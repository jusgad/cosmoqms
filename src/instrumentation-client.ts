import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryOptions";

// The browser only sees NEXT_PUBLIC_* variables, hence a separate DSN var.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
