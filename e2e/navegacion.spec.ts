import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, type Role } from "./helpers";

// Every role sees exactly the menu its job needs (MODULE_ROLES in
// src/lib/roles/modules.ts), each of those pages renders, and pages outside
// the role redirect away. The admin opens every module in read-only mode.

const PAGES: Record<string, { title: string | RegExp; roles: Role[] }> = {
  "/dashboard": { title: "Dashboard", roles: ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega", "admin"] },
  "/materias-primas": { title: "Materias Primas", roles: ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"] },
  "/materias-primas/catalogo": { title: "Catálogo de materias primas", roles: ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"] },
  "/formulas": { title: "Fórmulas Maestras", roles: ["jefe_planta", "calidad", "director_tecnico", "admin"] },
  "/produccion": { title: "Producción", roles: ["jefe_planta", "operario", "calidad", "director_tecnico", "admin"] },
  "/calidad": { title: "Control de Calidad", roles: ["calidad", "director_tecnico", "admin"] },
  "/trazabilidad": { title: "Trazabilidad", roles: ["calidad", "director_tecnico", "admin"] },
  "/reportes": { title: "Reportes", roles: ["calidad", "director_tecnico", "admin"] },
  "/auditoria": { title: "Auditoría", roles: ["director_tecnico", "admin"] },
  "/usuarios": { title: "Usuarios", roles: ["admin"] },
  "/usuarios/revision": { title: "Revisión de accesos", roles: ["admin"] },
  "/roles": { title: "Roles y permisos", roles: ["admin"] },
  "/configuracion": { title: "Configuración", roles: ["admin"] },
  "/sops": { title: "SOPs", roles: ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega", "admin"] },
  "/notificaciones": { title: "Notificaciones", roles: ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega", "admin"] },
};

const ROLES: Role[] = ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega", "admin"];

for (const role of ROLES) {
  test(`${role}: ve sus páginas y no las de otros roles`, async ({ page, context }) => {
    failOnPageErrors(page);
    await asRole(context, role);

    for (const [path, { title, roles }] of Object.entries(PAGES)) {
      await page.goto(path);
      if (roles.includes(role)) {
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expectHeading(page, title);
      } else {
        // Gated pages send the user away instead of rendering.
        await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      }
    }
  });
}

test("el admin supervisa todo en solo lectura: ve los módulos, no las acciones", async ({ page, context }) => {
  await asRole(context, "admin");
  await page.goto("/dashboard");
  await expect(page.getByRole("status").filter({ hasText: "Modo supervisión" })).toBeVisible();
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Producción" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Roles y permisos" })).toBeVisible();

  // Separation of duties: no weighing, signing, release or receipt.
  for (const path of ["/materias-primas/nueva", "/formulas/nueva", "/produccion/nueva", "/sops/nuevo"]) {
    await page.goto(path);
    await expect(page).not.toHaveURL(new RegExp(`${path}$`));
  }
  await page.goto("/produccion");
  await expect(page.getByRole("link", { name: "Nueva orden" })).toHaveCount(0);
  await page.goto("/calidad");
  await expect(page.getByRole("button", { name: "Registrar resultado" })).toHaveCount(0);
});

test("la página no tiene scroll horizontal", async ({ page, context }) => {
  await asRole(context, "director_tecnico");
  for (const path of ["/dashboard", "/produccion", "/reportes"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `scroll horizontal en ${path}`).toBe(false);
  }
});
