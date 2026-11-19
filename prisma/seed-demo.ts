/**
 * Demo history for the DEMO_MODE tenant (`demo-org`) — six months of batches
 * so the dashboard, notifications and the BPM report have something real to
 * show in screenshots and in the SENA evidence. Dev/demo databases only.
 *
 *   pnpm seed:demo
 *
 * Every write goes through `withTenant` (src/lib/db.ts), i.e. through the same
 * audited client the app uses, so the regulated rows it creates (orders,
 * batch events, QC results, deviations, finished lots) all get their
 * `audit_log` row (CLAUDE.md rule 2). Idempotent: it does nothing if the demo
 * tenant already has production orders.
 */
if (process.env.NODE_ENV === "production") {
  throw new Error("seed-demo no debe correr en produccion");
}

import { randomUUID } from "node:crypto";
import type { BatchStatus, DeviationStatus, Prisma, Role } from "@prisma/client";
import { prisma, withTenant } from "../src/lib/db";

const TENANT = "demo-org";
const DEMO_USER = "demo-user";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const STAFF: { id: string; role: Role; fullName: string; email: string }[] = [
  { id: DEMO_USER, role: "director_tecnico", fullName: "Usuario Demo", email: "demo@cosmoqms.local" },
  { id: "demo-calidad", role: "calidad", fullName: "Beatriz Calidad", email: "calidad@cosmoqms.local" },
  { id: "demo-jefe", role: "jefe_planta", fullName: "Carlos Jefe de Planta", email: "jefe.planta@cosmoqms.local" },
  { id: "demo-operario", role: "operario", fullName: "Ana Operaria", email: "operario@cosmoqms.local" },
  { id: "demo-bodega", role: "bodega", fullName: "Elena Bodega", email: "bodega@cosmoqms.local" },
];

const MATERIALS = [
  { code: "MP-001", name: "Agua Desionizada", unit: "kg", category: "solvente", lot: "PROV-AGUA-2026-07", status: "liberado", expiresInDays: 400 },
  { code: "MP-002", name: "Glicerina Vegetal", unit: "kg", category: "humectante", lot: "PROV-GLIC-2026-05", status: "liberado", expiresInDays: 300 },
  { code: "MP-003", name: "Fragancia Floral", unit: "kg", category: "fragancia", lot: "PROV-FRAG-2026-09", status: "liberado", expiresInDays: 18 },
  { code: "MP-004", name: "Alcohol Cetílico", unit: "kg", category: "emulsificante", lot: "PROV-CET-2026-10", status: "liberado", expiresInDays: 250 },
  { code: "MP-005", name: "Extracto de Aloe Vera", unit: "kg", category: "activo", lot: "PROV-ALOE-2026-11", status: "cuarentena", expiresInDays: 200 },
] as const;

// Recipe: [material code, percentage]. Each sums to exactly 100%.
const FORMULAS = [
  {
    code: "F-001",
    name: "Crema Hidratante Base",
    productType: "crema",
    recipe: [["MP-001", 70], ["MP-002", 15], ["MP-004", 10], ["MP-003", 5]] as const,
    specs: [
      { parameter: "pH", minValue: 5.5, maxValue: 7, unit: null },
      { parameter: "Viscosidad", minValue: 8000, maxValue: 12000, unit: "cP" },
    ],
  },
  {
    code: "F-002",
    name: "Gel de Aloe Calmante",
    productType: "gel",
    recipe: [["MP-001", 85], ["MP-002", 12], ["MP-003", 3]] as const,
    specs: [
      { parameter: "pH", minValue: 5, maxValue: 6.5, unit: null },
      { parameter: "Viscosidad", minValue: 3000, maxValue: 6000, unit: "cP" },
    ],
  },
] as const;

type Plan = {
  formula: 0 | 1;
  daysAgo: number;
  quantity: number;
  status: BatchStatus;
  // Hours each stage took: pesado, mezclado, envasado, calidad.
  hours: [number, number, number, number];
  qc: { parameter: string; value: number }[];
  deviation?: { status: DeviationStatus; description: string };
};

