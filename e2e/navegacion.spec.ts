import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, type Role } from "./helpers";

// Every role sees exactly the menu its job needs (Sidebar.tsx), each of
// those pages renders, and pages outside the role redirect away.

const PAGES: Record<string, { title: string | RegExp; roles: Role[] }> = {
  "/dashboard": { title: "Dashboard", roles: ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega", "admin"] },
  "/materias-primas": { title: "Materias Primas", roles: ["bodega", "jefe_planta", "calidad", "director_tecnico"] },
  "/formulas": { title: "Fórmulas Maestras", roles: ["jefe_planta", "calidad", "director_tecnico"] },
  "/produccion": { title: "Producción", roles: ["jefe_planta", "operario", "calidad", "director_tecnico"] },
  "/calidad": { title: "Control de Calidad", roles: ["calidad", "director_tecnico"] },
  "/trazabilidad": { title: "Trazabilidad", roles: ["calidad", "director_tecnico"] },
  "/reportes": { title: "Reportes", roles: ["calidad", "director_tecnico"] },
  "/auditoria": { title: "Auditoría", roles: ["director_tecnico", "admin"] },
  "/usuarios": { title: "Usuarios", roles: ["admin"] },
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

test("el admin nunca ve Producción ni Calidad en el menú (separación de funciones)", async ({ page, context }) => {
  await asRole(context, "admin");
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Usuarios" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Producción" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Calidad" })).toHaveCount(0);
});

test("la página no tiene scroll horizontal", async ({ page, context }) => {
  await asRole(context, "director_tecnico");
  for (const path of ["/dashboard", "/produccion", "/reportes"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `scroll horizontal en ${path}`).toBe(false);
  }
});

// Known gaps (group 2 of the roadmap): the menu links to these, but the
// pages do not exist yet.
test.fixme("SOPs y Configuración existen", async ({ page, context }) => {
  await asRole(context, "admin");
  await page.goto("/configuracion");
  await expectHeading(page, "Configuración");
  await asRole(context, "operario");
  await page.goto("/sops");
  await expectHeading(page, "SOPs");
});
