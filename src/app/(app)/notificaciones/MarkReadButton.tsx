"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => router.refresh() });

  return (
    <Button variant="outline" onClick={() => markRead.mutate({ id })} disabled={markRead.isPending}>
      Marcar como leída
    </Button>
  );
}
