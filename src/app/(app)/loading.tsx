// Shown the instant a menu link is tapped, while the next screen's Server
// Component reads the database. Without it the previous screen stays frozen
// until the new one is ready, which feels like the app ignored the tap.
// It sits inside (app)/layout.tsx, so the menu and header never disappear.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-56 rounded-lg bg-muted motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="h-24 rounded-card border border-border bg-card p-4">
            <div className="h-4 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
            <div className="mt-4 h-6 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-11 rounded-lg bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
