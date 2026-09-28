import { describe, it, expect, vi, beforeEach } from "vitest";

const executed: { sql: string; values: unknown[] }[] = [];
const fakeTx = {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
    executed.push({ sql: strings.join("?"), values });
    return Promise.resolve(1);
  },
};

const transactionMock = vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
  fn(fakeTx),
);

class FakePrismaClient {
  $transaction = transactionMock;
}

vi.mock("@prisma/client", () => ({
  PrismaClient: FakePrismaClient,
  Prisma: {},
}));

describe("withTenant", () => {
  beforeEach(() => {
    executed.length = 0;
    transactionMock.mockClear();
  });

  it("sets app.current_tenant_id before running the callback", async () => {
    const { withTenant } = await import("@/lib/db");

    const result = await withTenant("tenant-123", async (tx) => {
      expect(tx).toBe(fakeTx);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain("set_config");
    expect(executed[0].values).toContain("tenant-123");
  });

  it("throws when tenantId is empty and never opens a transaction", async () => {
    const { withTenant } = await import("@/lib/db");

    await expect(withTenant("", async () => "ok")).rejects.toThrow(
      "tenantId is required",
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
