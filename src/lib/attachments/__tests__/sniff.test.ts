import { describe, it, expect } from "vitest";
import { detectMimeType, sanitizeFileName } from "../sniff";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("detectMimeType", () => {
  it("recognises PDF, PNG, JPEG and WEBP by their magic bytes", () => {
    expect(detectMimeType(ascii("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(detectMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
    expect(detectMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
    expect(detectMimeType(ascii("RIFF\x00\x00\x00\x00WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects anything else, including HTML renamed to .pdf and truncated headers", () => {
    expect(detectMimeType(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectMimeType(ascii("RIFF\x00\x00\x00\x00WAVEfmt "))).toBeNull();
    expect(detectMimeType(bytes(0x89, 0x50))).toBeNull();
    expect(detectMimeType(new Uint8Array())).toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it("keeps a readable, storage-safe name", () => {
    expect(sanitizeFileName("Certificado Análisis (lote 45).pdf")).toBe("Certificado-Analisis-lote-45-.pdf");
  });

  it("drops directory parts and leading dots", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\fotos\\.oculto.jpg")).toBe("oculto.jpg");
  });

  it("never returns an empty segment", () => {
    expect(sanitizeFileName("...")).toBe("archivo");
    expect(sanitizeFileName("")).toBe("archivo");
  });
});
