import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { advanceStageInternal } from "@/lib/trpc/router/production";

const eventSchema = z.object({
  clientEventId: z.string().uuid(),
  productionOrderId: z.string().uuid(),
  eventType: z.string(),
  payload: z.unknown(),
  occurredAt: z.string(),
  deviceId: z.string(),
});
const bodySchema = z.object({ events: z.array(eventSchema) });

const PRISMA_UNIQUE_VIOLATION = "P2002";

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
// `tx.batchEvent.create` calls per event, in the same transaction, and
// treats a `P2002` unique-constraint violation on `client_event_id` as "a
// duplicate retry — skip the side effect, report status duplicate" rather
// than surfacing it as an error (matching the "never error destructively on
// a legitimate retry" rule the brief's own commentary calls out).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  const parsed = bodySchema.parse(await req.json());

  const results = await withTenant(user.tenantId, async (tx) => {
    const out: { clientEventId: string; status: "accepted" | "duplicate" }[] = [];

    for (const event of parsed.events) {
      let isNew = true;
      try {
        await tx.batchEvent.create({
          data: {
            tenantId: user.tenantId,
            productionOrderId: event.productionOrderId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            actorUserId: user.id,
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

      if (isNew && event.eventType === "weighing") {
        await advanceStageInternal(tx, event.productionOrderId, "pesado");
      }

      out.push({ clientEventId: event.clientEventId, status: isNew ? "accepted" : "duplicate" });
    }

    return out;
  });

  return NextResponse.json({ success: true, results });
}
