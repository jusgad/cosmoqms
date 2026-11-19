import { FileText, Image as ImageIcon } from "lucide-react";
import type { AttachmentListItem } from "@/lib/attachments/service";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}

export function AttachmentList({ items, emptyText }: { items: AttachmentListItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
      {items.map((item) => {
        const Icon = item.mimeType === "application/pdf" ? FileText : ImageIcon;
        return (
          <li key={item.id}>
            <a
              href={`/api/attachments/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
            >
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-sm text-foreground">{item.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatSize(item.sizeBytes)} · {item.uploadedByName} · {item.uploadedAt.toLocaleString("es-CO")}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
