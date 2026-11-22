import { chromium } from "playwright";
import { escapeHtml } from "@/lib/html";

// Display-shape types for the batch record (the legal document an INVIMA
// inspection asks for, per batch). Deliberately plain, not a raw Prisma
// payload: src/lib/batchRecord.ts resolves ids to names and converts
// `Decimal`/`Date` to `number`/ISO strings at that boundary, which keeps this
// module free of Prisma and trivially unit-testable with a fixture.
export interface BatchRecordSignature {
  stage: string;
  signedBy: string;
  meaningStatement: string;
  signedAt: string;
}

export interface BatchRecordQcResult {
  parameter: string;
  measuredValue: number;
  result: string;
  specification?: string;
  recordedBy?: string;
}

export interface BatchRecordEvent {
  eventType: string;
  occurredAt: string;
  actorUserId: string;
}

export interface BatchRecordWeighing {
  material: string;
  supplierLot: string;
  theoreticalQty: number;
  actualQty: number;
  unit: string;
  weighedBy: string;
  weighedAt: string;
}

export interface BatchRecordDeviation {
  description: string;
  status: string;
  investigation: string | null;
  correctiveAction: string | null;
  raisedBy: string;
  approvedBy: string | null;
}

export interface BatchRecordOrder {
  orderNumber: string;
  status: string;
  organization?: { name: string; nit: string | null; invimaRegistration: string | null };
  formula?: { code: string; name: string; version: number };
  plannedQuantity?: number;
  plannedStart?: string;
  finishedLotCode?: string | null;
  generatedAt?: string;
  generatedBy?: string;
  weighings?: BatchRecordWeighing[];
  signatures: BatchRecordSignature[];
  qcResults: BatchRecordQcResult[];
  deviations?: BatchRecordDeviation[];
  events: BatchRecordEvent[];
}

const STATUS_LABELS: Record<string, string> = {
  planificado: "Planificado",
  pesado: "Pesado",
  mezclado: "Mezclado",
  envasado: "Envasado",
  calidad: "En calidad",
  liberado: "Liberado",
  rechazado: "Rechazado",
};

const STAGE_LABELS: Record<string, string> = {
  pesado: "Pesaje",
  mezclado: "Mezclado",
  envasado: "Envasado",
  calidad: "Calidad",
  liberado: "Liberación",
  rechazado: "Rechazo",
};

const DEVIATION_LABELS: Record<string, string> = {
  abierta: "Abierta",
  en_investigacion: "En investigación",
  pendiente_aprobacion: "Pendiente de aprobación",
  cerrada: "Cerrada",
};

const RESULT_LABELS: Record<string, string> = { pass: "CONFORME", fail: "FALLA" };