const PLANS: Plan[] = [
  { formula: 0, daysAgo: 165, quantity: 200, status: "liberado", hours: [2, 4, 6, 30], qc: [{ parameter: "pH", value: 6.1 }, { parameter: "Viscosidad", value: 9800 }] },
  { formula: 1, daysAgo: 150, quantity: 120, status: "liberado", hours: [1.5, 3, 5, 26], qc: [{ parameter: "pH", value: 5.6 }, { parameter: "Viscosidad", value: 4200 }] },
  { formula: 0, daysAgo: 132, quantity: 180, status: "liberado", hours: [2.5, 4.5, 5, 40], qc: [{ parameter: "pH", value: 6.4 }, { parameter: "Viscosidad", value: 10100 }] },
  { formula: 0, daysAgo: 118, quantity: 220, status: "rechazado", hours: [2, 5, 6, 20], qc: [{ parameter: "pH", value: 7.8 }, { parameter: "Viscosidad", value: 10400 }], deviation: { status: "cerrada", description: "pH por encima de especificación tras el mezclado; se descarta el lote." } },
  { formula: 1, daysAgo: 101, quantity: 150, status: "liberado", hours: [1, 3, 4, 22], qc: [{ parameter: "pH", value: 5.9 }, { parameter: "Viscosidad", value: 4700 }] },
  { formula: 0, daysAgo: 88, quantity: 200, status: "liberado", hours: [2, 4, 5.5, 34], qc: [{ parameter: "pH", value: 6 }, { parameter: "Viscosidad", value: 9400 }], deviation: { status: "cerrada", description: "Temperatura de fase oleosa 3 °C por debajo del rango durante 10 minutos; se corrigió sin impacto." } },
  { formula: 1, daysAgo: 72, quantity: 130, status: "liberado", hours: [1.5, 2.5, 4, 28], qc: [{ parameter: "pH", value: 6.2 }, { parameter: "Viscosidad", value: 5100 }] },
  { formula: 0, daysAgo: 60, quantity: 240, status: "liberado", hours: [3, 4, 6, 36], qc: [{ parameter: "pH", value: 6.3 }, { parameter: "Viscosidad", value: 11000 }] },
  { formula: 0, daysAgo: 44, quantity: 200, status: "liberado", hours: [2, 3.5, 5, 24], qc: [{ parameter: "pH", value: 5.8 }, { parameter: "Viscosidad", value: 8800 }] },
  { formula: 1, daysAgo: 33, quantity: 160, status: "rechazado", hours: [1.5, 3, 4.5, 18], qc: [{ parameter: "pH", value: 6 }, { parameter: "Viscosidad", value: 7200 }], deviation: { status: "cerrada", description: "Viscosidad muy por encima del rango: lote fuera de especificación." } },
  { formula: 0, daysAgo: 18, quantity: 210, status: "liberado", hours: [2, 4, 5, 30], qc: [{ parameter: "pH", value: 6.6 }, { parameter: "Viscosidad", value: 9900 }] },
  { formula: 1, daysAgo: 9, quantity: 140, status: "liberado", hours: [1, 3, 4, 20], qc: [{ parameter: "pH", value: 5.4 }, { parameter: "Viscosidad", value: 4400 }] },
  { formula: 0, daysAgo: 4, quantity: 230, status: "calidad", hours: [2, 4, 6, 0], qc: [{ parameter: "pH", value: 7.4 }], deviation: { status: "pendiente_aprobacion", description: "pH fuera de especificación en el primer muestreo; se propone reajuste con ácido cítrico y nuevo muestreo." } },
  { formula: 1, daysAgo: 1, quantity: 150, status: "mezclado", hours: [1.5, 0, 0, 0], qc: [], deviation: { status: "abierta", description: "Grumos visibles en la fase acuosa al iniciar el mezclado." } },
];

const STAGES = ["pesado", "mezclado", "envasado", "calidad"] as const;

function evaluate(value: number, spec: { minValue: number; maxValue: number }): "pass" | "fail" {
  return value < spec.minValue || value > spec.maxValue ? "fail" : "pass";
}

