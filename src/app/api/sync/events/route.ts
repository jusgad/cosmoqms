import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { applyWeighing } from "@/lib/production/weighing";

// Review round 1 fix (Task 14, Critical Finding 2): restricted to the one
// offline event type this route supports, with its payload validated against
// the same fields `recordWeighingInput` requires. This generic ingestion
// point must not become a way to spoof an event type (e.g. `"signature"`)
// that has its own dedicated, reauth-validated mutation. Add a new
// `z.literal(...)` branch only together with its own payload schema and
// server-side handling.
const weighingPayloadSchema = z.object({
  rawMaterialLotId: z.string().uuid(),
  // Accepted for wire compatibility with queued events, but never persisted:
  // `applyWeighing` recomputes it from the server's formula/order rows.
  theoreticalQty: z.number().positive(),
  actualQty: z.number().positive(),
});

const eventSchema = z.object({
  clientEventId: z.string().uuid(),
  productionOrderId: z.string().uuid(),
  eventType: z.literal("weighing"),
  payload: weighingPayloadSchema,
  occurredAt: z.string().datetime(),
  deviceId: z.string(),
});
const bodySchema = z.object({ events: z.array(eventSchema) });

const PRISMA_UNIQUE_VIOLATION = "P2002";

// Matches `production.recordWeighing`'s own role gate (Task 14 review round 1).
const OFFLINE_CAPTURE_ROLES = ["operario", "jefe_planta"] as const;

// Final-review fix (Important 7a): a business-rule rejection of ONE event
// (order already past its weighing phase — including a released/rejected,
// closed batch — lot not `liberado`/expired/not in the formula, insufficient
// stock, or an order/lot that doesn't exist for this tenant) is a permanent,
// per-event outcome. It is reported back as `rejected` with the reason so
// `sync-engine.ts` marks exactly that event failed (visible in
// `OfflineIndicator`) instead of (a) the old behaviour of silently appending
// it to a closed batch record, or (b) failing the whole request and making
// the device retry forever.
const REJECTABLE_CODES = new Set<TRPCError["code"]>(["BAD_REQUEST", "NOT_FOUND"]);

type SyncResult =
  | { clientEventId: string; status: "accepted" | "duplicate" }
  | { clientEventId: string; status: "rejected"; reason: string };

function badRequest(error: string, issues?: z.core.$ZodIssue[]) {
  return NextResponse.json({ success: false, error, ...(issues ? { issues } : {}) }, { status: 400 });
}

// Architecture (Task 14, Option A): this is the single entry point for
// offline-captured events and runs under the same state machine and the
// same validation as the tRPC mutations — both paths call `applyWeighing`
// (lib/production/weighing.ts), which validates the order/lot, recomputes
// `theoreticalQty`, decrements the lot's stock and advances `planificado ->
// pesado` on the first weighing, all in one transaction.
//
// Non-negotiable (CLAUDE.md rules 1 and 6): `batch_events` stays append-only,
// and a retried `clientEventId` is reported as `duplicate` with NO side
// effects (no second stock decrement, no second stage advance). The
// duplicate check runs first inside the event's transaction; a concurrent
// insert racing past it still hits the `client_event_id` unique constraint
// (P2002), which rolls the whole transaction back — including the stock
// decrement — and is reported as `duplicate` too.
//
// Each event commits in its OWN `withTenant` transaction (Task 14 review
// round 1, Critical 1), so one event's outcome never affects another's.
export async function POST(req: Request) {
  let user;
  try {
    user = await requireRole([...OFFLINE_CAPTURE_ROLES]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ success: false }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ success: false }, { status: 403 });
    throw err;
  }

  // Final-review fix (Important 7b): a malformed body is a permanent client
  // error, never a transient one. An uncaught ZodError/SyntaxError used to
  // surface as a 500, which `sync-engine.ts` (correctly) treats as "server
  // hiccup, retry later" — so the device retried the same invalid batch
  // forever, deadlocking its queue. Both now return a 400 with a clear body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("El cuerpo de la solicitud no es JSON válido");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("Eventos inválidos", parsed.error.issues);
  }

  const currentUser = user;
  const results: SyncResult[] = [];

  for (const event of parsed.data.events) {
    try {
      const status = await withTenant(currentUser.tenantId, currentUser.id, async (tx) => {
        const existing = await tx.batchEvent.findFirst({
          where: { tenantId: currentUser.tenantId, clientEventId: event.clientEventId },
          select: { id: true },
        });
        if (existing) return "duplicate" as const;

        await applyWeighing(tx, {
          tenantId: currentUser.tenantId,
          actorUserId: currentUser.id,
          productionOrderId: event.productionOrderId,
          rawMaterialLotId: event.payload.rawMaterialLotId,
          actualQty: event.payload.actualQty,
          clientEventId: event.clientEventId,
          occurredAt: new Date(event.occurredAt),
          deviceId: event.deviceId,
        });
        return "accepted" as const;
      });
      results.push({ clientEventId: event.clientEventId, status });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_VIOLATION) {
        results.push({ clientEventId: event.clientEventId, status: "duplicate" });
      } else if (err instanceof TRPCError && REJECTABLE_CODES.has(err.code)) {
        results.push({ clientEventId: event.clientEventId, status: "rejected", reason: err.message });
      } else {
        // Genuinely unexpected/server-side (DB unreachable, a lost
        // stage-advance race that still needs a retry, ...) — surfaces as a
        // 5xx so the device keeps the event pending and retries later.
        throw err;
      }
    }
  }

  return NextResponse.json({ success: true, results });
}
