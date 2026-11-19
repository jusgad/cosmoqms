import { describe, expect, it } from "vitest";
import { isDemoMode, isLocalAppUrl } from "@/lib/demoMode";

describe("isLocalAppUrl", () => {
  it("accepts an unset URL and loopback hosts", () => {
    expect(isLocalAppUrl(undefined)).toBe(true);
    expect(isLocalAppUrl("http://localhost:3001")).toBe(true);
    expect(isLocalAppUrl("https://127.0.0.1")).toBe(true);
    expect(isLocalAppUrl("http://[::1]:3000")).toBe(true);
  });

  it("rejects real domains, look-alikes and garbage", () => {
    expect(isLocalAppUrl("https://cosmoqms.vercel.app")).toBe(false);
    expect(isLocalAppUrl("https://localhost.evil.com")).toBe(false);
    expect(isLocalAppUrl("no es una url")).toBe(false);
  });
});

describe("isDemoMode", () => {
  it("is off unless DEMO_MODE is exactly 'true'", () => {
    expect(isDemoMode({ NODE_ENV: "production" })).toBe(false);
    expect(isDemoMode({ NODE_ENV: "production", DEMO_MODE: "1" })).toBe(false);
  });

  it("is on with DEMO_MODE=true on a local app URL", () => {
    expect(isDemoMode({ NODE_ENV: "production", DEMO_MODE: "true", NEXT_PUBLIC_APP_URL: "http://localhost:3001" })).toBe(true);
  });

  it("stays off on a real domain even with DEMO_MODE=true", () => {
    expect(
      isDemoMode({ NODE_ENV: "production", DEMO_MODE: "true", NEXT_PUBLIC_APP_URL: "https://qms.laboratorio.com" }),
    ).toBe(false);
  });
});
