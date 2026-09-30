"use client";

// Task 15 non-negotiable (carried from Task 7's Blueprint rule: manual entry
// must ALWAYS work standalone, never blocked on or dependent on a scanner):
// this is the default, always-visible way to pick a lot. It has zero
// dependency on camera permissions or `QRScanner` — a plain, filterable text
// search over whatever lots the caller passes in.
import { useState } from "react";

export type LotOption = {
  id: string;
  rawMaterialName: string;
  supplierLotCode: string;
  supplierName?: string;
};

export function LotManualSearch({
  lots,
  onSelect,
}: {
  lots: LotOption[];
  onSelect: (lot: LotOption) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = lots.filter((l) =>
    `${l.rawMaterialName} ${l.supplierLotCode} ${l.supplierName ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Buscar por nombre, codigo o proveedor..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <ul className="flex flex-col gap-1">
        {filtered.map((lot) => (
          <li key={lot.id}>
            <button
              type="button"
              onClick={() => onSelect(lot)}
              className="min-h-[44px] w-full rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground hover:bg-muted"
            >
              {lot.rawMaterialName} — {lot.supplierLotCode}
              {lot.supplierName ? ` (${lot.supplierName})` : ""}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-1 py-2 text-sm text-muted-foreground">Sin resultados.</li>
        )}
      </ul>
    </div>
  );
}
