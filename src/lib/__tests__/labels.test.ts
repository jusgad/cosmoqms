import { describe, it, expect } from "vitest";
import { renderLotLabelHtml, qrSvg } from "../labels";

const LABEL = {
  organizationName: "CosmoLab S.A.S.",
  materialCode: "MP-002",
  materialName: "Glicerina Vegetal",
  supplierLotCode: "GLIC-118",
  qrCode: "MP-550e8400-e29b-41d4-a716-446655440000",
  status: "cuarentena",
  quantityReceived: "50 kg",
  receivedAt: "2026-11-22T15:00:00.000Z",
  expiryDate: "2027-06-30T00:00:00.000Z",
};

describe("lot label", () => {
  it("encodes the internal code as an SVG QR", async () => {
    const svg = await qrSvg(LABEL.qrCode);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
  });

  it("prints material, supplier lot, status and expiry next to the QR", async () => {
    const html = await renderLotLabelHtml(LABEL);
    expect(html).toContain("size: 100mm 70mm");
    expect(html).toContain("Glicerina Vegetal");
    expect(html).toContain("GLIC-118");
    expect(html).toContain("CUARENTENA");
    expect(html).toContain("30/6/2027");
    expect(html).toContain(LABEL.qrCode);
  });

  it("escapes the printed fields", async () => {
    const html = await renderLotLabelHtml({ ...LABEL, materialName: "<b>x</b>" });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
