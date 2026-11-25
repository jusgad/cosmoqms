import type { Role } from "@prisma/client";

// What each role can DO, written for people (the /roles screen and the user
// manual). It documents the checks the server already enforces in each tRPC
// procedure / REST route — it does not grant anything by itself. When a
// procedure's roles change, update the matching line here (the test in
// src/lib/roles/__tests__ keeps the module list honest).

// Same labels as the user-administration screen.
export { ROLE_LABELS } from "@/lib/validation/users";

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  jefe_planta: "Crea fórmulas y órdenes; en planta pesa, firma pesado, mezclado y envasado, y reporta desviaciones.",
  bodega: "Mantiene el catálogo, recibe lotes de materia prima y los deja en cuarentena.",
  calidad: "Libera materia prima, define especificaciones, registra QC, investiga desviaciones y redacta SOPs.",
  director_tecnico: "Responsable ante el INVIMA: libera o rechaza lotes y aprueba desviaciones y SOPs.",
  admin: "Gestiona usuarios, roles y datos de la empresa. Supervisa todos los módulos en solo lectura y no firma.",
};

export const ROLE_ORDER: Role[] = ["jefe_planta", "bodega", "calidad", "director_tecnico", "admin"];

export type Capability = { action: string; roles: Role[] };
export type CapabilityGroup = { module: string; capabilities: Capability[] };

export const CAPABILITIES: CapabilityGroup[] = [
  {
    module: "Materias primas",
    capabilities: [
      { action: "Ver lotes y catálogo", roles: ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"] },
      { action: "Mantener el catálogo de materias primas", roles: ["bodega"] },
      { action: "Recibir lote (con QR del proveedor) y adjuntar COA", roles: ["bodega"] },
      { action: "Liberar o rechazar lote en cuarentena", roles: ["bodega", "calidad"] },
      { action: "Imprimir etiqueta con QR del lote", roles: ["bodega", "calidad"] },
    ],
  },
  {
    module: "Fórmulas",
    capabilities: [
      { action: "Ver fórmulas y especificaciones", roles: ["jefe_planta", "calidad", "director_tecnico", "admin"] },
      { action: "Crear fórmula o nueva versión", roles: ["jefe_planta"] },
      { action: "Definir especificaciones de calidad", roles: ["calidad"] },
      { action: "Activar fórmula (100 % ± 0,5 %)", roles: ["calidad"] },
    ],
  },
  {
    module: "Producción",
    capabilities: [
      { action: "Ver órdenes y batch record", roles: ["jefe_planta", "calidad", "director_tecnico", "admin"] },
      { action: "Crear orden de producción", roles: ["jefe_planta"] },
      { action: "Registrar pesaje (también sin internet)", roles: ["jefe_planta"] },
      { action: "Firmar etapas de pesado, mezclado y envasado", roles: ["jefe_planta"] },
      { action: "Reportar desviación", roles: ["jefe_planta", "calidad"] },
      { action: "Descargar batch record en PDF", roles: ["calidad", "director_tecnico", "admin"] },
    ],
  },
  {
    module: "Calidad",
    capabilities: [
      { action: "Registrar resultados de QC", roles: ["calidad"] },
      { action: "Firmar la etapa de calidad", roles: ["calidad"] },
      { action: "Investigar desviación y proponer CAPA", roles: ["calidad"] },
      { action: "Aprobar y cerrar desviación", roles: ["director_tecnico"] },
      { action: "Liberar o rechazar el lote terminado", roles: ["director_tecnico"] },
    ],
  },
  {
    module: "Trazabilidad, reportes y SOPs",
    capabilities: [
      { action: "Consultar trazabilidad y reporte BPM", roles: ["calidad", "director_tecnico", "admin"] },
      { action: "Leer SOPs vigentes", roles: ["jefe_planta", "bodega", "calidad", "director_tecnico", "admin"] },
      { action: "Confirmar lectura de un SOP", roles: ["jefe_planta", "bodega", "calidad", "director_tecnico"] },
      { action: "Redactar SOP o nueva versión", roles: ["calidad", "director_tecnico"] },
      { action: "Aprobar SOP como vigente", roles: ["director_tecnico"] },
    ],
  },
  {
    module: "Administración",
    capabilities: [
      { action: "Consultar la auditoría y exportarla", roles: ["director_tecnico", "admin"] },
      { action: "Asignar roles, desactivar y reactivar usuarios", roles: ["admin"] },
      { action: "Revisión periódica de accesos", roles: ["admin"] },
      { action: "Datos de la empresa (razón social, NIT, INVIMA)", roles: ["admin"] },
    ],
  },
];
