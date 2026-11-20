import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { pageArgs, pageFromParam } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/layout/Pagination";
import { LotsDataTable, type LotRow } from "@/app/(app)/materias-primas/LotsDataTable";

export default async function MateriasPrimasPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; q?: string }>;
}) {
  const user = await requirePageRole(MODULE_ROLES.materiasPrimas);
  const params = await searchParams;
  const page = pageFromParam(params.pagina);
  const query = (params.q ?? "").trim().slice(0, 100);

  const where: Prisma.RawMaterialLotWhereInput = {
    tenantId: user.tenantId,
    ...(query && {
      OR: [
        { supplierLotCode: { contains: query, mode: "insensitive" } },
        { rawMaterial: { code: { contains: query, mode: "insensitive" } } },
        { rawMaterial: { name: { contains: query, mode: "insensitive" } } },
      ],
    }),
  };

  const [lots, total] = await withTenant(user.tenantId, user.id, (tx) =>
    Promise.all([
      tx.rawMaterialLot.findMany({ where, orderBy: { receivedAt: "desc" }, include: { rawMaterial: true }, ...pageArgs(page) }),
      tx.rawMaterialLot.count({ where }),
    ]),
  );

  const rows: LotRow[] = lots.map((lot) => ({
    id: lot.id,
    supplierLotCode: lot.supplierLotCode,
    materialCode: lot.rawMaterial.code,
    materialName: lot.rawMaterial.name,
    status: lot.status,
    expiryDate: lot.expiryDate.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold text-foreground">Materias Primas</h1>
        {user.role === "bodega" && <Button render={<Link href="/materias-primas/nueva">Recibir lote</Link>} />}
      </div>
      <LotsDataTable data={rows} query={query} />
      <Pagination page={page} total={total} basePath="/materias-primas" params={{ q: query || undefined }} />
    </div>
  );
}
