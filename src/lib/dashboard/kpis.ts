// Pure KPI math for the dashboard: the page fetches plain rows, these
// functions shape them. Month boundaries use the server's local time zone
// (`TZ`, America/Bogota in docker-compose), same as the existing
// "lotes liberados este mes" KPI.

const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type MonthOutcome = { key: string; label: string; liberados: number; rechazados: number };

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// First day of the oldest month in a `count`-month window ending in `now`'s
// month. Used both to bound the queries and to build the buckets.
export function windowStart(now: Date, count: number): Date {
  return new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
}

export function monthlyOutcomes(now: Date, released: Date[], rejected: Date[], count = 6): MonthOutcome[] {
  const start = windowStart(now, count);
  const buckets: MonthOutcome[] = Array.from({ length: count }, (_, offset) => {
    const month = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    return { key: monthKey(month), label: MONTH_LABELS[month.getMonth()], liberados: 0, rechazados: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const date of released) {
    const bucket = byKey.get(monthKey(date));
    if (bucket) bucket.liberados += 1;
  }
  for (const date of rejected) {
    const bucket = byKey.get(monthKey(date));
    if (bucket) bucket.rechazados += 1;
  }
  return buckets;
}

export const TIMED_STAGES = ["pesado", "mezclado", "envasado", "calidad"] as const;
export type TimedStage = (typeof TIMED_STAGES)[number];

export type OrderTimeline = {
  firstWeighingAt: Date | null;
  signatures: { stage: string; signedAt: Date }[];
};

export type StageDuration = { stage: TimedStage; averageHours: number | null; samples: number };

// A stage runs from the moment the previous one was signed off until its own
// signature (`production.sign` signs the stage being completed). Weighing
// starts at the first weighing event; the quality stage ends at the final
// release or rejection signature. Incomplete or out-of-order pairs are
// skipped instead of counted as zero.
export function averageStageDurations(orders: OrderTimeline[]): StageDuration[] {
  const totals = new Map<TimedStage, { hours: number; samples: number }>(
    TIMED_STAGES.map((stage) => [stage, { hours: 0, samples: 0 }]),
  );

  for (const order of orders) {
    const signedAt = (stage: string) => order.signatures.find((signature) => signature.stage === stage)?.signedAt;
    const spans: Record<TimedStage, [Date | null | undefined, Date | undefined]> = {
      pesado: [order.firstWeighingAt, signedAt("pesado")],
      mezclado: [signedAt("pesado"), signedAt("mezclado")],
      envasado: [signedAt("mezclado"), signedAt("envasado")],
      calidad: [signedAt("envasado"), signedAt("liberado") ?? signedAt("rechazado")],
    };
    for (const stage of TIMED_STAGES) {
      const [from, to] = spans[stage];
      if (!from || !to || to < from) continue;
      const total = totals.get(stage);
      if (!total) continue;
      total.hours += (to.getTime() - from.getTime()) / 3_600_000;
      total.samples += 1;
    }
  }

  return TIMED_STAGES.map((stage) => {
    const total = totals.get(stage) ?? { hours: 0, samples: 0 };
    return { stage, averageHours: total.samples === 0 ? null : total.hours / total.samples, samples: total.samples };
  });
}

export type PassRate = { total: number; passed: number; rate: number | null };

export function qcPassRate(results: { result: "pass" | "fail" }[]): PassRate {
  const passed = results.filter((item) => item.result === "pass").length;
  return { total: results.length, passed, rate: results.length === 0 ? null : passed / results.length };
}

// "45 min", "6,5 h", "2,3 días" — readable at a glance on the floor.
export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${(Math.round(hours * 10) / 10).toLocaleString("es-CO")} h`;
  return `${(Math.round((hours / 24) * 10) / 10).toLocaleString("es-CO")} días`;
}
