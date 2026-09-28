// Pure presentational Server Component — brief's Step 6 literal code, kept
// verbatim (already uses the correct `success`/`pending`/`destructive`
// tokens, not `accent`).
export function ToleranceIndicator({
  theoretical,
  actual,
  tolerancePct = 5,
}: {
  theoretical: number;
  actual: number;
  tolerancePct?: number;
}) {
  const deviationPct = Math.abs((actual - theoretical) / theoretical) * 100;
  const level = deviationPct <= tolerancePct ? "ok" : deviationPct <= tolerancePct * 2 ? "warn" : "bad";
  const color = { ok: "text-success", warn: "text-pending", bad: "text-destructive" }[level];
  return <span className={`font-mono ${color}`}>{deviationPct.toFixed(2)}% de desviación</span>;
}
