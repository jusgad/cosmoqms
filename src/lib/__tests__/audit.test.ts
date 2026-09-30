import { describe, it, expect } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { withAuditLog } from "../audit";

// Zero-`any` precedent (Tasks 6-16): the brief's literal test used `any`
// throughout (`created: any[]`, `args: any`, fake prisma cast `as any`) — this
// adapts it to the same "type against the real shape, narrow with `unknown`
// where the shape is generic" approach used in every prior router test.
type AuditLogCreateArgs = Prisma.AuditLogCreateArgs;

type AllOperationsParams = {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
};

// `withAuditLog(prisma, ...).client` is `prisma.$extends(...)`'s return value
// (cast to `PrismaClient` — same unavoidable cast the real implementation
// uses, documented in `audit.ts`). In this fake, `$extends` just returns the
// config object unchanged, so `.query.$allModels.$allOperations` reaches the
// hook directly.
function getAllOperations(client: PrismaClient): (params: AllOperationsParams) => Promise<unknown> {
  return (
    client as unknown as {
      query: { $allModels: { $allOperations: (params: AllOperationsParams) => Promise<unknown> } };
    }
  ).query.$allModels.$allOperations;
}

function fakePrisma(created: AuditLogCreateArgs["data"][]): PrismaClient {
  return {
    $extends: (config: unknown) => config,
    auditLog: { create: async (args: AuditLogCreateArgs) => created.push(args.data) },
  } as unknown as PrismaClient;
}

describe("withAuditLog", () => {
  it("writes an audit_log row for every write on a regulated model", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = fakePrisma(created);
    const { client } = withAuditLog(basePrisma, "actor-1", "tenant-1");
    const query = getAllOperations(client);

    await query({
      model: "ProductionOrder",
      operation: "update",
      args: { where: { id: "po1" }, data: { status: "pesado" } },
      query: async (args: Record<string, unknown>) => ({
        id: "po1",
        status: (args.data as { status: string }).status,
      }),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tableName: "ProductionOrder",
      action: "update",
      actorUserId: "actor-1",
      tenantId: "tenant-1",
      recordId: "po1",
    });
  });

  it("does not audit reads or non-regulated models", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = fakePrisma(created);
    const { client } = withAuditLog(basePrisma, "actor-1", "tenant-1");
    const query = getAllOperations(client);

    await query({ model: "RawMaterial", operation: "findMany", args: {}, query: async () => [] });
    expect(created).toHaveLength(0);
  });

  it("falls back to the where-clause id when the result has no id (e.g. updateMany)", async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = fakePrisma(created);
    const { client } = withAuditLog(basePrisma, "actor-1", "tenant-1");
    const query = getAllOperations(client);

    await query({
      model: "Deviation",
      operation: "updateMany",
      args: { where: { id: "dev1", status: "abierta" }, data: { status: "en_investigacion" } },
      query: async () => ({ count: 1 }),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tableName: "Deviation", action: "updateMany", recordId: "dev1" });
  });

  it('records recordId as "unknown" when neither the result nor the where clause carries an id', async () => {
    const created: AuditLogCreateArgs["data"][] = [];
    const basePrisma = fakePrisma(created);
    const { client } = withAuditLog(basePrisma, "actor-1", "tenant-1");
    const query = getAllOperations(client);

    await query({
      model: "QcResult",
      operation: "createMany",
      args: { data: [{ result: "pass" }] },
      query: async () => ({ count: 1 }),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tableName: "QcResult", action: "createMany", recordId: "unknown" });
  });

  // Review round 2 regression test: an earlier version of `withAuditLog`
  // wrote `auditLog.create` through the `prisma` parameter it closed over at
  // `withAuditLog(prisma, ...)`'s call time — which, once `db.ts` started
  // extending `prisma` BEFORE opening the transaction (round 1's fix),
  // permanently pointed at the plain, non-transactional top-level client,
  // never the active `tx`. This test is specifically designed to catch that
  // class of bug: it gives the outer `prisma` parameter and the "active
  // transaction client" passed to `bindTransactionClient` two DISTINCT,
  // independently-tracked `auditLog.create` spies, so it can assert not just
  // "a create call happened" (a call-count assertion can't tell which client
  // it went through) but specifically that it happened via the bound
  // transaction client and NOT via the original outer `prisma`.
  it("routes the audit write through the bound transaction client, not the original outer client", async () => {
    const outerCreated: AuditLogCreateArgs["data"][] = [];
    const txCreated: AuditLogCreateArgs["data"][] = [];

    const outerPrisma = fakePrisma(outerCreated);
    const txClient = { auditLog: { create: async (args: AuditLogCreateArgs) => txCreated.push(args.data) } } as unknown as PrismaClient;

    const { client, bindTransactionClient } = withAuditLog(outerPrisma, "actor-1", "tenant-1");
    const query = getAllOperations(client);

    // Simulate `db.ts`'s `withTenant`: bind the real tx client before any
    // regulated-model write runs.
    bindTransactionClient(txClient);

    await query({
      model: "ProductionOrder",
      operation: "update",
      args: { where: { id: "po1" }, data: { status: "pesado" } },
      query: async () => ({ id: "po1", status: "pesado" }),
    });

    expect(txCreated).toHaveLength(1);
    expect(txCreated[0]).toMatchObject({ tableName: "ProductionOrder", recordId: "po1" });
    // The crux of the round-1-regression this guards against: the write must
    // NOT have gone through the outer, non-transactional client.
    expect(outerCreated).toHaveLength(0);
  });

  it("writes through the original outer client when bindTransactionClient was never called", async () => {
    const outerCreated: AuditLogCreateArgs["data"][] = [];
    const basePrisma = fakePrisma(outerCreated);
    const { client } = withAuditLog(basePrisma, "actor-1", "tenant-1");
    const query = getAllOperations(client);

    await query({
      model: "ProductionOrder",
      operation: "update",
      args: { where: { id: "po1" }, data: { status: "pesado" } },
      query: async () => ({ id: "po1", status: "pesado" }),
    });

    expect(outerCreated).toHaveLength(1);
  });
});
