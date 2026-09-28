// Schema/logic-only module: no dependency on `@/lib/trpc/trpc` or `@/lib/db`
// (which instantiates `PrismaClient` at module top level). FormulaForm.tsx
// (a Client Component) imports these two pure functions directly so its
// bundle never pulls Prisma into the browser — same lesson as Task 7's
// `receiveLotInput` extraction (see src/lib/validation/materials.ts).
export function sumPercentages(ingredients: { percentage: number }[]): number {
  return ingredients.reduce((total, i) => total + i.percentage, 0);
}

export function isWithinTolerance(sum: number, tolerancePct = 0.5): boolean {
  return Math.abs(sum - 100) <= tolerancePct;
}
