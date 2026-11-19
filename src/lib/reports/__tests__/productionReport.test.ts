import { describe, it, expect } from "vitest";
import { buildReportRows, renderReportHtml, toCsv, type ReportHeader, type ReportSourceOrder } from "../productionReport";
import { productionReportQuery } from "@/lib/validation/reports";

const released: ReportSourceOrder = {
  orderNumber: "OP-2026-001",
  formulaCode: "F-001",
  formulaName: "Crema Hidratante Base",
  formulaVersion: 2,
  plannedQuantity: 150.5,
  status: "liberado",
  firstWeighingAt: new Date(2026, 10, 3, 8, 0),
  signatures: [
    { stage: "pesado", signedAt: new Date(2026, 10, 3, 10, 0), signedBy: "u-op" },
    { stage: "liberado", signedAt: new Date(2026, 10, 5, 16, 0), signedBy: "u-dir" },
  ],
  qcResults: [
    { parameter: "pH", result: "pass" },
    { parameter: "Viscosidad", result: "pass" },
  ],
  deviations: [{ status: "cerrada" }],
  rawMaterialLots: ["MP-001 lote PROV-AGUA-01", "MP-002 lote PROV-GLIC-01"],
};

const rejected: ReportSourceOrder = {
  ...released,
  orderNumber: "OP-2026-002",
  status: "rechazado",
  signatures: [{ stage: "rechazado", signedAt: new Date(2026, 10, 9, 11, 0), signedBy: "u-dir" }],
  qcResults: [
    { parameter: "pH", result: "fail" },
    { parameter: "pH", result: "fail" },
  ],
  deviations: [{ status: "abierta" }, { status: "cerrada" }],
};

const names = new Map([["u-dir", "Diego Director Técnico"]]);

const header: ReportHeader = {
  orgName: "CosmoLab Demo S.A.S.",
  nit: "900123456-7",
  invimaRegistration: "INVIMA-DEMO-2026",
  from: new Date(2026, 10, 1),
  to: new Date(2026, 10, 30, 23, 59, 59),
  generatedAt: new Date(2026, 10, 19, 12, 0),
  generatedBy: "Beatriz Calidad",
};

describe("buildReportRows", () => {
  it("summarises the final decision, QC and deviations per order", () => {
    const [ok, ko] = buildReportRows([released, rejected], names);
    expect(ok).toMatchObject({
      decision: "liberado",
      decidedBy: "Diego Director Técnico",
      qcTotal: 2,
      qcFailed: 0,
      deviationsOpen: 0,
      status: "Liberado",
    });
    expect(ko).toMatchObject({
      decision: "rechazado",
      qcFailed: 2,
      failedParameters: ["pH"],
      deviationsTotal: 2,
      deviationsOpen: 1,
    });
  });

  it("leaves the decision pending for an order still in production", () => {
    const [row] = buildReportRows([{ ...released, status: "mezclado", signatures: [] }], names);
    expect(row).toMatchObject({ decision: null, decidedAt: null, decidedBy: null, status: "Mezclado" });
  });
});

describe("toCsv", () => {
  const csv = toCsv(header, buildReportRows([released, rejected], names));
  const lines = csv.replace(/^﻿/, "").split("\r\n");

  it("starts with a UTF-8 BOM and carries the organization's regulatory header", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines).toContain("NIT;900123456-7");
    expect(lines).toContain("Registro INVIMA;INVIMA-DEMO-2026");
  });

  it("uses ; separators and a decimal comma for Excel (es-CO)", () => {
    const row = lines.find((line) => line.startsWith("OP-2026-001"));
    expect(row?.split(";")[3]).toBe("150,5");
    expect(row).toContain("MP-001 lote PROV-AGUA-01 | MP-002 lote PROV-GLIC-01");
  });

  it("neutralises spreadsheet formulas in free text", () => {
    const evil = buildReportRows([{ ...released, formulaName: "=HYPERLINK(\"http://x\")" }], names);
    const row = toCsv(header, evil).split("\r\n").find((line) => line.startsWith("OP-2026-001"));
    expect(row?.split(";")[1]).not.toMatch(/^=/);
  });
});

describe("renderReportHtml", () => {
  it("escapes user-controlled values and counts outcomes", () => {
    const html = renderReportHtml(header, buildReportRows([{ ...released, formulaName: "<img src=x onerror=1>" }, rejected], names));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=1&gt;");
    expect(html).toContain("Liberadas: 1 · Rechazadas: 1 · Desviaciones abiertas: 1");
  });

  it("states it explicitly when the period has no activity", () => {
    expect(renderReportHtml(header, [])).toContain("Sin órdenes con actividad en el período.");
  });
});

describe("productionReportQuery", () => {
  it("covers the whole last day and defaults to CSV", () => {
    const parsed = productionReportQuery.parse({ from: "2026-11-01", to: "2026-11-30" });
    expect(parsed.format).toBe("csv");
    expect(parsed.from).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0));
    expect(parsed.to).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
  });

  it.each([
    [{ from: "2026-11-30", to: "2026-11-01" }],
    [{ from: "2025-01-01", to: "2026-11-01" }],
    [{ from: "01/11/2026", to: "2026-11-30" }],
    [{ from: "2026-11-01", to: "2026-11-30", format: "xlsx" }],
  ])("rejects %j", (params) => {
    expect(productionReportQuery.safeParse(params).success).toBe(false);
  });
});
