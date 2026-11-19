import type { AllowedMimeType } from "@/lib/validation/attachments";

// The stored and served content type comes from the file's own magic bytes,
// never from the browser-sent `type` or the file extension — a renamed
// `.html` can't be smuggled in as a "PDF".
export function detectMimeType(bytes: Uint8Array): AllowedMimeType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return null;
}

// Keeps the original name readable while making it a safe storage-key
// segment: accents stripped, anything else outside [A-Za-z0-9._-] becomes
// "-", length capped.
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "archivo";
  const cleaned = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-120);
  return cleaned.length > 0 ? cleaned : "archivo";
}
