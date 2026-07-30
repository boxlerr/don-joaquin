"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  Clock,
  FileText,
  Truck,
  User,
  Pencil,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Receipt,
  CalendarDays,
  Route,
  Package,
  Hash,
  MapPin,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getViajesAction,
  deleteViajeAction,
  updateNotasViajeAction,
  type ViajeOrderBy,
} from "../actions";
import { getViajeDetalleAction, type ViajeDetalle } from "../detalle-action";
import type { ViajeBasico, FaltaDato } from "../types";
import { formatFecha } from "@/lib/utils";
import AuditTrailDrawer from "./audit-trail-drawer";
import ViajeGastosPanel, { type GastoFormData } from "./ViajeGastosPanel";
import ViajeAdjuntosStrip from "./ViajeAdjuntosStrip";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { esFacturable } from "../flujo-logic";
import CerrarViajeDialog from "./CerrarViajeDialog";
import EditViajeDialog from "./EditViajeDialog";
import ExportViajesButton from "./ExportViajesButton";
import FacturarBloqueDialog from "./FacturarBloqueDialog";

/** Una fila es seleccionable si se puede facturar. */
function esSeleccionable(v: ViajeBasico): boolean {
  return esFacturable(v);
}

/** Datos clave que faltan (origen/destino/chofer): los cargan después, por su
 *  forma de trabajar. Coincide con el filtro/tarjeta "Incompletos". */
function faltantesDe(v: ViajeBasico): string[] {
  const falta = (s: string | null | undefined) => !s || s === "—" || s.trim() === "";
  const out: string[] = [];
  if (falta(v.origen)) out.push("origen");
  if (falta(v.destino)) out.push("destino");
  if (falta(v.chofer)) out.push("chofer");
  return out;
}

/**
 * Marcador ⚠ ámbar para viajes incompletos. Es un botón: el triángulo dice que
 * falta algo, así que lo natural es que al tocarlo se abra el viaje para
 * cargarlo, en vez de tener que ir a buscar el botón de editar.
 */
function IncompletoMark({ v, onCompletar }: { v: ViajeBasico; onCompletar?: (v: ViajeBasico) => void }) {
  const faltas = faltantesDe(v);
  if (faltas.length === 0) return null;
  const texto = `Falta ${faltas.join(", ")}`;
  if (!onCompletar) {
    return (
      <span title={texto} aria-label={`Viaje incompleto. ${texto}`} className="inline-flex shrink-0 text-amber-500">
        <AlertTriangle size={13} />
      </span>
    );
  }
  return (
    <button
      type="button"
      title={`${texto} — clic para completarlo`}
      aria-label={`Viaje incompleto. ${texto}. Abrir para completar.`}
      onClick={(e) => {
        e.stopPropagation();
        onCompletar(v);
      }}
      className="-m-1 inline-flex shrink-0 cursor-pointer rounded p-1 text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
    >
      <AlertTriangle size={13} />
    </button>
  );
}

/** Filtro empujado desde las tarjetas de estadísticas (clic). */
export interface FiltroExterno {
  facturado: boolean | null;
  esVacio: boolean | null;
  incompleto: boolean | null;
  nonce: number;
}

interface Props {
  choferId?: string;
  /** Filtro "le falta este dato" que llega por URL desde /metricas. */
  falta?: FaltaDato;
  filtroExterno?: FiltroExterno;
  onFiltroChange?: (f: {
    facturado: boolean | null;
    esVacio: boolean | null;
    incompleto: boolean | null;
  }) => void;
  /** Datos de formulario de gasto, resueltos en la página y compartidos por todas
   *  las filas (evita re-pedirlos al expandir cada viaje). */
  gastoFormData: GastoFormData;
  /** Rango de fechas inicial sembrado desde el selector de período de la página
   *  (queda editable en los inputs de fecha del listado). */
  initialDesde?: string;
  /** Búsqueda inicial, para llegar desde otra pantalla con el filtro puesto. */
  initialBusqueda?: string;
  initialHasta?: string;
}

type ColumnDef = {
  label: string;
  sortKey?: ViajeOrderBy;
  /** Clases responsive aplicadas tanto al <th> como a la <td> correspondiente. */
  cellClass?: string;
  align?: "left" | "right";
};

const COLUMNS: ColumnDef[] = [
  { label: "", cellClass: "w-10" },
  { label: "Fecha", sortKey: "fecha" },
  { label: "Cliente" },
  { label: "Chofer", cellClass: "hidden lg:table-cell" },
  { label: "Origen", cellClass: "hidden sm:table-cell" },
  { label: "Destino", cellClass: "hidden sm:table-cell" },
  { label: "KM", cellClass: "hidden sm:table-cell" },
  // Igual que la planilla del cliente: los km vacíos van en su propia columna.
  { label: "KM vacíos", cellClass: "hidden sm:table-cell" },
  { label: "Toneladas", sortKey: "toneladas", cellClass: "hidden sm:table-cell" },
  { label: "Remito Nº", cellClass: "hidden xl:table-cell" },
  { label: "Material", cellClass: "hidden xl:table-cell" },
  { label: "Importe", sortKey: "monto", cellClass: "hidden lg:table-cell", align: "right" },
  { label: "Remito", cellClass: "hidden sm:table-cell" },
  { label: "" },
];

