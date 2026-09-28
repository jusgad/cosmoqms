import { describe, it, expect, vi } from "vitest";
import type { Prisma, RawMaterialLot } from "@prisma/client";

type CreateArgs = Prisma.RawMaterialLotCreateArgs;

const create = vi.fn(async (args: CreateArgs): Promise<RawMaterialLot> => {
  return {
    ...(args.data as unknown as RawMaterialLot),
    id: "lot-1",
  };
});

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ rawMaterialLot: { create } }),
}));

import { materialsRouter } from "../materials";

describe("materials.receiveLot", () => {
  it("accepts a lot with no supplierProvidedCode and still generates an internal qrCode", async () => {
    const caller = materialsRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "bodega" },
      prisma: {} as never,
    });
    const result = await caller.receiveLot({
      rawMaterialId: "550e8400-e29b-41d4-a716-446655440000",
      supplierLotCode: "SUP-123",
      quantityReceived: 25,
      expiryDate: "2027-01-01",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "cuarentena", qrCode: expect.any(String) }),
      }),
    );
    expect(result.id).toBe("lot-1");
  });
});
