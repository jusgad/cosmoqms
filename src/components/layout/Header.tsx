import { UserButton } from "@clerk/nextjs";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";

/**
 * Server Component: org name is passed in as a prop, resolved once in
 * `(app)/layout.tsx` (which already fetches the current user/tenant), so
 * this component does no data fetching of its own. `<UserButton />` is a
 * Clerk client component internally, but it can be rendered from a Server
 * Component parent without making this file `"use client"`.
 */
export function Header({ orgName }: { orgName: string }) {
  return (
    <header className="flex h-16 min-h-16 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <span className="truncate font-sans text-base font-semibold text-foreground">
        {orgName}
      </span>
      <div className="flex items-center gap-3">
        <OfflineIndicator />
        <UserButton />
      </div>
    </header>
  );
}
