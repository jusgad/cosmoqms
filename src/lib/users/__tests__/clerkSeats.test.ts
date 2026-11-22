import { describe, it, expect } from "vitest";
import { isMembershipQuotaError, seatsLeft } from "../clerkSeats";

describe("Clerk organization seats", () => {
  it("recognizes Clerk's membership quota error and nothing else", () => {
    expect(isMembershipQuotaError({ errors: [{ code: "organization_membership_quota_exceeded" }] })).toBe(true);
    expect(isMembershipQuotaError({ errors: [{ code: "form_identifier_exists" }] })).toBe(false);
    expect(isMembershipQuotaError(new Error("quota"))).toBe(false);
    expect(isMembershipQuotaError(null)).toBe(false);
  });

  it("counts the seats left, never below zero, and treats 0 as no limit", () => {
    expect(seatsLeft({ used: 3, max: 5 })).toBe(2);
    expect(seatsLeft({ used: 5, max: 5 })).toBe(0);
    expect(seatsLeft({ used: 6, max: 5 })).toBe(0);
    expect(seatsLeft({ used: 9, max: 0 })).toBeNull();
  });
});
