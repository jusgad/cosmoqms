"use client";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm ${online ? "bg-success text-white" : "bg-pending text-white"}`}
    >
      {online ? "Sincronizado" : "Sin conexión"}
    </span>
  );
}
