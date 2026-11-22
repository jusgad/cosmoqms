import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import type { PendingTask } from "@/lib/dashboard/pendingTasks";

// Server Component: the signed-in person's to-do list ("Mis pendientes").
export function PendingTasks({ tasks, roleLabel }: { tasks: PendingTask[]; roleLabel: string }) {
  return (
    <section aria-labelledby="pending-title" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pending-title" className="font-sans text-lg font-semibold text-foreground">
          Mis pendientes
        </h2>
        <span className="text-xs text-muted-foreground">Rol: {roleLabel}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CircleCheck className="size-4" aria-hidden />
          No tiene pendientes. Todo al día.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <li key={task.key}>
              <Link
                href={task.href}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <span>{task.label}</span>
                <span className="flex items-center gap-1">
                  <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-xs font-semibold text-primary-foreground">
                    {task.count}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
