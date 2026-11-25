/**
 * More products for the demonstration tenants: 14 raw materials (each with a
 * released lot in stock) and 5 active master formulas with their quality
 * specifications, so every screen (catalog, formulas, new order, weighing,
 * QC) has more than two products to work with.
 *
 *   pnpm seed:productos                                    # demo-org
 *   SEED_TENANT_ID=org_xxx pnpm seed:productos             # a real organization
 *
 * Idempotent: anything whose code already exists is left alone. Writes go
 * through `withTenant`, the same audited client the app uses. Dev/demo only.
 */
if (process.env.NODE_ENV === "production") {
  throw new Error("seed-productos no debe correr en produccion");
}

import { randomUUID } from "node:crypto";
import { withTenant } from "../src/lib/db";

const TENANT = process.env.SEED_TENANT_ID?.trim() || "demo-org";
const PREFIX = TENANT === "demo-org" ? "demo" : `hist-${TENANT.slice(-8).toLowerCase()}`;
const BODEGA = `${PREFIX}-bodega`;
const CALIDAD = `${PREFIX}-calidad`;
const DIRECTOR = TENANT === "demo-org" ? "demo-user" : `${PREFIX}-director`;
const DAY = 24 * 60 * 60 * 1000;

const MATERIALS = [
  { code: "MP-006", name: "Lauril Éter Sulfato de Sodio", category: "tensoactivo", lot: "PROV-LESS-2026-10", expiresInDays: 360 },
  { code: "MP-007", name: "Cocamidopropil Betaína", category: "tensoactivo", lot: "PROV-BETA-2026-10", expiresInDays: 330 },
  { code: "MP-008", name: "Cloruro de Sodio", category: "espesante", lot: "PROV-NACL-2026-09", expiresInDays: 720 },
  { code: "MP-009", name: "Ácido Cítrico", category: "regulador de pH", lot: "PROV-CITR-2026-08", expiresInDays: 540 },
  { code: "MP-010", name: "Fenoxietanol", category: "conservante", lot: "PROV-FENO-2026-09", expiresInDays: 600 },
  { code: "MP-011", name: "Manteca de Karité", category: "emoliente", lot: "PROV-KARI-2026-10", expiresInDays: 280 },
  { code: "MP-012", name: "Aceite de Almendras Dulces", category: "emoliente", lot: "PROV-ALMD-2026-11", expiresInDays: 240 },
  { code: "MP-013", name: "Pantenol (Provitamina B5)", category: "activo", lot: "PROV-PANT-2026-10", expiresInDays: 400 },
  { code: "MP-014", name: "Niacinamida", category: "activo", lot: "PROV-NIAC-2026-11", expiresInDays: 450 },
  { code: "MP-015", name: "Ácido Hialurónico", category: "activo", lot: "PROV-HIAL-2026-11", expiresInDays: 300 },
  { code: "MP-016", name: "Carbómero 940", category: "espesante", lot: "PROV-CARB-2026-09", expiresInDays: 500 },
  { code: "MP-017", name: "Trietanolamina", category: "neutralizante", lot: "PROV-TEA-2026-10", expiresInDays: 420 },
  { code: "MP-018", name: "Vitamina E (Tocoferol)", category: "antioxidante", lot: "PROV-VITE-2026-10", expiresInDays: 260 },
  { code: "MP-019", name: "Alcohol Etílico 96 %", category: "solvente", lot: "PROV-ETOH-2026-11", expiresInDays: 700 },
] as const;

