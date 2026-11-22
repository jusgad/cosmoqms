import Link from "next/link";
import { ChevronRight } from "lucide-react";

// A KPI tile. With `href` the whole tile links to the list behind the number
// (only passed when the viewer's role can open that module).
export function KPICard({ label, value, hint, href }: { label: string; value: number | string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        {href && <ChevronRight className="size-4 shrink-0" aria-hidden />}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  if (!href) {
    return <div className="rounded-card border border-border bg-card p-4">{body}</div>;
  }
  return (
    <Link
      href={href}
      className="block rounded-card border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {body}
    </Link>
  );
}
