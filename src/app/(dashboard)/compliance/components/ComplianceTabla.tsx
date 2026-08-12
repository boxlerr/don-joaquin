"use client";

import { useMemo, useState } from "react";
import { Download, History, Pencil, Upload } from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import MarcaLogo from "@/components/ui/MarcaLogo";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import { formatFecha } from "@/lib/utils";
import IlustracionCompliance, { type IlustracionNombre } from "./IlustracionCompliance";
import type { FiltroEstado, FiltrosCompliance } from "./ComplianceResumen";
import type {
  ChoferInfo,
  ComplianceEstado,
  ComplianceEstadoRow,
  ComplianceNivel,
  ComplianceRequisito,
  UnidadInfo,
} from "../types";

/**
 * Los documentos como tabla: una fila por documento, con todo en columnas.
 *
 * Es la otra forma de mirar lo mismo que el checklist agrupado. El agrupado
 * contesta "¿qué le falta a este chofer?"; la tabla contesta "¿qué vence
 * primero?", que es la pregunta de todas las mañanas — y para eso el árbol de
 * Nivel → Entidad → Documento obligaba a abrir 62 tarjetas y comparar fechas a
 * ojo.
 *
 * Las solapas de arriba son el MISMO filtro de estado que las tarjetas y que la
 * columna de la derecha: tocar "Por vencer" acá o arriba deja la pantalla igual.
 * Dos filtros de estado que no se hablan es la forma más rápida de que los
 * números dejen de coincidir.
 */

const ESTADO_UI: Record<ComplianceEstado, { label: string; fg: string; bg: string; arte: IlustracionNombre }> = {
  vencido: { label: "Vencido", fg: "#B91C1C", bg: "#FEF2F2", arte: "vencido" },
  por_vencer: { label: "Por vencer", fg: "#B45309", bg: "#FFFBEB", arte: "por-vencer" },
  faltante: { label: "Sin cargar", fg: "#475569", bg: "#F1F5F9", arte: "sin-cargar" },
  vigente: { label: "Al día", fg: "#166534", bg: "#F0FDF4", arte: "al-dia" },
};

const NIVEL_LABEL: Record<ComplianceNivel, string> = {
  empresa: "Empresa",
  unidad: "Camión",
  chofer: "Chofer",
};

/** A qué plataforma va. Es dato de la papeleta, no una categoría inventada. */
const PLATAFORMA: Record<string, { label: string; fg: string; bg: string }> = {
  AMBOS: { label: "YPF + Loma", fg: "#075985", bg: "#E0F2FE" },
  YPF: { label: "Solo YPF", fg: "#166534", bg: "#F0FDF4" },
  LOMA_NEGRA: { label: "Solo Loma", fg: "#7C2D12", bg: "#FFF7ED" },
};

/** Las solapas, en el orden en que importan. */
const SOLAPAS: { estado: FiltroEstado; label: string }[] = [
  { estado: "vencido", label: "Vencidos" },
  { estado: "por_vencer", label: "Por vencer" },
  { estado: "faltante", label: "Sin cargar" },
  { estado: "vigente", label: "Al día" },
  { estado: "todos", label: "Todos" },
];

/** Cuántas filas se pintan de entrada. 848 nodos de una hacen sentir la lista pesada. */
const PASO = 60;

