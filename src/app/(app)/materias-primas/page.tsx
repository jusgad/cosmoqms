import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { LotsDataTable, type LotRow } from "@/app/(app)/materias-primas/LotsDataTable";

export default async function MateriasPrimasPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const lots = await withTenant(user.tenantId, (tx) =>
    tx.rawMaterialLot.findMany({
      orderBy: { receivedAt: "desc" },
      include: { rawMaterial: true },
    }),
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
        {user.role === "bodega" && (
          <Button render={<Link href="/materias-primas/nueva">Recibir lote</Link>} />
        )}
      </div>
      <LotsDataTable data={rows} />
    </div>
  );
}
