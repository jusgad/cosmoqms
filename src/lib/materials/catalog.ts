import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { RawMaterialInput, RawMaterialUpdateInput } from "@/lib/validation/materials";

// Raw-material catalog maintenance, shared by `materials` tRPC procedures and
// the REST API. Every function runs inside the caller's `withTenant`
// transaction and filters by `tenantId` explicitly (defense in depth until
// RLS is live). Not a regulated table (CLAUDE.md rule 2), so no audit row.

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function duplicateCode(code: string | undefined): TRPCError {
  return new TRPCError({
    code: "CONFLICT",
    message: `Ya existe una materia prima con el código '${code ?? ""}'`,
  });
}

export async function createRawMaterial(tx: Prisma.TransactionClient, tenantId: string, input: RawMaterialInput) {
  try {
    return await tx.rawMaterial.create({ data: { ...input, tenantId } });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(input.code);
    throw error;
  }
}

export async function getRawMaterial(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const material = await tx.rawMaterial.findFirst({ where: { id, tenantId } });
  if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "Materia prima no encontrada" });
  return material;
}

export async function updateRawMaterial(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  input: RawMaterialUpdateInput,
) {
  await getRawMaterial(tx, tenantId, id);
  try {
    const { count } = await tx.rawMaterial.updateMany({ where: { id, tenantId }, data: input });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Materia prima no encontrada" });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(input.code);
    throw error;
  }
  return getRawMaterial(tx, tenantId, id);
}

// A material that was ever received (has lots) or appears in a formula is
// part of the batch-record history and must stay; only an unused catalog
// entry (e.g. a typo) can be deleted.
export async function deleteRawMaterial(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const material = await getRawMaterial(tx, tenantId, id);
  const [lots, ingredients] = await Promise.all([
    tx.rawMaterialLot.count({ where: { tenantId, rawMaterialId: id } }),
    tx.formulaIngredient.count({ where: { rawMaterialId: id, formula: { tenantId } } }),
  ]);
  if (lots > 0 || ingredients > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `No se puede eliminar '${material.code}': tiene ${lots} lote(s) recibido(s) y está en ${ingredients} fórmula(s)`,
    });
  }
  await tx.rawMaterial.deleteMany({ where: { id, tenantId } });
  return material;
}
