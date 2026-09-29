"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { syncPendingEvents } from "@/lib/offline/sync-engine";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  // Task 14: real queue depth instead of only reflecting `navigator.onLine`.
  // `useLiveQuery` re-runs whenever `pendingEvents` changes (a new
  // `queueEvent` from `WeighingForm`, or a `pushedAt`/`failedAt` update from
  // `syncPendingEvents`), so the indicator updates immediately without a
  // manual refresh. `undefined` (still loading) is treated as 0.
  const pendingCount = useLiveQuery(
    () => db.pendingEvents.filter((e) => !e.pushedAt && !e.failedAt).count(),
    [],
    0,
  );
  // Review round 1 fix (Important Finding 2): a hard-rejected event
  // (`failedAt` set — a 4xx the server will never accept on retry, see
  // `sync-engine.ts`) must not look identical to "still pending, will sync
  // once online." This count is checked first below so a permanent failure
  // is never silently masked by an otherwise-empty pending queue.
  const failedCount = useLiveQuery(
    () => db.pendingEvents.filter((e) => !e.pushedAt && !!e.failedAt).count(),
    [],
    0,
  );

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      // Auto-sync on reconnect — the whole point of a queue-first submit is
      // that it drains as soon as the network comes back, not only on the
      // next explicit form submission.
      void syncPendingEvents();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (failedCount > 0) {
    // Solid `bg-destructive` (not just `text-destructive` on a neutral
    // pill) to keep the same "colored pill" visual language as the other
    // two states below, and to keep contrast unambiguous against the
    // white label text (design system: 4.5:1 minimum).
    return (
      <span className="rounded-full bg-destructive px-3 py-1 text-sm text-white">
        {failedCount === 1 ? "1 evento con error" : `${failedCount} eventos con error`}
      </span>
    );
  }

  const hasPending = pendingCount > 0;

  return (
    <span
      className={`rounded-full px-3 py-1 text-sm ${
        !online || hasPending ? "bg-pending text-white" : "bg-success text-white"
      }`}
    >
      {hasPending ? `${pendingCount} eventos pendientes` : online ? "Sincronizado" : "Sin conexión"}
    </span>
  );
}
