import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createRawMaterial, deleteRawMaterial, updateRawMaterial } from "../catalog";

const MATERIAL = { id: "m1", tenantId: "t1", code: "MP-010", name: "Pantenol", unit: "kg", category: null };

let existing: typeof MATERIAL | null = MATERIAL;
let lots = 0;
let ingredients = 0;
let failWith: Error | null = null;

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6.19.3" });

const tx = {
  rawMaterial: {
    create: vi.fn(async (args: Prisma.RawMaterialCreateArgs) => {
      if (failWith) throw failWith;
      return { id: "new", ...args.data };
    }),
    findFirst: vi.fn(async () => existing),
    updateMany: vi.fn(async () => {
      if (failWith) throw failWith;
      return { count: 1 };
    }),
    deleteMany: vi.fn(async () => ({ count: 1 })),
  },
  rawMaterialLot: { count: vi.fn(async () => lots) },
  formulaIngredient: { count: vi.fn(async () => ingredients) },
};
const client = tx as unknown as Prisma.TransactionClient;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.then(() => undefined).catch((e: unknown) => e);
  return error instanceof TRPCError ? error.code : undefined;
}

describe("raw-material catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existing = MATERIAL;
    lots = 0;
    ingredients = 0;
    failWith = null;
  });

  it("creates the material inside the caller's tenant", async () => {
    await createRawMaterial(client, "t1", { code: "MP-010", name: "Pantenol", unit: "kg" });
    expect(tx.rawMaterial.create).toHaveBeenCalledWith({ data: { code: "MP-010", name: "Pantenol", unit: "kg", tenantId: "t1" } });
  });

  it("turns a duplicate code into CONFLICT on create and on update", async () => {
    failWith = uniqueViolation();
    expect(await codeOf(createRawMaterial(client, "t1", { code: "MP-010", name: "X", unit: "kg" }))).toBe("CONFLICT");
    expect(await codeOf(updateRawMaterial(client, "t1", "m1", { code: "MP-001" }))).toBe("CONFLICT");
  });

  it("updates only within the tenant and returns the fresh row", async () => {
    const updated = await updateRawMaterial(client, "t1", "m1", { name: "D-Pantenol" });
    expect(tx.rawMaterial.updateMany).toHaveBeenCalledWith({ where: { id: "m1", tenantId: "t1" }, data: { name: "D-Pantenol" } });
    expect(updated).toEqual(MATERIAL);
  });

  it("is NOT_FOUND for a material outside the tenant", async () => {
    existing = null;
    expect(await codeOf(updateRawMaterial(client, "t1", "m1", { name: "x" }))).toBe("NOT_FOUND");
    expect(await codeOf(deleteRawMaterial(client, "t1", "m1"))).toBe("NOT_FOUND");
    expect(tx.rawMaterial.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an unused catalog entry", async () => {
    await deleteRawMaterial(client, "t1", "m1");
    expect(tx.rawMaterial.deleteMany).toHaveBeenCalledWith({ where: { id: "m1", tenantId: "t1" } });
  });

  it.each([
    [2, 0],
    [0, 1],
  ])("refuses to delete a material with %s lot(s) and %s formula use(s)", async (lotCount, ingredientCount) => {
    lots = lotCount;
    ingredients = ingredientCount;
    expect(await codeOf(deleteRawMaterial(client, "t1", "m1"))).toBe("CONFLICT");
    expect(tx.rawMaterial.deleteMany).not.toHaveBeenCalled();
  });
});
