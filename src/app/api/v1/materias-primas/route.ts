import { NextResponse } from "next/server";
import { authorize, parseJsonBody, restError } from "@/lib/api/rest";
import { withTenant } from "@/lib/db";
import { createRawMaterial } from "@/lib/materials/catalog";
import { rawMaterialInput } from "@/lib/validation/materials";

// REST view of the raw-material catalog (same rules as `materials.list` /
// `materials.create` in tRPC). Read: everyone who works with materials;
// write: bodega and admin.
const READ_ROLES = ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"] as const;
const WRITE_ROLES = ["bodega", "admin"] as const;

export async function GET() {
  const user = await authorize([...READ_ROLES]);
  if (user instanceof NextResponse) return user;

  const materials = await withTenant(user.tenantId, user.id, (tx) =>
    tx.rawMaterial.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } }),
  );
  return NextResponse.json({ data: materials, total: materials.length });
}

export async function POST(req: Request) {
  const user = await authorize([...WRITE_ROLES]);
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(req, rawMaterialInput);
  if ("response" in body) return body.response;

  try {
    const material = await withTenant(user.tenantId, user.id, (tx) => createRawMaterial(tx, user.tenantId, body.data));
    return NextResponse.json({ data: material }, { status: 201, headers: { Location: `/api/v1/materias-primas/${material.id}` } });
  } catch (error) {
    return restError(error);
  }
}
