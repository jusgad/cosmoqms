// Reads the data some suppliers encode in the QR / barcode printed on a raw
// material package, so the reception form can be pre-filled in one scan.
//
// Pure functions only: this module runs in the browser (ReceiveLotForm) and
// in unit tests. It never decides anything regulated — the lot still enters
// `cuarentena` server-side and the operator reviews every pre-filled field
// before submitting.
//
// Supported payloads, tried in this order:
//   1. GS1 Digital Link URL  https://id.gs1.org/01/<gtin>/10/<lot>?17=YYMMDD
//   2. GS1 element string    (01)…(10)…(17)… or raw with FNC1/GS separators
//   3. JSON                  {"codigo":"MP-001","lote":"L-1","vence":"2027-06-30"}
//   4. Key/value text        LOTE: L-1; VENCE: 30/06/2027; CANT: 25
//   5. Anything else         kept as the supplier's own code

export type SupplierQrFormat = "gs1" | "json" | "clave-valor" | "texto";

export type SupplierQrData = {
  format: SupplierQrFormat;
  /** Supplier code to keep on the lot (GTIN, or the raw text when nothing else was read). */
  supplierCode?: string;
  materialCode?: string;
  materialName?: string;
  supplierLotCode?: string;
  quantity?: number;
  /** ISO date, YYYY-MM-DD. */
  expiryDate?: string;
  coaUrl?: string;
};

export type MaterialRef = { id: string; code: string; name: string };

const GS = "\u001d";

type FieldKey = "materialCode" | "materialName" | "supplierLotCode" | "quantity" | "expiryDate" | "coaUrl" | "supplierCode";

// Normalized (lowercase, no accents, letters/digits only) aliases → field.
const ALIASES: Record<string, FieldKey> = {
  codigo: "materialCode", cod: "materialCode", code: "materialCode", materialcode: "materialCode",
  codigomaterial: "materialCode", codigomp: "materialCode", sku: "materialCode", ref: "materialCode",
  referencia: "materialCode", item: "materialCode", producto: "materialName", material: "materialName",
  materiaprima: "materialName", nombre: "materialName", name: "materialName", descripcion: "materialName",
  description: "materialName", lote: "supplierLotCode", lot: "supplierLotCode", batch: "supplierLotCode",
  lotno: "supplierLotCode", nolote: "supplierLotCode", numerolote: "supplierLotCode", lotnumber: "supplierLotCode",
  supplierlotcode: "supplierLotCode", cantidad: "quantity", cant: "quantity", qty: "quantity", quantity: "quantity",
  peso: "quantity", pesoneto: "quantity", netweight: "quantity", contenido: "quantity", vence: "expiryDate",
  vencimiento: "expiryDate", fechavencimiento: "expiryDate", fechadevencimiento: "expiryDate",
  fvencimiento: "expiryDate", fechavto: "expiryDate", fechaexp: "expiryDate", fv: "expiryDate", fvto: "expiryDate", vto: "expiryDate",
  exp: "expiryDate", expiry: "expiryDate", expirydate: "expiryDate", expiration: "expiryDate", caducidad: "expiryDate",
  coa: "coaUrl", coaurl: "coaUrl", certificado: "coaUrl", certificadoanalisis: "coaUrl", gtin: "supplierCode",
  ean: "supplierCode", codigoproveedor: "supplierCode", suppliercode: "supplierCode",
};

function normalizeKey(key: string): string {
  return key.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** GS1 YYMMDD; day 00 means the last day of the month. Years 00–49 → 20xx, 50–99 → 19xx. */
export function parseGs1Date(value: string): string | undefined {
  if (!/^\d{6}$/.test(value)) return undefined;
  const yy = Number(value.slice(0, 2));
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  const month = Number(value.slice(2, 4));
  let day = Number(value.slice(4, 6));
  if (day === 0 && month >= 1 && month <= 12) day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return validDate(year, month, day);
}

/** Accepts YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, YYYYMMDD or GS1 YYMMDD. */
export function parseFlexibleDate(value: string): string | undefined {
  const v = value.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v);
  if (m) return validDate(Number(m[3]), Number(m[2]), Number(m[1]));
  if (/^\d{8}$/.test(v)) return validDate(Number(v.slice(0, 4)), Number(v.slice(4, 6)), Number(v.slice(6, 8)));
  return parseGs1Date(v);
}

