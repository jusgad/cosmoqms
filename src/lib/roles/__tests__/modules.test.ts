import { describe, it, expect } from "vitest";
import { MODULE_ROLES, canOpen, isReadOnly } from "@/lib/roles/modules";
import { CAPABILITIES, ROLE_ORDER } from "@/lib/roles/permissions";

// Supervision mode (BPM separation of duties): the administrator opens every
// module but is never listed for an action that weighs, signs, releases or
// approves. These tests keep the /roles screen and the gates consistent.
describe("module access", () => {
  it("lets the administrator open every module in read-only mode", () => {
    for (const key of Object.keys(MODULE_ROLES) as (keyof typeof MODULE_ROLES)[]) {
      expect(canOpen(key, "admin")).toBe(true);
    }
    expect(isReadOnly("admin")).toBe(true);
    expect(isReadOnly("director_tecnico")).toBe(false);
  });

  it("keeps user and role administration to the administrator", () => {
    for (const role of ROLE_ORDER.filter((item) => item !== "admin")) {
      expect(canOpen("usuarios", role)).toBe(false);
      expect(canOpen("roles", role)).toBe(false);
      expect(canOpen("configuracion", role)).toBe(false);
    }
  });

  it("never shows the administrator as able to weigh, sign, release or approve", () => {
    const guarded = /\b(?:pesaje|firmar|liberar|aprobar|activar|registrar resultados|recibir|reportar)\b/i;
    const forAdmin = CAPABILITIES.flatMap((group) => group.capabilities).filter((capability) => capability.roles.includes("admin"));
    expect(forAdmin.filter((capability) => guarded.test(capability.action))).toEqual([]);
  });

  it("gives every role at least one action of its own", () => {
    const all = CAPABILITIES.flatMap((group) => group.capabilities);
    for (const role of ROLE_ORDER) {
      expect(all.some((capability) => capability.roles.includes(role))).toBe(true);
    }
  });
});
