import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {/* config options here */};

// Verified against the installed `@serwist/next@9.5.12` types: the default
// export is `withSerwistInit` (an older-tutorial `withSerwist` name does not
// exist in this version), and `InjectManifestOptions` requires `swSrc`
// (source service worker) — `swDest` defaults to `public/sw.js` based on it.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