export function formatBogota(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function quantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

// Every interpolated value is HTML-escaped (`escapeHtml`): meaning
// statements, QC parameters, deviation texts and names are user-controlled,
// and this HTML becomes a legal PDF rendered by server-side Chromium — an
// unescaped `<` could rewrite the document's visible content.
export function renderBatchRecordHtml(order: BatchRecordOrder): string {
  const e = escapeHtml;
  const org = order.organization;
  const rows = <T,>(items: T[], empty: string, columns: number, render: (item: T) => string) =>
    items.length === 0 ? `<tr><td colspan="${columns}" class="empty">${e(empty)}</td></tr>` : items.map(render).join("");

  const weighings = order.weighings ?? [];
  const deviations = order.deviations ?? [];

  return `
    <!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: sans-serif; color: #134E4A; font-size: 10px; }
      h1 { font-size: 16px; margin: 0 0 2px; }
      h2 { font-size: 12px; margin: 16px 0 6px; }
      .meta { margin: 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; margin: 10px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #CCFBF1; padding: 3px 5px; text-align: left; vertical-align: top; }
      th { background: #F0FDFA; }
      tr { page-break-inside: avoid; }
      .mono { font-family: monospace; }
      .empty { text-align: center; color: #475569; }
      .fail { color: #DC2626; font-weight: bold; }
      .foot { margin-top: 18px; color: #475569; }
    </style></head><body>
      <h1>Registro de lote (batch record) — ${e(order.orderNumber)}</h1>
      ${
        org
          ? `<p class="meta">${e(org.name)}${org.nit ? ` · NIT ${e(org.nit)}` : ""}${org.invimaRegistration ? ` · Registro INVIMA ${e(org.invimaRegistration)}` : ""}</p>`
          : ""
      }
      <div class="grid">
        <span>Estado: <strong>${e(STATUS_LABELS[order.status] ?? order.status)}</strong></span>
        ${order.formula ? `<span>Fórmula: ${e(order.formula.code)} — ${e(order.formula.name)} (versión ${e(order.formula.version)})</span>` : ""}
        ${order.plannedQuantity !== undefined ? `<span>Cantidad planificada: <span class="mono">${e(quantity(order.plannedQuantity))}</span></span>` : ""}
        ${order.plannedStart ? `<span>Inicio planificado: ${e(formatBogota(order.plannedStart))}</span>` : ""}
        ${order.finishedLotCode ? `<span>Lote de producto terminado: <span class="mono">${e(order.finishedLotCode)}</span></span>` : ""}
      </div>

      <h2>Pesajes</h2>
      <table><thead><tr><th>Materia prima</th><th>Lote proveedor</th><th>Teórico</th><th>Pesado</th><th>Responsable</th><th>Fecha</th></tr></thead>
      <tbody>${rows(weighings, "Sin pesajes registrados.", 6, (w) => `<tr><td>${e(w.material)}</td><td class="mono">${e(w.supplierLot)}</td><td class="mono">${e(quantity(w.theoreticalQty))} ${e(w.unit)}</td><td class="mono">${e(quantity(w.actualQty))} ${e(w.unit)}</td><td>${e(w.weighedBy)}</td><td>${e(formatBogota(w.weighedAt))}</td></tr>`)}</tbody></table>

      <h2>Firmas electrónicas</h2>
      <table><thead><tr><th>Etapa</th><th>Declaración</th><th>Firmado por</th><th>Fecha</th></tr></thead>
      <tbody>${rows(order.signatures, "Sin firmas registradas.", 4, (s) => `<tr><td>${e(STAGE_LABELS[s.stage] ?? s.stage)}</td><td>${e(s.meaningStatement)}</td><td>${e(s.signedBy)}</td><td>${e(formatBogota(s.signedAt))}</td></tr>`)}</tbody></table>

      <h2>Control de calidad</h2>
      <table><thead><tr><th>Parámetro</th><th>Especificación</th><th>Medido</th><th>Resultado</th><th>Registró</th></tr></thead>
      <tbody>${rows(order.qcResults, "Sin resultados de calidad.", 5, (r) => `<tr><td>${e(r.parameter)}</td><td>${e(r.specification ?? "—")}</td><td class="mono">${e(r.measuredValue)}</td><td class="${r.result === "fail" ? "fail" : ""}">${e(RESULT_LABELS[r.result] ?? r.result)}</td><td>${e(r.recordedBy ?? "—")}</td></tr>`)}</tbody></table>

      <h2>Desviaciones</h2>
      <table><thead><tr><th>Descripción</th><th>Estado</th><th>Investigación</th><th>Acción correctiva (CAPA)</th><th>Reportó / aprobó</th></tr></thead>
      <tbody>${rows(deviations, "Sin desviaciones.", 5, (d) => `<tr><td>${e(d.description)}</td><td>${e(DEVIATION_LABELS[d.status] ?? d.status)}</td><td>${e(d.investigation ?? "—")}</td><td>${e(d.correctiveAction ?? "—")}</td><td>${e(d.raisedBy)}${d.approvedBy ? ` / ${e(d.approvedBy)}` : ""}</td></tr>`)}</tbody></table>

      <h2>Eventos del lote</h2>
      <table><thead><tr><th>Evento</th><th>Fecha</th><th>Usuario</th></tr></thead>
      <tbody>${rows(order.events, "Sin eventos.", 3, (ev) => `<tr><td>${e(ev.eventType)}</td><td>${e(formatBogota(ev.occurredAt))}</td><td>${e(ev.actorUserId)}</td></tr>`)}</tbody></table>

      ${
        order.generatedAt
          ? `<p class="foot">Generado por CosmoQMS el ${e(formatBogota(order.generatedAt))}${order.generatedBy ? ` por ${e(order.generatedBy)}` : ""}. Documento de solo lectura: los registros de lote no se modifican; las correcciones constan como eventos y desviaciones.</p>`
          : ""
      }
    </body></html>
  `;
}

// Not unit-tested: launching a real Chromium browser belongs in an e2e/manual
// check, not a fast unit suite. The page runs with `javaScriptEnabled: false`,
// so even an unescaped field could never execute script in the renderer.
export async function renderPdf(
  html: string,
  options: {
    landscape?: boolean;
    margin?: { top: string; bottom: string; left: string; right: string };
    // Use the document's own `@page { size }` (e.g. a 100 x 70 mm label).
    preferCSSPageSize?: boolean;
  } = {},
): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setContent(html);
    if (options.preferCSSPageSize) {
      return await page.pdf({ preferCSSPageSize: true, printBackground: true });
    }
    return await page.pdf({
      format: "A4",
      landscape: options.landscape ?? false,
      margin: options.margin ?? { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
  } finally {
    await browser.close();
  }
}
