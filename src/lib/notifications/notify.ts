import type { NotificationKind, Prisma, Role } from "@prisma/client";

export type NotificationDraft = {
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
};

export type PendingEmail = {
  notificationId: string;
  tenantId: string;
  to: string;
  title: string;
  body: string;
  link?: string;
};

// Who hears about what. A deviation or an out-of-spec QC result is a quality
// event, so calidad and director_tecnico always get it; jefe_planta also gets
// QC failures because the batch is physically on their floor.
export const NOTIFICATION_AUDIENCE: Record<NotificationKind, Role[]> = {
  desviacion_creada: ["calidad", "director_tecnico"],
  desviacion_pendiente_aprobacion: ["director_tecnico"],
  qc_fuera_de_especificacion: ["calidad", "director_tecnico", "jefe_planta"],
};

// Must be called with the caller's own `withTenant` transaction so the inbox
// rows commit or roll back with the event that caused them. The person who
// triggered the event is not notified about their own action. Returns the
// emails to send AFTER the transaction commits (see `deliverEmails`).
export async function notifyAudience(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; actorUserId: string; draft: NotificationDraft },
): Promise<PendingEmail[]> {
  const { tenantId, actorUserId, draft } = params;
  const recipients = await tx.user.findMany({
    where: {
      tenantId,
      active: true,
      role: { in: NOTIFICATION_AUDIENCE[draft.kind] },
      id: { not: actorUserId },
    },
    select: { id: true, email: true },
  });
  if (recipients.length === 0) return [];

  const created = await tx.notification.createManyAndReturn({
    data: recipients.map((recipient) => ({
      tenantId,
      recipientUserId: recipient.id,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      link: draft.link,
    })),
    select: { id: true, recipientUserId: true },
  });

  const emailByUser = new Map(recipients.map((recipient) => [recipient.id, recipient.email]));
  return created.flatMap((notification) => {
    const to = emailByUser.get(notification.recipientUserId);
    return to
      ? [{ notificationId: notification.id, tenantId, to, title: draft.title, body: draft.body, link: draft.link }]
      : [];
  });
}
