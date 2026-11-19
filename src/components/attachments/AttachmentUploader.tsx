"use client";

// Client Component: picking a file and posting it needs interactivity. It
// only imports the bundle-safe limits from `@/lib/validation/attachments`;
// the server re-checks everything (role, tenant, size, real file type).

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTRIBUTE,
  MAX_ATTACHMENT_BYTES,
  type AttachmentEntityType,
} from "@/lib/validation/attachments";

export function AttachmentUploader({
  entityType,
  entityId,
  label,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  label: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Seleccione un archivo");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("El archivo supera el límite de 10 MB");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("entityType", entityType);
    body.append("entityId", entityId);

    setUploading(true);
    try {
      const response = await fetch("/api/attachments", { method: "POST", body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "No se pudo subir el archivo");
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      setFileName(null);
      router.refresh();
    } catch {
      setError("Sin conexión: el archivo no se subió. Intente de nuevo cuando haya señal.");
    } finally {
      setUploading(false);
    }
  }

  const inputId = `attachment-${entityType}-${entityId}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          className="min-h-11 max-w-full flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <Button type="submit" disabled={uploading || !fileName}>
          <UploadIcon data-icon="inline-start" />
          {uploading ? "Subiendo..." : "Subir"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">PDF, PNG, JPG o WEBP · máximo 10 MB · los archivos no se pueden borrar.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
