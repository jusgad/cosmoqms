import { describe, it, expect } from "vitest";
import { renderBatchRecordHtml, type BatchRecordOrder } from "../pdf";

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
});
