import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

// Verified against the installed `serwist@9.5.12`/`@serwist/next@9.5.12`
// `.d.mts` files (Serwist's API shape has changed across major versions —
// same "check the installed types, don't assume an older tutorial" approach
// as Task 4's Clerk verification). In this version:
//   - `@serwist/next`'s config integration is `withSerwistInit` (default
//     export of `@serwist/next`), not a named `withSerwist`.
//   - The service worker itself is written against the plain `serwist`
//     package's `Serwist` class + strategy classes (`NetworkFirst`, etc.),
//     not a `generateSW`-style declarative config.
//   - `@serwist/next/worker` exports `defaultCache`, Next.js's recommended
//     baseline `RuntimeCaching[]` (RSC/pages/static assets), which this
//     spreads in alongside the app-specific `/api/sync/state` rule.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// `ServiceWorkerGlobalScope` needs the `webworker` lib, which the project's
// root `tsconfig.json` (correctly) doesn't include — `webworker` and `dom`
// declare conflicting globals (`self`, `caches`, etc.) and the rest of the
// app is `dom`. Serwist's own build step bundles this file with esbuild
// (via `swSrc` in `next.config.ts`), which does not type-check it, so
// `tsconfig.json` excludes `src/app/sw.ts` from `pnpm typecheck` rather than
// widening the whole project's `lib`. Kept the real `ServiceWorkerGlobalScope`
// type here (not `any`) for editor/IDE correctness when this file is opened
// on its own.
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname === "/api/sync/state",
      handler: new NetworkFirst({ cacheName: "sync-state" }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
