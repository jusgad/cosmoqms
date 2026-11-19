import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryOptions";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions(process.env.SENTRY_DSN));
  }
}

// Reports errors thrown in Server Components, route handlers and middleware.
export const onRequestError = Sentry.captureRequestError;
