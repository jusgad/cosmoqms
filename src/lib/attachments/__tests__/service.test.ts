import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma, Role } from "@prisma/client";
import type { FileStorage } from "@/lib/storage/storage";

type AttachmentCreateArgs = Prisma.AttachmentCreateArgs;

let lotInTenant: { id: string } | null = { id: "lot" };
let orderInTenant: { id: string } | null = { id: "order" };
let storedAttachment: { id: string; entityType: "raw_material_lot" | "production_order"; storageKey: string } | null =
  null;

const rawMaterialLotFindFirst = vi.fn(async () => lotInTenant);
const productionOrderFindFirst = vi.fn(async () => orderInTenant);
const attachmentCreate = vi.fn(async (args: AttachmentCreateArgs) => ({
  id: "att1",
  uploadedAt: new Date(),
  ...args.data,
}));
const attachmentFindFirst = vi.fn(async () => storedAttachment);

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({
      rawMaterialLot: { findFirst: rawMaterialLotFindFirst },
      productionOrder: { findFirst: productionOrderFindFirst },
      attachment: { create: attachmentCreate, findFirst: attachmentFindFirst },
    }),
}));

import { AttachmentError, readAttachment, uploadAttachment } from "../service";

const LOT_ID = "550e8400-e29b-41d4-a716-446655440000";
const PDF = new TextEncoder().encode("%PDF-1.7 certificado de analisis");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const user = (role: Role) => ({ id: "u1", tenantId: "t1", role });

function memoryStorage(): FileStorage & { put: ReturnType<typeof vi.fn> } {
  const files = new Map<string, Uint8Array>();
  return {
    put: vi.fn(async (key: string, bytes: Uint8Array) => {
      files.set(key, bytes);
    }),
    get: async (key: string) => {
      const found = files.get(key);
      if (!found) throw new Error("missing");
      return found;
    },
  };
}

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  const error = await promise.then(() => undefined).catch((e: unknown) => e);
  return error instanceof AttachmentError ? error.status : undefined;
}

describe("uploadAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lotInTenant = { id: LOT_ID };
    orderInTenant = { id: LOT_ID };
  });

  it("stores a COA under the tenant's prefix with the detected type", async () => {
    const storage = memoryStorage();
    const attachment = await uploadAttachment({
      user: user("bodega"),
      entityType: "raw_material_lot",
      entityId: LOT_ID,
      fileName: "COA Glicerina.pdf",
      bytes: PDF,
      storage,
    });

    expect(attachment).toMatchObject({ kind: "coa", mimeType: "application/pdf", fileName: "COA-Glicerina.pdf" });
    expect(attachment.storageKey).toMatch(new RegExp(`^t1/raw_material_lot/${LOT_ID}/[0-9a-f-]{36}-COA-Glicerina\\.pdf$`));
    expect(storage.put).toHaveBeenCalledWith(attachment.storageKey, PDF, "application/pdf");
    expect(rawMaterialLotFindFirst).toHaveBeenCalledWith({ where: { id: LOT_ID, tenantId: "t1" }, select: { id: true } });
  });

  it("classifies uploads on a production order as evidence", async () => {
    const attachment = await uploadAttachment({
      user: user("jefe_planta"),
      entityType: "production_order",
      entityId: LOT_ID,
      fileName: "mezcla.png",
      bytes: PNG,
      storage: memoryStorage(),
    });
    expect(attachment).toMatchObject({ kind: "evidencia", mimeType: "image/png" });
  });

  it("rejects a role that may not upload to that entity", async () => {
    const storage = memoryStorage();
    expect(
      await statusOf(
        uploadAttachment({ user: user("jefe_planta"), entityType: "raw_material_lot", entityId: LOT_ID, fileName: "a.pdf", bytes: PDF, storage }),
      ),
    ).toBe(403);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("rejects a file that is not really a PDF or image, whatever its name says", async () => {
    const storage = memoryStorage();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(
      await statusOf(
        uploadAttachment({ user: user("calidad"), entityType: "raw_material_lot", entityId: LOT_ID, fileName: "coa.pdf", bytes: html, storage }),
      ),
    ).toBe(415);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized files", async () => {
    const storage = memoryStorage();
    const base = { user: user("calidad"), entityType: "raw_material_lot" as const, entityId: LOT_ID, fileName: "x.pdf", storage };
    expect(await statusOf(uploadAttachment({ ...base, bytes: new Uint8Array() }))).toBe(400);
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    expect(await statusOf(uploadAttachment({ ...base, bytes: big }))).toBe(413);
  });

  it("rejects an entity outside the caller's tenant without writing the file", async () => {
    lotInTenant = null;
    const storage = memoryStorage();
    expect(
      await statusOf(
        uploadAttachment({ user: user("bodega"), entityType: "raw_material_lot", entityId: LOT_ID, fileName: "a.pdf", bytes: PDF, storage }),
      ),
    ).toBe(404);
    expect(storage.put).not.toHaveBeenCalled();
    expect(attachmentCreate).not.toHaveBeenCalled();
  });
});

describe("readAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedAttachment = null;
  });

  it("returns the bytes to a role allowed to view that entity", async () => {
    const storage = memoryStorage();
    await storage.put("t1/raw_material_lot/l/x-coa.pdf", PDF, "application/pdf");
    storedAttachment = { id: "att1", entityType: "raw_material_lot", storageKey: "t1/raw_material_lot/l/x-coa.pdf" };

    const { bytes } = await readAttachment({ user: user("director_tecnico"), id: "att1", storage });
    expect(bytes).toEqual(PDF);
    expect(attachmentFindFirst).toHaveBeenCalledWith({ where: { id: "att1", tenantId: "t1" } });
  });

  it("answers 404 both for unknown ids and for roles that may not see the entity", async () => {
    const storage = memoryStorage();
    expect(await statusOf(readAttachment({ user: user("calidad"), id: "nope", storage }))).toBe(404);

    storedAttachment = { id: "att1", entityType: "production_order", storageKey: "t1/x.pdf" };
    expect(await statusOf(readAttachment({ user: user("bodega"), id: "att1", storage }))).toBe(404);
  });
});
