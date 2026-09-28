import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "u1", orgId: "org1" }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: async () => ({ id: "u1", tenantId: "org1", role: "operario", active: true }) },
  },
}));

import { requireRole, ForbiddenError } from "@/lib/auth";

describe("requireRole", () => {
  it("throws ForbiddenError when the user's role isn't in the allow-list", async () => {
    await expect(requireRole(["director_tecnico"])).rejects.toBeInstanceOf(ForbiddenError);
  });
});