async function main(): Promise<void> {
  const existing = await withTenant(TENANT, DEMO_USER, (tx) => tx.productionOrder.count({ where: { tenantId: TENANT } }));
  if (existing > 0) {
    console.log(`demo-org ya tiene ${existing} órdenes: no se siembra nada.`);
    return;
  }

  await withTenant(TENANT, DEMO_USER, async (tx) => {
    await tx.organization.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: "CosmoLab Demo S.A.S.", nit: "900123456-7", invimaRegistration: "INVIMA-2026-DEMO" },
      update: { name: "CosmoLab Demo S.A.S.", nit: "900123456-7", invimaRegistration: "INVIMA-2026-DEMO" },
    });
    for (const member of STAFF) {
      await tx.user.upsert({
        where: { id: member.id },
        create: { ...member, tenantId: TENANT, active: true },
        update: { fullName: member.fullName, email: member.email },
      });
    }
  });

  const now = Date.now();
  const lotByCode = new Map<string, string>();
  const materialByCode = new Map<string, string>();

  await withTenant(TENANT, "demo-bodega", async (tx) => {
    for (const material of MATERIALS) {
      const created = await tx.rawMaterial.create({
        data: { tenantId: TENANT, code: material.code, name: material.name, unit: material.unit, category: material.category },
      });
      materialByCode.set(material.code, created.id);
      const lot = await tx.rawMaterialLot.create({
        data: {
          tenantId: TENANT,
          rawMaterialId: created.id,
          supplierLotCode: material.lot,
          receivedAt: new Date(now - 170 * DAY),
          expiryDate: new Date(now + material.expiresInDays * DAY),
          quantityReceived: 5000,
          quantityAvailable: 3200,
          status: material.status,
          qrCode: `MP-${randomUUID()}`,
        },
      });
      lotByCode.set(material.code, lot.id);
    }
  });

  const formulaIds: string[] = [];
  await withTenant(TENANT, "demo-calidad", async (tx) => {
    for (const formula of FORMULAS) {
      const created = await tx.masterFormula.create({
        data: {
          tenantId: TENANT,
          code: formula.code,
          name: formula.name,
          productType: formula.productType,
          status: "active",
          approvedBy: DEMO_USER,
          approvedAt: new Date(now - 175 * DAY),
          ingredients: {
            create: formula.recipe.map(([code, percentage], index) => ({
              rawMaterialId: materialByCode.get(code) ?? "",
              percentage,
              orderIndex: index,
            })),
          },
        },
      });
      for (const spec of formula.specs) {
        await tx.qcSpecification.create({ data: { tenantId: TENANT, formulaId: created.id, ...spec } });
      }
      formulaIds.push(created.id);
    }
  });

  for (const [index, plan] of PLANS.entries()) {
    const formula = FORMULAS[plan.formula];
    const orderNumber = `OP-2026-${String(index + 1).padStart(3, "0")}`;
    // Shift starts at 08:00 local time on the planned day.
    const planned = new Date(now - plan.daysAgo * DAY);
    const start = new Date(planned.getFullYear(), planned.getMonth(), planned.getDate(), 8, 0, 0, 0);

    await withTenant(TENANT, "demo-jefe", async (tx: Prisma.TransactionClient) => {
      const order = await tx.productionOrder.create({
        data: {
          tenantId: TENANT,
          orderNumber,
          formulaId: formulaIds[plan.formula],
          formulaVersion: 1,
          plannedQuantity: plan.quantity,
          plannedStart: start,
          status: plan.status,
          createdBy: "demo-jefe",
        },
      });

      for (const [code, percentage] of formula.recipe) {
        await tx.batchEvent.create({
          data: {
            tenantId: TENANT,
            productionOrderId: order.id,
            eventType: "weighing",
            payload: {
              rawMaterialLotId: lotByCode.get(code) ?? "",
              theoreticalQty: (percentage / 100) * plan.quantity,
              actualQty: Math.round((percentage / 100) * plan.quantity * 1000) / 1000,
            },
            actorUserId: "demo-operario",
            occurredAt: start,
            clientEventId: randomUUID(),
          },
        });
      }

      // Sign each completed stage; the quality stage ends at the decision.
      let cursor = start.getTime();
      for (const [stageIndex, stage] of STAGES.entries()) {
        const hours = plan.hours[stageIndex];
        if (hours === 0) break;
        cursor += hours * HOUR;
        const signedAt = new Date(cursor);
        const finalDecision = stage === "calidad" ? (plan.status === "liberado" || plan.status === "rechazado" ? plan.status : null) : null;
        const signatureStage = finalDecision ?? stage;
        const signer = stage === "calidad" ? DEMO_USER : "demo-operario";
        const signature = await tx.batchSignature.create({
          data: {
            productionOrderId: order.id,
            stage: signatureStage,
            signedBy: signer,
            signedAt,
            meaningStatement:
              finalDecision === "liberado"
                ? "Confirmo que reviso los resultados de calidad y libero este lote para su comercialización"
                : finalDecision === "rechazado"
                  ? "Confirmo que reviso los resultados de calidad y rechazo este lote: no puede comercializarse"
                  : `Confirmo que realicé el ${stage} conforme al proceso`,
            reauthVerified: true,
          },
        });
        await tx.batchEvent.create({
          data: {
            tenantId: TENANT,
            productionOrderId: order.id,
            eventType: "signature",
            payload: { stage: signatureStage, signatureId: signature.id },
            actorUserId: signer,
            occurredAt: signedAt,
            clientEventId: randomUUID(),
          },
        });
        if (finalDecision === "liberado") {
          await tx.finishedProductLot.create({
            data: { tenantId: TENANT, productionOrderId: order.id, code: orderNumber, releasedBy: DEMO_USER, releasedAt: signedAt },
          });
        }
      }

      const qcAt = new Date(start.getTime() + (plan.hours[0] + plan.hours[1] + plan.hours[2] + 2) * HOUR);
      for (const result of plan.qc) {
        const spec = formula.specs.find((item) => item.parameter === result.parameter);
        await tx.qcResult.create({
          data: {
            tenantId: TENANT,
            productionOrderId: order.id,
            parameter: result.parameter,
            measuredValue: result.value,
            result: spec ? evaluate(result.value, spec) : "pass",
            recordedBy: "demo-calidad",
            recordedAt: qcAt,
          },
        });
      }

      if (plan.deviation) {
        const closed = plan.deviation.status === "cerrada";
        const investigating = plan.deviation.status !== "abierta";
        const deviation = await tx.deviation.create({
          data: {
            tenantId: TENANT,
            productionOrderId: order.id,
            description: plan.deviation.description,
            status: plan.deviation.status,
            raisedBy: "demo-operario",
            investigationStartedBy: investigating ? "demo-calidad" : null,
            investigationStartedAt: investigating ? new Date(start.getTime() + 6 * HOUR) : null,
            investigation: investigating ? "Revisión del registro de lote, condiciones de proceso y materias primas del lote." : null,
            correctiveAction: investigating ? "Ajuste del procedimiento y reentrenamiento del personal de turno." : null,
            approvedBy: closed ? DEMO_USER : null,
            approvedAt: closed ? new Date(start.getTime() + 3 * DAY) : null,
          },
        });

        if (!closed) {
          await tx.notification.create({
            data: {
              tenantId: TENANT,
              recipientUserId: DEMO_USER,
              kind: plan.deviation.status === "pendiente_aprobacion" ? "desviacion_pendiente_aprobacion" : "desviacion_creada",
              title:
                plan.deviation.status === "pendiente_aprobacion"
                  ? `Desviación lista para aprobar (${orderNumber})`
                  : `Nueva desviación en ${orderNumber}`,
              body: plan.deviation.description,
              link: `/calidad/desviaciones/${deviation.id}`,
              createdAt: new Date(now - plan.daysAgo * DAY + 10 * HOUR),
            },
          });
        }
      }

      const failed = plan.qc.find((result) => {
        const spec = formula.specs.find((item) => item.parameter === result.parameter);
        return spec ? evaluate(result.value, spec) === "fail" : false;
      });
      if (failed && plan.daysAgo <= 10) {
        await tx.notification.create({
          data: {
            tenantId: TENANT,
            recipientUserId: DEMO_USER,
            kind: "qc_fuera_de_especificacion",
            title: `QC fuera de especificación en ${orderNumber}`,
            body: `${failed.parameter}: ${failed.value} fuera del rango especificado.`,
            link: `/produccion/${order.id}`,
            createdAt: qcAt,
          },
        });
      }
    });
  }

  console.log(`Sembradas ${PLANS.length} órdenes de producción en demo-org.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
