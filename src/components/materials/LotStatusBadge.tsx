import type { LotStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<LotStatus, string> = {
  cuarentena: "Cuarentena",
  liberado: "Liberado",
  rechazado: "Rechazado",
};

const STATUS_CLASSES: Record<LotStatus, string> = {
  cuarentena: "bg-pending/10 text-pending border-pending/30",
  liberado: "bg-success/10 text-success border-success/30",
  rechazado: "bg-destructive/10 text-destructive border-destructive/30",
};

export function LotStatusBadge({ status }: { status: LotStatus }) {
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
