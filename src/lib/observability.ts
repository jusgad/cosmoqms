import * as Sentry from "@sentry/nextjs";

// Side effects that must never fail the user's action (email delivery,
// post-commit bookkeeping) report through here instead of throwing. Sentry is
// a no-op until `SENTRY_DSN` is configured, so the console line is the only
// trace in local/Docker runs.
export function reportError(error: unknown, context: Record<string, string>): void {
  console.error("[cosmoqms]", context, error);
  Sentry.captureException(error, { tags: context });
}
