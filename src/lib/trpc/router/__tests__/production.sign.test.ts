import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

// Zero-`any` precedent (Tasks 6-10): mocks are typed against the actual
// Prisma delegate call shapes rather than using `any`. `withTenant`'s `fn`
// parameter is typed `unknown` (matching production.recordWeighing.test.ts)
// since the mock `tx` below is a partial stand-in, not a real
// `Prisma.TransactionClient`.
type SignatureCreateArgs = Prisma.BatchSignatureCreateArgs;
type EventCreateArgs = Prisma.BatchEventCreateArgs;
type OrderUpdateArgs = Prisma.ProductionOrderUpdateArgs;

const batchSignatureCreate = vi.fn(async (args: SignatureCreateArgs) => ({ id: "sig1", ...args.data }));
const batchEventCreate = vi.fn(async (args: EventCreateArgs) => ({ id: "ev1", ...args.data }));
const findUniqueOrThrow = vi.fn(async () => ({ id: "po1", status: "pesado" as const }));
const update = vi.fn(async (args: OrderUpdateArgs) => ({ id: "po1", status: args.data.status }));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      batchSignature: { create: batchSignatureCreate },
      batchEvent: { create: batchEventCreate },
      productionOrder: { findUniqueOrThrow, update },
    }),
}));

import { productionRouter } from "../production";
import { TRPCError } from "@trpc/server";

describe("production.sign", () => {
  // `vi.clearAllMocks()` (not `resetAllMocks`) so call history is wiped
  // between tests while the `vi.fn(async () => ...)` implementations above
  // (needed by every test) stay intact.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when reauthVerified is false", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "operario" },
      prisma: {} as never,
    });
    await expect(
      caller.sign({
        productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
        stage: "pesado",
        meaningStatement: "Confirmo el pesaje",
        reauthVerified: false as unknown as true,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects an empty meaningStatement even if reauthVerified is true", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "operario" },
      prisma: {} as never,
    });
    await expect(
      caller.sign({
        productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
        stage: "pesado",
        meaningStatement: "",
        reauthVerified: true,
      }),
    ).rejects.toThrow();
  });

  // Covers the advance-stage decision documented in production.ts: signing
  // off the order's *current* stage records the signature, appends a
  // `signature` BatchEvent (so EventTimeline reflects it), and advances the
  // order to the state machine's next stage.
  it("records the signature, appends a signature event, and advances 'pesado' -> 'mezclado'", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "operario" },
      prisma: {} as never,
    });

    await caller.sign({
      productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
      stage: "pesado",
      meaningStatement: "Confirmo el pesaje realizado",
      reauthVerified: true,
    });

    expect(batchSignatureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stage: "pesado",
          signedBy: "u1",
          reauthVerified: true,
          meaningStatement: "Confirmo el pesaje realizado",
        }),
      }),
    );
    expect(batchEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "signature" }) }),
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "mezclado" } }));
  });

  // Never trusts the client's reported `stage` over the order's actual
  // server-side status (CLAUDE.md rule 7's state-machine principle, applied
  // to signatures too).
  it("rejects when the input stage doesn't match the order's actual status", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "operario" },
      prisma: {} as never,
    });

    await expect(
      caller.sign({
        productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
        stage: "mezclado",
        meaningStatement: "Confirmo el mezclado realizado",
        reauthVerified: true,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(batchSignatureCreate).not.toHaveBeenCalled();
  });
});
