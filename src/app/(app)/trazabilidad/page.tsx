import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TraceabilitySearch } from "@/app/(app)/trazabilidad/TraceabilitySearch";

// Server Component doing the auth/role gate (same pattern as
// calidad/page.tsx, materias-primas/page.tsx, produccion/page.tsx) — the
// route itself stays server-rendered and redirects unauthorized/unauthenticated
// users before any client JS ships, rather than relying on a client-side
// check alone. The actual search UI is the `"use client"` `TraceabilitySearch`
// component (real interactivity: free-text input, direction toggle, tRPC
// queries) — mirrors `byRawMaterialLot`/`byFinishedLot`'s own
// `roleProcedure("calidad", "director_tecnico")` gate, never the only
// enforcement.
export default async function TrazabilidadPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "calidad" && user.role !== "director_tecnico") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Trazabilidad</h1>
      <p className="text-sm text-muted-foreground">
        Busque por código de lote de materia prima o de producto terminado para ver su genealogía
        bidireccional.
      </p>
      <TraceabilitySearch />
    </div>
  );
}
