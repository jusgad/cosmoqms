import { escapeHtml } from "@/lib/html";
import { reportError } from "@/lib/observability";
import type { PendingEmail } from "@/lib/notifications/notify";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailConfig = { apiKey: string; from: string; appUrl: string };

// Email is optional infrastructure: with no RESEND_API_KEY the in-app inbox is
// the whole feature and nothing is sent.
export function emailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFICATIONS_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return { apiKey, from, appUrl: (env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") };
}

export function renderNotificationEmail(email: PendingEmail, appUrl: string): string {
  const e = escapeHtml;
  const href = email.link ? `${appUrl}${email.link}` : appUrl;
  return `
    <div style="font-family: sans-serif; color: #134E4A; max-width: 560px;">
      <h2 style="margin: 0 0 12px;">${e(email.title)}</h2>
      <p style="margin: 0 0 16px; white-space: pre-line;">${e(email.body)}</p>
      <a href="${e(href)}" style="color: #0891B2;">Abrir en CosmoQMS</a>
      <p style="margin-top: 24px; font-size: 12px; color: #475569;">
        Notificación automática del sistema de calidad CosmoQMS.
      </p>
    </div>
  `;
}

// Sends each email independently and returns the ids that went out. A failed
// email is reported, never thrown: the deviation/QC result it is about has
// already committed and must not look like it failed.
export async function sendEmails(
  emails: PendingEmail[],
  config: EmailConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const sent: string[] = [];
  for (const email of emails) {
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.from,
          to: [email.to],
          subject: email.title,
          html: renderNotificationEmail(email, config.appUrl),
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend respondió ${response.status}`);
      }
      sent.push(email.notificationId);
    } catch (error) {
      reportError(error, { area: "notifications.email", notificationId: email.notificationId });
    }
  }
  return sent;
}
