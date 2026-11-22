import QRCode from "qrcode";
import { escapeHtml } from "@/lib/html";

// Printable identification label for a raw-material lot: the internal QR the
// operator scans at the weighing station, plus the data a person checks by
// eye (material, supplier lot, status, expiry). One label per page, sized
// 100 x 70 mm for a standard thermal label printer.

export type LotLabel = {
  organizationName: string;
  materialCode: string;
  materialName: string;
  supplierLotCode: string;
  qrCode: string;
  status: string;
  quantityReceived: string;
  receivedAt: string;
  expiryDate: string;
};

const STATUS_LABELS: Record<string, string> = {
  cuarentena: "CUARENTENA",
  liberado: "LIBERADO",
  rechazado: "RECHAZADO",
};

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: "UTC" });
}

export async function renderLotLabelHtml(label: LotLabel): Promise<string> {
  const e = escapeHtml;
  // The QR library builds the SVG from the code itself (no user markup), so
  // it is inserted as-is; every other field is escaped.
  const svg = await qrSvg(label.qrCode);
  const statusColor = label.status === "liberado" ? "#16A34A" : label.status === "rechazado" ? "#DC2626" : "#D97706";
  return `
    <!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: 100mm 70mm; margin: 0; }
      body { margin: 0; font-family: sans-serif; color: #111827; }
      .label { box-sizing: border-box; width: 100mm; height: 70mm; padding: 4mm; display: grid; grid-template-columns: 30mm 1fr; gap: 4mm; }
      .qr svg { width: 30mm; height: 30mm; }
      .org { font-size: 7pt; color: #475569; margin: 0 0 1mm; }
      .material { font-size: 11pt; font-weight: bold; margin: 0; }
      .code { font-family: monospace; font-size: 9pt; margin: 0 0 2mm; }
      .row { font-size: 8pt; margin: 0.6mm 0; }
      .mono { font-family: monospace; }
      .status { display: inline-block; margin-top: 2mm; padding: 1mm 2mm; border: 0.6mm solid ${statusColor}; color: ${statusColor}; font-weight: bold; font-size: 9pt; }
      .qrtext { grid-column: 1 / span 2; font-family: monospace; font-size: 6.5pt; color: #475569; word-break: break-all; }
    </style></head><body>
      <div class="label">
        <div class="qr">${svg}</div>
        <div>
          <p class="org">${e(label.organizationName)}</p>
          <p class="material">${e(label.materialName)}</p>
          <p class="code">${e(label.materialCode)}</p>
          <p class="row">Lote proveedor: <span class="mono">${e(label.supplierLotCode)}</span></p>
          <p class="row">Recibido: <span class="mono">${e(day(label.receivedAt))}</span> · Cantidad: <span class="mono">${e(label.quantityReceived)}</span></p>
          <p class="row">Vence: <span class="mono">${e(day(label.expiryDate))}</span></p>
          <span class="status">${e(STATUS_LABELS[label.status] ?? label.status)}</span>
        </div>
        <div class="qrtext">${e(label.qrCode)}</div>
      </div>
    </body></html>
  `;
}
