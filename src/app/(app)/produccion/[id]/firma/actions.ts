"use server";

import { auth, reverificationError } from "@clerk/nextjs/server";

// Server Action wrapped by `useReverification` in SignaturePad.tsx (a Client
// Component). This is Clerk's documented step-up pattern for
// @clerk/nextjs@7.9.7 (verified against the installed package's own types —
// `node_modules/.pnpm/@clerk+shared@.../dist/authorization-errors.d.ts` and
// `.../react/hooks/useReverification.d.ts` — the same "check the installed
// version's types" approach Task 4 used for `auth()`'s async signature):
//
// `useReverification(fetcher)` returns an "enhanced" fetcher. When the
// wrapped fetcher *resolves* to a `{ clerk_error: { reason:
// "reverification-error", ... } }` value (produced by `reverificationError`,
// not thrown), the hook shows Clerk's built-in step-up modal
// (password/MFA), then automatically retries the fetcher. Only when `has({
// reverification })` is already satisfied does this action resolve to
// `{ reauthVerified: true }`, which is what lets SignaturePad enable
// "Firmar".
//
// "strict" is Clerk's built-in `SessionVerificationTypes` level requiring a
// first-factor re-check within the last 10 minutes (or a second factor, if
// the account has MFA) — the appropriate bar for an electronic signature,
// stricter than the default "moderate"/"lax" levels.
export async function verifyReauthForSignature(): Promise<{ reauthVerified: true } | ReturnType<typeof reverificationError>> {
  const { userId, has } = await auth();
  if (!userId) {
    // No session at all — nothing this action can step up. The route itself
    // is already behind the (app) layout's auth gate, so this is defensive.
    return reverificationError("strict");
  }
  if (!has({ reverification: "strict" })) {
    return reverificationError("strict");
  }
  return { reauthVerified: true };
}
