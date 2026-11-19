// Demo mode (2026-10-11, requested + approved by Sebas): a session without
// Clerk, for screenshots of the user manual and the Postman evidence. It must
// never reach production, so it needs BOTH:
//   1. `DEMO_MODE=true`, which only docker-compose.demo.yml sets, and
//   2. an app URL on this machine (`NEXT_PUBLIC_APP_URL` unset or pointing at
//      localhost / 127.0.0.1 / [::1]).
// A deployment with a real domain therefore stays behind Clerk even if
// `DEMO_MODE=true` is copied into its environment by mistake.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalAppUrl(appUrl: string | undefined): boolean {
  if (!appUrl) return true;
  try {
    return LOCAL_HOSTS.has(new URL(appUrl).hostname);
  } catch {
    return false;
  }
}

export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO_MODE === "true" && isLocalAppUrl(env.NEXT_PUBLIC_APP_URL);
}
