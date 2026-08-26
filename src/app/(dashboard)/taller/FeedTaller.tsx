"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Search, Truck, User, X } from "lucide-react";
import DetalleTrabajo, { descripcionDe } from "./DetalleTrabajo";
import { getFeedTallerAction, type FeedResultado, type TrabajoFeed } from "./actions";

/**
 * Lo cargado, pensado para cuando haya 150 y no 3.
 *
 * Pregunta de Julián: *"¿cómo se irá visualizando cuando haya 150 cargadas?"*.
 * La primera versión apilaba las últimas 30 sin agrupar ni buscar: con 150, las
 * otras 120 eran invisibles y no había forma de contestar "qué le hicimos a este
 * acoplado".
 *
 * Tres cosas la hacen aguantar:
 *
 *  · **Agrupada por día**, como el grupo de WhatsApp. Un scroll largo sin
 *    cortes es una pared; con las fechas de por medio se sabe dónde se está.
 *  · **Buscador sobre el mensaje.** Funciona justamente porque el texto se
 *    guarda tal cual se escribió: buscar "AF-112" o "balancín" encuentra el
 *    trabajo.
 *  · **Tocar la patente filtra por esa unidad.** Es el historial que pidió
 *    Bárbara —*"que se sepa lo que se le estuvo haciendo"*— sin una pantalla
 *    aparte: sale del gesto natural de tocar lo que te interesa.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "Hoy", "Ayer" o "lunes 24 de agosto" — como lo diría una persona. */
function tituloDia(fechaISO: string, hoyISO: string): string {
  if (fechaISO === hoyISO) return "Hoy";
  const [y, m, d] = fechaISO.split("-").map(Number) as [number, number, number];
  const f = new Date(Date.UTC(y, m - 1, d));
  const [hy, hm, hd] = hoyISO.split("-").map(Number) as [number, number, number];
  const ayer = new Date(Date.UTC(hy, hm - 1, hd - 1));
  if (f.getTime() === ayer.getTime()) return "Ayer";
  const anioHoy = hy;
  const base = `${DIAS[f.getUTCDay()]} ${d} de ${MESES[m - 1]}`;
  return y === anioHoy ? base : `${base} de ${y}`;
}

