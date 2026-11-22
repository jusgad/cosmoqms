import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";
import { QUICK_ACTIONS } from "../QuickActions";
import { canOpen, type ModuleKey } from "@/lib/roles/modules";

// Every quick action must open a screen the role can really use, so no
// dashboard button ever bounces the person back to the dashboard.
const MODULE_BY_PREFIX: [string, ModuleKey][] = [
  ["/materias-primas", "materiasPrimas"],
  ["/formulas", "formulas"],
  ["/produccion", "produccion"],
  ["/calidad/desviaciones", "desviaciones"],
  ["/calidad", "calidad"],
  ["/trazabilidad", "trazabilidad"],
  ["/reportes", "reportes"],
  ["/sops", "sops"],
  ["/auditoria", "auditoria"],
  ["/usuarios", "usuarios"],
  ["/roles", "roles"],
  ["/configuracion", "configuracion"],
];

// Creation screens are narrower than their module (they redirect any other role).
const CREATE_ROLES: Record<string, Role[]> = {
  "/materias-primas/nueva": ["bodega"],
  "/produccion/nueva": ["jefe_planta"],
  "/formulas/nueva": ["jefe_planta"],
};

describe("dashboard quick actions", () => {
  for (const [role, actions] of Object.entries(QUICK_ACTIONS) as [Role, (typeof QUICK_ACTIONS)[Role]][]) {
    it(`${role}: every action opens a screen the role can use`, () => {
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        const moduleKey = MODULE_BY_PREFIX.find(([prefix]) => action.href.startsWith(prefix))?.[1];
        expect(moduleKey, action.href).toBeDefined();
        expect(canOpen(moduleKey!, role), `${role} → ${action.href}`).toBe(true);
        const createRoles = CREATE_ROLES[action.href];
        if (createRoles) expect(createRoles).toContain(role);
      }
    });
  }

  it("never offers the administrator a creation screen", () => {
    expect(QUICK_ACTIONS.admin.some((action) => action.href in CREATE_ROLES)).toBe(false);
  });
});
