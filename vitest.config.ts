import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Default stays "node" — most of the suite exercises Prisma/tRPC
    // routers and offline-sync logic with no DOM. Component tests that
    // need a DOM (e.g. `LotManualSearch.test.tsx`) opt in per-file with a
    // `// @vitest-environment jsdom` comment instead of flipping this
    // globally, so the (cheaper, faster) node environment stays the
    // default for the rest of the suite.
    environment: "node",
  },
});
