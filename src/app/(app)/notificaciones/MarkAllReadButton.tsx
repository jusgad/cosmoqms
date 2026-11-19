"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => router.refresh() });

  return (
    <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
      Marcar todas como leídas
    </Button>
  );
}
