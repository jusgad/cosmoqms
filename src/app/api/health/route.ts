import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/observability";

// Public liveness/readiness probe for Docker's healthcheck and uptime
// monitors. It touches no tenant data (a bare `SELECT 1`), so it runs outside
// `withTenant`, and on failure it reveals nothing beyond "down".
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    reportError(error, { area: "health.database" });
    return NextResponse.json(
      { status: "error", database: "unreachable", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
