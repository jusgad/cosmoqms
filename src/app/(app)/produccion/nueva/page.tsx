import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NuevaOrdenForm } from "@/components/production/NuevaOrdenForm";

export default async function NuevaOrdenPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "jefe_planta") {
    redirect("/produccion");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Nueva orden de producción</h1>
      <NuevaOrdenForm />
    </div>
  );
}