function Celda({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-2.5 align-middle ${className}`}>{children}</td>;
}

function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#E1F5FE] hover:text-primary max-md:size-9"
    >
      {children}
    </button>
  );
}

export default function ComplianceTabla({
  rows,
  todas,
  filtros,
  onChange,
  requisitos,
  unidades,
  choferes,
  canWrite,
  onCargar,
  onHistorial,
  onDescargar,
}: {
  /** Las filas que pasaron los filtros. */
  rows: ComplianceEstadoRow[];
  /** Todas, para los contadores de las solapas (que no dependen del estado elegido). */
  todas: ComplianceEstadoRow[];
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
  requisitos: ComplianceRequisito[];
  unidades?: Record<string, UnidadInfo>;
  choferes?: Record<string, ChoferInfo>;
  canWrite: boolean;
  onCargar: (row: ComplianceEstadoRow) => void;
  onHistorial: (row: ComplianceEstadoRow) => void;
  onDescargar: (row: ComplianceEstadoRow) => void;
}) {
  const [visibles, setVisibles] = useState(PASO);

  const descripcionDe = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of requisitos) m.set(r.id, r.descripcion ?? null);
    return m;
  }, [requisitos]);

  // Los contadores miran el resto de los filtros pero NO el estado: si no, la
  // solapa "Vencidos" diría siempre (0) cuando estás parado en "Por vencer".
  const conteo = useMemo(() => {
    const out: Record<string, number> = { todos: todas.length };
    for (const r of todas) out[r.estado] = (out[r.estado] ?? 0) + 1;
    return out;
  }, [todas]);

  const aMostrar = rows.slice(0, visibles);

  return (
    <section className="rounded-[10px] border border-border bg-card print:border-0">
      {/* Solapas por estado */}
      <HorizontalScrollHint className="flex border-b border-border px-2 print:hidden" fadeBg="from-card">
        <div className="flex w-max items-center gap-1">
          {SOLAPAS.map((s) => {
            const activa = filtros.estado === s.estado;
            const n = conteo[s.estado] ?? 0;
            return (
              <button
                key={s.estado}
                type="button"
                onClick={() => onChange({ ...filtros, estado: s.estado })}
                aria-pressed={activa}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  activa
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}{" "}
                <span className={`tabular-nums ${activa ? "" : "text-muted-foreground/70"}`}>({n})</span>
              </button>
            );
          })}
        </div>
      </HorizontalScrollHint>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No hay documentos con este filtro.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            {/* Con la columna de atajos al costado quedan ~880px: las dos
                columnas secundarias se esconden antes que aparecer una barra de
                scroll horizontal. Ninguna de las dos pierde información —
                "Alcance" se lee en la columna de al lado ("Toda la flota", una
                patente o un nombre) y la plataforma sólo distingue a los pocos
                documentos que no van a las dos. */}
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2.5 py-2 font-semibold">Documento</th>
                  <th className="hidden px-2.5 py-2 font-semibold 2xl:table-cell">Plataforma</th>
                  <th className="hidden px-2.5 py-2 font-semibold 2xl:table-cell">Alcance</th>
                  <th className="px-2.5 py-2 font-semibold">Unidad / Chofer</th>
                  <th className="px-2.5 py-2 font-semibold">Vence el</th>
                  <th className="px-2.5 py-2 font-semibold">Estado</th>
                  <th className="px-2.5 py-2 text-right font-semibold print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aMostrar.map((r) => {
                  const ui = ESTADO_UI[r.estado];
                  const plat = PLATAFORMA[r.cliente_aplica] ?? PLATAFORMA.AMBOS!;
                  const unidad = r.camion_id ? unidades?.[r.camion_id] : undefined;
                  const chofer = r.chofer_id ? choferes?.[r.chofer_id] : undefined;
                  const desc = descripcionDe.get(r.requisito_id);

                  return (
                    <tr
                      key={`${r.requisito_id}-${r.chofer_id ?? r.camion_id ?? "emp"}`}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <Celda>
                        <div className="flex items-center gap-2.5">
                          <IlustracionCompliance nombre={ui.arte} size={30} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {r.requisito_nombre}
                            </p>
                            {desc && (
                              <p className="truncate text-[11px] text-muted-foreground">{desc}</p>
                            )}
                          </div>
                        </div>
                      </Celda>

                      <Celda className="hidden 2xl:table-cell">
                        <Chip label={plat.label} fg={plat.fg} bg={plat.bg} />
                      </Celda>

                      <Celda className="hidden 2xl:table-cell">
                        <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {NIVEL_LABEL[r.nivel]}
                        </span>
                      </Celda>

                      <Celda>
                        {r.nivel === "empresa" ? (
                          <span className="text-[13px] text-muted-foreground">Toda la flota</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {r.nivel === "chofer" ? (
                              <AvatarPersona
                                name={chofer?.nombre ?? r.chofer_nombre ?? ""}
                                src={chofer?.foto_url ?? null}
                                rol={chofer?.rol}
                                size={28}
                              />
                            ) : (
                              <MarcaLogo
                                marca={unidad?.marca}
                                foto={unidad?.foto_url}
                                patente={r.camion_patente ?? ""}
                                size={28}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-foreground">
                                {r.chofer_nombre ?? r.camion_patente}
                              </p>
                              {unidad && (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {[unidad.marca, unidad.modelo].filter(Boolean).join(" ")}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </Celda>

                      <Celda className="whitespace-nowrap">
                        {r.fecha_vencimiento ? (
                          <>
                            <p className="text-[13px] text-foreground">
                              {formatFecha(r.fecha_vencimiento)}
                            </p>
                            {r.dias_restantes !== null && (
                              <p className="text-[11px]" style={{ color: ui.fg }}>
                                {r.dias_restantes < 0
                                  ? `hace ${Math.abs(r.dias_restantes)} días`
                                  : `en ${r.dias_restantes} días`}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">—</span>
                        )}
                      </Celda>

                      <Celda>
                        {r.estado === "faltante" && canWrite ? (
                          <button
                            type="button"
                            onClick={() => onCargar(r)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[12px] font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/10"
                          >
                            <Upload size={13} />
                            Cargar
                          </button>
                        ) : (
                          <Chip label={ui.label} fg={ui.fg} bg={ui.bg} />
                        )}
                      </Celda>

                      <Celda className="print:hidden">
                        <div className="flex items-center justify-end gap-0.5">
                          {r.archivo_id && (
                            <IconBtn title="Descargar el documento" onClick={() => onDescargar(r)}>
                              <Download size={14} />
                            </IconBtn>
                          )}
                          <IconBtn title="Ver el historial" onClick={() => onHistorial(r)}>
                            <History size={14} />
                          </IconBtn>
                          {canWrite && r.estado !== "faltante" && (
                            <IconBtn title="Renovar el vencimiento" onClick={() => onCargar(r)}>
                              <Pencil size={14} />
                            </IconBtn>
                          )}
                        </div>
                      </Celda>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.length > visibles && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + PASO * 4)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground print:hidden"
            >
              Ver más — {visibles} de {rows.length}
            </button>
          )}
        </>
      )}
    </section>
  );
}
