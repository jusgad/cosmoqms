import type { FormulaStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<FormulaStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

// Design-token mapping decision (see Task 8 report): the brief's Step 10
// says "colors: muted/accent/border" for draft/active/archived, but Task 1's
// review renamed the status-green token away from `accent` (which in this
// codebase means hover/subtle background, not status-green) to
// `bg-success`/`text-success`. So: draft -> muted, active -> success,
// archived -> a neutral border-only treatment (distinct from draft's filled
// muted look, signaling "retired" rather than "not yet active").
const STATUS_CLASSES: Record<FormulaStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-success/10 text-success border-success/30",
  archived: "bg-transparent text-muted-foreground border-border",
};

export function FormulaStatusBadge({ status }: { status: FormulaStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium",
        STATUS_CLASSES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
