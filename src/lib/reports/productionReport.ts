import { escapeHtml } from "@/lib/html";

// Consolidated BPM production & quality report for a period: one row per
// production order with activity in the period, covering what an INVIMA BPM
// inspection asks to see per batch — formula and version, quantities, dates,
// QC results, deviations, the final release/rejection signature and the
// raw-material lots consumed (traceability). There is no single official
// INVIMA export template; this structure follows the batch-record contents
// of the BPM for cosmetics and should be validated by the director técnico.

export type ReportHeader = {
  orgName: string;
  nit: string | null;
  invimaRegistration: string | null;
  from: Date;
  to: Date;
  generatedAt: Date;
  generatedBy: string;
};

export type ReportRow = {
  orderNumber: string;
  formula: string;
  formulaVersion: number;
  plannedQuantity: number;
  status: string;
  startedAt: Date | null;
  decision: "liberado" | "rechazado" | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  qcTotal: number;
  qcFailed: number;
  failedParameters: string[];
  deviationsTotal: number;
  deviationsOpen: number;
  rawMaterialLots: string[];
};

export type ReportSourceOrder = {
  orderNumber: string;
  formulaCode: string;
  formulaName: string;
  formulaVersion: number;
  plannedQuantity: number;
  status: string;
  firstWeighingAt: Date | null;
  signatures: { stage: string; signedAt: Date; signedBy: string }[];
  qcResults: { parameter: string; result: string }[];
  deviations: { status: string }[];
  rawMaterialLots: string[];
};

const STATUS_LABELS: Record<string, string> = {
  planificado: "Planificado",
  pesado: "Pesado",
  mezclado: "Mezclado",
  envasado: "Envasado",
  calidad: "En calidad",
  liberado: "Liberado",
  rechazado: "Rechazado",
};

export function buildReportRows(orders: ReportSourceOrder[], userNames: Map<string, string>): ReportRow[] {
  return orders.map((order) => {
    const decisionSignature = order.signatures.find(
      (signature) => signature.stage === "liberado" || signature.stage === "rechazado",
    );
    const failed = order.qcResults.filter((result) => result.result === "fail");
    return {
      orderNumber: order.orderNumber,
      formula: `${order.formulaCode} — ${order.formulaName}`,
      formulaVersion: order.formulaVersion,
      plannedQuantity: order.plannedQuantity,
      status: STATUS_LABELS[order.status] ?? order.status,
      startedAt: order.firstWeighingAt,
      decision: decisionSignature ? (decisionSignature.stage as "liberado" | "rechazado") : null,
      decidedAt: decisionSignature?.signedAt ?? null,
      decidedBy: decisionSignature ? (userNames.get(decisionSignature.signedBy) ?? decisionSignature.signedBy) : null,
      qcTotal: order.qcResults.length,
      qcFailed: failed.length,
      failedParameters: [...new Set(failed.map((result) => result.parameter))],
      deviationsTotal: order.deviations.length,
      deviationsOpen: order.deviations.filter((deviation) => deviation.status !== "cerrada").length,
      rawMaterialLots: order.rawMaterialLots,
    };
  });
}

const dateFmt = (date: Date | null) => (date ? date.toLocaleDateString("es-CO") : "");
const dateTimeFmt = (date: Date | null) =>
  date
    ? date.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
const numberFmt = (value: number) => value.toLocaleString("es-CO", { maximumFractionDigits: 3, useGrouping: false });

// `pdfWidth` (% of the landscape page) keeps the PDF table readable: narrow
// numeric columns, room for the formula and the raw-material lots.
type Column = {
  title: string;
  pdfTitle?: string;
  pdfWidth: number;
  value: (row: ReportRow) => string;
  lines?: (row: ReportRow) => string[];
};

