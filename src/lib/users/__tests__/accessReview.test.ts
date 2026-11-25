import { describe, it, expect } from "vitest";
import { accessReviewCsv, buildAccessReview, type ReviewUser } from "../accessReview";

const NOW = new Date("2026-11-22T15:00:00.000Z");
const base: ReviewUser = { id: "u1", fullName: "Ana", email: "ana@lab.co", role: "bodega", active: true, mfaEnabled: true };

describe("buildAccessReview", () => {
  it("has no findings for an active user with MFA who signed in recently", () => {
    const [row] = buildAccessReview([base], new Map([["u1", { lastSignInAt: new Date("2026-11-20"), twoFactorEnabled: true }]]), NOW);
    expect(row.findings).toEqual([]);
    expect(row.roleLabel).toBe("Bodega");
  });

  it("flags missing MFA, never signed in and long inactivity", () => {
    const rows = buildAccessReview(
      [
        { ...base, id: "a", mfaEnabled: false },
        { ...base, id: "b" },
        { ...base, id: "c" },
      ],
      new Map([
        ["a", { lastSignInAt: new Date("2026-11-20"), twoFactorEnabled: false }],
        ["b", { lastSignInAt: null, twoFactorEnabled: true }],
        ["c", { lastSignInAt: new Date("2026-05-01"), twoFactorEnabled: true }],
      ]),
      NOW,
    );
    expect(rows[0].findings).toContain("Sin MFA");
    expect(rows[1].findings).toContain("Nunca ha ingresado");
    expect(rows[2].findings).toContain("Sin ingresar hace más de 90 días");
  });

  it("calls out an administrator without MFA and ignores deactivated accounts", () => {
    const rows = buildAccessReview(
      [
        { ...base, id: "adm", role: "admin", mfaEnabled: false },
        { ...base, id: "old", active: false, mfaEnabled: false },
      ],
      new Map(),
      NOW,
    );
    expect(rows[0].findings).toContain("Administrador sin MFA");
    expect(rows[1].findings).toEqual([]);
  });

  it("falls back to the stored MFA flag when Clerk is not available", () => {
    const [row] = buildAccessReview([{ ...base, mfaEnabled: true }], new Map(), NOW);
    expect(row.mfa).toBe(true);
    expect(row.findings).toEqual([]);
  });
});

describe("accessReviewCsv", () => {
  it("writes a header, one line per account and escapes separators", () => {
    const rows = buildAccessReview([{ ...base, fullName: 'Ana; "la jefa"' }], new Map(), NOW);
    const csv = accessReviewCsv(rows, { orgName: "CosmoLab", generatedAt: NOW, generatedBy: "Admin" });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Nombre;Correo;Rol;Estado;MFA;Último ingreso;Hallazgos");
    expect(csv).toContain('"Ana; ""la jefa"""');
  });
});
