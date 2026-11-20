import { describe, it, expect } from "vitest";
import {
  matchMaterial,
  parseFlexibleDate,
  parseGs1Date,
  parseQuantity,
  parseSupplierQr,
} from "../supplierQr";

const GS = "\u001d";

describe("parseSupplierQr — GS1", () => {
  it("reads a parenthesized element string", () => {
    const data = parseSupplierQr("(01)07701234567893(10)GLIC-2026-118(17)270630(30)50");
    expect(data).toMatchObject({
      format: "gs1",
      supplierCode: "07701234567893",
      supplierLotCode: "GLIC-2026-118",
      expiryDate: "2027-06-30",
      quantity: 50,
    });
  });

  it("reads a raw element string with GS separators and a net weight", () => {
    const data = parseSupplierQr(`]d2010770123456789317270600` + `10L-77${GS}3102002550${GS}240MP-002`);
    expect(data).toMatchObject({
      supplierCode: "07701234567893",
      expiryDate: "2027-06-30",
      supplierLotCode: "L-77",
      quantity: 25.5,
      materialCode: "MP-002",
    });
  });

  it("reads a GS1 Digital Link URL", () => {
    const data = parseSupplierQr("https://id.gs1.org/01/07701234567893/10/AB12?17=280115");
    expect(data).toMatchObject({ format: "gs1", supplierCode: "07701234567893", supplierLotCode: "AB12", expiryDate: "2028-01-15" });
  });
});

describe("parseSupplierQr — JSON and key/value", () => {
  it("reads JSON with Spanish keys and accents", () => {
    const data = parseSupplierQr(
      JSON.stringify({ código: "MP-001", lote: "L-9", cantidad: "25,5", vencimiento: "30/06/2027", coa: "https://prov.co/coa/L-9.pdf" }),
    );
    expect(data).toMatchObject({
      format: "json",
      materialCode: "MP-001",
      supplierLotCode: "L-9",
      quantity: 25.5,
      expiryDate: "2027-06-30",
      coaUrl: "https://prov.co/coa/L-9.pdf",
    });
  });

  it("reads key/value lines", () => {
    const data = parseSupplierQr("MATERIAL: Glicerina Vegetal\nLOTE: GV-55\nCANT: 1.250,75 kg\nF. VENCIMIENTO: 2027-12-31");
    expect(data).toMatchObject({
      format: "clave-valor",
      materialName: "Glicerina Vegetal",
      supplierLotCode: "GV-55",
      quantity: 1250.75,
      expiryDate: "2027-12-31",
    });
  });

  it("reads semicolon-separated pairs and ignores unknown keys", () => {
    const data = parseSupplierQr("SKU=MP-003; LOT=X1; EXP=20270101; COLOR=blanco");
    expect(data).toMatchObject({ materialCode: "MP-003", supplierLotCode: "X1", expiryDate: "2027-01-01" });
  });

  it("drops a COA value that is not a URL", () => {
    expect(parseSupplierQr('{"lote":"A","coa":"ver adjunto"}').coaUrl).toBeUndefined();
  });
});

describe("parseSupplierQr — plain codes", () => {
  it("keeps any other text as the supplier code", () => {
    expect(parseSupplierQr("PROV-ABC-123")).toEqual({ format: "texto", supplierCode: "PROV-ABC-123" });
  });

  it("returns nothing useful for an empty scan", () => {
    expect(parseSupplierQr("   ")).toEqual({ format: "texto" });
  });

  it("does not treat a URL without a GTIN as GS1", () => {
    expect(parseSupplierQr("https://proveedor.co/producto/9").format).toBe("texto");
  });
});

describe("date and quantity helpers", () => {
  it("parses GS1 dates, including day 00 as the last day of the month", () => {
    expect(parseGs1Date("270600")).toBe("2027-06-30");
    expect(parseGs1Date("280200")).toBe("2028-02-29");
    expect(parseGs1Date("271340")).toBeUndefined();
  });

  it("parses the common date formats and rejects impossible dates", () => {
    expect(parseFlexibleDate("2027-06-30")).toBe("2027-06-30");
    expect(parseFlexibleDate("30/06/2027")).toBe("2027-06-30");
    expect(parseFlexibleDate("20270630")).toBe("2027-06-30");
    expect(parseFlexibleDate("31/02/2027")).toBeUndefined();
    expect(parseFlexibleDate("mañana")).toBeUndefined();
  });

  it("parses quantities with comma or dot decimals and rejects non-positive values", () => {
    expect(parseQuantity("25,5")).toBe(25.5);
    expect(parseQuantity("1,250.75")).toBe(1250.75);
    expect(parseQuantity("0")).toBeUndefined();
    expect(parseQuantity("sin dato")).toBeUndefined();
  });
});

describe("matchMaterial", () => {
  const materials = [
    { id: "a", code: "MP-001", name: "Agua Desionizada" },
    { id: "b", code: "MP-002", name: "Glicerina Vegetal" },
    { id: "c", code: "07701234567893", name: "Carbómero 940" },
  ];

  it("matches by code, case-insensitive", () => {
    expect(matchMaterial({ format: "json", materialCode: "mp-002" }, materials)?.id).toBe("b");
  });

  it("matches a GTIN registered as the material code", () => {
    expect(matchMaterial({ format: "gs1", supplierCode: "07701234567893" }, materials)?.id).toBe("c");
  });

  it("matches by name ignoring accents and case", () => {
    expect(matchMaterial({ format: "clave-valor", materialName: "carbomero 940" }, materials)?.id).toBe("c");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchMaterial({ format: "json", materialCode: "MP-999" }, materials)).toBeUndefined();
  });
});
