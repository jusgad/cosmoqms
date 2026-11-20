import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageHref, totalPages } from "@/lib/pagination";

const linkClasses =
  "flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

// Server Component: plain links, so paging works without client JS and every
// page has its own URL.
export function Pagination({
  page,
  total,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = totalPages(total);
  if (total === 0) return null;

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        Página {Math.min(page, pages)} de {pages} · {total} registro{total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(basePath, params, page - 1)} className={linkClasses} rel="prev">
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </Link>
        ) : (
          <span className={cn(linkClasses, "pointer-events-none opacity-50")} aria-disabled="true">
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </span>
        )}
        {page < pages ? (
          <Link href={pageHref(basePath, params, page + 1)} className={linkClasses} rel="next">
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={cn(linkClasses, "pointer-events-none opacity-50")} aria-disabled="true">
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
