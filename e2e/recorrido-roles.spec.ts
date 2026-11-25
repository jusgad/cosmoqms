import { expect, test, type Page } from "@playwright/test";
import { asRole, type Role } from "./helpers";

// Walks every screen each of the five accounts can reach: the dashboard, its
// quick actions, pending tasks and KPI cards, the sidebar, and one level
// deeper (the first records of each list). Every page must answer without an
// HTTP error and without a crash in the browser — a broken link or screen
// anywhere in a role's day fails here.

const ROLES: Role[] = ["bodega", "jefe_planta", "calidad", "director_tecnico", "admin"];
const MAX_PER_SECTION = 2;

// Downloads and API routes are covered by their own specs.
function isPage(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("/api/") && !href.startsWith("//");
}

async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
  );
  return [...new Set(hrefs.filter(isPage).map((href) => href.split("#")[0]))];
}

// "/produccion/3f2a..." -> "/produccion/:id", so only a couple of records per
// list are opened.
function section(href: string): string {
  return href.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id");
}

async function visit(page: Page, href: string, errors: string[]): Promise<void> {
  const response = await page.goto(href, { waitUntil: "load" });
  const status = response?.status() ?? 0;
  if (status >= 400) errors.push(`${href} respondió ${status}`);
  const crashed = await page.getByText(/Application error|Algo salió mal|Unhandled Runtime Error/).count();
  if (crashed > 0) errors.push(`${href} muestra una pantalla de error`);
}

for (const role of ROLES) {
  test(`${role}: todas sus pantallas y enlaces abren sin errores`, async ({ page, context }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
    await asRole(context, role);

    await visit(page, "/dashboard", errors);
    const queue = await internalLinks(page);
    const seen = new Set<string>(["/dashboard"]);
    const perSection = new Map<string, number>();

    for (let index = 0; index < queue.length && seen.size < 60; index++) {
      const href = queue[index];
      if (seen.has(href)) continue;
      const key = section(href);
      const count = perSection.get(key) ?? 0;
      if (count >= MAX_PER_SECTION) continue;
      perSection.set(key, count + 1);
      seen.add(href);

      await visit(page, href, errors);
      // One level deeper: the records listed on this page.
      if (!href.includes(":") && href.split("/").length <= 3) {
        for (const next of await internalLinks(page)) if (!seen.has(next)) queue.push(next);
      }
    }

    expect(errors, `Pantallas con problemas para ${role}`).toEqual([]);
    expect(seen.size).toBeGreaterThan(3);
  });
}
