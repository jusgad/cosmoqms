import type { MetadataRoute } from "next";

// Next.js typed manifest route (App Router convention: a `manifest.ts` file
// under `app/` is served as `/manifest.webmanifest`). No dedicated PWA icon
// asset exists in `public/` yet (only the generic Next.js starter SVGs and
// `favicon.ico`) — using `favicon.ico` for both sizes here rather than
// inventing a binary PNG asset; swap in real 192/512 PNG icons once the
// design team provides them.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CosmoQMS",
    short_name: "CosmoQMS",
    description: "Sistema interno de producción y calidad (MES/QMS) para laboratorio cosmético",
    start_url: "/",
    display: "standalone",
    background_color: "#F0FDFA",
    theme_color: "#0891B2",
    icons: [
      { src: "/favicon.ico", sizes: "192x192", type: "image/x-icon" },
      { src: "/favicon.ico", sizes: "512x512", type: "image/x-icon" },
    ],
  };
}
