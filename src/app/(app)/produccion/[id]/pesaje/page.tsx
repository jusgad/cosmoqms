import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { WeighingForm } from "@/components/batch/WeighingForm";

export default async function PesajePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "operario" && user.role !== "jefe_planta") {
    redirect(`/produccion/${id}`);
  }

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { formula: { include: { ingredients: true } } },
    }),
  );
  if (!order) {
    notFound();
  }

  // `theoreticalQty` is computed client-side by WeighingForm from these
  // props (see that file's header comment). Prisma `Decimal` values can't
  // cross the Server->Client Component boundary as-is, so they're converted
  // to plain numbers here.
  const ingredients = order.formula.ingredients.map((ingredient) => ({
    rawMaterialId: ingredient.rawMaterialId,
    percentage: Number(ingredient.percentage),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Registrar pesaje — {order.orderNumber}</h1>
      <WeighingForm
        productionOrderId={order.id}
        plannedQuantity={Number(order.plannedQuantity)}
        ingredients={ingredients}
      />
    </div>
  );
}
