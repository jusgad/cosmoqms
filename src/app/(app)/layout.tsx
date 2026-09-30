import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await withTenant(user.tenantId, user.id, (tx) =>
    tx.organization.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
  );

  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[240px_1fr]">
      <Sidebar role={user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header orgName={organization?.name ?? "CosmoQMS"} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
