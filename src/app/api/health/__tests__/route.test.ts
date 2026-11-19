import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ up: true }));
const queryRaw = vi.hoisted(() =>
  vi.fn(async () => {
    if (!db.up) throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret");
    return [{ "?column?": 1 }];
  }),
);
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRaw } }));

const reportError = vi.hoisted(() => vi.fn((error: unknown, context: Record<string, string>) => void [error, context]));
vi.mock("@/lib/observability", () => ({ reportError }));

import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.up = true;
  });

  it("is 200 with the database check when Postgres answers", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", database: "ok" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is 503 when Postgres is down, and leaks no connection details", async () => {
    db.up = false;
    const response = await GET();
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(503);
    expect(body).not.toContain("10.0.0.5");
    expect(body).not.toContain("secret");
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "health.database" });
  });
});
