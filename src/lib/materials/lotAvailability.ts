// When a raw-material lot can be used, shared by the weighing screen, the
// lots table and the server-side checks. Plain module (no Prisma, no server
// imports) so Client Components can use it.
//
// `expiryDate` is a calendar date (stored as midnight UTC). A lot is usable
// THROUGH its expiry date, so it is expired only once that date is strictly
// before today (UTC) — the same rule `applyWeighing` enforces on the server.

export const EXPIRY_WARNING_DAYS = 30;
// A lot with less than this fraction of what was received is flagged as low
// stock (e.g. 10 % of a 50 kg drum = 5 kg left).
export const LOW_STOCK_FRACTION = 0.1;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isExpired(expiryDate: Date | string, now: Date = new Date()): boolean {
  return new Date(expiryDate) < startOfUtcDay(now);
}

export function expiresSoon(expiryDate: Date | string, now: Date = new Date()): boolean {
  const warning = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  return !isExpired(expiryDate, now) && new Date(expiryDate) <= warning;
}

export function isLowStock(quantityAvailable: number, quantityReceived: number): boolean {
  return quantityReceived > 0 && quantityAvailable > 0 && quantityAvailable < quantityReceived * LOW_STOCK_FRACTION;
}

export type UsableLot = { status: string; expiryDate: Date | string; quantityAvailable: number | string };

// Usable for weighing: released by quality, not expired, and with stock left.
export function isUsableForWeighing(lot: UsableLot, now: Date = new Date()): boolean {
  return lot.status === "liberado" && !isExpired(lot.expiryDate, now) && Number(lot.quantityAvailable) > 0;
}
