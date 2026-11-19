import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, parseJsonBody, restError } from "@/lib/api/rest";
import { withTenant } from "@/lib/db";
import { deleteRawMaterial, getRawMaterial, updateRawMaterial } from "@/lib/materials/catalog";
import { rawMaterialUpdateInput } from "@/lib/validation/materials";

const READ_ROLES = ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"] as const;
const WRITE_ROLES = ["bodega", "admin"] as const;

type Params = { params: Promise<{ id: string }> };

async function materialId({ params }: Params): Promise<string | null> {
  const { id } = await params;
  return z.string().uuid().safeParse(id).success ? id : null;
}

const notFound = () => NextResponse.json({ error: "Materia prima no encontrada" }, { status: 404 });

export async function GET(_req: Request, context: Params) {
  const user = await authorize([...READ_ROLES]);
  if (user instanceof NextResponse) return user;
  const id = await materialId(context);
  if (!id) return notFound();

  try {
    const material = await withTenant(user.tenantId, user.id, (tx) => getRawMaterial(tx, user.tenantId, id));
    return NextResponse.json({ data: material });
  } catch (error) {
    return restError(error);
  }
}

export async function PATCH(req: Request, context: Params) {
  const user = await authorize([...WRITE_ROLES]);
  if (user instanceof NextResponse) return user;
  const id = await materialId(context);
  if (!id) return notFound();

  const body = await parseJsonBody(req, rawMaterialUpdateInput);
  if ("response" in body) return body.response;

  try {
    const material = await withTenant(user.tenantId, user.id, (tx) => updateRawMaterial(tx, user.tenantId, id, body.data));
    return NextResponse.json({ data: material });
  } catch (error) {
    return restError(error);
  }
}

export async function DELETE(_req: Request, context: Params) {
  const user = await authorize([...WRITE_ROLES]);
  if (user instanceof NextResponse) return user;
  const id = await materialId(context);
  if (!id) return notFound();

  try {
    const material = await withTenant(user.tenantId, user.id, (tx) => deleteRawMaterial(tx, user.tenantId, id));
    return NextResponse.json({ data: material, deleted: true });
  } catch (error) {
    return restError(error);
  }
}
