import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  archiveOtherActiveVersions,
  createNewVersion,
  removeIngredient,
  updateIngredientPercentage,
} from "../versioning";

type Source = {
  id: string;
  code: string;
  name: string;
  productType: string | null;
  version: number;
  status: string;
  ingredients: { rawMaterialId: string; percentage: number; orderIndex: number }[];
  qcSpecifications: { parameter: string; minValue: number | null; maxValue: number | null; unit: string | null }[];
};

let source: Source | null;
let existingDraft: { version: number } | null;
let latest: { version: number } | null;
let ingredient: { id: string; formula: { status: string } } | null;

const findFirst = vi.fn(async (args: { where: Record<string, unknown>; orderBy?: unknown }) => {
  if (args.where.id) return source;
  if (args.where.status === "draft") return existingDraft;
  return latest;
});
const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "new-id", ...args.data }));
const updateMany = vi.fn(async () => ({ count: 1 }));
const specCreate = vi.fn(async () => ({}));
const ingredientFindFirst = vi.fn(async () => ingredient);
const ingredientUpdate = vi.fn(async () => ({ id: "ing-1" }));
const ingredientDelete = vi.fn(async () => ({ id: "ing-1" }));

const tx = {
  masterFormula: { findFirst, create, updateMany },
  qcSpecification: { create: specCreate },
  formulaIngredient: { findFirst: ingredientFindFirst, update: ingredientUpdate, delete: ingredientDelete },
} as unknown as Prisma.TransactionClient;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const err = await promise.then(() => undefined).catch((e: unknown) => e);
  return err instanceof TRPCError ? err.code : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  source = {
    id: "f1",
    code: "F-001",
    name: "Crema",
    productType: "crema",
    version: 1,
    status: "active",
    ingredients: [
      { rawMaterialId: "m1", percentage: 70, orderIndex: 0 },
      { rawMaterialId: "m2", percentage: 30, orderIndex: 1 },
    ],
    qcSpecifications: [{ parameter: "pH", minValue: 5.5, maxValue: 7, unit: null }],
  };
  existingDraft = null;
  latest = { version: 1 };
  ingredient = { id: "ing-1", formula: { status: "draft" } };
});

describe("createNewVersion", () => {
  it("copies ingredients and specifications into a draft with the next version", async () => {
    const created = await createNewVersion(tx, "t1", "f1");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "f1", tenantId: "t1" } }));
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        code: "F-001",
        version: 2,
        status: "draft",
        ingredients: { create: [expect.objectContaining({ rawMaterialId: "m1", percentage: 70 }), expect.objectContaining({ rawMaterialId: "m2" })] },
      }),
    });
    expect(specCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ formulaId: "new-id", parameter: "pH", tenantId: "t1" }) });
    expect(created.id).toBe("new-id");
  });

  it("numbers after the highest existing version, not after the source", async () => {
    latest = { version: 4 };
    await createNewVersion(tx, "t1", "f1");
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: 5 }) });
  });

  it("only branches from the active version", async () => {
    source = { ...source!, status: "archived" };
    expect(await codeOf(createNewVersion(tx, "t1", "f1"))).toBe("BAD_REQUEST");
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a second open draft for the same code", async () => {
    existingDraft = { version: 2 };
    expect(await codeOf(createNewVersion(tx, "t1", "f1"))).toBe("CONFLICT");
  });

  it("treats a formula outside the tenant as NOT_FOUND", async () => {
    source = null;
    expect(await codeOf(createNewVersion(tx, "t1", "f1"))).toBe("NOT_FOUND");
  });
});

describe("archiveOtherActiveVersions", () => {
  it("archives every other active version of the same code in the tenant", async () => {
    await archiveOtherActiveVersions(tx, "t1", { id: "f2", code: "F-001" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", code: "F-001", status: "active", id: { not: "f2" } },
      data: { status: "archived" },
    });
  });
});

describe("draft ingredient edits", () => {
  it("updates and removes ingredients of a draft, scoped to the tenant", async () => {
    await updateIngredientPercentage(tx, "t1", "ing-1", 65);
    expect(ingredientFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ing-1", formula: { tenantId: "t1" } } }));
    expect(ingredientUpdate).toHaveBeenCalledWith({ where: { id: "ing-1" }, data: { percentage: 65 } });
    await removeIngredient(tx, "t1", "ing-1");
    expect(ingredientDelete).toHaveBeenCalledWith({ where: { id: "ing-1" } });
  });

  it("refuses to edit an active formula's ingredients", async () => {
    ingredient = { id: "ing-1", formula: { status: "active" } };
    expect(await codeOf(updateIngredientPercentage(tx, "t1", "ing-1", 65))).toBe("BAD_REQUEST");
    expect(await codeOf(removeIngredient(tx, "t1", "ing-1"))).toBe("BAD_REQUEST");
    expect(ingredientUpdate).not.toHaveBeenCalled();
    expect(ingredientDelete).not.toHaveBeenCalled();
  });
});
