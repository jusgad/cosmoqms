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
  FileBarChart,
  KeyRound,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { canOpen, type ModuleKey } from "@/lib/roles/modules";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  module: ModuleKey;
};

// Which roles see each entry comes from MODULE_ROLES (src/lib/roles/modules.ts),
// the same list the page gates use, so the menu and the URLs never disagree.
// The administrator sees every module in supervision (read-only) mode.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/materias-primas", label: "Materias Primas", icon: Boxes, module: "materiasPrimas" },
  { href: "/formulas", label: "Fórmulas", icon: FlaskConical, module: "formulas" },
  { href: "/produccion", label: "Producción", icon: Factory, module: "produccion" },
  { href: "/calidad", label: "Calidad", icon: ShieldCheck, module: "calidad" },
  { href: "/trazabilidad", label: "Trazabilidad", icon: Route, module: "trazabilidad" },
  { href: "/reportes", label: "Reportes", icon: FileBarChart, module: "reportes" },
  { href: "/sops", label: "SOPs", icon: BookOpen, module: "sops" },
  { href: "/auditoria", label: "Auditoría", icon: ClipboardList, module: "auditoria" },
  { href: "/usuarios", label: "Usuarios", icon: Users, module: "usuarios" },
  { href: "/roles", label: "Roles y permisos", icon: KeyRound, module: "roles" },
  { href: "/configuracion", label: "Configuración", icon: Settings, module: "configuracion" },
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
  const items = NAV_ITEMS.filter((item) => canOpen(item.module, role));

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