// Recipe: [material code, percentage]. Each sums to exactly 100 %.
const FORMULAS = [
  {
    code: "F-004",
    name: "Champú Suave de Pantenol",
    productType: "champú",
    recipe: [["MP-001", 69.5], ["MP-006", 15], ["MP-007", 8], ["MP-002", 3], ["MP-008", 2], ["MP-013", 1], ["MP-010", 1], ["MP-003", 0.5]],
    specs: [
      { parameter: "pH", minValue: 5.5, maxValue: 6.5, unit: null },
      { parameter: "Viscosidad", minValue: 3000, maxValue: 7000, unit: "cP" },
    ],
  },
  {
    code: "F-005",
    name: "Bálsamo Corporal de Karité",
    productType: "bálsamo",
    recipe: [["MP-001", 60], ["MP-011", 15], ["MP-012", 10], ["MP-004", 8], ["MP-002", 4], ["MP-018", 1], ["MP-010", 1], ["MP-003", 1]],
    specs: [
      { parameter: "pH", minValue: 5, maxValue: 6.5, unit: null },
      { parameter: "Viscosidad", minValue: 15000, maxValue: 25000, unit: "cP" },
    ],
  },
  {
    code: "F-006",
    name: "Sérum Facial de Niacinamida",
    productType: "sérum",
    recipe: [["MP-001", 84.8], ["MP-014", 5], ["MP-002", 5], ["MP-013", 2], ["MP-015", 1], ["MP-010", 1], ["MP-016", 0.5], ["MP-017", 0.5], ["MP-009", 0.2]],
    specs: [
      { parameter: "pH", minValue: 5, maxValue: 6, unit: null },
      { parameter: "Viscosidad", minValue: 2000, maxValue: 5000, unit: "cP" },
    ],
  },
  {
    code: "F-007",
    name: "Gel Antibacterial para Manos",
    productType: "gel",
    recipe: [["MP-019", 70], ["MP-001", 26.5], ["MP-002", 2], ["MP-016", 0.5], ["MP-017", 0.5], ["MP-005", 0.5]],
    specs: [
      { parameter: "pH", minValue: 6, maxValue: 8, unit: null },
      { parameter: "Viscosidad", minValue: 4000, maxValue: 9000, unit: "cP" },
    ],
  },
  {
    code: "F-008",
    name: "Jabón Líquido para Manos",
    productType: "jabón líquido",
    recipe: [["MP-001", 74], ["MP-006", 12], ["MP-007", 6], ["MP-002", 3], ["MP-008", 2.5], ["MP-010", 1], ["MP-003", 1], ["MP-009", 0.5]],
    specs: [
      { parameter: "pH", minValue: 5.5, maxValue: 7, unit: null },
      { parameter: "Viscosidad", minValue: 2500, maxValue: 6000, unit: "cP" },
    ],
  },
] as const;

async function main(): Promise<void> {
  for (const formula of FORMULAS) {
    const total = formula.recipe.reduce((sum, [, percentage]) => sum + percentage, 0);
    if (Math.abs(total - 100) > 1e-9) throw new Error(`${formula.code} suma ${total} %, no 100 %`);
  }
  const now = Date.now();

  let newMaterials = 0;
  await withTenant(TENANT, BODEGA, async (tx) => {
    for (const material of MATERIALS) {
      const existing = await tx.rawMaterial.findFirst({ where: { tenantId: TENANT, code: material.code } });
      if (existing) continue;
      const created = await tx.rawMaterial.create({
        data: { tenantId: TENANT, code: material.code, name: material.name, unit: "kg", category: material.category },
      });
      await tx.rawMaterialLot.create({
        data: {
          tenantId: TENANT,
          rawMaterialId: created.id,
          supplierLotCode: material.lot,
          receivedAt: new Date(now - 20 * DAY),
          expiryDate: new Date(now + material.expiresInDays * DAY),
          quantityReceived: 2000,
          quantityAvailable: 1850,
          status: "liberado",
          qrCode: `MP-${randomUUID()}`,
        },
      });
      newMaterials++;
    }
  });

  let newFormulas = 0;
  await withTenant(TENANT, CALIDAD, async (tx) => {
    const materials = await tx.rawMaterial.findMany({ where: { tenantId: TENANT }, select: { id: true, code: true } });
    const idByCode = new Map(materials.map((material) => [material.code, material.id]));
    for (const formula of FORMULAS) {
      const existing = await tx.masterFormula.findFirst({ where: { tenantId: TENANT, code: formula.code } });
      if (existing) continue;
      const missing = formula.recipe.find(([code]) => !idByCode.has(code));
      if (missing) throw new Error(`${formula.code}: falta la materia prima ${missing[0]}`);
      const created = await tx.masterFormula.create({
        data: {
          tenantId: TENANT,
          code: formula.code,
          name: formula.name,
          productType: formula.productType,
          status: "active",
          approvedBy: DIRECTOR,
          approvedAt: new Date(now - 15 * DAY),
          ingredients: {
            create: formula.recipe.map(([code, percentage], index) => ({
              rawMaterialId: idByCode.get(code) ?? "",
              percentage,
              orderIndex: index,
            })),
          },
        },
      });
      for (const spec of formula.specs) {
        await tx.qcSpecification.create({ data: { tenantId: TENANT, formulaId: created.id, ...spec } });
      }
      newFormulas++;
    }
  });

  console.log(`${TENANT}: ${newMaterials} materias primas nuevas con su lote liberado y ${newFormulas} fórmulas activas nuevas.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
