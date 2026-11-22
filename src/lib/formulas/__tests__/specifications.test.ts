import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { addSpecification, removeSpecification } from "../specifications";
import { qcSpecificationInput } from "@/lib/validation/formulas";

const FORMULA_ID = "550e8400-e29b-41d4-a716-446655440000";
const SPEC_ID = "550e8400-e29b-41d4-a716-446655440002";

let formula: { id: string; status: string } | null;
let existing: { parameter: string }[];
let spec: { id: string; formula: { status: string } } | null;

const formulaFindFirst = vi.fn(async () => formula);
const specFindMany = vi.fn(async () => existing);
const specFindFirst = vi.fn(async () => spec);
const specCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: SPEC_ID, ...args.data }));
const specDeleteMany = vi.fn(async () => ({ count: 1 }));

const tx = {
  masterFormula: { findFirst: formulaFindFirst },
  qcSpecification: { findMany: specFindMany, findFirst: specFindFirst, create: specCreate, deleteMany: specDeleteMany },
} as unknown as Prisma.TransactionClient;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const err = await promise.then(() => undefined).catch((e: unknown) => e);
  return err instanceof TRPCError ? err.code : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  formula = { id: FORMULA_ID, status: "draft" };
  existing = [];
  spec = { id: SPEC_ID, formula: { status: "draft" } };
});

describe("qcSpecificationInput", () => {
  it("accepts a closed range and a one-sided limit", () => {
    expect(qcSpecificationInput.safeParse({ formulaId: FORMULA_ID, parameter: "pH", minValue: 5.5, maxValue: 7 }).success).toBe(true);
    expect(
      qcSpecificationInput.safeParse({ formulaId: FORMULA_ID, parameter: "Viscosidad", minValue: 8000, unit: "cP" }).success,
    ).toBe(true);
  });

  it("rejects a spec without bounds or with an inverted range", () => {
    expect(qcSpecificationInput.safeParse({ formulaId: FORMULA_ID, parameter: "pH" }).success).toBe(false);
    const inverted = qcSpecificationInput.safeParse({ formulaId: FORMULA_ID, parameter: "pH", minValue: 8, maxValue: 6 });
    expect(inverted.success).toBe(false);
    expect(inverted.error?.issues[0]?.message).toMatch(/mínimo no puede ser mayor/);
  });

  it("rejects an empty parameter", () => {
    expect(qcSpecificationInput.safeParse({ formulaId: FORMULA_ID, parameter: "  ", minValue: 1 }).success).toBe(false);
  });
});

describe("addSpecification", () => {
  it("creates the spec on a draft formula of the tenant", async () => {
    await addSpecification(tx, "t1", { formulaId: FORMULA_ID, parameter: "pH", minValue: 5.5, maxValue: 7 });
    expect(formulaFindFirst).toHaveBeenCalledWith({ where: { id: FORMULA_ID, tenantId: "t1" } });
    expect(specCreate).toHaveBeenCalledWith({
      data: { tenantId: "t1", formulaId: FORMULA_ID, parameter: "pH", minValue: 5.5, maxValue: 7, unit: null },
    });
  });

  it("treats a formula outside the tenant as NOT_FOUND", async () => {
    formula = null;
    expect(await codeOf(addSpecification(tx, "t1", { formulaId: FORMULA_ID, parameter: "pH", minValue: 1 }))).toBe("NOT_FOUND");
    expect(specCreate).not.toHaveBeenCalled();
  });

  it.each(["active", "archived"])("refuses to change the specs of a formula that is '%s'", async (status) => {
    formula = { id: FORMULA_ID, status };
    expect(await codeOf(addSpecification(tx, "t1", { formulaId: FORMULA_ID, parameter: "pH", minValue: 1 }))).toBe(
      "BAD_REQUEST",
    );
    expect(specCreate).not.toHaveBeenCalled();
  });

  it("refuses a second spec for the same parameter, ignoring case and spaces", async () => {
    existing = [{ parameter: "pH" }];
    expect(await codeOf(addSpecification(tx, "t1", { formulaId: FORMULA_ID, parameter: " PH ", minValue: 1 }))).toBe(
      "CONFLICT",
    );
    expect(specCreate).not.toHaveBeenCalled();
  });
});

describe("removeSpecification", () => {
  it("deletes a spec of a draft formula, scoped to the tenant", async () => {
    await removeSpecification(tx, "t1", SPEC_ID);
    expect(specFindFirst).toHaveBeenCalledWith({ where: { id: SPEC_ID, tenantId: "t1" }, include: { formula: true } });
    expect(specDeleteMany).toHaveBeenCalledWith({ where: { id: SPEC_ID, tenantId: "t1" } });
  });

  it("refuses to remove a spec once the formula is active", async () => {
    spec = { id: SPEC_ID, formula: { status: "active" } };
    expect(await codeOf(removeSpecification(tx, "t1", SPEC_ID))).toBe("BAD_REQUEST");
    expect(specDeleteMany).not.toHaveBeenCalled();
  });

  it("treats a spec outside the tenant as NOT_FOUND", async () => {
    spec = null;
    expect(await codeOf(removeSpecification(tx, "t1", SPEC_ID))).toBe("NOT_FOUND");
  });
});
