"use client";

// Client Component: client-side sorting of the current page needs
// interactive state (useReactTable + useState). The search runs on the
// server (a plain GET form, `?q=`) so it covers every page, not just the 25
// rows loaded; the data is fetched in page.tsx and passed down as a prop.

import { useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, TriangleAlert } from "lucide-react";
import { LotStatusBadge } from "@/components/materials/LotStatusBadge";
import { cn } from "@/lib/utils";
import { expiresSoon, isExpired, isLowStock } from "@/lib/materials/lotAvailability";
import type { LotStatus } from "@prisma/client";


export type LotRow = {
  id: string;
  supplierLotCode: string;
  materialCode: string;
  materialName: string;
  status: LotStatus;
  expiryDate: string;
  quantityAvailable: number;
  quantityReceived: number;
  unit: string;
};

const columns: ColumnDef<LotRow, unknown>[] = [
  {
    accessorKey: "materialCode",
    header: "Código",
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.materialCode}</span>,
  },
  {
    accessorKey: "materialName",
    header: "Nombre",
  },
  {
    accessorKey: "supplierLotCode",
    header: "Lote proveedor",
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.supplierLotCode}</span>,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <LotStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "quantityAvailable",
    header: "Disponible",
    cell: ({ row }) => {
      const { quantityAvailable, quantityReceived, unit } = row.original;
      const low = isLowStock(quantityAvailable, quantityReceived);
      const empty = quantityAvailable <= 0;
      return (
        <span className={cn("flex items-center gap-1 font-mono text-sm", (low || empty) && "text-pending")}>
          {(low || empty) && <TriangleAlert className="size-4" aria-hidden />}
          {quantityAvailable} {unit}
          {empty ? " (agotado)" : low ? " (bajo)" : ""}
        </span>
      );
    },
  },
  {
    accessorKey: "expiryDate",
    header: "Vence",
    cell: ({ row }) => {
      const expired = row.original.status !== "rechazado" && isExpired(row.original.expiryDate);
      const soon = row.original.status !== "rechazado" && expiresSoon(row.original.expiryDate);
      return (
        <span className={cn("flex items-center gap-1 font-mono text-sm", soon && "text-pending", expired && "text-destructive")}>
          {(soon || expired) && <TriangleAlert className="size-4" aria-hidden />}
          {new Date(row.original.expiryDate).toLocaleDateString("es-CO", { timeZone: "UTC" })}
          {expired ? " (vencido)" : ""}
        </span>
      );
    },
  },
];

export function LotsDataTable({ data, query }: { data: LotRow[]; query: string }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <form method="get" role="search" className="flex w-full max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Buscar por lote, código o nombre..."
          aria-label="Buscar materia prima"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Buscar
        </button>
      </form>
      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-0 text-left">
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex h-11 w-full items-center gap-1 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown className="size-3.5" aria-hidden />
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/materias-primas/${row.original.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:underline"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Sin lotes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
