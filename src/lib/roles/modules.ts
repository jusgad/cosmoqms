import type { Role } from "@prisma/client";

// Single source of truth for which roles may OPEN each module — used by the
// page gates (src/lib/pageAccess.ts), the menu (Sidebar.tsx) and the
// /roles screen. Plain module (no server imports) so the Client Component
// menu can use it too. Opening a module never implies acting in it: every
// action has its own role check, here in the UI and again on the server.
//
// `admin` opens every module in SUPERVISION mode (read-only). Separation of
// duties (BPM / INVIMA): the person who administers the system never weighs,
// signs, releases or approves anything — those procedures do not list admin.
export const ALL_ROLES: Role[] = ["jefe_planta", "calidad", "director_tecnico", "bodega", "admin"];

export const READ_ONLY_ROLES: readonly Role[] = ["admin"];

export const MODULE_ROLES = {
  dashboard: ALL_ROLES,
  materiasPrimas: ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"],
  formulas: ["jefe_planta", "calidad", "director_tecnico", "admin"],
  produccion: ["jefe_planta", "calidad", "director_tecnico", "admin"],
  calidad: ["calidad", "director_tecnico", "admin"],
  // Deviations are reported from the floor (jefe_planta) and the
  // reporter lands on the detail page — same roles as deviationsRouter.list.
  desviaciones: ["calidad", "director_tecnico", "jefe_planta", "admin"],
  trazabilidad: ["calidad", "director_tecnico", "admin"],
  reportes: ["calidad", "director_tecnico", "admin"],
  sops: ["jefe_planta", "calidad", "director_tecnico", "bodega", "admin"],
  auditoria: ["director_tecnico", "admin"],
  usuarios: ["admin"],
  roles: ["admin"],
  configuracion: ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type ModuleKey = keyof typeof MODULE_ROLES;

export function canOpen(module: ModuleKey, role: Role): boolean {
  return (MODULE_ROLES[module] as readonly Role[]).includes(role);
}

export function isReadOnly(role: Role): boolean {
  return READ_ONLY_ROLES.includes(role);
}
