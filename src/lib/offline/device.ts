// Browser-only device identity, persisted in `localStorage` so every event
// queued from this device (across page reloads and offline sessions) shares
// the same `deviceId`, matching the `BatchEvent.deviceId` field (Task 2).
// Zero Prisma dependency — safe for Client Components to import directly.
const STORAGE_KEY = "cosmoqms-device-id";

export function getDeviceId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
