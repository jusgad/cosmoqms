import { expect, test, type Page } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, trpcCall } from "./helpers";

// /usuarios: admin changes a role, it is audited, and nobody else can do it.

test.describe.configure({ mode: "serial" });

const TARGET = { id: "demo-calidad", name: "Beatriz Calidad" };

// Waits for the server to confirm the change before the test moves on.
async function changeRole(page: Page, role: string): Promise<void> {
  const saved = page.waitForResponse((response) => response.url().includes("users.update") && response.ok());
  await page.getByLabel(`Rol de ${TARGET.name}`).selectOption(role);
  await saved;
}

// Leave the target in a known state even if a previous run stopped midway.
test.beforeAll(async ({ request }) => {
  await trpcCall(request, "admin", "users.update", { id: TARGET.id, role: "calidad", active: true });
});

test.beforeEach(({ page }) => failOnPageErrors(page));

test("el admin cambia un rol, queda en la auditoría y lo revierte", async ({ page, context }) => {
  await asRole(context, "admin");
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/usuarios");
  await expectHeading(page, "Usuarios");

  const roleSelect = page.getByLabel(`Rol de ${TARGET.name}`);
  await expect(roleSelect).toHaveValue("calidad");
  await changeRole(page, "director_tecnico");
  await page.reload();
  await expect(page.getByLabel(`Rol de ${TARGET.name}`)).toHaveValue("director_tecnico");

  await page.goto("/auditoria");
  await page.getByLabel("Tabla").selectOption("User");
  await page.getByRole("button", { name: /Buscar|Filtrar/ }).click();
  await expect(page.getByText(TARGET.id).first()).toBeVisible();

  await page.goto("/usuarios");
  await changeRole(page, "calidad");
  await page.reload();
  await expect(page.getByLabel(`Rol de ${TARGET.name}`)).toHaveValue("calidad");
});

test("el admin no puede cambiar su propio acceso", async ({ request }) => {
  const self = await trpcCall(request, "admin", "users.update", { id: "demo-user", active: false });
  expect(self.status).toBe(400);
  expect(self.error?.message).toContain("propio");
});

test("ningún otro rol puede administrar usuarios", async ({ page, context, request }) => {
  for (const role of ["director_tecnico", "calidad", "bodega"] as const) {
    const attempt = await trpcCall(request, role, "users.update", { id: TARGET.id, role: "admin" });
    expect(attempt.status, role).toBe(403);
  }
  await asRole(context, "director_tecnico");
  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/dashboard$/);
});
