import { expect, test } from "@playwright/test";
import { asRole, failOnPageErrors } from "./helpers";

// Lists are paginated on the server and the lot search covers every page.

test.beforeEach(({ page }) => failOnPageErrors(page));

test("la búsqueda de lotes corre en el servidor y conserva el filtro", async ({ page, context }) => {
  await asRole(context, "bodega");
  await page.goto("/materias-primas");
  await page.getByLabel("Buscar materia prima").fill("Glicerina");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page).toHaveURL(/\/materias-primas\?q=Glicerina$/);
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("Glicerina");
  for (const text of await rows.allInnerTexts()) expect(text).toContain("Glicerina");
  await expect(page.getByRole("navigation", { name: "Paginación" })).toContainText(/Página 1 de \d+/);
});

test("una página fuera de rango no rompe la lista", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/formulas?pagina=999");
  await expect(page.getByText("Sin fórmulas registradas.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Anterior" })).toBeVisible();

  await page.goto("/formulas?pagina=abc");
  await expect(page.getByRole("navigation", { name: "Paginación" })).toContainText("Página 1 de");
});
