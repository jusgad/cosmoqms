import { NextResponse } from "next/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { renderPdf } from "@/lib/pdf";
import { renderLotLabelHtml } from "@/lib/labels";

// Printable 100 x 70 mm label with the internal QR of a raw-material lot,
// for bodega (at receipt) and quality (after releasing or rejecting it, so
// the label on the drum shows the current status). Read-only; scoped to the
// caller's tenant explicitly on top of RLS.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole(["bodega", "calidad"]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ success: false }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ success: false }, { status: 403 });
    throw err;
  }

  const { id } = await params;
  const found = await withTenant(user.tenantId, user.id, (tx) =>
    Promise.all([
      tx.rawMaterialLot.findFirst({ where: { id, tenantId: user.tenantId }, include: { rawMaterial: true } }),
      tx.organization.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    ]),
  );
  const [lot, organization] = found;
  if (!lot || !lot.qrCode) return NextResponse.json({ success: false }, { status: 404 });

  const html = await renderLotLabelHtml({
    organizationName: organization?.name ?? "CosmoQMS",
    materialCode: lot.rawMaterial.code,
    materialName: lot.rawMaterial.name,
    supplierLotCode: lot.supplierLotCode,
    qrCode: lot.qrCode,
    status: lot.status,
    quantityReceived: `${Number(lot.quantityReceived)} ${lot.rawMaterial.unit}`,
    receivedAt: lot.receivedAt.toISOString(),
    expiryDate: lot.expiryDate.toISOString(),
  });
  const pdf = await renderPdf(html, { preferCSSPageSize: true });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiqueta-${lot.supplierLotCode}.pdf"`,
    },
  });
}
