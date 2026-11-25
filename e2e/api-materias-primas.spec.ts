import { expect, test } from "@playwright/test";
import { roleHeaders, uniqueSuffix } from "./helpers";

// REST API v1 CRUD (same cases as the Postman collection), with RLS active
// in the database underneath.

const BASE = "/api/v1/materias-primas";
const admin = roleHeaders("admin");

test("CRUD completo de materias primas", async ({ request }) => {
  const code = `MP-E2E-${uniqueSuffix()}`;

  const created = await request.post(BASE, {
    headers: admin,
    data: { code, name: "Pantenol USP", unit: "kg", category: "humectante" },
  });
  expect(created.status()).toBe(201);
  const { data } = (await created.json()) as { data: { id: string; code: string } };
  expect(data.code).toBe(code);
  expect(created.headers()["location"]).toBe(`${BASE}/${data.id}`);

  const list = await request.get(BASE, { headers: admin });
  expect(list.status()).toBe(200);
  const listed = (await list.json()) as { data: { id: string }[]; total: number };
  expect(listed.total).toBe(listed.data.length);
  expect(listed.data.some((material) => material.id === data.id)).toBe(true);

  const patched = await request.patch(`${BASE}/${data.id}`, { headers: admin, data: { category: "activo" } });
  expect(patched.status()).toBe(200);
  expect(((await patched.json()) as { data: { category: string; unit: string } }).data).toMatchObject({
    category: "activo",
    unit: "kg",
  });

  const deleted = await request.delete(`${BASE}/${data.id}`, { headers: admin });
  expect(deleted.status()).toBe(200);
  expect((await request.get(`${BASE}/${data.id}`, { headers: admin })).status()).toBe(404);
});

test("errores: validación 400, duplicado 409 y borrado con historial 409", async ({ request }) => {
  const invalid = await request.post(BASE, { headers: admin, data: { code: "MP-X", name: "", unit: "kg" } });
  expect(invalid.status()).toBe(400);

  const duplicate = await request.post(BASE, { headers: admin, data: { code: "MP-001", name: "Agua", unit: "kg" } });
  expect(duplicate.status()).toBe(409);

  const list = (await (await request.get(BASE, { headers: admin })).json()) as { data: { id: string; code: string }[] };
  const withHistory = list.data.find((material) => material.code === "MP-001")!;
  const blocked = await request.delete(`${BASE}/${withHistory.id}`, { headers: admin });
  expect(blocked.status()).toBe(409);
});

test("un rol sin permiso de escritura recibe 403", async ({ request }) => {
  const attempt = await request.post(BASE, {
    headers: roleHeaders("calidad"),
    data: { code: `MP-NO-${uniqueSuffix()}`, name: "No autorizado", unit: "kg" },
  });
  expect(attempt.status()).toBe(403);
});
