import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { advanceStageInternal } from "@/lib/trpc/router/production";

// Review round 1 fix (Critical Finding 2): restricted to the one offline
// event type this route currently supports, with its payload validated
// against the same fields `recordWeighingInput` (Task 10) requires — never
// `z.string()`/`z.unknown()`. Every tRPC mutation that writes a `BatchEvent`
// is validated and role-gated (`recordWeighing`, `sign`); this generic
// ingestion point must not become a way to spoof an event type (e.g.
// `"signature"`, `"qc_check"`) that has its own dedicated, reauth/validated
// mutation. Add a new `z.literal(...)` branch here only when a genuinely new
// event type gains its own offline-capture flow, together with its own
// payload schema and stage-advance handling below.
const weighingPayloadSchema = z.object({
  rawMaterialLotId: z.string().uuid(),
  theoreticalQty: z.number().positive(),
  actualQty: z.number().positive(),
});

const eventSchema = z.object({
  clientEventId: z.string().uuid(),
  productionOrderId: z.string().uuid(),
  eventType: z.literal("weighing"),
  payload: weighingPayloadSchema,
  occurredAt: z.string(),
  deviceId: z.string(),
});
const bodySchema = z.object({ events: z.array(eventSchema) });

const PRISMA_UNIQUE_VIOLATION = "P2002";

// Review round 1 fix (Critical Finding 2): matches `production.recordWeighing`'s
// own role gate — the only mutation this route's `weighing` event type
// mirrors. `getCurrentUser()` alone (the brief's literal Step 9 code) let
// ANY authenticated tenant member of ANY role post an event, bypassing every
// role restriction the equivalent tRPC mutations enforce.
const OFFLINE_CAPTURE_ROLES = ["operario", "jefe_planta"] as const;

type SyncStatus = "accepted" | "duplicate";

// Review round 1 fix (Critical Finding 1): a multi-ingredient formula's
// `WeighingForm` queues one `weighing` event per ingredient, all against the
// SAME production order (`pesaje/page.tsx` renders one form per ingredient).
// Only the first one is a genuine `planificado -> pesado` transition; every
// subsequent one finds the order already at `pesado` (or later), where
// `canTransition` is correctly `false` and `advanceStageInternal` throws
// `BAD_REQUEST`. That is expected, not a failure — a redundant transition
// must be a silent no-op, never an error. It's caught here (rather than
// pre-checked with an extra `findUniqueOrThrow`) because
// `advanceStageInternal` already re-reads the order's current status itself;
// duplicating that read here would just be a second round trip to the same
// answer. `CONFLICT` (the TOCTOU guard from Task 9/11 — another concurrent
// sync/mutation call won the race and advanced the order first) is the same
// "already advanced" outcome and is treated the same way.
async function tryAdvanceToPesado(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  try {
    await advanceStageInternal(tx, orderId, "pesado");
  } catch (err) {
    if (err instanceof TRPCError && (err.code === "BAD_REQUEST" || err.code === "CONFLICT")) return;
    throw err;
  }
}

// Architecture-gap resolution (Option A — see task-14-report.md): this is
// the single entry point for offline-capturable events and, per the
// blueprint, must run under the same state machine as tRPC mutations.
// `production.recordWeighing` (Task 10) does two things atomically in one
// transaction — create the `BatchEvent` and call `advanceStageInternal` to
// `pesado` — so a `weighing` event synced through here must do the same, or
// an offline-captured weighing would forever leave its order stuck in
// `planificado`.
//
// Non-negotiable (CLAUDE.md rule 1): `batch_events` stays append-only —
// this only ever calls `tx.batchEvent.create`, never `update`/`delete`.
// Non-negotiable (CLAUDE.md rule 6): duplicates (retried `clientEventId`s)
// must be ignored, never applied twice — that now also means never calling
// `advanceStageInternal` twice for the same logical event. The brief's
// literal `createMany({ skipDuplicates: true })` can't support this: its
// return value is only a total insert count, with no way to tell which
// individual input rows were skipped. So this iterates with individual
// `tx.batchEvent.create` calls, and treats a `P2002` unique-constraint
// violation on `client_event_id` as "a duplicate retry — skip the side
// effect, report status duplicate" rather than surfacing it as an error.
//
// Review round 1 fix (Critical Finding 1): each event now commits in its OWN
// `withTenant` transaction, not one shared transaction for the whole batch.
// A shared transaction meant one event's rejection (e.g. the redundant
// stage-advance above, before it was made a silent no-op) rolled back every
// other event in the same sync call's otherwise-successful writes —
// `sync-engine.ts` would then see the whole POST fail, mark nothing as
// pushed, and resend the identical failing batch forever: a permanent,
// silent deadlock. Per-event transactions mean one event's outcome (success,
// duplicate, or a genuine unexpected error) never affects another event's
// durability.
export async function POST(req: Request) {
  let user;
  try {
    user = await requireRole([...OFFLINE_CAPTURE_ROLES]);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ success: false }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ success: false }, { status: 403 });
    throw err;
  }

  const parsed = bodySchema.parse(await req.json());
  const currentUser = user;

  const results: { clientEventId: string; status: SyncStatus }[] = [];

  for (const event of parsed.events) {
    const status = await withTenant(currentUser.tenantId, async (tx): Promise<SyncStatus> => {
      let isNew = true;
      try {
        await tx.batchEvent.create({
          data: {
            tenantId: currentUser.tenantId,
            productionOrderId: event.productionOrderId,
            eventType: event.eventType,
            payload: event.payload,
            actorUserId: currentUser.id,
            occurredAt: new Date(event.occurredAt),
            clientEventId: event.clientEventId,
            deviceId: event.deviceId,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_VIOLATION) {
          isNew = false;
        } else {
          throw err;
        }
      }

      if (isNew) {
        await tryAdvanceToPesado(tx, event.productionOrderId);
      }

      return isNew ? "accepted" : "duplicate";
    });

    results.push({ clientEventId: event.clientEventId, status });
  }

  return NextResponse.json({ success: true, results });
}
