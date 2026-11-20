import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, trpcCall } from "./helpers";

// Company data on the BPM report: admin edits it, it is audited, and it is
// what the report header prints.

test.beforeEach(({ page }) => failOnPageErrors(page));

test("el admin actualiza los datos de la empresa y quedan en la auditoría", async ({ page, context }) => {
  await asRole(context, "admin");
  await page.goto("/configuracion");
  await expectHeading(page, "Configuración");

  const original = await page.getByLabel("Registro / certificación INVIMA").inputValue();
  const changed = `INVIMA-E2E-${Date.now().toString(36).toUpperCase()}`;

  for (const value of [changed, original]) {
    await page.getByLabel("Registro / certificación INVIMA").fill(value);
    const saved = page.waitForResponse((response) => response.url().includes("organization.update") && response.ok());
    await page.getByRole("button", { name: "Guardar" }).click();
    await saved;
    await expect(page.getByText("Datos guardados.")).toBeVisible();
  }

  await page.goto("/auditoria");
  await page.getByLabel("Tabla").selectOption("Organization");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("demo-org").first()).toBeVisible();
});

test("un NIT inválido se rechaza y nadie más puede cambiar estos datos", async ({ request }) => {
  const invalid = await trpcCall(request, "admin", "organization.update", { name: "CosmoLab", nit: "abc", invimaRegistration: "" });
  expect(invalid.status).toBe(400);
  const notAdmin = await trpcCall(request, "director_tecnico", "organization.update", {
    name: "CosmoLab",
    nit: "",
    invimaRegistration: "",
  });
  expect(notAdmin.status).toBe(403);
});
