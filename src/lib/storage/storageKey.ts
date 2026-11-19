// Shared by every driver: a key is a relative path of safe segments. Rejects
// absolute paths, `..`, empty segments and anything outside [A-Za-z0-9._-],
// so a key can never escape the storage root or address another object.
const SEGMENT = /^[A-Za-z0-9._-]+$/;

export function assertSafeKey(key: string): void {
  const segments = key.split("/");
  const valid = segments.length > 0 && segments.every((segment) => SEGMENT.test(segment) && segment !== "." && segment !== "..");
  if (!valid) {
    throw new Error(`Clave de almacenamiento inválida: ${key}`);
  }
}
