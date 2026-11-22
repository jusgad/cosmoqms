import { NextResponse } from "next/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { renderBatchRecordHtml, renderPdf } from "@/lib/pdf";
import { loadBatchRecord } from "@/lib/batchRecord";

// Read-only endpoint, but still routed through `withTenant` (not a plain
// `prisma` call) per the codebase's established pattern — RLS is enforced by
// the `set_config('app.current_tenant_id', ...)` that `withTenant` issues
// inside its transaction, and that must run before ANY query against a
// regulated table, reads included.
//
// Review round 1 fix (task 18): the `where` clause also filters explicitly
// by `tenantId` as defense-in-depth, matching `traceability.ts`'s explicit
// rationale (every regulated query filters by `tenantId` even though
// `withTenant`'s `SET LOCAL` already scopes it and the RLS policies of
// db/rls.sql enforce it again in the database: two independent walls) and
// `deviations.ts`'s
// `updateMany` guards. This matters more here than most routes: a PDF export
// endpoint returning raw bytes of a regulated legal document, trivially
// probed by id, is exactly the case defense-in-depth exists for.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole(["calidad", "director_tecnico", "admin"]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ success: false }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ success: false }, { status: 403 });
    throw err;
  }

  const { id } = await params;

  // loadBatchRecord filters by tenantId explicitly (defense in depth on top
  // of RLS) and resolves user ids to names for the printed document.
  let batchRecord;
  try {
    batchRecord = await withTenant(user.tenantId, user.id, (tx) => loadBatchRecord(tx, user.tenantId, id, user.id));
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") return NextResponse.json({ success: false }, { status: 404 });
    throw err;
  }

  const html = renderBatchRecordHtml(batchRecord);
  const pdf = await renderPdf(html);

  // `Buffer` isn't directly assignable to the DOM `BodyInit` type
  // `NextResponse` expects; a plain `Uint8Array` view over the same bytes is.
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="batch-record-${batchRecord.orderNumber}.pdf"`,
    },
  });
}
