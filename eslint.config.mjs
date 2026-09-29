import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // `public/sw.js` is Serwist's generated service worker bundle (from
    // `src/app/sw.ts` via `swDest` in `next.config.ts`) — a build artifact,
    // not source, and already gitignored; it should never be linted.
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "public/sw.js"],
  },
];

export default eslintConfig;
