// Skeleton compartido de las páginas del dashboard. Next lo muestra al instante
// mientras el Server Component se renderiza, así la navegación se siente
// inmediata (estructura en vez de pantalla en blanco). El sidebar/layout no se
// re-renderiza: solo el contenido.

export default function DashboardLoading() {
  return (
    <div className="p-8 animate-pulse" aria-busy="true" aria-label="Cargando…">
      {/* Encabezado */}
      <div className="mb-6 space-y-2">
        <div className="h-7 w-64 rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted/70" />
      </div>

      {/* Tres tarjetas de resumen */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-muted/70" />
            <div className="mt-3 h-7 w-32 rounded-md bg-muted" />
            <div className="mt-2 h-3 w-20 rounded bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Bloque de tabla / listado */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <div className="h-4 w-40 rounded bg-muted/70" />
        </div>
        <div className="divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-4 w-28 rounded bg-muted/70" />
              <div className="h-4 flex-1 rounded bg-muted/50" />
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-4 w-16 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
