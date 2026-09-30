import { chromium } from "playwright";

// Display-shape types for the batch record. Deliberately plain (not a raw
// Prisma `GetPayload`): the PDF route converts `Decimal`/`Date` fields to
// `number`/`string` before calling `renderBatchRecordHtml`, the same
// "convert Decimal at the boundary" pattern `qc.ts`'s `specsForFormula` uses
// for `minValue`/`maxValue`. That keeps this module free of a Prisma
// dependency and trivially unit-testable with a plain object fixture.
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
}

export interface BatchRecordEvent {
  eventType: string;
  occurredAt: string;
  actorUserId: string;
}

export interface BatchRecordOrder {
  orderNumber: string;
  status: string;
  signatures: BatchRecordSignature[];
  qcResults: BatchRecordQcResult[];
  events: BatchRecordEvent[];
}

// Minimal inline styling only — this HTML is rendered to PDF via headless
// Chromium (`renderPdf`), never shown in a browser, so it doesn't need to
// follow the app's Tailwind/shadcn design system (no touch targets, no
// interactivity, print-only).
export function renderBatchRecordHtml(order: BatchRecordOrder): string {
  return `
    <html><body style="font-family: sans-serif;">
      <h1>Batch Record — ${order.orderNumber}</h1>
      <p>Estado: ${order.status}</p>
      <h2>Firmas</h2>
      <ul>${order.signatures.map((s) => `<li>${s.stage}: ${s.meaningStatement} — ${s.signedBy} (${s.signedAt})</li>`).join("")}</ul>
      <h2>Resultados de calidad</h2>
      <ul>${order.qcResults.map((r) => `<li>${r.parameter}: ${r.measuredValue} (${r.result})</li>`).join("")}</ul>
      <h2>Eventos</h2>
      <ul>${order.events.map((e) => `<li>${e.eventType} — ${e.occurredAt} — ${e.actorUserId}</li>`).join("")}</ul>
    </body></html>
  `;
}

// Not unit-tested per the brief: launching a real Chromium browser belongs
// in an e2e/manual check, not a fast unit suite.
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    return await page.pdf({ format: "A4" });
  } finally {
    await browser.close();
  }
}
