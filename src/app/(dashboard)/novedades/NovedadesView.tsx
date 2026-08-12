"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import ListaNovedades, { fechaLargaISO, TIPO_ESTILO } from "@/components/novedades/ListaNovedades";
import MegafonoNovedades from "@/components/novedades/MegafonoNovedades";
import type { Novedad, NovedadTipo } from "@/lib/novedades";

/**
 * El historial de novedades.
 *
 * Por qué NO hay paginación numerada, que fue la pregunta: la lista se escribe a
 * mano y crece unas pocas por semana, así que las páginas partirían un mes al
 * medio y esconderían lo nuevo detrás de un control. Se muestran de a `PASO` y
 * hay un botón para traer más — lo mismo que hace la tabla de movimientos de la
 * caja. Si algún día son mil, el filtro por tipo y el corte por fecha siguen
 * alcanzando; recién ahí valdría la pena paginar de verdad.
 */
const PASO = 20;

const FILTROS: { id: NovedadTipo | "todo"; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "nuevo", label: "Nuevo" },
  { id: "mejora", label: "Mejoras" },
  { id: "arreglo", label: "Arreglos" },
];

export default function NovedadesView({ items }: { items: Novedad[] }) {
  const [filtro, setFiltro] = useState<NovedadTipo | "todo">("todo");
  const [tope, setTope] = useState(PASO);

  const filtradas = useMemo(
    () => (filtro === "todo" ? items : items.filter((n) => n.tipo === filtro)),
    [items, filtro],
  );
  const visibles = filtradas.slice(0, tope);

  // Un corte por día: leídas de arriba a abajo se entienden como una línea de
  // tiempo y no como una lista suelta donde cada renglón repite la fecha.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Novedad[]>();
    for (const n of visibles) {
      const acc = mapa.get(n.fecha);
      if (acc) acc.push(n);
      else mapa.set(n.fecha, [n]);
    }
    return [...mapa.entries()];
  }, [visibles]);

  const cuenta = (tipo: NovedadTipo | "todo") =>
    tipo === "todo" ? items.length : items.filter((n) => n.tipo === tipo).length;

  return (
    <>
      {/* La franja de arriba: qué es esta pantalla, en una línea, con el mismo
          dibujo con el que las novedades aparecen en el resumen del día. */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
        <MegafonoNovedades className="size-14 shrink-0 sm:size-16" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground sm:text-sm">
            Acá queda anotado cada cambio del sistema
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Lo nuevo también te aparece al entrar, en el resumen del día — pero sólo una vez. Esta
            pantalla es la que se acuerda de todo.
          </p>
        </div>
      </div>

      {/* Filtro por tipo. Los números son parte del filtro, como en Legajos. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => {
          const activo = filtro === f.id;
          const color = f.id === "todo" ? undefined : TIPO_ESTILO[f.id].color;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFiltro(f.id);
                setTope(PASO);
              }}
              aria-pressed={activo}
              className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors ${
                activo
                  ? "border-foreground/20 bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  : "border-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {color && (
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              )}
              {f.label}
              <span className="tabular-nums text-muted-foreground/70">{cuenta(f.id)}</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <EmptyState message="Todavía no hay novedades de este tipo" icon={Sparkles} />
      ) : (
        <div className="flex flex-col gap-5">
          {porDia.map(([fecha, delDia]) => (
            <section key={fecha}>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                {fechaLargaISO(fecha)}
              </h2>
              <ListaNovedades items={delDia} amplia />
            </section>
          ))}
        </div>
      )}

      {filtradas.length > visibles.length && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button variant="outline" onClick={() => setTope((t) => t + PASO)}>
            <ChevronDown size={15} />
            Ver más novedades
          </Button>
          <span className="text-[11.5px] text-muted-foreground/80">
            Mostrando {visibles.length} de {filtradas.length}
          </span>
        </div>
      )}
    </>
  );
}
