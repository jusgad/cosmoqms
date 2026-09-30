export function KPICard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
