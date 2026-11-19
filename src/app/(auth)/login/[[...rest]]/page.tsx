import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";

// A Clerk session whose CosmoQMS user is missing or deactivated goes to
// /sin-acceso instead of looping between /login and the app.
export default async function LoginPage() {
  const { userId } = await auth();
  if (userId) {
    redirect((await getCurrentUser()) ? "/dashboard" : "/sin-acceso");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-8">
      <SignIn />
    </main>
  );
}
