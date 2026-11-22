import Link from "next/link";
import type { ComponentType } from "react";
import type { Role } from "@prisma/client";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  Factory,
  FileBarChart,
  FlaskConical,
  KeyRound,
  PackagePlus,
  Plus,
  Route,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

// Server Component: the main things each role does, one tap away from the
// dashboard. The links only point to screens the role can use; the pages and
// the server re-check the role anyway.
type Action = { label: string; href: string; icon: ComponentType<{ className?: string }>; primary?: boolean };

const ACTIONS: Record<Role, Action[]> = {
  bodega: [
    { label: "Recibir lote", href: "/materias-primas/nueva", icon: PackagePlus, primary: true },
    { label: "Lotes de materia prima", href: "/materias-primas", icon: Boxes },
    { label: "Catálogo", href: "/materias-primas/catalogo", icon: ClipboardList },
    { label: "SOPs", href: "/sops", icon: BookOpen },
  ],
  operario: [
    { label: "Órdenes de producción", href: "/produccion", icon: Scale, primary: true },
    { label: "SOPs por leer", href: "/sops", icon: BookOpen },
  ],
  jefe_planta: [
    { label: "Nueva orden", href: "/produccion/nueva", icon: Plus, primary: true },
    { label: "Tablero de producción", href: "/produccion", icon: Factory },
    { label: "Nueva fórmula", href: "/formulas/nueva", icon: FlaskConical },
    { label: "Lotes disponibles", href: "/materias-primas", icon: Boxes },
  ],
  calidad: [
    { label: "Control de calidad", href: "/calidad", icon: ShieldCheck, primary: true },
    { label: "Lotes en cuarentena", href: "/materias-primas", icon: Boxes },
    { label: "Desviaciones", href: "/calidad/desviaciones", icon: ShieldAlert },
    { label: "Fórmulas", href: "/formulas", icon: FlaskConical },
    { label: "Trazabilidad", href: "/trazabilidad", icon: Route },
  ],
  director_tecnico: [
    { label: "Lotes por liberar", href: "/produccion", icon: ShieldCheck, primary: true },
    { label: "Desviaciones por aprobar", href: "/calidad/desviaciones", icon: ShieldAlert },
    { label: "Reporte BPM", href: "/reportes", icon: FileBarChart },
    { label: "SOPs", href: "/sops", icon: BookOpen },
    { label: "Auditoría", href: "/auditoria", icon: ClipboardList },
  ],
  admin: [
    { label: "Usuarios y roles", href: "/usuarios", icon: Users, primary: true },
    { label: "Revisión de accesos", href: "/usuarios/revision", icon: UserCheck },
    { label: "Roles y permisos", href: "/roles", icon: KeyRound },
    { label: "Auditoría", href: "/auditoria", icon: ClipboardList },
    { label: "Configuración", href: "/configuracion", icon: Settings },
  ],
};

export function QuickActions({ role }: { role: Role }) {
  return (
    <nav aria-label="Acciones rápidas" className="flex flex-wrap gap-2">
      {ACTIONS[role].map(({ label, href, icon: Icon, primary }) => (
        <Link
          key={href + label}
          href={href}
          className={
            primary
              ? "inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              : "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export const QUICK_ACTIONS = ACTIONS;
