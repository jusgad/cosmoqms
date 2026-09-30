import { NextResponse } from "next/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { renderBatchRecordHtml, renderPdf, type BatchRecordOrder } from "@/lib/pdf";

// Read-only endpoint, but still routed through `withTenant` (not a plain
// `prisma` call) per the codebase's established pattern — RLS is enforced by
// the `set_config('app.current_tenant_id', ...)` that `withTenant` issues
// inside its transaction, and that must run before ANY query against a
// regulated table, reads included.
//
// Review round 1 fix (task 18): the `where` clause also filters explicitly
// by `tenantId` as defense-in-depth, matching `traceability.ts`'s explicit
// rationale (every regulated query filters by `tenantId` even though
// `withTenant`'s `SET LOCAL` already scopes it, because RLS policies don't
// exist yet in a live DB — Task 3 remains blocked — so the app-level filter
// is the only enforcement that actually runs today) and `deviations.ts`'s
// `updateMany` guards. This matters more here than most routes: a PDF export
// endpoint returning raw bytes of a regulated legal document, trivially
// probed by id, is exactly the case defense-in-depth exists for.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole(["calidad", "director_tecnico"]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ success: false }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ success: false }, { status: 403 });
    throw err;
  }

  const { id } = await params;

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findUniqueOrThrow({
      where: { id, tenantId: user.tenantId },
      include: { signatures: true, qcResults: true, events: true },
    }),
  );

  // Convert Prisma `Decimal`/`Date` values to plain `number`/`string` at this
  // boundary — same pattern as `qc.ts`'s `specsForFormula` — so `pdf.ts`
  // stays free of a Prisma dependency and its pure `renderBatchRecordHtml`
  // function is trivially unit-testable with a plain object fixture.
  const batchRecord: BatchRecordOrder = {
    orderNumber: order.orderNumber,
    status: order.status,
    signatures: order.signatures.map((s) => ({
      stage: s.stage,
      signedBy: s.signedBy,
      meaningStatement: s.meaningStatement,
      signedAt: s.signedAt.toISOString(),
    })),
    qcResults: order.qcResults.map((r) => ({
      parameter: r.parameter,
      measuredValue: Number(r.measuredValue),
      result: r.result,
    })),
    events: order.events.map((e) => ({
      eventType: e.eventType,
      occurredAt: e.occurredAt.toISOString(),
      actorUserId: e.actorUserId,
    })),
  };

  const html = renderBatchRecordHtml(batchRecord);
  const pdf = await renderPdf(html);

  // `Buffer` isn't directly assignable to the DOM `BodyInit` type
  // `NextResponse` expects; a plain `Uint8Array` view over the same bytes is.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="batch-record-${order.orderNumber}.pdf"`,
    },
  });
}
