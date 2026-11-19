// Pure, bundle-safe: shared by QCResultForm (preview) and `qc.recordResult`
// (the server's verdict, which is the one persisted).

export type SpecBounds = { minValue: number | null; maxValue: number | null };

// Spec parameters are free text typed by people, so "pH", " ph " and "PH"
// must resolve to the same specification.
export function normalizeParameter(parameter: string): string {
  return parameter.trim().toLowerCase();
}

// Bounds are inclusive: a value exactly on the min or max conforms.
export function evaluateAgainstSpec(value: number, spec: SpecBounds): "pass" | "fail" {
  const belowMin = spec.minValue !== null && value < spec.minValue;
  const aboveMax = spec.maxValue !== null && value > spec.maxValue;
  return belowMin || aboveMax ? "fail" : "pass";
}