const COLUMNS: Column[] = [
  { title: "Orden", pdfWidth: 7, value: (row) => row.orderNumber },
  { title: "Fórmula", pdfWidth: 12, value: (row) => row.formula },
  { title: "Versión", pdfTitle: "Ver.", pdfWidth: 4, value: (row) => String(row.formulaVersion) },
  { title: "Cantidad planificada", pdfTitle: "Cant. plan.", pdfWidth: 6, value: (row) => numberFmt(row.plannedQuantity) },
  { title: "Estado", pdfWidth: 6, value: (row) => row.status },
  { title: "Inicio de producción", pdfTitle: "Inicio", pdfWidth: 8, value: (row) => dateTimeFmt(row.startedAt) },
  { title: "Decisión final", pdfTitle: "Decisión", pdfWidth: 6, value: (row) => (row.decision === "liberado" ? "Liberado" : row.decision === "rechazado" ? "Rechazado" : "Pendiente") },
  { title: "Fecha decisión", pdfWidth: 8, value: (row) => dateTimeFmt(row.decidedAt) },
  { title: "Firmado por", pdfWidth: 7, value: (row) => row.decidedBy ?? "" },
  { title: "Resultados QC", pdfTitle: "QC", pdfWidth: 4, value: (row) => String(row.qcTotal) },
  { title: "QC no conformes", pdfTitle: "QC no conf.", pdfWidth: 4, value: (row) => String(row.qcFailed) },
  { title: "Parámetros no conformes", pdfTitle: "Parám. no conf.", pdfWidth: 6, value: (row) => row.failedParameters.join(", ") },
  { title: "Desviaciones", pdfTitle: "Desv.", pdfWidth: 4, value: (row) => String(row.deviationsTotal) },
  { title: "Desviaciones abiertas", pdfTitle: "Desv. abiertas", pdfWidth: 4, value: (row) => String(row.deviationsOpen) },
  {
    title: "Lotes de materia prima",
    pdfTitle: "Lotes de MP",
    pdfWidth: 14,
    value: (row) => row.rawMaterialLots.join(" | "),
    lines: (row) => row.rawMaterialLots,
  },
];

// Excel in a Spanish (Colombia) locale expects `;` as the list separator and
// `,` as the decimal mark; the UTF-8 BOM makes it read accents correctly.
function csvField(value: string): string {
  // Leading = + - @ would be evaluated as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: ReportHeader, rows: ReportRow[]): string {
  const meta = [
    ["Reporte consolidado de producción y calidad (BPM)"],
    ["Organización", header.orgName],
    ["NIT", header.nit ?? ""],
    ["Registro INVIMA", header.invimaRegistration ?? ""],
    ["Período", `${dateFmt(header.from)} a ${dateFmt(header.to)}`],
    ["Generado", `${dateTimeFmt(header.generatedAt)} por ${header.generatedBy}`],
    [],
  ];
  const lines = [
    ...meta.map((line) => line.map(csvField).join(";")),
    COLUMNS.map((column) => csvField(column.title)).join(";"),
    ...rows.map((row) => COLUMNS.map((column) => csvField(column.value(row))).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function renderReportHtml(header: ReportHeader, rows: ReportRow[]): string {
  const e = escapeHtml;
  const released = rows.filter((row) => row.decision === "liberado").length;
  const rejected = rows.filter((row) => row.decision === "rechazado").length;
  const openDeviations = rows.reduce((sum, row) => sum + row.deviationsOpen, 0);
  const body =
    rows.length === 0
      ? `<tr><td colspan="${COLUMNS.length}" style="text-align:center;padding:16px;">Sin órdenes con actividad en el período.</td></tr>`
      : rows
          .map(
            (row) =>
              `<tr>${COLUMNS.map((column) => {
                const cell = column.lines ? column.lines(row).map(e).join("<br>") : e(column.value(row));
                return `<td>${cell}</td>`;
              }).join("")}</tr>`,
          )
          .join("");

  return `
    <!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: sans-serif; color: #134E4A; font-size: 8px; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      .meta { margin: 0 0 12px; font-size: 10px; }
      .summary { margin: 0 0 12px; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #CCFBF1; padding: 3px 4px; text-align: left; vertical-align: top; overflow-wrap: break-word; }
      th { background: #F0FDFA; }
      tr { page-break-inside: avoid; }
      .firma { margin-top: 32px; font-size: 10px; }
    </style></head><body>
      <h1>Reporte consolidado de producción y calidad (BPM)</h1>
      <p class="meta">
        ${e(header.orgName)}${header.nit ? ` · NIT ${e(header.nit)}` : ""}${header.invimaRegistration ? ` · Registro INVIMA ${e(header.invimaRegistration)}` : ""}<br>
        Período: ${e(dateFmt(header.from))} a ${e(dateFmt(header.to))} · Generado ${e(dateTimeFmt(header.generatedAt))} por ${e(header.generatedBy)}
      </p>
      <p class="summary">
        Órdenes: ${rows.length} · Liberadas: ${released} · Rechazadas: ${rejected} · Desviaciones abiertas: ${openDeviations}
      </p>
      <table>
        <colgroup>${COLUMNS.map((column) => `<col style="width:${column.pdfWidth}%">`).join("")}</colgroup>
        <thead><tr>${COLUMNS.map((column) => `<th>${e(column.pdfTitle ?? column.title)}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      <p class="firma">Revisado por (Director Técnico): ______________________________ Fecha: ______________</p>
    </body></html>
  `;
}
