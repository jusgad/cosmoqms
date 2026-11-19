// Shared by the server, edge and browser Sentry inits. Without a DSN the SDK
// stays disabled, so local and Docker runs send nothing. `sendDefaultPii` is
// off: this system handles regulated production data and user identities,
// which must not leave the tenant's infrastructure in error reports.
export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
  };
}
