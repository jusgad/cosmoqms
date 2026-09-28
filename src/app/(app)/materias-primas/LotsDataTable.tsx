"use client";

// Client Component: the listing needs client-side sorting and a free-text
// filter over the received lots, which requires interactive state
// (useReactTable + useState). The data itself is still fetched server-side
// in page.tsx via direct Prisma access and passed down as a plain prop.

import { useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, TriangleAlert } from "lucide-react";
import { LotStatusBadge } from "@/components/materials/LotStatusBadge";
import { cn } from "@/lib/utils";
import type { LotStatus } from "@prisma/client";

const DAYS_UNTIL_EXPIRY_WARNING = 30;

export type LotRow = {
  id: string;
  supplierLotCode: string;
  materialCode: string;
  materialName: string;
  status: LotStatus;
  expiryDate: string;
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
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <LotStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "expiryDate",
    header: "Próximo a vencer",
    cell: ({ row }) => {
      const expiry = new Date(row.original.expiryDate);
      const warningDate = new Date(Date.now() + DAYS_UNTIL_EXPIRY_WARNING * 24 * 60 * 60 * 1000);
      const proximo = row.original.status !== "rechazado" && expiry <= warningDate;
      return (
        <span className={cn("flex items-center gap-1 font-mono text-sm", proximo && "text-pending")}>
          {proximo && <TriangleAlert className="size-4" aria-hidden />}
          {expiry.toLocaleDateString("es-CO")}
        </span>
      );
    },
  },
];

export function LotsDataTable({ data }: { data: LotRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        placeholder="Buscar por código o nombre..."
        aria-label="Buscar materia prima"
        className="h-11 w-full max-w-sm rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-xs"
      />
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
