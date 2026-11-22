import { NextResponse } from "next/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { listUsers } from "@/lib/users/admin";
import { accessReviewCsv, buildAccessReview } from "@/lib/users/accessReview";
import { loadSignIns } from "@/lib/users/clerkSignIns";

// CSV evidence of the periodic access review (administrator only).
export async function GET() {
  let user;
  try {
    user = await requireRole(["admin"]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ success: false }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ success: false }, { status: 403 });
    throw err;
  }

  const [users, organization, me] = await withTenant(user.tenantId, user.id, (tx) =>
    Promise.all([
      listUsers(tx, user.tenantId),
      tx.organization.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
      tx.user.findFirst({ where: { id: user.id, tenantId: user.tenantId }, select: { fullName: true } }),
    ]),
  );
  const { signIns } = await loadSignIns(users.map((row) => row.id));
  const generatedAt = new Date();
  const csv = accessReviewCsv(buildAccessReview(users, signIns, generatedAt), {
    orgName: organization?.name ?? "CosmoQMS",
    generatedAt,
    generatedBy: me?.fullName ?? user.id,
  });
  const day = generatedAt.toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revision-accesos-${day}.csv"`,
    },
  });
}
