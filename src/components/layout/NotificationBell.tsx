import Link from "next/link";
import { Bell } from "lucide-react";

// Server Component: the unread count is resolved in `(app)/layout.tsx` and
// refreshed whenever a mutation calls `router.refresh()`.
export function NotificationBell({ unread }: { unread: number }) {
  const label = unread === 0 ? "Notificaciones" : `Notificaciones: ${unread} sin leer`;
  return (
    <Link
      href="/notificaciones"
      aria-label={label}
      title={label}
      className="relative flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[11px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
