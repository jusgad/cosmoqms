import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, trpcCall, uniqueSuffix } from "./helpers";

// The BPM flow end to end, each step by the role that owns it:
// receive raw material (bodega) -> release lots (calidad) -> master formula
// (jefe_planta) -> activate it at 100% (calidad) -> production order
// (jefe_planta) -> weighing every ingredient (jefe_planta, who does the plant work) -> electronic
// signature, which must demand re-authentication (non-negotiable rule 3).

test.describe.configure({ mode: "serial" });

const run = uniqueSuffix();
const lots = [
  { material: "MP-001 — Agua Desionizada", code: `E2E-AGUA-${run}`, percentage: 80 },
  { material: "MP-002 — Glicerina Vegetal", code: `E2E-GLIC-${run}`, percentage: 20 },
];
const PLANNED_QTY = 10;
const lotIds: string[] = [];
let formulaUrl = "";
let orderId = "";
let orderNumber = "";

test.beforeEach(({ page }) => failOnPageErrors(page));

test("bodega recibe dos lotes de materia prima en cuarentena", async ({ page, context }) => {
  await asRole(context, "bodega");
  for (const lot of lots) {
    await page.goto("/materias-primas/nueva");
    await page.getByLabel("Materia prima").selectOption({ label: lot.material });
    await page.getByLabel("Código de lote del proveedor").fill(lot.code);
    await page.getByLabel("Cantidad recibida").fill("50");
    await page.getByLabel("Fecha de vencimiento").fill("2028-12-31");
    await page.getByRole("button", { name: "Recibir lote" }).click();

    await expect(page).toHaveURL(/\/materias-primas\/[0-9a-f-]{36}$/);
    await expectHeading(page, `Lote ${lot.code}`);
    await expect(page.getByText("Cuarentena").first()).toBeVisible();
    lotIds.push(page.url().split("/").pop()!);
  }
});

test("calidad libera los lotes", async ({ page, context }) => {
  await asRole(context, "calidad");
  for (const id of lotIds) {
    await page.goto(`/materias-primas/${id}`);
    await page.getByRole("button", { name: "Liberar lote" }).click();
    await expect(page.getByText("Liberado").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Liberar lote" })).toHaveCount(0);
  }
});

test("una fórmula que no suma 100% no se puede activar", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/formulas/nueva");
  await page.getByLabel("Código").fill(`F-INC-${run}`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Fórmula incompleta ${run}`);
  await page.getByLabel("Materia prima").selectOption({ label: lots[0].material });
  await page.getByLabel("Porcentaje").fill("90");
  await page.getByRole("button", { name: "Guardar fórmula" }).click();
  await expect(page).toHaveURL(/\/formulas\/[0-9a-f-]{36}$/);

  await asRole(context, "calidad");
  await page.reload();
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText(/100/).last()).toBeVisible();
  await expect(page.getByText("Borrador").first()).toBeVisible();
  await expect(page.getByText("Activa", { exact: true })).toHaveCount(0);
});

test("jefe de planta crea la fórmula y calidad la activa", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/formulas/nueva");
  await page.getByLabel("Código").fill(`F-E2E-${run}`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Crema E2E ${run}`);
  await page.getByRole("button", { name: "Agregar ingrediente" }).click();
  for (const [index, lot] of lots.entries()) {
    await page.locator(`[id="ingredients.${index}.rawMaterialId"]`).selectOption({ label: lot.material });
    await page.locator(`[id="ingredients.${index}.percentage"]`).fill(String(lot.percentage));
  }
  await page.getByRole("button", { name: "Guardar fórmula" }).click();
  await expect(page).toHaveURL(/\/formulas\/[0-9a-f-]{36}$/);
  formulaUrl = new URL(page.url()).pathname;

  await asRole(context, "calidad");
  await page.goto(formulaUrl);
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("Activa", { exact: true })).toBeVisible();
});

test("jefe de planta crea la orden de producción", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/produccion/nueva");
  await page.getByLabel("Fórmula (solo activas)").selectOption({ label: `F-E2E-${run} — Crema E2E ${run} (v1)` });
  await page.getByLabel("Cantidad planificada").fill(String(PLANNED_QTY));
  await page.getByRole("button", { name: "Crear orden" }).click();

  await expect(page).toHaveURL(/\/produccion\?created=/);
  orderNumber = new URL(page.url()).searchParams.get("created")!;
  const card = page.getByRole("link", { name: new RegExp(orderNumber) });
  await card.click();
  await expect(page).toHaveURL(/\/produccion\/[0-9a-f-]{36}$/);
  await expectHeading(page, orderNumber);
  orderId = page.url().split("/").pop()!;
});

test("jefe de planta pesa cada ingrediente con el lote liberado", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  for (const lot of lots) {
    await page.goto(`/produccion/${orderId}`);
    await page.getByRole("link", { name: /Registrar pesaje/ }).click();
    await expectHeading(page, new RegExp(orderNumber));

    await page.getByPlaceholder("Buscar por nombre, codigo o proveedor...").fill(lot.code);
    await page.getByRole("button", { name: new RegExp(lot.code) }).click();
    const theoretical = ((lot.percentage / 100) * PLANNED_QTY).toFixed(3);
    await expect(page.getByText(theoretical, { exact: true })).toBeVisible();
    await page.getByLabel("Cantidad pesada").fill(theoretical);
    await page.getByRole("button", { name: "Registrar pesaje" }).click();
    await expect(page).toHaveURL(new RegExp(`/produccion/${orderId}$`));
  }

  // Both weighings reached the server (offline queue -> /api/sync/events).
  await expect
    .poll(async () => {
      await page.reload();
      return page.getByRole("link", { name: "Firmar" }).count();
    })
    .toBe(1);
  await expect(page.getByRole("link", { name: /faltan/ })).toHaveCount(0);
});

test("la firma electrónica exige reautenticación (regla 3)", async ({ page, context, request }) => {
  await asRole(context, "jefe_planta");
  await page.goto(`/produccion/${orderId}`);
  await page.getByRole("link", { name: "Firmar" }).click();
  await expectHeading(page, /Firma electrónica/);
  await expect(page.locator("[data-slot=meaning-statement]")).not.toBeEmpty();
  await expect(page.getByRole("button", { name: "Firmar" })).toBeDisabled();

  // Even sending reauthVerified=true by hand, the server re-checks with Clerk.
  const forged = await trpcCall(request, "jefe_planta", "production.sign", {
    productionOrderId: orderId,
    stage: "pesado",
    meaningStatement: "Confirmo el pesaje",
    reauthVerified: true,
  });
  expect(forged.status).toBe(401);
  expect(forged.error?.data.code).toBe("UNAUTHORIZED");

  const order = await trpcCall(request, "jefe_planta", "production.getById", { id: orderId }, "query");
  expect((order.result as { status: string }).status).toBe("pesado");
});
