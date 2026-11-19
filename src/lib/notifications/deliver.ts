import { withTenant } from "@/lib/db";
import { reportError } from "@/lib/observability";
import { emailConfigFromEnv, sendEmails } from "@/lib/notifications/email";
import type { PendingEmail } from "@/lib/notifications/notify";

// Called only after the triggering transaction has committed, so an email is
// never sent about a deviation/QC result that rolled back. `emailedAt` is
// stamped in a second, short transaction once Resend accepted the message.
export async function deliverEmails(emails: PendingEmail[], actorUserId: string): Promise<void> {
  const config = emailConfigFromEnv();
  if (!config || emails.length === 0) return;

  const sentIds = await sendEmails(emails, config);
  if (sentIds.length === 0) return;

  const tenantId = emails[0].tenantId;
  try {
    await withTenant(tenantId, actorUserId, (tx) =>
      tx.notification.updateMany({
        where: { tenantId, id: { in: sentIds } },
        data: { emailedAt: new Date() },
      }),
    );
  } catch (error) {
    reportError(error, { area: "notifications.markEmailed", tenantId });
  }
}