/** "25", "25,5", "1.250,75", "25.5 kg" → number; anything else → undefined. */
export function parseQuantity(value: string | number): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  const match = /-?\d[\d.,]*/.exec(value.trim());
  if (!match) return undefined;
  let digits = match[0];
  if (digits.includes(",") && digits.includes(".")) {
    digits = digits.lastIndexOf(",") > digits.lastIndexOf(".")
      ? digits.replace(/\./g, "").replace(",", ".")
      : digits.replace(/,/g, "");
  } else if (digits.includes(",")) {
    digits = digits.replace(",", ".");
  }
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function assign(data: SupplierQrData, field: FieldKey, raw: string | number): void {
  const text = String(raw).trim();
  if (!text) return;
  if (field === "quantity") {
    const q = parseQuantity(raw);
    if (q !== undefined) data.quantity = q;
  } else if (field === "expiryDate") {
    const d = parseFlexibleDate(text);
    if (d) data.expiryDate = d;
  } else if (field === "coaUrl") {
    if (/^https?:\/\//i.test(text)) data.coaUrl = text;
  } else {
    data[field] = text;
  }
}

function hasData(data: SupplierQrData): boolean {
  return Boolean(data.materialCode || data.materialName || data.supplierLotCode || data.quantity || data.expiryDate || data.coaUrl);
}

// ---------- GS1 ----------

// Fixed-length AIs (data length, without the AI) used to split raw strings.
const GS1_FIXED: Record<string, number> = { "00": 18, "01": 14, "02": 14, "11": 6, "13": 6, "15": 6, "16": 6, "17": 6 };

function applyGs1(data: SupplierQrData, ai: string, value: string): void {
  if (ai === "01" || ai === "02") data.supplierCode = value;
  else if (ai === "10") data.supplierLotCode = value;
  else if (ai === "17" || (ai === "15" && !data.expiryDate)) {
    const d = parseGs1Date(value);
    if (d) data.expiryDate = d;
  } else if (ai === "30" || ai === "37") {
    const q = parseQuantity(value);
    if (q !== undefined) data.quantity = q;
  } else if (/^31[0-5]\d$/.test(ai)) {
    // 310n–315n: net measure with n implied decimals (e.g. 3102 000250 → 2.50).
    const n = Number(value) / 10 ** Number(ai.slice(3));
    if (n > 0) data.quantity = n;
  } else if (ai === "240") {
    data.materialCode = value;
  }
}

function gs1AiLength(rest: string): { ai: string; fixed?: number } | undefined {
  const two = rest.slice(0, 2);
  if (two in GS1_FIXED) return { ai: two, fixed: GS1_FIXED[two] };
  if (two === "10" || two === "21" || two === "30" || two === "37") return { ai: two };
  const three = rest.slice(0, 3);
  if (three === "240" || three === "241") return { ai: three };
  const four = rest.slice(0, 4);
  if (/^31[0-5]\d$/.test(four)) return { ai: four, fixed: 6 };
  return undefined;
}

function parseGs1(raw: string): SupplierQrData | undefined {
  let text = raw.trim().replace(/^\][A-Za-z]\d/, "");
  const data: SupplierQrData = { format: "gs1" };

  if (/^\(\d{2,4}\)/.test(text)) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) applyGs1(data, m[1], m[2].replace(new RegExp(GS, "g"), "").trim());
    return data.supplierCode || hasData(data) ? data : undefined;
  }

  // Raw element string: must start with a known AI and be digits/GS-separated.
  if (!(text.includes(GS) || /^(01|02)\d{14}/.test(text))) return undefined;
  let guard = 0;
  while (text.length > 0 && guard++ < 20) {
    if (text.startsWith(GS)) { text = text.slice(1); continue; }
    const spec = gs1AiLength(text);
    if (!spec) return data.supplierCode || hasData(data) ? data : undefined;
    text = text.slice(spec.ai.length);
    let value: string;
    if (spec.fixed !== undefined) {
      value = text.slice(0, spec.fixed);
      text = text.slice(spec.fixed);
    } else {
      const end = text.indexOf(GS);
      value = end === -1 ? text : text.slice(0, end);
      text = end === -1 ? "" : text.slice(end + 1);
    }
    applyGs1(data, spec.ai, value);
  }
  return data.supplierCode || hasData(data) ? data : undefined;
}

function parseDigitalLink(raw: string): SupplierQrData | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  const parts = url.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  const idx = parts.findIndex((p) => p === "01" || p === "gtin");
  if (idx === -1 || !/^\d{8,14}$/.test(parts[idx + 1] ?? "")) return undefined;
  const data: SupplierQrData = { format: "gs1" };
  for (let i = idx; i + 1 < parts.length; i += 2) applyGs1(data, parts[i] === "gtin" ? "01" : parts[i], parts[i + 1]);
  url.searchParams.forEach((value, key) => applyGs1(data, key, value));
  return data;
}

// ---------- JSON / key-value ----------

function parseJson(raw: string): SupplierQrData | undefined {
  const text = raw.trim();
  if (!text.startsWith("{")) return undefined;
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const data: SupplierQrData = { format: "json" };
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const field = ALIASES[normalizeKey(key)];
    if (field && (typeof value === "string" || typeof value === "number")) assign(data, field, value);
  }
  return hasData(data) || data.supplierCode ? data : undefined;
}

function parseKeyValue(raw: string): SupplierQrData | undefined {
  const data: SupplierQrData = { format: "clave-valor" };
  const pieces = raw.split(/[\r\n;|]+/);
  let matched = 0;
  for (const piece of pieces) {
    const m = /^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/.exec(piece);
    if (!m) continue;
    const field = ALIASES[normalizeKey(m[1])];
    if (!field) continue;
    assign(data, field, m[2]);
    matched++;
  }
  return matched > 0 && (hasData(data) || data.supplierCode) ? data : undefined;
}

/** Interprets a scanned supplier code. Never throws. */
export function parseSupplierQr(raw: string): SupplierQrData {
  const text = raw.trim();
  if (!text) return { format: "texto" };
  const parsed = parseDigitalLink(text) ?? parseGs1(text) ?? parseJson(text) ?? parseKeyValue(text);
  if (parsed) {
    if (!parsed.supplierCode) parsed.supplierCode = text.length <= 120 ? text : undefined;
    return parsed;
  }
  return { format: "texto", supplierCode: text };
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Finds the catalog material the QR refers to: exact code first (case-
 * insensitive, also matching the supplier code/GTIN), then exact name.
 * Returns undefined when nothing matches unambiguously — the operator then
 * picks it by hand.
 */
export function matchMaterial(data: SupplierQrData, materials: MaterialRef[]): MaterialRef | undefined {
  const codes = [data.materialCode, data.supplierCode].filter((c): c is string => Boolean(c)).map((c) => c.toLowerCase());
  for (const code of codes) {
    const hit = materials.find((m) => m.code.toLowerCase() === code);
    if (hit) return hit;
  }
  if (data.materialName) {
    const name = normalizeName(data.materialName);
    const hits = materials.filter((m) => normalizeName(m.name) === name);
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}
