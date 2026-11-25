import { describe, it, expect, vi, beforeEach } from "vitest";

type SopRow = {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  version: number;
  status: "borrador" | "vigente" | "obsoleto";
};

const SOP_ID = "550e8400-e29b-41d4-a716-446655440000";
const OLD_ID = "550e8400-e29b-41d4-a716-446655440001";

let rows: SopRow[];
let attachments: number;
let reverified: boolean;
let acks: { sopId: string; userId: string }[];

const auditCreate = vi.fn(async (args: unknown) => args);
const executeRaw = vi.fn(async () => 1);

function matches(row: SopRow, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

const sop = {
  findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    rows.filter((row) => matches(row, where)).sort((a, b) => b.version - a.version),
  ),
  findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null),
  create: vi.fn(async ({ data }: { data: Omit<SopRow, "id" | "status"> }) => {
    const row: SopRow = { id: "new-sop", status: "borrador", ...data };
    rows.push(row);
    return row;
  }),
  updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<SopRow> }) => {
    const hit = rows.filter((row) => matches(row, where));
    hit.forEach((row) => Object.assign(row, data));
    return { count: hit.length };
  }),
};

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({
      sop,
      attachment: { count: vi.fn(async () => attachments) },
      auditLog: { create: auditCreate },
      $executeRaw: executeRaw,
      sopAcknowledgment: {
        findFirst: vi.fn(async ({ where }: { where: { sopId: string; userId: string } }) =>
          acks.find((ack) => ack.sopId === where.sopId && ack.userId === where.userId) ?? null,
        ),
        create: vi.fn(async ({ data }: { data: { sopId: string; userId: string } }) => {
          acks.push(data);
          return data;
        }),
      },
    }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ has: () => reverified }),
}));

import { sopsRouter } from "../sops";
import { SOP_APPROVAL_MEANING_STATEMENT } from "@/lib/validation/sops";

type Role = "bodega" | "calidad" | "director_tecnico" | "admin";
const caller = (role: Role) => sopsRouter.createCaller({ user: { id: `u-${role}`, tenantId: "t1", role }, prisma: {} as never });

const approval = {
  id: SOP_ID,
  effectiveDate: "2026-12-01",
  reviewDue: "2028-12-01",
  meaningStatement: SOP_APPROVAL_MEANING_STATEMENT,
  reauthVerified: true,
} as const;

describe("sops router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [
      { id: OLD_ID, tenantId: "t1", code: "SOP-LIM-001", title: "Limpieza", version: 1, status: "vigente" },
      { id: SOP_ID, tenantId: "t1", code: "SOP-LIM-001", title: "Limpieza", version: 2, status: "borrador" },
    ];
    attachments = 1;
    reverified = true;
    acks = [];
  });

  it("only the quality unit drafts, only the director approves, admin only reads", async () => {
    await expect(caller("bodega").create({ code: "SOP-X", title: "Nuevo" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("calidad").approve(approval)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Supervision mode: the administrator reads SOPs but never drafts,
    // approves or records a training acknowledgement.
    const adminRead = await caller("admin")
      .list()
      .then(() => "ok")
      .catch((error: { code?: string }) => error.code);
    expect(adminRead).not.toBe("FORBIDDEN");
    await expect(caller("admin").create({ code: "SOP-X", title: "Nuevo" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("admin").acknowledge({ id: OLD_ID })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a new code starts at version 1 and is audited", async () => {
    const created = await caller("calidad").create({ code: "sop-alm-002", title: "Almacenamiento" });
    expect(created).toMatchObject({ code: "SOP-ALM-002", version: 1, status: "borrador", createdBy: "u-calidad" });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ tableName: "Sop", action: "create" }) });
  });

  it("refuses a second draft of the same code", async () => {
    await expect(caller("calidad").create({ code: "SOP-LIM-001", title: "Otra" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("the next version of an existing code gets max + 1", async () => {
    rows = rows.filter((row) => row.status !== "borrador");
    const created = await caller("director_tecnico").create({ code: "SOP-LIM-001", title: "Limpieza", changeSummary: "Nuevo agente" });
    expect(created.version).toBe(2);
  });

  it("approving makes the draft vigente and the previous version obsoleto, both audited", async () => {
    const approved = await caller("director_tecnico").approve(approval);
    expect(approved).toMatchObject({ id: SOP_ID, status: "vigente", approvedBy: "u-director_tecnico" });
    expect(rows.find((row) => row.id === OLD_ID)?.status).toBe("obsoleto");
    expect(executeRaw).toHaveBeenCalled();
    const actions = auditCreate.mock.calls.map((call) => (call[0] as { data: { action: string } }).data.action);
    expect(actions).toEqual(["obsolete", "approve"]);
  });

  it("approval requires a fresh Clerk re-verification, not the client flag", async () => {
    reverified = false;
    await expect(caller("director_tecnico").approve(approval)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(rows.find((row) => row.id === SOP_ID)?.status).toBe("borrador");
  });

  it("approval requires an attached document and a review date after the effective date", async () => {
    attachments = 0;
    await expect(caller("director_tecnico").approve(approval)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    attachments = 1;
    await expect(caller("director_tecnico").approve({ ...approval, reviewDue: "2026-11-30" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("only a draft can be approved", async () => {
    await expect(caller("director_tecnico").approve({ ...approval, id: OLD_ID })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("acknowledging is only for the vigente version and is idempotent", async () => {
    await expect(caller("bodega").acknowledge({ id: SOP_ID })).rejects.toMatchObject({ code: "CONFLICT" });
    await caller("bodega").acknowledge({ id: OLD_ID });
    await caller("bodega").acknowledge({ id: OLD_ID });
    expect(acks).toEqual([{ sopId: OLD_ID, userId: "u-bodega" }]);
  });

  it("a SOP from another tenant is not found", async () => {
    rows = rows.map((row) => ({ ...row, tenantId: "otro" }));
    await expect(caller("bodega").acknowledge({ id: OLD_ID })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
