import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BadgeCheck, Boxes, ClipboardCheck, FlaskConical, Microscope } from "lucide-react";
import type { NotificationKind } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { cn } from "@/lib/utils";
import { MarkReadButton } from "@/app/(app)/notificaciones/MarkReadButton";
import { MarkAllReadButton } from "@/app/(app)/notificaciones/MarkAllReadButton";

const KIND_META: Record<NotificationKind, { label: string; icon: typeof AlertTriangle; tone: string }> = {
  desviacion_creada: { label: "Desviación", icon: AlertTriangle, tone: "text-pending" },
  desviacion_pendiente_aprobacion: { label: "Aprobación pendiente", icon: ClipboardCheck, tone: "text-primary" },
  qc_fuera_de_especificacion: { label: "QC fuera de especificación", icon: FlaskConical, tone: "text-destructive" },
  lote_recibido_cuarentena: { label: "Lote en cuarentena", icon: Boxes, tone: "text-pending" },
  orden_lista_para_calidad: { label: "Orden lista para calidad", icon: Microscope, tone: "text-primary" },
  lote_listo_para_liberar: { label: "Lote listo para liberar", icon: BadgeCheck, tone: "text-success" },
};

export default async function NotificacionesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const notifications = await withTenant(user.tenantId, user.id, (tx) =>
    tx.notification.findMany({
      where: { tenantId: user.tenantId, recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
  const unread = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-2xl font-semibold text-foreground">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            {unread === 0 ? "No tiene notificaciones pendientes." : `${unread} sin leer`}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          Aquí aparecerán las desviaciones nuevas, las desviaciones listas para aprobar y los resultados de
          calidad fuera de especificación.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((notification) => {
            const meta = KIND_META[notification.kind];
            const Icon = meta.icon;
            const isUnread = notification.readAt === null;
            return (
              <li
                key={notification.id}
                className={cn(
                  "flex flex-col gap-3 rounded-card border bg-card p-4 sm:flex-row sm:items-start sm:justify-between",
                  isUnread ? "border-primary" : "border-border",
                )}
              >
                <div className="flex gap-3">
                  <Icon className={cn("mt-0.5 size-5 shrink-0", meta.tone)} aria-hidden />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {meta.label}
                      {isUnread && " · Nueva"}
                    </span>
                    <p className="font-sans text-sm font-semibold text-foreground">{notification.title}</p>
                    <p className="text-sm whitespace-pre-line text-foreground">{notification.body}</p>
                    <time className="font-mono text-xs text-muted-foreground" dateTime={notification.createdAt.toISOString()}>
                      {notification.createdAt.toLocaleString("es-CO")}
                    </time>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-muted"
                    >
                      Ver detalle
                    </Link>
                  )}
                  {isUnread && <MarkReadButton id={notification.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
