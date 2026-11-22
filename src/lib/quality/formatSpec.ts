// Human-readable acceptance range of a QC specification ("5.5 – 7",
// "≥ 8000 cP"). Plain module so both Server and Client Components can use it.
export type SpecRange = { minValue: number | null; maxValue: number | null; unit: string | null };

export function formatRange(spec: SpecRange): string {
  const unit = spec.unit ? ` ${spec.unit}` : "";
  if (spec.minValue !== null && spec.maxValue !== null) return `${spec.minValue} – ${spec.maxValue}${unit}`;
  if (spec.minValue !== null) return `≥ ${spec.minValue}${unit}`;
  if (spec.maxValue !== null) return `≤ ${spec.maxValue}${unit}`;
  return "Sin rango";
}
