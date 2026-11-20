"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRScanner } from "@/components/batch/QRScanner";

// Two ways to read the supplier's code, both optional: the device camera, or
// a handheld USB/Bluetooth scanner, which "types" the code into a text field
// and ends with Enter. Manual entry in the form below always keeps working.
export function SupplierQrDialog({
  open,
  onOpenChange,
  onDecode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecode: (code: string) => void;
}) {
  const [typed, setTyped] = useState("");

  function apply(code: string) {
    if (!code.trim()) return;
    setTyped("");
    onDecode(code);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leer QR del proveedor</DialogTitle>
          <DialogDescription>
            Apunte la cámara al QR o código de barras del empaque. Si el proveedor incluye material,
            lote, cantidad o vencimiento, CosmoQMS llena esos campos por usted.
          </DialogDescription>
        </DialogHeader>
        {open && <QRScanner onDecode={apply} onClose={() => onOpenChange(false)} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier-qr-text" className="text-sm font-medium text-foreground">
            Lector de mano o texto del código
          </label>
          <textarea
            id="supplier-qr-text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                apply(typed);
              }
            }}
            rows={3}
            placeholder="Haga clic aquí y escanee con el lector, o pegue el contenido del QR"
            className="min-h-11 rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="button" variant="outline" onClick={() => apply(typed)} disabled={!typed.trim()}>
            Usar este código
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
