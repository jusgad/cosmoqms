import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";

// GET-only reference-data endpoint the offline UI caches so `WeighingForm`
// can render its lot/formula pickers with no network (Serwist's
// `NetworkFirst` strategy for this route, configured in `app/sw.ts`, falls
// back to this cached response when offline). `?since=` is accepted for a
// future incremental-refresh optimization but both queries are cheap enough
// to always return the full current set for now — never trusting anything
// from the client to scope the tenant, only `withTenant(user.tenantId, ...)`.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  // Reserved for a future incremental sync; unused today but parsed so a
  // malformed value fails loudly instead of being silently ignored forever.
  searchParams.get("since");

  const [activeFormulas, availableLots] = await withTenant(user.tenantId, (tx) =>
    Promise.all([
      tx.masterFormula.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
      tx.rawMaterialLot.findMany({
        where: { status: "liberado", quantityAvailable: { gt: 0 } },
        include: { rawMaterial: true },
        orderBy: { receivedAt: "asc" },
      }),
    ]),
  );

  return NextResponse.json({ activeFormulas, availableLots });
}
