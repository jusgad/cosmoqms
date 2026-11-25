import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

export type Role = "jefe_planta" | "calidad" | "director_tecnico" | "bodega" | "admin";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3001";

// Demo-mode role switch (see DEMO_ROLE_COOKIE in src/lib/auth.ts).
export async function asRole(context: BrowserContext, role: Role): Promise<void> {
  await context.clearCookies({ name: "cosmoqms-demo-role" });
  await context.addCookies([{ name: "cosmoqms-demo-role", value: role, url: BASE_URL }]);
}

export function roleHeaders(role: Role): Record<string, string> {
  return { cookie: `cosmoqms-demo-role=${role}` };
}

// Short unique suffix so the suite can run many times against the same DB.
export function uniqueSuffix(): string {
  return Date.now().toString(36).slice(-5).toUpperCase();
}

// Fails the test on any uncaught error in the page (React crashes, etc.).
export function failOnPageErrors(page: Page): void {
  page.on("pageerror", (error) => {
    throw new Error(`Error en la página ${page.url()}: ${error.message}`);
  });
}

export async function expectHeading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

// Calls a tRPC procedure the way the browser client does (superjson, batch).
export async function trpcCall(
  request: APIRequestContext,
  role: Role,
  procedure: string,
  input: unknown,
  kind: "query" | "mutation" = "mutation",
) {
  const payload = JSON.stringify({ "0": { json: input } });
  const url = `/api/trpc/${procedure}?batch=1`;
  const response =
    kind === "mutation"
      ? await request.post(url, { headers: { ...roleHeaders(role), "content-type": "application/json" }, data: payload })
      : await request.get(`${url}&input=${encodeURIComponent(payload)}`, { headers: roleHeaders(role) });
  const body = (await response.json()) as Array<{ result?: { data: { json: unknown } }; error?: { json: { message: string; data: { code: string } } } }>;
  return { status: response.status(), result: body[0]?.result?.data.json, error: body[0]?.error?.json };
}
