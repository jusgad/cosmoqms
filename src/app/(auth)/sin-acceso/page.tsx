import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ShieldOff } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

// Signed in to Clerk, but no active CosmoQMS user: either an admin
// deactivated the account in /usuarios, or the signup webhook has not
// created the row yet. Without this page /login and the app would bounce
// the person back and forth.
export default async function SinAccesoPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-card border border-border bg-card p-6">
        <ShieldOff className="size-8 text-pending" aria-hidden />
        <h1 className="font-sans text-xl font-semibold text-foreground">Sin acceso a CosmoQMS</h1>
        <p className="text-sm text-foreground">
          Su cuenta está desactivada o todavía no ha sido habilitada. Pida a un administrador que la revise en
          la sección Usuarios.
        </p>
        <p className="text-sm text-muted-foreground">
          Si acaba de registrarse, espere unos segundos e intente de nuevo.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Intentar de nuevo
          </Link>
          <SignOutButton redirectUrl="/login">
            <button
              type="button"
              className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cerrar sesión
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
