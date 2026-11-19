import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs/config";

// `standalone` is what Docker needs: it traces and copies only the files a
// production `node server.js` actually requires into `.next/standalone`,
// instead of relying on a full `node_modules` inside the image.
//
// `middlewareClientMaxBodySize`: Clerk's middleware buffers request bodies,
// and Next's 10 MB default equals the attachment limit itself, so a 10 MB file
// plus its multipart envelope would be cut off. 12 MB leaves headroom; the
// attachments service still rejects anything over 10 MB.
const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { middlewareClientMaxBodySize: "12mb" },
};

// Verified against the installed `@serwist/next@9.5.12` types: the default
// export is `withSerwistInit` (an older-tutorial `withSerwist` name does not
// exist in this version), and `InjectManifestOptions` requires `swSrc`
// (source service worker) — `swDest` defaults to `public/sw.js` based on it.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Source maps are only uploaded when SENTRY_AUTH_TOKEN (+ SENTRY_ORG,
// SENTRY_PROJECT) is set, e.g. in Vercel; local and Docker builds skip it.
export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
