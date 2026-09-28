"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Boxes,
  FlaskConical,
  Factory,
  ShieldCheck,
  Route,
  BookOpen,
  ClipboardList,
  Users,
  Settings,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

const ALL_ROLES: Role[] = [
  "operario",
  "jefe_planta",
  "calidad",
  "director_tecnico",
  "bodega",
  "admin",
];

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
};

/**
 * Role -> nav visibility, per Blueprint Section 8 ("Roles & Permissions"):
 * - Dashboard: visible to every authenticated role.
 * - Materias Primas: bodega (recibir/gestionar MP, su trabajo completo),
 *   jefe_planta (planear ordenes requiere ver lotes de MP disponibles),
 *   calidad + director_tecnico (contexto de trazabilidad/QC).
 * - Formulas: jefe_planta (programa ordenes), calidad + director_tecnico
 *   (especificaciones QC atadas a la formula).
 * - Produccion: jefe_planta, operario (captura su etapa), calidad
 *   (puntos criticos), director_tecnico (libera lote). NUNCA admin ni bodega.
 * - Calidad: calidad + director_tecnico unicamente (registrar QC, desviaciones).
 * - Trazabilidad: calidad + director_tecnico (ven trazabilidad completa).
 * - SOPs: todos los roles de planta (operario, jefe_planta, calidad,
 *   director_tecnico, bodega) — acuse de SOP no esta restringido por rol en
 *   el blueprint. Admin no opera en planta, se excluye.
 * - Auditoria: director_tecnico ("exportar auditoria") + admin (gestion/
 *   configuracion incluye supervision de auditoria).
 * - Usuarios / Configuracion: admin unicamente, separacion de funciones —
 *   admin NUNCA ve Produccion ni Calidad (no firma lotes).
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  {
    href: "/materias-primas",
    label: "Materias Primas",
    icon: Boxes,
    roles: ["bodega", "jefe_planta", "calidad", "director_tecnico"],
  },
  {
    href: "/formulas",
    label: "Fórmulas",
    icon: FlaskConical,
    roles: ["jefe_planta", "calidad", "director_tecnico"],
  },
  {
    href: "/produccion",
    label: "Producción",
    icon: Factory,
    roles: ["jefe_planta", "operario", "calidad", "director_tecnico"],
  },
  {
    href: "/calidad",
    label: "Calidad",
    icon: ShieldCheck,
    roles: ["calidad", "director_tecnico"],
  },
  {
    href: "/trazabilidad",
    label: "Trazabilidad",
    icon: Route,
    roles: ["calidad", "director_tecnico"],
  },
  {
    href: "/sops",
    label: "SOPs",
    icon: BookOpen,
    roles: ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega"],
  },
  {
    href: "/auditoria",
    label: "Auditoría",
    icon: ClipboardList,
    roles: ["director_tecnico", "admin"],
  },
  { href: "/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
];

/**
 * Client Component: needs `usePathname()` for active-route highlighting as
 * the user navigates client-side. An alternative (Server Component reading
 * the path via a middleware-injected header) would require changing
 * `src/middleware.ts` to stamp every request with an `x-pathname` header —
 * a wider blast radius affecting every route for a purely cosmetic feature.
 * Keeping this one leaf component client-side is the smaller, safer change;
 * the nav item list itself is still static, role-filtered data.
 */
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav
      aria-label="Navegación principal"
      className="flex gap-1 overflow-x-auto border-b border-border bg-card p-2 md:h-full md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-3"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
