"use client";

// Optional capture shortcut, never a dependency. Per the Blueprint's
// non-negotiable rule (carried since Task 7): whichever form renders this
// must keep `LotManualSearch` (or, for `ReceiveLotForm`, the plain text
// field it pre-fills) fully usable with zero camera permission granted.
// This component is always dismissible via the visible "Cerrar escáner"
// button below — it must never be a full-screen trap.
//
// `html5-qrcode`'s `Html5Qrcode` class (verified against its shipped
// `esm/html5-qrcode.d.ts`) exposes:
//   new Html5Qrcode(elementId: string)
//   .start(cameraIdOrConfig, scanConfig, onSuccess, onError): Promise<null>
//   .stop(): Promise<void>
//   .clear(): void
//   .isScanning: boolean
// `start`'s first argument accepts a `MediaTrackConstraints` directly (not
// just a camera id string), so `{ facingMode: "environment" }` asks for the
// rear camera on phones without an extra `getCameras()` round trip.
import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

export function QRScanner({
  onDecode,
  onClose,
}: {
  onDecode: (code: string) => void;
  onClose: () => void;
}) {
  // `Html5Qrcode` looks its target element up with `document.getElementById`,
  // but some of its internals build CSS selectors from that id too — strip
  // `useId()`'s colons so it's always a safe selector fragment.
  const elementId = `qr-scanner-${useId().replace(/:/g, "")}`;
  const [cameraError, setCameraError] = useState<string | null>(null);

  // `onDecode` is typically a fresh closure on every parent render; reading
  // it through a ref (updated every render) keeps the scan-start effect
  // below from re-running — and restarting the camera — on every keystroke
  // elsewhere in the form.
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId);
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (!stopped) onDecodeRef.current(decodedText);
        },
        () => {
          // Per-frame "no code found in this frame" callback — expected
          // continuously while the operator lines up the QR code, never an
          // error worth surfacing.
        },
      )
      .catch((err: unknown) => {
        if (!stopped) {
          setCameraError(
            err instanceof Error
              ? err.message
              : "No se pudo acceder a la cámara. Use la búsqueda manual.",
          );
        }
      });

    return () => {
      stopped = true;
      if (scanner.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      } else {
        scanner.clear();
      }
    };
  }, [elementId]);

  return (
    <div className="flex flex-col gap-3">
      <div id={elementId} className="w-full overflow-hidden rounded-lg bg-black" />
      {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
      <Button type="button" variant="outline" onClick={onClose}>
        Cerrar escáner
      </Button>
    </div>
  );
}
