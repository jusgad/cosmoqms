import { describe, it, expect } from "vitest";
import { renderBatchRecordHtml, type BatchRecordOrder } from "../pdf";
import { escapeHtml } from "../html";

// Zero-`any` precedent (Tasks 6-17): the brief's literal test cast its fixture
// `as any`. `BatchRecordOrder` is `renderBatchRecordHtml`'s real, exported
// parameter type (see pdf.ts) — a plain display-shape interface, not a raw
// Prisma `GetPayload`, because the PDF route converts `Decimal`/`Date` values
// to `number`/`string` at the boundary before calling this pure function
// (same "convert Decimal at the boundary" pattern as `qc.ts`'s
// `specsForFormula`). That keeps this fixture simple and fully typed.
describe("renderBatchRecordHtml", () => {
  it("includes the order number, every signature, and every QC result in the rendered HTML", () => {
    const order: BatchRecordOrder = {
      orderNumber: "OP-2026-005",
      status: "liberado",
      signatures: [
        {
          stage: "pesado",
          signedBy: "u1",
          meaningStatement: "Confirmo el pesaje",
          signedAt: new Date().toISOString(),
        },
      ],
      qcResults: [{ parameter: "pH", measuredValue: 6.5, result: "pass" }],
      events: [],
    };

    const html = renderBatchRecordHtml(order);

    expect(html).toContain("OP-2026-005");
    expect(html).toContain("Confirmo el pesaje");
    expect(html).toContain("pH");
  });

  // Final-review fix (Important 9): user-controlled free text must never be
  // able to inject markup/script into the legal batch-record PDF.
  it("HTML-escapes user-controlled fields so injected markup and script are rendered inert", () => {
    const order: BatchRecordOrder = {
      orderNumber: "OP-2026-006",
      status: "calidad",
      signatures: [
        {
          stage: "pesado",
          signedBy: "u1",
          meaningStatement: '<script>fetch("http://169.254.169.254/")</script><h1>LIBERADO</h1>',
          signedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      qcResults: [{ parameter: '<img src=x onerror="alert(1)">', measuredValue: 6.5, result: "pass" }],
      events: [{ eventType: "weighing", occurredAt: "2026-01-01T00:00:00.000Z", actorUserId: "a'b\"c&d" }],
    };

    const html = renderBatchRecordHtml(order);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<h1>LIBERADO</h1>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("a&#39;b&quot;c&amp;d");
  });
});

describe("renderBatchRecordHtml — full batch record", () => {
  const full: BatchRecordOrder = {
    orderNumber: "OP-2026-015",
    status: "liberado",
    organization: { name: "CosmoLab S.A.S.", nit: "900123456-7", invimaRegistration: "INVIMA-2026-001" },
    formula: { code: "F-001", name: "Crema Hidratante Base", version: 2 },
    plannedQuantity: 100,
    plannedStart: "2026-11-22T13:00:00.000Z",
    finishedLotCode: "OP-2026-015",
    generatedAt: "2026-11-22T20:00:00.000Z",
    generatedBy: "Diana Directora",
    weighings: [
      {
        material: "MP-002 — Glicerina Vegetal",
        supplierLot: "GLIC-118",
        theoreticalQty: 15,
        actualQty: 15.02,
        unit: "kg",
        weighedBy: "Ana Operaria",
        weighedAt: "2026-11-22T14:00:00.000Z",
      },
    ],
    signatures: [{ stage: "liberado", signedBy: "Diana Directora", meaningStatement: "Libero el lote", signedAt: "2026-11-22T19:00:00.000Z" }],
    qcResults: [{ parameter: "pH", measuredValue: 6.2, result: "pass", specification: "5.5 – 7", recordedBy: "Beatriz Calidad" }],
    deviations: [
      {
        description: "Derrame de 0,5 kg",
        status: "cerrada",
        investigation: "Abrazadera floja",
        correctiveAction: "Cambio de abrazadera",
        raisedBy: "Ana Operaria",
        approvedBy: "Diana Directora",
      },
    ],
    events: [{ eventType: "Pesaje", occurredAt: "2026-11-22T14:00:00.000Z", actorUserId: "Ana Operaria" }],
  };

  it("prints the organization header, formula and finished lot", () => {
    const html = renderBatchRecordHtml(full);
    expect(html).toContain("CosmoLab S.A.S.");
    expect(html).toContain("NIT 900123456-7");
    expect(html).toContain("Registro INVIMA INVIMA-2026-001");
    expect(html).toContain("F-001 — Crema Hidratante Base (versión 2)");
    expect(html).toContain("Lote de producto terminado");
  });

  it("prints weighings with the supplier lot, QC against its specification and deviations with CAPA", () => {
    const html = renderBatchRecordHtml(full);
    expect(html).toContain("GLIC-118");
    expect(html).toContain("15.02 kg");
    expect(html).toContain("5.5 – 7");
    expect(html).toContain("CONFORME");
    expect(html).toContain("Cambio de abrazadera");
    expect(html).toContain("Liberación");
    expect(html).toContain("Generado por CosmoQMS");
  });

  it("escapes deviation texts and names too", () => {
    const html = renderBatchRecordHtml({
      ...full,
      deviations: [{ ...full.deviations![0], description: "<b>x</b>", raisedBy: "<i>y</i>" }],
    });
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<i>y</i>");
  });

  it("shows empty-state rows instead of empty tables", () => {
    const html = renderBatchRecordHtml({ orderNumber: "OP-1", status: "planificado", signatures: [], qcResults: [], events: [] });
    expect(html).toContain("Sin pesajes registrados.");
    expect(html).toContain("Sin desviaciones.");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml(6.5)).toBe("6.5");
  });
});