const VIA_LABELS: Record<string, string> = { ruta_5: "Ruta 5", ruta_22: "Ruta 22" };

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fila etiqueta → valor del panel de detalle. */
function DetField({
  label,
  value,
  mono,
  strong,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
  tone?: string;
}) {
  const vacio = value == null || value === "" || value === "—";
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-[11px] text-right ${mono ? "font-mono" : ""} ${
          strong ? "font-bold" : "font-medium"
        } ${vacio ? "text-muted-foreground/40" : tone ?? "text-foreground/90"}`}
      >
        {vacio ? "—" : value}
      </span>
    </div>
  );
}

function DetSkeleton({ n }: { n: number }) {
  return (
    <div className="py-1.5 space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/** Encabezado del panel expandido: código, estado, quién/cuándo lo cargó, la
 *  ruta dibujada (origen ─🚚─ destino) y los adjuntos del viaje como chips. */
function ViajeDetalleHeader({
  viaje: v,
  detalle,
}: {
  viaje: ViajeBasico;
  detalle: ViajeDetalle | "loading" | "error" | undefined;
}) {
  const det = typeof detalle === "object" ? detalle : null;
  const cargandoDet = detalle === "loading";
  const faltas = faltantesDe(v);
  const kmTotal = (v.km_con_carga ?? 0) + (v.km_vacios ?? 0);
  // El camino se pinta rojo si el tramo va vacío (mismo código de color que la tabla).
  const roadColor = v.es_vacio ? "#C00000" : "#0088D1";
  // Qué se lleva: el material del viaje o, si no hay, el tipo de carga.
  const carga = v.material || det?.tipoCarga || null;
  // El código es un correlativo de carga (V-año-número): se explica en el tooltip.
  const [, anioCod, nroCod] = v.codigo.split("-");
  const nroCorrelativo = nroCod ? parseInt(nroCod, 10) : NaN;
  return (
    <div className="rounded-lg border border-border/80 bg-card px-4 pt-3 pb-3.5 shadow-2xs space-y-3">
      {/* Fecha del viaje + código + badges de estado + quién lo cargó */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-black tracking-tight text-foreground">
            Viaje del {formatFecha(v.fecha_viaje)}
          </span>
          <span
            className="font-mono text-[10.5px] font-bold text-muted-foreground bg-muted/60 border border-border/70 rounded-md px-1.5 py-0.5 cursor-help"
            title={
              Number.isFinite(nroCorrelativo)
                ? `Código interno: viaje Nº ${nroCorrelativo.toLocaleString("es-AR")} cargado al sistema en ${anioCod}. Es un correlativo automático de carga — no depende de la fecha del viaje ni del cliente.`
                : "Código interno del viaje (correlativo automático de carga)."
            }
          >
            {v.codigo}
          </span>
          {v.es_vacio && (
            <span className="rounded bg-[#C00000]/10 text-[#C00000] text-[10px] font-bold px-2 py-0.5">
              VACÍO
            </span>
          )}
          {v.facturado && (
            <span className="rounded bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
              <CheckCircle2 size={11} /> Facturado
            </span>
          )}
          {v.cobrado && (
            <span className="rounded bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 text-[10px] font-bold px-2 py-0.5">
              Cobrado
            </span>
          )}
          {faltas.length > 0 && (
            <span className="rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
              <AlertTriangle size={11} /> Incompleto · falta {faltas.join(", ")}
            </span>
          )}
        </div>
        {cargandoDet ? (
          <Skeleton className="h-3.5 w-48" />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays size={12} className="shrink-0" />
            Cargado el {fmtDateTime(det?.createdAt ?? null)}
            {det?.creadoPor && (
              <>
                <span aria-hidden>·</span>
                <AvatarPersona name={det.creadoPor} size={20} />
                <span className="font-semibold text-foreground/80">{det.creadoPor}</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* La ruta, dibujada: origen ── 🚚 km ── destino */}
      <div className="flex items-center gap-3 sm:gap-4 rounded-lg border border-border/60 bg-muted/40 px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0 max-w-[38%]">
          <span className="size-2.5 rounded-full bg-[#10B981] ring-4 ring-[#10B981]/15 shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
              Origen
            </div>
            <div
              className={`text-[13px] font-bold truncate ${v.origen ? "text-foreground" : "text-muted-foreground/50 italic"}`}
              title={v.origen ?? undefined}
            >
              {v.origen ?? "A definir"}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-[56px]">
          <div className="relative h-8" aria-hidden>
            <span
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] opacity-45"
              style={{
                color: roadColor,
                backgroundImage:
                  "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 14px)",
              }}
            />
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-0.5 shadow-2xs"
              style={{ color: roadColor }}
            >
              <Truck size={13} strokeWidth={2.2} />
              {kmTotal > 0 && (
                <span className="font-mono text-[10px] font-bold text-foreground/75 whitespace-nowrap">
                  {kmTotal.toLocaleString("es-AR")} km
                </span>
              )}
            </span>
          </div>
          {/* Qué lleva el camión, bien visible en el medio de la ruta */}
          {carga && (
            <div
              className="text-center text-[11.5px] font-bold text-foreground/85 truncate px-2 -mt-1"
              title={`Carga: ${carga}`}
            >
              <Package size={11} className="inline-block mr-1 -mt-px text-muted-foreground" />
              {carga}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0 max-w-[38%]">
          <MapPin
            size={16}
            className={`shrink-0 ${v.destino ? "text-[#C00000]" : "text-muted-foreground/40"}`}
          />
          <div className="min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
              Destino
            </div>
            <div
              className={`text-[13px] font-bold truncate ${v.destino ? "text-foreground" : "text-muted-foreground/50 italic"}`}
              title={v.destino ?? undefined}
            >
              {v.destino ?? "A definir"}
            </div>
          </div>
        </div>
      </div>

      {/* Chips de contexto: vía, tipo de carga (si el material ya ocupa la ruta) y remito */}
      {(det?.rutaVia || (det?.tipoCarga && v.material) || (!v.es_vacio && v.nro_remito)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {det?.rutaVia && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#0088D1]/30 bg-[#0088D1]/8 px-2 py-0.5 text-[10.5px] font-bold text-[#0277BD] dark:text-sky-300">
              <Route size={11} /> {VIA_LABELS[det.rutaVia] ?? det.rutaVia}
            </span>
          )}
          {det?.tipoCarga && v.material && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[10.5px] font-semibold text-foreground/75">
              <Package size={11} /> {det.tipoCarga}
            </span>
          )}
          {!v.es_vacio && v.nro_remito && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[10.5px] font-semibold font-mono text-foreground/75">
              <Hash size={11} /> Remito {v.nro_remito}
            </span>
          )}
        </div>
      )}

      {/* Adjuntos (remito / factura / otro) como chips */}
      <div className="pt-2.5 border-t border-dashed border-border/70">
        <ViajeAdjuntosStrip viajeId={v.id} />
      </div>
    </div>
  );
}

/** Tarjeta con los datos del chofer (traídos al expandir la fila). */
function ChoferCard({
  detalle,
  choferNombre,
}: {
  detalle: ViajeDetalle | "loading" | "error" | undefined;
  choferNombre: string | null;
}) {
  const det = typeof detalle === "object" ? detalle : null;
  const c = det?.chofer;
  const cargando = detalle === "loading";
  const nombre = c ? [c.apellido, c.nombre].filter(Boolean).join(", ") : choferNombre;
  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
      <div className="flex items-center gap-2.5 border-b border-border pb-2.5 mb-1">
        {nombre ? (
          <AvatarPersona name={nombre} rol="chofer" size={38} />
        ) : (
          <span className="flex items-center justify-center size-[34px] rounded-full bg-muted text-muted-foreground/60 shrink-0">
            <User size={16} />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Chofer
          </div>
          <div
            className={`text-[13px] font-bold truncate ${nombre ? "text-foreground" : "text-muted-foreground/60 italic"}`}
            title={nombre ?? undefined}
          >
            {nombre ?? "Sin asignar"}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {cargando ? (
          <DetSkeleton n={4} />
        ) : (
          <>
            <DetField
              label="Teléfono"
              value={
                c?.telefono ? (
                  <a
                    href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2"
                    title="Llamar"
                  >
                    <Phone size={10} /> {c.telefono}
                  </a>
                ) : null
              }
              mono
            />
            <DetField label="DNI" value={c?.dni} mono />
            <DetField label="Localidad" value={c?.localidad} />
            <DetField label="Ingreso" value={c?.fecha_ingreso ? formatFecha(c.fecha_ingreso) : "—"} />
          </>
        )}
      </div>
    </div>
  );
}

/** Tarjeta con los datos del camión + el flete y las distancias del viaje. */
function CamionFleteCard({
  detalle,
  viaje: v,
}: {
  detalle: ViajeDetalle | "loading" | "error" | undefined;
  viaje: ViajeBasico;
}) {
  const det = typeof detalle === "object" ? detalle : null;
  const cam = det?.camion;
  const cargando = detalle === "loading";
  // v.camion viene del listado como "PATENTE - Marca - Modelo": se parsea para
  // pintar la chapa y el modelo al instante, sin esperar el detalle (antes la
  // chapa mostraba el string completo mientras cargaba y rompía el layout).
  const rowParts = v.camion && v.camion !== "—" ? v.camion.split(" - ") : [];
  const patente = cam?.patente ?? (rowParts[0]?.trim() || null);
  const marcaModelo = cam
    ? [cam.marca, cam.modelo].filter(Boolean).join(" ")
    : rowParts.slice(1).join(" ").trim();
  return (
    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
      <div className="flex items-center gap-2.5 border-b border-border pb-2.5 mb-1">
        <span className="flex items-center justify-center size-[34px] rounded-lg bg-[#7C3AED]/12 text-[#7C3AED] shrink-0">
          <Truck size={17} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Camión &amp; flete
          </div>
          <div
            className={`text-[13px] font-bold truncate ${marcaModelo ? "text-foreground" : "text-muted-foreground/50"}`}
            title={marcaModelo || undefined}
          >
            {marcaModelo || "—"}
          </div>
        </div>
        {patente && (
          <span
            className="shrink-0 overflow-hidden rounded-[5px] border-[1.5px] border-foreground/45 bg-background shadow-2xs"
            title={`Patente ${patente}`}
          >
            {/* Franja azul arriba, guiño a la chapa Mercosur */}
            <span className="block h-[3px] bg-[#1D4ED8]" aria-hidden />
            <span className="block px-1.5 pt-0.5 pb-1 font-mono text-[11px] font-black tracking-[0.1em] leading-none text-foreground">
              {patente}
            </span>
          </span>
        )}
      </div>
      <div className="divide-y divide-border/40">
        {cargando ? (
          <DetSkeleton n={2} />
        ) : (
          <>
            <DetField label="Capacidad" value={cam?.capacidad_tn != null ? `${cam.capacidad_tn} tn` : "—"} mono />
            <DetField
              label="Km actual"
              value={cam?.km_actual != null ? `${cam.km_actual.toLocaleString("es-AR")} km` : "—"}
              mono
            />
          </>
        )}
        <DetField label="Km con carga" value={`${(v.km_con_carga ?? 0).toLocaleString("es-AR")} km`} mono />
        <DetField
          label="Km vacíos"
          value={`${(v.km_vacios ?? 0).toLocaleString("es-AR")} km`}
          mono
          tone={v.km_vacios ? "text-[#C00000]" : undefined}
        />
        <DetField
          label="Toneladas"
          value={v.toneladas != null ? `${v.toneladas.toLocaleString("es-AR")} tn` : "—"}
          mono
        />
      </div>
      {/* El flete destacado: verde si está, ámbar si falta, neutro si es tramo vacío */}
      {v.es_vacio ? (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Flete</span>
          <span className="text-[11px] font-semibold text-muted-foreground">Tramo vacío · sin flete</span>
        </div>
      ) : v.monto_flete ? (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#10B981]/25 bg-[#10B981]/8 px-2.5 py-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#059669] dark:text-[#34D399]">
            Flete
          </span>
          <span className="font-mono text-[13px] font-black text-[#059669] dark:text-[#34D399]">
            $ {v.monto_flete.toLocaleString("es-AR")}
          </span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Flete
          </span>
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            Importe pendiente
          </span>
        </div>
      )}
    </div>
  );
}

/** Solo el texto libre de observaciones (sin los segmentos legados
 *  "Origen:"/"Destino:" que traen algunos viajes importados). */
function notasDe(observaciones: string | null): string {
  if (!observaciones) return "";
  return observaciones
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && !/^(Origen|Destino):/i.test(p))
    .join(" | ");
}

/** Notas del viaje editables ahí mismo: clic sobre el texto → textarea →
 *  Guardar. Persiste con updateNotasViajeAction (conserva los segmentos
 *  legados) y avisa al padre para refrescar la fila. */
function NotasEditables({
  viajeId,
  observaciones,
  onSaved,
}: {
  viajeId: string;
  observaciones: string | null;
  onSaved: (observaciones: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notas = notasDe(observaciones);

  if (!editando) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(notas);
          setError(null);
          setEditando(true);
        }}
        className="group/notas flex-1 w-full text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors cursor-text"
        title="Clic para editar las notas"
      >
        {notas ? (
          <p className="text-xs text-muted-foreground italic line-clamp-4 whitespace-pre-wrap">
            {notas}
            <Pencil size={10} className="inline-block ml-1.5 opacity-0 group-hover/notas:opacity-60 transition-opacity" />
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic inline-flex items-center gap-1.5">
            <Pencil size={11} className="opacity-60" /> Escribí una nota…
          </p>
        )}
      </button>
    );
  }

  return (
    <div className="flex-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={1000}
        placeholder="Ej: Remito entregado en planta, esperar factura…"
        className="w-full min-h-[64px] px-2.5 py-2 text-xs rounded-lg border border-border bg-card outline-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all resize-none text-foreground"
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex items-center gap-1.5">
        <Button
          size="xs"
          className="h-7 px-3 text-[11px] font-bold bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-md"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            const res = await updateNotasViajeAction(viajeId, draft);
            setSaving(false);
            if (!res.ok) {
              setError(res.error ?? "No se pudieron guardar las notas");
              return;
            }
            onSaved(res.observaciones ?? null);
            setEditando(false);
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          disabled={saving}
          onClick={() => setEditando(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function ViajesTable({ choferId, falta, filtroExterno, onFiltroChange, gastoFormData, initialDesde, initialHasta, initialBusqueda }: Props) {

  const [rows, setRows] = useState<ViajeBasico[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ?viaje=<id> — se llega desde "A dónde fueron" clickeando un viaje puntual.
  // La fila se abre y se le hace scroll: si no, el link caía en una lista larga
  // y había que buscar a mano el viaje que se acaba de clickear.
  const params = useSearchParams();
  const viajePedido = params.get("viaje");
  // ?destino=LOMASER — llega desde "A dónde fueron". Filtra por destino exacto,
  // no por el buscador libre (que también traería los que SALIERON de ahí).
  const destinoUrl = params.get("destino")?.trim() || "";
  const [destino, setDestino] = useState(destinoUrl);
  const yaSalte = useRef<string | null>(null);
  useEffect(() => {
    if (!viajePedido || yaSalte.current === viajePedido) return;
    if (!rows.some((r) => r.id === viajePedido)) return;
    yaSalte.current = viajePedido;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abrir la fila que pidió la URL
    setExpandedId(viajePedido);
    requestAnimationFrame(() => {
      const fila = document.querySelector(`[data-viaje-id="${viajePedido}"]`);
      // scrollIntoView no existe en todos los entornos (jsdom, por ejemplo): que
      // falte no puede impedir que la fila quede abierta.
      if (fila instanceof HTMLElement && typeof fila.scrollIntoView === "function") {
        fila.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  }, [viajePedido, rows]);
  // Detalle rico (chofer, camión, quién/cuándo lo cargó), traído al expandir.
  const [detalles, setDetalles] = useState<
    Record<string, ViajeDetalle | "loading" | "error">
  >({});
  useEffect(() => {
    const id = expandedId;
    if (!id || detalles[id]) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marcar "cargando" al abrir la fila
    setDetalles((p) => ({ ...p, [id]: "loading" }));
    getViajeDetalleAction(id).then((res) => {
      if (cancel) return;
      setDetalles((p) => ({ ...p, [id]: "error" in res ? "error" : res }));
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de fila expandida
  }, [expandedId]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [auditTrailViajeId, setAuditTrailViajeId] = useState<string | null>(null);
  const [cerrandoViaje, setCerrandoViaje] = useState<ViajeBasico | null>(null);
  const [editingViaje, setEditingViaje] = useState<ViajeBasico | null>(null);
  const [confirmEditViaje, setConfirmEditViaje] = useState<ViajeBasico | null>(null);

  // Selección múltiple para facturación en bloque.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [facturarOpen, setFacturarOpen] = useState(false);

  const [search, setSearch] = useState(initialBusqueda ?? "");
  const [desde, setDesde] = useState(initialDesde ?? "");
  const [hasta, setHasta] = useState(initialHasta ?? "");
  const [facturadoFiltro, setFacturadoFiltro] = useState<boolean | null>(null);
  // ?sinVacios=1 — lo pone el link de "A dónde fueron", que no cuenta los
  // retornos vacíos: sin esto el listado mostraba 8 donde el resumen decía 4.
  const [esVacioFiltro, setEsVacioFiltro] = useState<boolean | null>(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sinVacios")
      ? false
      : null,
  );
  const [incompletoFiltro, setIncompletoFiltro] = useState<boolean | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [allLoaded, setAllLoaded] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [orderBy, setOrderBy] = useState<ViajeOrderBy>("fecha");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = () => setRefreshToken((t) => t + 1);
    window.addEventListener("viaje-created", handler);
    return () => window.removeEventListener("viaje-created", handler);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Aplicar filtro empujado desde las tarjetas de estadísticas (clic en tarjeta).
  // Patrón "ajustar estado al cambiar un prop": se setea durante el render
  // comparando contra el último nonce procesado, evitando un efecto.
  const [ultimoNonce, setUltimoNonce] = useState<number | undefined>(undefined);
  if (filtroExterno && filtroExterno.nonce !== ultimoNonce) {
    setUltimoNonce(filtroExterno.nonce);
    setFacturadoFiltro(filtroExterno.facturado);
    setEsVacioFiltro(filtroExterno.esVacio);
    setIncompletoFiltro(filtroExterno.incompleto);
  }

  // Reportar el filtro actual al contenedor (para resaltar la tarjeta activa).
  useEffect(() => {
    onFiltroChange?.({ facturado: facturadoFiltro, esVacio: esVacioFiltro, incompleto: incompletoFiltro });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturadoFiltro, esVacioFiltro, incompletoFiltro]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    setError(null);

    getViajesAction({
      choferId,
      page: 0,
      desde: desde || undefined,
      hasta: hasta || undefined,
      facturado: facturadoFiltro ?? undefined,
      esVacio: esVacioFiltro ?? undefined,
      incompleto: incompletoFiltro ?? undefined,
      falta,
      search: debouncedSearch || undefined,
      destino: destino || undefined,
      orderBy,
      orderDir,
    }).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setRows(result.data);
        setHasMore(result.hasMore);
        setAllLoaded(false);
        setPage(0);
        setSelectedIds(new Set());
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [choferId, falta, desde, hasta, facturadoFiltro, esVacioFiltro, incompletoFiltro, debouncedSearch, destino, refreshToken, orderBy, orderDir]);

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await getViajesAction({
        choferId,
        page: nextPage,
        desde: desde || undefined,
        hasta: hasta || undefined,
        facturado: facturadoFiltro ?? undefined,
        esVacio: esVacioFiltro ?? undefined,
        incompleto: incompletoFiltro ?? undefined,
        falta,
        search: debouncedSearch || undefined,
        destino: destino || undefined,
        orderBy,
        orderDir,
      });
      if ("data" in result) {
        setRows((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
        if (!result.hasMore) setAllLoaded(true);
      }
    });
  };

  const hayFiltros =
    !!desde || !!hasta || !!search || !!falta || !!destino || facturadoFiltro !== null || esVacioFiltro !== null || incompletoFiltro !== null;

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setSearch("");
    setDestino("");
    setFacturadoFiltro(null);
    setEsVacioFiltro(null);
    setIncompletoFiltro(null);
  };

  const toggleOrden = (key: ViajeOrderBy) => {
    if (orderBy === key) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(key);
      setOrderDir(key === "fecha" ? "desc" : "asc");
    }
  };

  // --- Selección múltiple (facturación en bloque) -------------------------
  const seleccionablesCargadas = rows.filter(esSeleccionable);
  const selectedViajes = rows.filter((v) => selectedIds.has(v.id));
  // Subconjunto elegible para la acción en bloque.
  const selectedFacturables = selectedViajes.filter(esFacturable);
  const allSeleccionablesSelected =
    seleccionablesCargadas.length > 0 && seleccionablesCargadas.every((v) => selectedIds.has(v.id));

  const toggleSeleccion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeleccionarTodos = () => {
    setSelectedIds((prev) => {
      if (seleccionablesCargadas.length > 0 && seleccionablesCargadas.every((v) => prev.has(v.id))) {
        return new Set();
      }
      return new Set(seleccionablesCargadas.map((v) => v.id));
    });
  };

  const onFacturadoEnBloque = (patches: Map<string, Partial<ViajeBasico>>) => {
    setRows((prev) => prev.map((v) => (patches.has(v.id) ? { ...v, ...patches.get(v.id)! } : v)));
    setSelectedIds(new Set());
  };

  // Totales sobre las filas ya cargadas (no sobre el total del filtro completo).
  const totales = rows.reduce(
    (acc, v) => {
      acc.km += v.km_con_carga ?? 0;
      acc.kmVacios += v.km_vacios ?? 0;
      acc.toneladas += v.toneladas ?? 0;
      acc.flete += v.monto_flete ?? 0;
      return acc;
    },
    { km: 0, kmVacios: 0, toneladas: 0, flete: 0 },
  );

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-muted/40">
        <Input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="text-sm w-36"
          aria-label="Fecha desde"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="text-sm w-36"
          aria-label="Fecha hasta"
        />
        <Input
          type="text"
          placeholder="Buscar por código, chofer, camión, cliente o lugar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm flex-1 min-w-[11rem]"
          aria-label="Buscar viaje por código, chofer, camión, cliente o lugar"
        />
        {destino && (
          <button
            type="button"
            onClick={() => {
              setDestino("");
              setEsVacioFiltro(null);
            }}
            title="Quitar el filtro de destino"
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-primary/40 bg-primary/5 px-2.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <MapPin size={12} />
            Destino: {destino}
            {esVacioFiltro === false && (
              <span className="font-normal opacity-80">· sin vueltas vacías</span>
            )}
            <X size={12} />
          </button>
        )}
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            className="text-muted-foreground hover:text-foreground h-9"
            aria-label="Limpiar todos los filtros"
          >
            <X size={13} className="mr-1" />
            Limpiar filtros
          </Button>
        )}
        <div className="ml-auto">
          <ExportViajesButton
            choferId={choferId}
            falta={falta}
            desde={desde || undefined}
            hasta={hasta || undefined}
            facturado={facturadoFiltro ?? undefined}
            esVacio={esVacioFiltro ?? undefined}
            incompleto={incompletoFiltro ?? undefined}
            search={debouncedSearch || undefined}
            destino={destino || undefined}
            disabled={loading || rows.length === 0}
          />
        </div>
      </div>

      {/* Barra de selección para facturar en bloque */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-[#10B981]/5">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} viaje{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          {selectedFacturables.length > 0 && (
            <Button
              size="sm"
              className="bg-[#10B981] hover:bg-[#059669] text-white gap-1.5"
              onClick={() => setFacturarOpen(true)}
            >
              <Receipt size={14} />
              Agregar remito ({selectedFacturables.length})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            <X size={13} className="mr-1" />
            Limpiar selección
          </Button>
        </div>
      )}

      {/* Tabla */}
      {/* container-type: el panel expandido usa 100cqw para quedar siempre
          dentro del ancho visible aunque la tabla scrollee horizontal. */}
      <div className="overflow-x-auto [container-type:inline-size]">
      {/* Línea divisoria tenue entre columnas: ayuda a seguir la fila sin
          agregar peso visual (el panel expandido va con colSpan → sin borde). */}
      <Table className="[&_tr>*:not(:last-child)]:border-r [&_tr>*:not(:last-child)]:border-border/40">
        <TableHeader className="bg-muted/40">
          <TableRow>
            {COLUMNS.map((col, i) => {
              const isSorted = col.sortKey && orderBy === col.sortKey;
              return (
                <TableHead
                  key={i}
                  className={`text-xs font-semibold text-muted-foreground uppercase tracking-wide ${col.cellClass ?? ""}`}
                >
                  {i === 0 ? (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los viajes facturables"
                      className="size-4 accent-[#0088D1] cursor-pointer align-middle disabled:cursor-not-allowed disabled:opacity-40"
                      checked={allSeleccionablesSelected}
                      disabled={seleccionablesCargadas.length === 0}
                      onChange={toggleSeleccionarTodos}
                    />
                  ) : col.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleOrden(col.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      aria-label={`Ordenar por ${col.label}`}
                    >
                      {col.label}
                      {isSorted ? (
                        orderDir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {COLUMNS.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length}
                className="py-12 text-center text-red-500 text-sm"
              >
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Sin viajes registrados" />
          ) : (
            rows.map((v) => (
              <React.Fragment key={v.id}>
                <TableRow
                  data-viaje-id={v.id}
                  className={`transition-colors cursor-pointer ${
                    viajePedido === v.id ? "bg-primary/[0.06]" : "hover:bg-muted/40"
                  }`}
                  tabIndex={0}
                  onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setExpandedId(expandedId === v.id ? null : v.id);
                  }}
                >
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    {esSeleccionable(v) ? (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar viaje ${v.codigo}`}
                        className="size-4 accent-[#0088D1] cursor-pointer align-middle"
                        checked={selectedIds.has(v.id)}
                        onChange={() => toggleSeleccion(v.id)}
                      />
                    ) : v.facturado ? (
                      <CheckCircle2 size={15} className="text-[#10B981]" aria-label="Con remito" />
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {formatFecha(v.fecha_viaje)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                      <IncompletoMark
                        v={v}
                        onCompletar={(viaje) =>
                          viaje.facturado ? setConfirmEditViaje(viaje) : setEditingViaje(viaje)
                        }
                      />
                      <span className="truncate">{v.cliente ?? <span className="text-muted-foreground/50">—</span>}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-foreground hidden lg:table-cell">
                    {v.chofer ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-foreground hidden sm:table-cell">
                    {v.origen ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-foreground hidden sm:table-cell">
                    {v.destino ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-mono hidden sm:table-cell">
                    {v.es_vacio ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      `${(v.km_con_carga ?? 0).toLocaleString("es-AR")} km`
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono hidden sm:table-cell">
                    {(v.km_vacios ?? 0) > 0 ? (
                      <span className="text-[#C00000] font-semibold">{v.km_vacios.toLocaleString("es-AR")} km</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-mono hidden sm:table-cell">
                    {v.toneladas ?? 0} tn
                  </TableCell>
                  <TableCell className="text-sm font-mono hidden xl:table-cell">
                    {v.es_vacio ? (
                      // Igual que la planilla Excel del cliente: "VACIO" en rojo en el remito.
                      <span className="text-[#C00000] font-bold">VACIO</span>
                    ) : v.nro_remito && v.nro_remito.toUpperCase() !== "VACIO" ? (
                      <span className="text-foreground">{v.nro_remito}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-foreground hidden xl:table-cell max-w-[12rem] truncate">
                    {v.material ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right hidden lg:table-cell">
                    {v.monto_flete != null ? (
                      <span className="font-semibold text-[#10B981]">
                        $ {v.monto_flete.toLocaleString("es-AR")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                        v.facturado
                          ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30"
                          : "bg-[#C00000]/10 text-[#C00000] border border-[#C00000]/30"
                      }`}
                    >
                      {v.facturado ? "REMITO" : "SIN REMITO"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Expandir detalles"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === v.id ? null : v.id);
                      }}
                    >
                      {expandedId === v.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Sub-fila Desplegable de Detalles */}
                {expandedId === v.id && (
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={COLUMNS.length} className="p-0 border-b border-border">
                      {/* sticky + 100cqw: el detalle no se corta con el scroll
                          horizontal de la tabla — siempre ocupa lo visible. */}
                      <div className="sticky left-0 w-[100cqw] p-4 sm:p-5 space-y-4 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        <ViajeDetalleHeader viaje={v} detalle={detalles[v.id]} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ChoferCard detalle={detalles[v.id]} choferNombre={v.chofer} />

                        <CamionFleteCard detalle={detalles[v.id]} viaje={v} />

                        {/* Notas y acciones del viaje */}
                        <div className="flex flex-col rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                          <div className="flex items-center gap-2.5 border-b border-border pb-2.5 mb-2">
                            <span className="flex items-center justify-center size-[34px] rounded-lg bg-[#F59E0B]/14 text-[#D97706] shrink-0">
                              <FileText size={16} strokeWidth={2.1} />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                Notas
                              </div>
                              {v.nro_viaje_ypf ? (
                                <div className="text-[13px] font-bold text-foreground truncate">
                                  Nº viaje <span className="font-mono text-primary">{v.nro_viaje_ypf}</span>
                                </div>
                              ) : (
                                <div className="text-[13px] font-bold text-foreground">Observaciones</div>
                              )}
                            </div>
                          </div>

                          <NotasEditables
                            viajeId={v.id}
                            observaciones={v.observaciones}
                            onSaved={(obs) =>
                              setRows((prev) =>
                                prev.map((item) =>
                                  item.id === v.id ? { ...item, observaciones: obs } : item
                                )
                              )
                            }
                          />

                          <div className="pt-2.5 mt-2.5 border-t border-border space-y-2">
                            {v.facturado ? (
                              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/30 px-3 py-2">
                                <CheckCircle2 size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-[11px] font-semibold text-green-700 dark:text-green-300">
                                  Viaje facturado — remito y valor cargados
                                </span>
                              </div>
                            ) : (
                              !v.es_vacio && (
                                <Button
                                  size="xs"
                                  className="h-9 w-full rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-[12px] font-bold gap-1.5 shadow-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCerrandoViaje(v);
                                  }}
                                >
                                  <Receipt size={13} /> Agregar remito
                                </Button>
                              )
                            )}

                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                {/* Editar primero y con borde: es lo que más se
                                    usa acá y como botón chico de texto plano no
                                    se encontraba. */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 border-border px-3 text-[12px] font-medium text-foreground hover:bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (v.facturado) {
                                      setConfirmEditViaje(v);
                                    } else {
                                      setEditingViaje(v);
                                    }
                                  }}
                                >
                                  <Pencil size={14} /> Editar viaje
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="h-8 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAuditTrailViajeId(v.id);
                                    setAuditTrailOpen(true);
                                  }}
                                >
                                  <Clock size={12} /> Historial
                                </Button>
                              </div>
                              {deletingId === v.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-red-600 font-medium">¿Confirmar?</span>
                                  <Button
                                    variant="destructive"
                                    size="xs"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const res = await deleteViajeAction(v.id);
                                      if (res && res.ok) {
                                        setRows((prev) => prev.filter((item) => item.id !== v.id));
                                        setExpandedId(null);
                                      }
                                      setDeletingId(null);
                                    }}
                                  >
                                    Sí, borrar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingId(null);
                                    }}
                                  >
                                    No
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(v.id);
                                  }}
                                >
                                  <Trash2 size={12} /> Eliminar Viaje
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        </div>

                        <ViajeGastosPanel
                          viajeId={v.id}
                          formData={gastoFormData}
                          montoFlete={v.monto_flete ?? null}
                          moneda={v.moneda ?? "ARS"}
                          esVacio={v.es_vacio}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {/* Resumen de totales sobre los viajes cargados */}
      {!loading && !error && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-t border-border bg-muted/30 text-xs">
          <span className="text-muted-foreground/80 font-semibold uppercase tracking-wide">
            Totales <span className="font-normal normal-case">(sobre {rows.length} cargados)</span>
          </span>
          <span className="text-muted-foreground">
            KM:{" "}
            <span className="font-mono font-semibold text-foreground">
              {totales.km.toLocaleString("es-AR")}
            </span>
          </span>
          <span className="text-muted-foreground">
            KM vacíos:{" "}
            <span className="font-mono font-semibold text-[#C00000]">
              {totales.kmVacios.toLocaleString("es-AR")}
            </span>
          </span>
          <span className="text-muted-foreground">
            Toneladas:{" "}
            <span className="font-mono font-semibold text-foreground">
              {totales.toneladas.toLocaleString("es-AR")} tn
            </span>
          </span>
          <span className="text-muted-foreground">
            Flete:{" "}
            <span className="font-mono font-semibold text-[#10B981]">
              $ {totales.flete.toLocaleString("es-AR")}
            </span>
          </span>
        </div>
      )}

      {/* Cargar más / fin de resultados */}
      {!loading && (hasMore || allLoaded) && (
        <div className="flex justify-center px-5 py-4 border-t border-border">
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isPending}
              aria-label="Cargar más viajes"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Cargando...
                </>
              ) : (
                "Cargar más"
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground/80">
              Todos los resultados cargados — {rows.length} viaje{rows.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Dialog cerrar viaje */}
      {cerrandoViaje && (
        <CerrarViajeDialog
          viaje={cerrandoViaje}
          open={!!cerrandoViaje}
          onOpenChange={(v) => { if (!v) setCerrandoViaje(null); }}
          onSuccess={(patch) => {
            setRows((prev) =>
              prev.map((item) =>
                item.id === cerrandoViaje.id ? { ...item, ...patch } : item
              )
            );
            setCerrandoViaje(null);
          }}
        />
      )}

      {/* Confirm edit facturado */}
      {confirmEditViaje && (
        <Dialog open={!!confirmEditViaje} onOpenChange={(v) => { if (!v) setConfirmEditViaje(null); }}>
          <DialogContent className="sm:max-w-[420px] p-6 gap-0">
            <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-11 rounded-full bg-amber-100 text-amber-600 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <DialogTitle className="text-foreground text-base font-bold">
                    Viaje con remito
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                    {confirmEditViaje.codigo} · {confirmEditViaje.cliente}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-4 space-y-2">
              <p className="text-sm text-foreground font-medium">
                Este viaje ya tiene el remito cargado (con remito y valor).
              </p>
              <p className="text-sm text-muted-foreground">
                Podés editar los datos igual: si cambiás el monto, el viaje se recalcula solo
                (con monto queda &quot;REMITO&quot;; sin monto vuelve a &quot;SIN REMITO&quot;).
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border -mx-6 px-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmEditViaje(null)}
                className="h-9 px-5 text-sm"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-9 px-5 text-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                onClick={() => {
                  setEditingViaje(confirmEditViaje);
                  setConfirmEditViaje(null);
                }}
              >
                Entendido, editar igual
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Viaje Dialog */}
      {editingViaje && (
        <EditViajeDialog
          viaje={editingViaje}
          open={!!editingViaje}
          onOpenChange={(v) => { if (!v) setEditingViaje(null); }}
          onSuccess={(patch) => {
            setRows((prev) =>
              prev.map((item) =>
                item.id === editingViaje.id ? { ...item, ...patch } : item
              )
            );
            setEditingViaje(null);
          }}
        />
      )}

      {/* Audit Trail Drawer */}
      {auditTrailViajeId && (
        <AuditTrailDrawer
          viajeId={auditTrailViajeId}
          open={auditTrailOpen}
          onOpenChange={setAuditTrailOpen}
        />
      )}

      {/* Facturación en bloque */}
      {facturarOpen && selectedFacturables.length > 0 && (
        <FacturarBloqueDialog
          viajes={selectedFacturables}
          open={facturarOpen}
          onOpenChange={setFacturarOpen}
          onSuccess={onFacturadoEnBloque}
        />
      )}

    </div>
  );
}
