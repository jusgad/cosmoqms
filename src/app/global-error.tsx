"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it brings its own <html>/<body> and inline styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "sans-serif", background: "#F0FDFA", color: "#134E4A", padding: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Algo salió mal</h1>
        <p style={{ marginBottom: 16 }}>
          El error quedó registrado. Ninguna firma ni registro de lote se guardó a medias: puede intentar de nuevo.
        </p>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12 }}>Referencia: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: 0, background: "#0891B2", color: "#fff" }}
        >
          Intentar de nuevo
        </button>
      </body>
    </html>
  );
}
