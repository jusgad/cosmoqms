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

// Final-review fix (Important 9): every interpolated value is HTML-escaped.
// `meaningStatement`, QC `parameter` and the other free-text fields are
// user-controlled (any user with signing/QC rights sets them), and this HTML
// becomes a legal batch-record PDF rendered by server-side Chromium — an
// unescaped `<` could rewrite the document's visible content or inject a
// `<script>`/`<img src=...>` that runs in (or makes requests from) the
// renderer. Escaping `& < > " '` covers both element and attribute contexts.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// Minimal inline styling only — this HTML is rendered to PDF via headless
// Chromium (`renderPdf`), never shown in a browser, so it doesn't need to
// follow the app's Tailwind/shadcn design system (no touch targets, no
// interactivity, print-only).
export function renderBatchRecordHtml(order: BatchRecordOrder): string {
  const e = escapeHtml;
  return `
    <html><head><meta charset="utf-8"></head><body style="font-family: sans-serif;">
      <h1>Batch Record — ${e(order.orderNumber)}</h1>
      <p>Estado: ${e(order.status)}</p>
      <h2>Firmas</h2>
      <ul>${order.signatures.map((s) => `<li>${e(s.stage)}: ${e(s.meaningStatement)} — ${e(s.signedBy)} (${e(s.signedAt)})</li>`).join("")}</ul>
      <h2>Resultados de calidad</h2>
      <ul>${order.qcResults.map((r) => `<li>${e(r.parameter)}: ${e(r.measuredValue)} (${e(r.result)})</li>`).join("")}</ul>
      <h2>Eventos</h2>
      <ul>${order.events.map((ev) => `<li>${e(ev.eventType)} — ${e(ev.occurredAt)} — ${e(ev.actorUserId)}</li>`).join("")}</ul>
    </body></html>
  `;
}

// Not unit-tested per the brief: launching a real Chromium browser belongs
// in an e2e/manual check, not a fast unit suite.
//
// Final-review fix (Important 9, second layer): the page is created in a
// context with `javaScriptEnabled: false` (Playwright `BrowserContextOptions`,
// verified in the installed playwright@1.63 types), so even if some future
// field were interpolated without escaping, injected script could never
// execute in the renderer. The document is static markup — nothing in it
// needs JavaScript.
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setContent(html);
    return await page.pdf({ format: "A4" });
  } finally {
    await browser.close();
  }
}
