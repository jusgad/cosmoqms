import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, roleHeaders, trpcCall, uniqueSuffix } from "./helpers";

// The second half of the BPM cycle with the five accounts that exist in
// production (jefe de planta does the plant work):
// deviation reported (jefe_planta) -> investigated with CAPA (calidad) ->
// approved and closed (director_tecnico); QC result on an order waiting for
// quality (calidad); batch record and lot label PDFs; the raw-material catalog
// (bodega). Electronic signatures need Clerk's re-authentication and are
// covered by flujo-produccion.spec.ts and the unit tests.

test.describe.configure({ mode: "serial" });

const run = uniqueSuffix();
type Order = { id: string; orderNumber: string; status: string; formulaId: string };
let deviationUrl = "";

test.beforeEach(({ page }) => failOnPageErrors(page));

async function ordersIn(request: Parameters<typeof trpcCall>[0], status: string): Promise<Order[]> {
  const list = await trpcCall(request, "jefe_planta", "production.list", undefined, "query");
  return (list.result as Order[]).filter((order) => order.status === status);
}

test("jefe de planta reporta una desviación desde el batch record", async ({ page, context, request }) => {
  const [order] = await ordersIn(request, "pesado");
  expect(order, "hace falta una orden en pesado").toBeTruthy();

  await asRole(context, "jefe_planta");
  await page.goto(`/produccion/${order.id}`);
  await page.getByRole("link", { name: "Reportar desviación" }).click();
  await page.getByLabel("Descripción de la desviación").fill(`Temperatura fuera de rango en el mezclado ${run}`);
  await page.getByRole("button", { name: "Reportar desviación" }).click();

  await expect(page).toHaveURL(/\/calidad\/desviaciones\/[0-9a-f-]{36}$/);
  deviationUrl = new URL(page.url()).pathname;
  await expect(page.getByText(`Temperatura fuera de rango en el mezclado ${run}`)).toBeVisible();
});

test("calidad investiga la desviación y propone la CAPA", async ({ page, context }) => {
  await asRole(context, "calidad");
  await page.goto(deviationUrl);
  await page.getByRole("button", { name: "Iniciar investigación" }).click();
  await expect(page.getByRole("button", { name: /Iniciar investigación|Iniciando/ })).toHaveCount(0, { timeout: 30_000 });
  await page.getByLabel("Investigación").fill(`Termostato descalibrado ${run}`);
  await page.getByLabel("Acción correctiva/preventiva").fill("Calibrar el termostato y revisarlo cada mes");
  await page.getByRole("button", { name: "Enviar para aprobación" }).click();
  // Saved: the text boxes give way to the read-only investigation.
  await expect(page.getByRole("textbox", { name: "Investigación" })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(`Termostato descalibrado ${run}`)).toBeVisible();
});

test("el director técnico aprueba y cierra la desviación", async ({ page, context }) => {
  await asRole(context, "director_tecnico");
  await page.goto(deviationUrl);
  await page.getByRole("button", { name: "Aprobar y cerrar" }).click();
  await expect(page.getByText("Desviación cerrada.")).toBeVisible();

  // Jefe de planta sees it, but cannot approve it.
  await asRole(context, "jefe_planta");
  await page.reload();
  await expect(page.getByRole("button", { name: "Aprobar y cerrar" })).toHaveCount(0);
});

test("calidad registra un resultado de QC de una orden en calidad", async ({ page, context, request }) => {
  const [order] = await ordersIn(request, "calidad");
  expect(order, "hace falta una orden en calidad").toBeTruthy();
  const specs = await trpcCall(request, "calidad", "qc.specsForFormula", { formulaId: order.formulaId }, "query");
  const [spec] = specs.result as Array<{ parameter: string; minValue: number | null; maxValue: number | null }>;
  expect(spec, "la fórmula de la orden necesita especificaciones").toBeTruthy();
  const value = spec.minValue ?? spec.maxValue ?? 0;

  await asRole(context, "calidad");
  await page.goto("/calidad");
  const row = page.getByRole("row", { name: new RegExp(order.orderNumber) });
  await row.getByRole("button", { name: "Registrar resultado" }).click();
  await page.getByLabel("Parámetro").fill(spec.parameter);
  await page.getByLabel("Valor medido").fill(String(value));
  await expect(page.getByText("Resultado calculado: CONFORME")).toBeVisible();
  await page.getByRole("button", { name: "Registrar resultado" }).last().click();
  // The form clears itself only when the server accepted and stored the result.
  await expect(page.getByLabel("Valor medido")).toHaveValue("", { timeout: 30_000 });
  await expect(page.getByText(/Ingrese un parámetro|no se pudo|error/i)).toHaveCount(0);
});

test("el batch record y la etiqueta del lote salen en PDF", async ({ request }) => {
  const [order] = await ordersIn(request, "liberado");
  const batch = await request.get(`/api/pdf/batch/${order.id}`, { headers: roleHeaders("calidad") });
  expect(batch.status()).toBe(200);
  expect(batch.headers()["content-type"]).toContain("application/pdf");
  expect((await batch.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const lots = await trpcCall(request, "bodega", "materials.listLots", undefined, "query");
  const lot = (lots.result as Array<{ id: string }> | undefined)?.[0];
  if (lot) {
    const label = await request.get(`/api/pdf/lot-label/${lot.id}`, { headers: roleHeaders("bodega") });
    expect(label.status()).toBe(200);
    expect((await label.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }

  // Jefe de planta cannot export the batch record.
  const denied = await request.get(`/api/pdf/batch/${order.id}`, { headers: roleHeaders("jefe_planta") });
  expect(denied.status()).toBe(403);
});

test("bodega agrega una materia prima al catálogo", async ({ page, context }) => {
  await asRole(context, "bodega");
  await page.goto("/materias-primas/catalogo");
  await expectHeading(page, /Catálogo/);
  await page.getByLabel("Código").fill(`MP-E2E-${run}`);
  await page.getByLabel("Nombre").fill(`Extracto de prueba ${run}`);
  await page.getByRole("button", { name: /Agregar|Guardar/ }).first().click();
  await expect(page.getByText(`MP-E2E-${run}`)).toBeVisible();
});
