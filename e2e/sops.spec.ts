import { expect, test } from "@playwright/test";
import { asRole, expectHeading, failOnPageErrors, trpcCall } from "./helpers";

// SOP document control: calidad drafts a new procedure and attaches its PDF;
// approval is the director's electronic signature, so without a real Clerk
// re-verification it must be refused; the floor confirms reading the
// vigente version and calidad sees who did.

test.describe.configure({ mode: "serial" });

// Fixed code: a draft can never be approved in demo mode (no real Clerk
// re-verification), so every run reuses the same draft instead of piling up
// new ones in the list.
const code = "SOP-E2E-PRUEBA";
let draftId = "";

// Smallest valid PDF header: the server sniffs the real file type.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test.beforeEach(({ page }) => failOnPageErrors(page));

test("calidad crea un borrador y adjunta el documento", async ({ page, context, request }) => {
  await asRole(context, "calidad");
  const list = await trpcCall(request, "calidad", "sops.list", undefined, "query");
  const existing = (list.result as { code: string; draft: { id: string } | null }[]).find((sop) => sop.code === code);

  if (existing?.draft) {
    await page.goto(`/sops/${existing.draft.id}`);
  } else {
    await page.goto("/sops");
    await page.getByRole("link", { name: "Nuevo SOP" }).click();
    await page.getByLabel("Código").fill(code);
    await page.getByLabel("Título").fill("Procedimiento de prueba E2E");
    await page.getByRole("button", { name: "Crear borrador" }).click();
  }

  await expect(page).toHaveURL(/\/sops\/[0-9a-f-]{36}$/);
  draftId = page.url().split("/").pop()!;
  await expectHeading(page, "Procedimiento de prueba E2E");
  await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Adjuntar documento del procedimiento (PDF)").setInputFiles({
    name: `${code}.pdf`,
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.getByRole("button", { name: "Subir" }).click();
  await expect(page.getByText(`${code}.pdf`).first()).toBeVisible();
});

test("no se permite un segundo borrador del mismo código", async ({ request }) => {
  const second = await trpcCall(request, "calidad", "sops.create", { code, title: "Otro" });
  expect(second.status).toBe(409);
});

test("el piso no ve borradores", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/sops");
  await expect(page.getByText(code)).toHaveCount(0);
  await page.goto(`/sops/${draftId}`);
  await expect(page).toHaveURL(/\/sops$/);
});

test("aprobar exige reautenticación real (firma electrónica)", async ({ page, context, request }) => {
  await asRole(context, "director_tecnico");
  await page.goto(`/sops/${draftId}`);
  await expect(page.getByRole("heading", { name: /Aprobación/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprobar como vigente" })).toBeDisabled();

  const forged = await trpcCall(request, "director_tecnico", "sops.approve", {
    id: draftId,
    effectiveDate: "2026-12-01",
    reviewDue: "2028-12-01",
    meaningStatement: "Apruebo este procedimiento como versión vigente y autorizo su uso en planta",
    reauthVerified: true,
  });
  expect(forged.status).toBe(401);
  await page.reload();
  await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();

  const asQuality = await trpcCall(request, "calidad", "sops.approve", {
    id: draftId,
    effectiveDate: "2026-12-01",
    reviewDue: "2028-12-01",
    meaningStatement: "Apruebo este procedimiento como versión vigente y autorizo su uso en planta",
    reauthVerified: true,
  });
  expect(asQuality.status).toBe(403);
});

test("el jefe de planta confirma la lectura del SOP vigente y calidad lo ve", async ({ page, context }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/sops");
  await page.getByRole("link", { name: /Pesaje de materias primas/ }).click();
  await expectHeading(page, "Pesaje de materias primas");
  await expect(page.getByText("Vigente", { exact: true }).first()).toBeVisible();

  const confirm = page.getByRole("button", { name: "Confirmar lectura" });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByText("Usted ya confirmó la lectura de esta versión.")).toBeVisible();

  await asRole(context, "calidad");
  await page.reload();
  await expect(page.getByRole("heading", { name: /Lectura del personal/ })).toBeVisible();
  await expect(page.getByText(/^Leído /).first()).toBeVisible();
});

test("la versión obsoleta queda en el historial y no se puede confirmar", async ({ page, context, request }) => {
  await asRole(context, "jefe_planta");
  await page.goto("/sops");
  await page.getByRole("link", { name: /Limpieza y sanitización/ }).click();
  await expectHeading(page, /Limpieza y sanitización/);
  await page.getByRole("link", { name: "v1 Obsoleto" }).click();
  await expect(page.getByText("SOP-LIM-001 · versión 1")).toBeVisible();
  await expect(page.getByText("Obsoleto", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar lectura" })).toHaveCount(0);

  const obsoleteId = page.url().split("/").pop()!;
  const attempt = await trpcCall(request, "jefe_planta", "sops.acknowledge", { id: obsoleteId });
  expect(attempt.status).toBe(409);
});
