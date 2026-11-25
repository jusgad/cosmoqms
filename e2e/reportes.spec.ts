import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, roleHeaders } from "./helpers";

// INVIMA/BPM report: the page downloads a CSV Excel can open and a PDF.

test.beforeEach(({ page }) => failOnPageErrors(page));

test("calidad descarga el reporte BPM en CSV", async ({ page, context }) => {
  await asRole(context, "calidad");
  await page.goto("/reportes");
  await expectHeading(page, "Reportes");
  await page.getByLabel(/Desde/).fill("2026-10-01");
  await page.getByLabel(/Hasta/).fill("2026-11-30");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /CSV/ }).click();
  const file = await (await download).path();
  const csv = await readFile(file, "utf8");

  expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM so Excel reads accents
  expect(csv).toContain("Reporte consolidado de producción y calidad (BPM)");
  expect(csv).toContain("Orden;Fórmula;Versión");
});

test("el PDF del reporte es un PDF real", async ({ request }) => {
  const response = await request.get("/api/reports/produccion?from=2026-10-01&to=2026-11-30&format=pdf", {
    headers: roleHeaders("director_tecnico"),
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("bodega no puede descargar el reporte", async ({ request }) => {
  const response = await request.get("/api/reports/produccion?from=2026-10-01&to=2026-11-30&format=csv", {
    headers: roleHeaders("bodega"),
  });
  expect(response.status()).toBe(403);
});