function hora(cargadoEn: string | null): string | null {
  if (!cargadoEn) return null;
  const dt = new Date(cargadoEn);
  if (Number.isNaN(dt.getTime())) return null;
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

export default function FeedTaller({
  inicial,
  hoy,
  refrescar,
}: {
  inicial: FeedResultado;
  hoy: string;
  /** Cambia cuando se carga un trabajo nuevo: vuelve al principio. */
  refrescar: number;
}) {
  const [busca, setBusca] = useState("");
  const [debounced, setDebounced] = useState("");
  const [unidad, setUnidad] = useState<{ id: string; patente: string } | null>(null);
  const [datos, setDatos] = useState<FeedResultado>(inicial);
  const [cargando, setCargando] = useState(false);
  const [detalle, setDetalle] = useState<TrabajoFeed | null>(null);

  // Se espera a que termine de escribir: una consulta por tecla con 150 filas
  // es una consulta por tecla de más.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const filtrando = debounced !== "" || unidad !== null;

  // La primera tanda ya vino del servidor con la página: volver a pedirla al
  // montar es una consulta al pedo en cada visita.
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      if (!debounced && !unidad && refrescar === 0) return;
    }
    let cancelado = false;
    setCargando(true);
    getFeedTallerAction({ busca: debounced, unidadId: unidad?.id ?? null })
      .then((r) => !cancelado && setDatos(r))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [debounced, unidad, refrescar]);

  const verMas = async () => {
    setCargando(true);
    const r = await getFeedTallerAction({
      busca: debounced,
      unidadId: unidad?.id ?? null,
      desde: datos.trabajos.length,
    });
    setDatos((prev) => ({ ...r, trabajos: [...prev.trabajos, ...r.trabajos] }));
    setCargando(false);
  };

  // Agrupado por día, respetando el orden en que vino (más nuevo primero).
  const porDia = useMemo(() => {
    const grupos: { dia: string; items: TrabajoFeed[] }[] = [];
    for (const t of datos.trabajos) {
      const dia = t.fecha.slice(0, 10);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.items.push(t);
      else grupos.push({ dia, items: [t] });
    }
    return grupos;
  }, [datos.trabajos]);

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-foreground">Lo cargado</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {filtrando ? `${datos.total} de ${inicial.total}` : `${datos.total} en total`}
        </span>
      </div>

      <div className="mb-3 flex h-12 items-center gap-2 rounded-xl border border-input bg-background px-3">
        <Search size={17} className="shrink-0 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar una patente, un nombre o qué se hizo…"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            aria-label="Borrar la búsqueda"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {unidad && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
            <Truck size={14} className="shrink-0" />
            <span className="truncate">Historial de {unidad.patente}</span>
          </span>
          <button
            type="button"
            onClick={() => setUnidad(null)}
            className="shrink-0 text-sm font-semibold text-primary"
          >
            Ver todo
          </button>
        </div>
      )}

      {datos.trabajos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {filtrando
            ? "No hay ningún trabajo que coincida."
            : "Todavía no hay trabajos cargados. El primero que cargues aparece acá."}
        </p>
      ) : (
        <div className="space-y-4">
          {porDia.map((g) => (
            <div key={g.dia}>
              {/* La fecha, pegada arriba mientras se scrollea ese día: sin esto,
                  en una lista larga se pierde de vista de cuándo es lo que se
                  está mirando. */}
              <p className="sticky top-0 z-10 -mx-1 mb-1.5 bg-background/85 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {tituloDia(g.dia, hoy)}
              </p>
              <ul className="space-y-2.5">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <div className="rounded-xl border border-border bg-card shadow-sm">
                      <button
                        type="button"
                        onClick={() => setDetalle(t)}
                        className="w-full rounded-t-xl p-3.5 text-left transition-colors active:bg-muted/40"
                      >
                        {t.fotos.length > 0 && (
                          <div className="mb-2.5 flex gap-2 overflow-x-auto">
                            {t.fotos.map((f) => (
                              <Image
                                key={f}
                                src={f}
                                alt=""
                                width={200}
                                height={200}
                                unoptimized
                                className="h-28 w-auto shrink-0 rounded-lg border border-border object-cover"
                              />
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-line text-[15px] leading-snug text-foreground">
                          {descripcionDe(t)}
                        </p>
                      </button>

                      {/* El pie va FUERA del botón: la patente es su propio
                          botón, y un botón adentro de otro no se puede tocar. */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 pb-3 text-xs text-muted-foreground">
                        {hora(t.cargadoEn) && <span className="tabular-nums">{hora(t.cargadoEn)}</span>}
                        {t.patente && (
                          <>
                            <span aria-hidden>·</span>
                            <button
                              type="button"
                              onClick={() =>
                                t.unidadId && setUnidad({ id: t.unidadId, patente: t.patente! })
                              }
                              disabled={!t.unidadId}
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                            >
                              <Truck size={11} />
                              {t.patente}
                            </button>
                          </>
                        )}
                        {t.persona && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-1">
                              <User size={11} />
                              {t.persona}
                            </span>
                          </>
                        )}
                        {t.quien && (
                          <>
                            <span aria-hidden>·</span>
                            <span>cargó {t.quien}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {datos.hayMas && (
            <button
              type="button"
              onClick={verMas}
              disabled={cargando}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : null}
              Ver más ({datos.total - datos.trabajos.length} sin mostrar)
            </button>
          )}
        </div>
      )}

      <DetalleTrabajo trabajo={detalle} onCerrar={() => setDetalle(null)} />
    </section>
  );
}
