"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { syncPendingEvents } from "@/lib/offline/sync-engine";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  // Task 14: real queue depth instead of only reflecting `navigator.onLine`.
  // `useLiveQuery` re-runs whenever `pendingEvents` changes (a new
  // `queueEvent` from `WeighingForm`, or a `pushedAt` update from
  // `syncPendingEvents`), so the indicator updates immediately without a
  // manual refresh. `undefined` (still loading) is treated as 0 pending.
  const pendingCount = useLiveQuery(
    () => db.pendingEvents.filter((e) => !e.pushedAt).count(),
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
