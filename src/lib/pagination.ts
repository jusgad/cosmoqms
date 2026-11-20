// Server-side offset pagination for list pages (`?pagina=N`). Offset is fine
// at this scale (a lab's lots/formulas/deviations/audit rows per tenant) and
// keeps page links shareable and bookmarkable.

export const PAGE_SIZE = 25;
const MAX_PAGE = 10_000;

export function pageFromParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
}

export function pageArgs(page: number, pageSize = PAGE_SIZE): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function totalPages(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Builds `/path?a=1&pagina=N`, keeping the other filters of the page.
export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("pagina", String(page));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}
