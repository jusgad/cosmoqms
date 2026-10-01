import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// Final-review fix (Critical 1 follow-up): `generateOrderNumber` now counts
// through the caller's transaction client (so the count runs under the same
// `withTenant` tenant context as the insert), instead of the module-level
// `prisma` import — the mock is therefore a plain stand-in `tx`, no
// `vi.mock("@/lib/db")` needed any more.
import { generateOrderNumber } from "../generateOrderNumber";

function fakeTx(count: () => Promise<number>): Prisma.TransactionClient {
  return { productionOrder: { count } } as unknown as Prisma.TransactionClient;
}

describe("generateOrderNumber", () => {
  it("pads the consecutive to 3 digits under the current year prefix", async () => {
    const count = vi.fn(async () => 4);
    const year = new Date().getFullYear();
    await expect(generateOrderNumber(fakeTx(count), "tenant-1")).resolves.toBe(`OP-${year}-005`);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1" }) }),
    );
  });

  // Critical 1 regression: numbering is per tenant, so a brand-new tenant's
  // first order is `-001` even when another tenant already has orders — this
  // is only safe because the schema's uniqueness is now
  // `@@unique([tenantId, orderNumber])`, not a global `@unique`.
  it("starts a new tenant at 001 regardless of other tenants' orders", async () => {
    const count = vi.fn(async () => 0);
    const year = new Date().getFullYear();
    await expect(generateOrderNumber(fakeTx(count), "tenant-2")).resolves.toBe(`OP-${year}-001`);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-2" }) }),
    );
  });
});
