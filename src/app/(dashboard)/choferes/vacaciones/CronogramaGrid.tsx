"use client";

// Cronograma de vacaciones: una fila por persona y una columna por tramo.
//
// El mismo componente dibuja las dos vistas, porque son la misma grilla con
// distinto zoom: en "Calendario" cada columna es UN día (para armar la semana
// hay que ver si sale el martes o el jueves) y en "Semanas" cada columna es una
// semana (para mirar tres meses de una). Tenerlas en dos componentes distintos
// era lo que hacía que una estuviera bien y la otra no.
//
// Las barras NO se colocan por columna: van posicionadas en porcentaje sobre
// toda la tira. Así un período de 3 días dentro de una semana ocupa 3/7 de esa
// columna en vez de la columna entera, y el dibujo es el mismo con cualquier
// zoom.

import { Fragment, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { choferSlug } from "@/lib/chofer-slug";
import type { VacacionesPeriodo } from "./lib";

export type FilaCrono = {
  id: string;
  nombre: string;
  apellido: string;
  periodos: VacacionesPeriodo[];
};

/** Una columna de la grilla: un día o una semana, según la vista. */
export type ColumnaCrono = {
  /** Primer día que cubre la columna (ISO). */
  inicio: string;
  /** Último día que cubre la columna (ISO). */
  fin: string;
  /** Línea de arriba del encabezado: "Lun" en días, "3 ago" en semanas. */
  arriba: string;
  /** Línea de abajo, más grande: el número del día. Vacío en semanas. */
  abajo?: string;
  finde?: boolean;
  feriado?: string;
};

/** Banda superior que agrupa columnas (los meses, en la vista de semanas). */
export type BandaCrono = { key: string; label: string; span: number };

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Cuántas filas se muestran antes de plegar el resto. Con 78 empleados, la
 *  grilla entera tapa la pantalla y hay que scrollear para llegar a los saldos. */
const FILAS_VISIBLES = 12;

function fecha(iso: string): Date {
  return new Date(iso + "T00:00:00");
}
function diffDias(aISO: string, bISO: string): number {
  return Math.round((fecha(bISO).getTime() - fecha(aISO).getTime()) / 86_400_000);
}

/** Etiqueta de la barra: "1 – 7 dic", "28 dic – 3 ene". Sin año: el rango que se
 *  está mirando ya está escrito arriba, en la navegación. */
export function etiquetaRango(inicioISO: string, finISO: string): string {
  const a = fecha(inicioISO);
  const b = fecha(finISO);
  const mesA = MES_CORTO[a.getMonth()]!;
  const mesB = MES_CORTO[b.getMonth()]!;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${b.getDate()} ${mesA}`;
  }
  return `${a.getDate()} ${mesA} – ${b.getDate()} ${mesB}`;
}

/**
 * "Grassi, Bruno Emmanuel" → "Grassi, Bruno E.".
 *
 * En una columna angosta el segundo nombre empuja todo a tres renglones y hace
 * la fila el doble de alta sin agregar nada: el apellido y el primer nombre ya
 * identifican a la persona. NO es truncar —no se corta a mitad de palabra— y el
 * nombre entero sigue estando en el tooltip.
 */
export function nombreCorto(apellido: string, nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return `${apellido}, ${nombre}`.trim();
  const iniciales = partes.slice(1).map((p) => `${p[0]!.toUpperCase()}.`).join(" ");
  return `${apellido}, ${partes[0]} ${iniciales}`;
}

/** Colores de la barra según el estado del período. El texto va adentro, así que
 *  cada fondo trae su color de texto con contraste suficiente para leerse. */
function coloresBarra(p: VacacionesPeriodo): { fondo: string; texto: string } {
  if (p.viajes_conflicto > 0) return { fondo: "#F59E0B", texto: "#442104" };
  if (p.en_curso) return { fondo: "#047857", texto: "#ECFDF5" };
  return { fondo: "#34D399", texto: "#064E3B" };
}

interface Props {
  filas: FilaCrono[];
  columnas: ColumnaCrono[];
  /** Banda de meses arriba de las columnas (vista de semanas). */
  bandas?: BandaCrono[];
  hoyISO: string;
  /** chofer_id → URL de la foto (los períodos no la traen). */
  fotos: Map<string, string>;
  /** chofer_id → área, para la silueta del avatar. */
  sectores: Map<string, string>;
  /** Personas distintas de vacaciones en cada columna (sin filtrar). */
  ocupacion: number[];
  canWrite: boolean;
  onPeriodo: (p: VacacionesPeriodo) => void;
  onVacio: (f: FilaCrono, col: ColumnaCrono) => void;
  onVerSaldo: (choferId: string) => void;
  onMover: (p: VacacionesPeriodo, desdeISO: string, haciaISO: string) => void;
}

export default function CronogramaGrid({
  filas,
  columnas,
  bandas,
  hoyISO,
  fotos,
  sectores,
  ocupacion,
  canWrite,
  onPeriodo,
  onVacio,
  onVerSaldo,
  onMover,
}: Props) {
  const [verTodos, setVerTodos] = useState(false);
  const [drag, setDrag] = useState<{ periodo: VacacionesPeriodo; diaISO: string } | null>(null);

  // Orden por fecha de salida, no alfabético: así las barras bajan en cascada y
  // se lee de un vistazo quién se va primero y dónde quedan los huecos. Además,
  // cuando la lista se pliega, los 12 que quedan a la vista son los que salen
  // antes, que es lo que se está mirando. El desempate por apellido mantiene el
  // orden estable entre renders.
  const ordenadas = [...filas].sort((a, b) => {
    const ia = a.periodos.reduce((min, p) => (p.fecha_inicio < min ? p.fecha_inicio : min), "9999-12-31");
    const ib = b.periodos.reduce((min, p) => (p.fecha_inicio < min ? p.fecha_inicio : min), "9999-12-31");
    return ia.localeCompare(ib) || a.apellido.localeCompare(b.apellido);
  });

  // Si dos personas comparten apellido y primer nombre, abreviar las dejaría
  // idénticas en pantalla; a ésas se les escribe el nombre entero.
  const vecesCorto = new Map<string, number>();
  for (const f of ordenadas) {
    const k = nombreCorto(f.apellido, f.nombre);
    vecesCorto.set(k, (vecesCorto.get(k) ?? 0) + 1);
  }
  const etiquetaNombre = (f: FilaCrono) => {
    const corto = nombreCorto(f.apellido, f.nombre);
    return (vecesCorto.get(corto) ?? 0) > 1 ? `${f.apellido}, ${f.nombre}` : corto;
  };

  const visibles = verTodos ? ordenadas : ordenadas.slice(0, FILAS_VISIBLES);
  const ocultas = ordenadas.length - visibles.length;

  const primerDia = columnas[0]!.inicio;
  const ultimoDia = columnas[columnas.length - 1]!.fin;
  const totalDias = diffDias(primerDia, ultimoDia) + 1;
  /** De 0 a 100 dentro de la tira. */
  const pct = (dias: number) => (dias / totalDias) * 100;
  const anchoColPct = 100 / columnas.length;

  // Línea de "hoy": sólo si el rango llega hasta hoy.
  const hoyDentro = hoyISO >= primerDia && hoyISO <= ultimoDia;
  const hoyPct = hoyDentro ? pct(diffDias(primerDia, hoyISO) + 0.5) : 0;
  const colDeHoy = columnas.findIndex((c) => c.inicio <= hoyISO && c.fin >= hoyISO);

  // El ancho de la columna del empleado sale de una variable CSS para que cambie
  // por breakpoint: en el celular 14rem se comían la mitad de la pantalla.
  const gridTemplateColumns = `var(--col-emp) repeat(${columnas.length}, minmax(var(--col-dia), 1fr))`;

  /** Fondo de una columna (fin de semana, feriado, hoy). */
  const fondoCol = (c: ColumnaCrono, i: number) => {
    if (i === colDeHoy) return "bg-primary/[0.07]";
    if (c.feriado) return "bg-[#7C3AED]/[0.09]";
    if (c.finde) return "bg-muted/70";
    return "";
  };

  const filaInicial = bandas ? 3 : 2;

  return (
    <div className="max-h-[75vh] overflow-auto">
      <div
        className="grid text-sm [--col-dia:2rem] [--col-emp:10rem] sm:[--col-dia:2.5rem] sm:[--col-emp:12rem] lg:[--col-emp:14rem]"
        style={{ gridTemplateColumns }}
      >
        {/* --- Banda de meses (sólo en semanas) --------------------------- */}
        {bandas && (
          <>
            <div className="sticky left-0 top-0 z-40 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.06)]" />
            {bandas.map((b) => (
              <div
                key={b.key}
                style={{ gridColumn: `span ${b.span}` }}
                className="sticky top-0 z-30 border-l border-border bg-card px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {b.label}
              </div>
            ))}
          </>
        )}

        {/* --- Encabezado de columnas ------------------------------------- */}
        <div
          style={bandas ? { gridRow: 2 } : undefined}
          className={`sticky left-0 z-40 flex items-end border-b border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground shadow-[1px_0_0_0_rgba(0,0,0,0.06)] ${bandas ? "top-[1.75rem]" : "top-0"}`}
        >
          Empleado
        </div>
        {columnas.map((c, i) => {
          const esHoy = i === colDeHoy;
          return (
            <div
              key={c.inicio}
              style={bandas ? { gridRow: 2 } : undefined}
              title={
                (c.feriado ? `${c.feriado} · ` : "") +
                `${ocupacion[i] ?? 0} ${(ocupacion[i] ?? 0) === 1 ? "persona" : "personas"} de vacaciones`
              }
              className={`sticky z-30 border-b bg-card px-0.5 pb-1.5 pt-2 text-center ${bandas ? "top-[1.75rem]" : "top-0"} ${
                esHoy ? "border-b-2 border-b-primary" : "border-border"
              } ${fondoCol(c, i)}`}
            >
              <div
                className={`text-[11px] leading-none ${
                  esHoy ? "text-primary" : c.finde ? "text-[#DC2626]/75" : "text-muted-foreground"
                }`}
              >
                {c.arriba}
              </div>
              {c.abajo && (
                <div
                  className={`mt-0.5 text-[15px] font-semibold leading-none tabular-nums ${
                    esHoy
                      ? "text-primary"
                      : c.feriado
                        ? "text-[#7C3AED]"
                        : c.finde
                          ? "text-[#DC2626]"
                          : "text-foreground"
                  }`}
                >
                  {c.abajo}
                </div>
              )}
            </div>
          );
        })}

        {/* --- Una fila por empleado --------------------------------------- */}
        {visibles.map((f, idx) => {
          const gridRow = idx + filaInicial;
          const enCurso = f.periodos.some((p) => p.en_curso);
          return (
            <Fragment key={f.id}>
              <div
                style={{ gridRow }}
                className={`sticky left-0 z-20 flex min-h-[3rem] items-center gap-2 border-t border-border px-3 py-1.5 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] ${
                  enCurso ? "bg-[#F0FDF4]" : "bg-card"
                }`}
              >
                {enCurso && (
                  <span className="relative flex size-1.5 shrink-0" title="De vacaciones hoy">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-[#10B981]" />
                  </span>
                )}
                <AvatarPersona
                  name={`${f.nombre} ${f.apellido}`}
                  src={fotos.get(f.id) ?? undefined}
                  size={30}
                  rol={sectores.get(f.id)}
                  className="shrink-0"
                />
                <button
                  type="button"
                  onClick={() => onVerSaldo(f.id)}
                  title="Ver su saldo en la tabla de abajo"
                  className="min-w-0 flex-1 text-left text-[13px] font-medium leading-tight text-foreground hover:text-primary"
                >
                  {etiquetaNombre(f)}
                </button>
                <Link
                  href={`/choferes/${choferSlug(f)}?tab=vacaciones`}
                  title="Abrir legajo"
                  className="shrink-0 text-muted-foreground/40 hover:text-primary max-md:-my-2 max-md:px-1 max-md:py-2"
                >
                  <ExternalLink size={12} className="max-md:size-4" />
                </Link>
              </div>

              {/* La tira: las celdas de fondo dibujan las columnas y las barras
                  van encima, posicionadas en porcentaje del rango completo. */}
              <div
                style={{ gridRow, gridColumn: `2 / span ${columnas.length}` }}
                className="relative grid border-t border-border"
                // La grilla interna repite las mismas columnas que la de afuera,
                // así las celdas caen exactas debajo de su encabezado.
              >
                <div
                  className="col-start-1 row-start-1 grid"
                  style={{ gridTemplateColumns: `repeat(${columnas.length}, 1fr)` }}
                >
                  {columnas.map((c, i) => {
                    const ocupado = f.periodos.some((p) => p.fecha_inicio <= c.fin && p.fecha_fin >= c.inicio);
                    const dropOk = !!drag && drag.periodo.chofer_id === f.id && !ocupado;
                    return (
                      <div
                        key={c.inicio}
                        onDragOver={(e) => {
                          if (dropOk) e.preventDefault();
                        }}
                        onDrop={() => {
                          if (!drag || !dropOk) return;
                          const d = drag;
                          setDrag(null);
                          onMover(d.periodo, d.diaISO, c.inicio);
                        }}
                        className={`border-l border-border/40 ${fondoCol(c, i)} ${dropOk ? "bg-primary/10" : ""}`}
                      >
                        {canWrite && !ocupado && (
                          <button
                            type="button"
                            onClick={() => onVacio(f, c)}
                            title={`Cargar vacaciones desde el ${fecha(c.inicio).getDate()} de ${MES_CORTO[fecha(c.inicio).getMonth()]}`}
                            aria-label={`Cargar vacaciones de ${f.apellido} el ${c.inicio}`}
                            className="h-full w-full rounded-[4px] border border-dashed border-transparent transition-colors hover:border-primary/40 hover:bg-primary/10"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Barras: una por período. Se recortan al rango visible y
                    pierden la esquina redondeada del lado que sigue afuera. */}
                {f.periodos.map((p) => {
                  const desde = p.fecha_inicio < primerDia ? primerDia : p.fecha_inicio;
                  const hasta = p.fecha_fin > ultimoDia ? ultimoDia : p.fecha_fin;
                  if (hasta < desde) return null;
                  const left = pct(diffDias(primerDia, desde));
                  const width = pct(diffDias(desde, hasta) + 1);
                  const c = coloresBarra(p);
                  const empiezaAca = p.fecha_inicio >= primerDia;
                  const terminaAca = p.fecha_fin <= ultimoDia;
                  // El rango escrito entra si la barra mide al menos dos columnas
                  // y media; si no, queda sólo el color y el texto en el tooltip.
                  const entraTexto = width / anchoColPct >= 2.5;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      draggable={canWrite && p.fecha_fin >= hoyISO}
                      onDragStart={() => setDrag({ periodo: p, diaISO: desde })}
                      onDragEnd={() => setDrag(null)}
                      onClick={() => onPeriodo(p)}
                      title={`${etiquetaRango(p.fecha_inicio, p.fecha_fin)} · ${p.dias} día${p.dias !== 1 ? "s" : ""}${
                        p.anio_cargo != null ? ` · descuenta ${p.anio_cargo}` : " · histórico"
                      }${
                        p.viajes_conflicto > 0 ? ` · ⚠ ${p.viajes_conflicto} viaje(s) asignados en esas fechas` : ""
                      } · clic: detalle${canWrite && p.fecha_fin >= hoyISO ? " · arrastrá para moverlo" : ""}`}
                      className="absolute inset-y-0 z-10 flex min-w-0 items-center px-1 py-1.5"
                    >
                      <span
                        style={{
                          backgroundColor: c.fondo,
                          color: c.texto,
                          borderTopLeftRadius: empiezaAca ? 6 : 0,
                          borderBottomLeftRadius: empiezaAca ? 6 : 0,
                          borderTopRightRadius: terminaAca ? 6 : 0,
                          borderBottomRightRadius: terminaAca ? 6 : 0,
                        }}
                        className="flex h-[1.65rem] w-full min-w-0 items-center justify-center overflow-hidden px-1.5 text-[11px] font-semibold leading-none transition-[filter] hover:brightness-95"
                      >
                        {entraTexto && (
                          <span className="truncate">{etiquetaRango(p.fecha_inicio, p.fecha_fin)}</span>
                        )}
                      </span>
                    </button>
                  );
                })}

                {/* Línea del día de hoy, para no tener que contar columnas.
                    z-[1]: por encima de las celdas pero por DEBAJO de las barras
                    y, sobre todo, de la columna del empleado (z-20). Con z-20
                    empataba con ella y, al scrollear de costado, la línea se
                    dibujaba encima de los nombres. */}
                {hoyDentro && (
                  <span
                    aria-hidden
                    style={{ left: `${hoyPct}%` }}
                    className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-primary/50"
                  />
                )}
              </div>
            </Fragment>
          );
        })}

        {/* --- Pie: el resto de la gente ----------------------------------- */}
        {(ocultas > 0 || verTodos) && (
          <div
            style={{ gridColumn: `1 / span ${columnas.length + 1}` }}
            className="sticky left-0 border-t border-border bg-card"
          >
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              className="inline-flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[13px] text-muted-foreground hover:text-primary"
            >
              <Plus size={14} />
              {verTodos ? "Ver menos" : `${ocultas} empleado${ocultas !== 1 ? "s" : ""} más`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
