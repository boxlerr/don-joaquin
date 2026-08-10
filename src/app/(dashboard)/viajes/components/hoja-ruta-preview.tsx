"use client";

// La vista del preview de la HOJA DE RUTA: el resumen, la tabla de pestañas y
// el detalle de los duplicados.
//
// Vive aparte del diálogo (ImportHojaRutaModal) porque son dos cosas distintas:
// el diálogo maneja el archivo, las llamadas al server y la confirmación; esto
// es solo la lectura del análisis. Separado se puede montar con un preview real
// sin subir nada, que es como se mira el diseño.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Combobox } from "@/components/ui/combobox";
import { formatFecha } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Search,
  X,
  XCircle,
} from "lucide-react";
import type {
  HojaRutaPreviewState,
  FilaFutura,
  SheetPreview,
  SheetViajePreview,
  AsignacionSheet,
} from "../import-hoja-ruta/actions";

/** Sentinel local del preview: el usuario decidió explícitamente NO importar una
 * pestaña cuyo chofer no existe en Legajos (se manda como null al confirmar).
 * Una pestaña missing sin decisión bloquea la confirmación (caso «Goiti», 02/07). */
export const OMITIR_SHEET = "__omitir__";

/** Qué se está mirando. Las pestañas son la vista normal; las otras dos son
 * "abrí el número que te llamó la atención". */
type Vista = "pestanas" | "duplicados" | "sin-chofer";

// ---------------------------------------------------------------------------
// Cuentas del preview (puras: las usa el diálogo para el botón de confirmar)
// ---------------------------------------------------------------------------

/** El chofer que quedaría cargado, o null si la pestaña no se va a importar. */
export function choferRealDe(
  asignaciones: AsignacionSheet[],
  sheetName: string,
): string | null {
  const a = asignaciones.find((x) => x.sheetName === sheetName)?.chofer_id ?? null;
  return a && a !== OMITIR_SHEET ? a : null;
}

/** Viajes que se van a crear: los de las pestañas resueltas, sin los duplicados. */
export function contarImportables(
  sheets: SheetPreview[],
  asignaciones: AsignacionSheet[],
): number {
  return sheets.reduce(
    (acc, sh) =>
      acc + (choferRealDe(asignaciones, sh.sheetName) ? sh.total - sh.yaImportados : 0),
    0,
  );
}

/** Filas con fecha futura que hoy se importarían: las de pestañas con chofer.
 * Es lo que hay que descontar del total si el usuario elige dejarlas afuera
 * (las duplicadas ya vienen filtradas del server). */
export function contarFuturasImportables(
  filasFuturas: FilaFutura[],
  asignaciones: AsignacionSheet[],
): number {
  return filasFuturas.filter((f) => choferRealDe(asignaciones, f.sheetName)).length;
}

/** Pestañas que hoy no importarían nada (sin chofer o marcadas para omitir). */
export function sheetsSinChofer(
  sheets: SheetPreview[],
  asignaciones: AsignacionSheet[],
): SheetPreview[] {
  return sheets.filter((sh) => !choferRealDe(asignaciones, sh.sheetName));
}

/** Pestañas cuyo chofer no está en Legajos y que el usuario todavía no resolvió:
 * bloquean la confirmación (ningún viaje puede quedar sin legajo). */
export function sheetsMissingSinResolver(
  sheets: SheetPreview[],
  asignaciones: AsignacionSheet[],
): SheetPreview[] {
  return sheets.filter(
    (sh) =>
      sh.chofer.status === "missing" &&
      !asignaciones.find((a) => a.sheetName === sh.sheetName)?.chofer_id,
  );
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR");

const entero = (n: number) => Math.round(n).toLocaleString("es-AR");

/** Vía marcada a mano en la columna MATERIAL: define los km propios del par.
 * Sin marcar no muestra nada. */
function ViaPill({ via }: { via: "ruta_5" | "ruta_22" | null }) {
  if (!via) return null;
  return (
    <span
      className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      title={
        via === "ruta_5"
          ? "Ruta 5: directa (más corta). Tiene su propia distancia para este par."
          : "Ruta 22: por la base/zona (más larga). Tiene su propia distancia para este par."
      }
    >
      · {via === "ruta_5" ? "Ruta 5" : "Ruta 22"}
    </span>
  );
}

/**
 * Número grande con su etiqueta. El color va SOLO en el número: un bloque entero
 * pintado de ámbar se lee como si algo estuviera roto, y ninguno de estos
 * conteos es un error.
 *
 * Con `onClick` es además el acceso a esas filas: el número que llama la
 * atención tiene que ser el que lleva a ver de qué se trata.
 */
function Tile({
  label,
  value,
  sub,
  tone = "neutral",
  onClick,
  activo,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "warning" | "error" | "neutral";
  onClick?: () => void;
  activo?: boolean;
}) {
  const fg =
    tone === "success"
      ? "text-[#047857]"
      : tone === "warning"
        ? "text-[#B45309]"
        : tone === "error"
          ? "text-[#B91C1C]"
          : "text-foreground";

  const contenido = (
    <>
      {/* Altura fija: sin ella, el chevron de los que se pueden abrir empuja el
          número una fila más abajo que el de los tiles de al lado. */}
      <p className="flex h-3.5 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
        {onClick && <ChevronRight size={11} className="shrink-0 text-muted-foreground/60" />}
      </p>
      <p className={`mt-1 text-lg font-bold leading-none tabular-nums ${fg}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </>
  );

  const base = `rounded-[8px] border bg-card px-3 py-2.5 text-left ${
    activo ? "border-primary ring-1 ring-primary/30" : "border-border"
  }`;

  if (!onClick) return <div className={base}>{contenido}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} transition-colors hover:border-primary/50 hover:bg-muted/30`}
    >
      {contenido}
    </button>
  );
}

function SegBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors ${
        activo ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Avisos del parseo. Fondo de tarjeta y color solo en el ícono: son avisos, no
 * errores, y en bloque ámbar se leían como si el archivo estuviera roto. */
function Avisos({ warnings }: { warnings: string[] }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? warnings : warnings.slice(0, 2);
  return (
    <div className="flex shrink-0 items-start gap-2.5 rounded-[8px] border border-border bg-card px-3 py-2.5 text-xs">
      <AlertTriangle size={15} className="mt-px shrink-0 text-[#F59E0B]" />
      <div className="min-w-0 flex-1 space-y-0.5 text-muted-foreground">
        {visibles.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
        {warnings.length > 2 && (
          <button
            type="button"
            onClick={() => setTodos((v) => !v)}
            className="font-medium text-primary hover:underline"
          >
            {todos ? "Ver menos" : `Ver los ${warnings.length} avisos`}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Filas con fecha posterior a hoy. Un viaje que todavía no pasó no existe: es un
 * error de tipeo en el Excel (el "09/10/2026" que era "09/06"). No se corrige
 * acá —el dato del cliente va tal cual— pero se puede dejar la fila afuera.
 */
function FechasFuturas({
  filas,
  omitir,
  onOmitirChange,
}: {
  filas: FilaFutura[];
  omitir: boolean;
  onOmitirChange: (v: boolean) => void;
}) {
  const una = filas.length === 1;
  return (
    <div className="shrink-0 rounded-[8px] border border-border bg-card px-3 py-2.5 text-xs">
      <p className="flex items-start gap-2.5 text-muted-foreground">
        <AlertTriangle size={15} className="mt-px shrink-0 text-[#F59E0B]" />
        <span>
          <span className="font-semibold text-[#B45309]">
            {una ? "Una fila tiene" : `${filas.length} filas tienen`} fecha posterior a hoy
          </span>
          , así que {una ? "es" : "son"} un error de tipeo en el Excel:{" "}
          {una ? "ese viaje" : "esos viajes"} todavía no pasó
          {una ? "" : "ron"}.
        </span>
      </p>
      <ul className="mt-1.5 space-y-0.5 pl-[26px] font-mono text-[11px] text-muted-foreground">
        {filas.slice(0, 3).map((f, i) => (
          <li key={`${f.sheetName}-${i}`}>
            <span className="font-semibold text-foreground">{formatFecha(f.fecha)}</span> ·{" "}
            {f.sheetName.trim()} · {f.saleDe} → {f.llegaA} · remito {f.remito}
            {f.importe != null && ` · ${money(f.importe)}`}
          </li>
        ))}
        {filas.length > 3 && <li className="font-sans">…y {filas.length - 3} más.</li>}
      </ul>
      <label className="mt-2 flex cursor-pointer items-center gap-2 pl-[26px] text-muted-foreground">
        <input
          type="checkbox"
          checked={omitir}
          onChange={(e) => onOmitirChange(e.target.checked)}
          className="size-4 shrink-0 cursor-pointer rounded accent-[#0088D1] max-md:size-5"
        />
        <span>
          No importar {una ? "esa fila" : "esas filas"}
          <span className="text-muted-foreground/70">
            {" "}
            — el Excel no se toca, la fila queda afuera de esta carga.
          </span>
        </span>
      </label>
    </div>
  );
}

/** El viaje que ya está cargado: código con link a la lista, de dónde salió y
 * cuándo se cargó. Sin el link, "ya estaba" es una afirmación que hay que
 * creerle al sistema. */
function YaCargado({ dupDe }: { dupDe: SheetViajePreview["dupDe"] }) {
  if (!dupDe) return <span className="text-muted-foreground">Ya cargado</span>;
  return (
    <div className="leading-tight">
      <Link
        href={`/viajes?q=${encodeURIComponent(dupDe.codigo)}`}
        target="_blank"
        className="inline-flex items-center gap-1 font-mono font-semibold text-primary hover:underline"
        title="Abrir el viaje ya cargado en el listado"
      >
        {dupDe.codigo}
        <ArrowUpRight size={11} />
      </Link>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {dupDe.cargadoDesde ?? "Origen desconocido"}
        {dupDe.cargadoEl && ` · cargado el ${formatFecha(dupDe.cargadoEl)}`}
      </div>
    </div>
  );
}

/**
 * Los duplicados, uno por uno. Es la respuesta a "¿cuáles son esos 5?": cada
 * fila muestra la del Excel y, al lado, el viaje que YA está cargado por el que
 * se saltea — con su código, de dónde salió y un link para ir a verlo.
 */
function DuplicadosPanel({
  items,
  totales,
  nombreDeChofer,
}: {
  items: { sheet: SheetPreview; viaje: SheetViajePreview }[];
  totales: number;
  nombreDeChofer: (sh: SheetPreview) => string;
}) {
  const uno = totales === 1;
  return (
    // Desde sm la lista tiene su propio scroll dentro del alto del diálogo. En
    // celular no: ahí el alto disponible es tan poco que la tabla quedaba
    // aplastada contra el pie, así que crece y scrollea el diálogo entero.
    <div className="flex flex-col gap-2 sm:min-h-0 sm:flex-1">
      <div className="flex items-start gap-2.5 rounded-[8px] border border-border bg-card px-3 py-2.5 text-xs">
        <Copy size={15} className="mt-px shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          {uno ? "Esta fila del Excel ya está cargada" : `Estas ${totales} filas del Excel ya están cargadas`}{" "}
          en el sistema, así que el importador {uno ? "la saltea" : "las saltea"}: no se
          van a duplicar. Suele pasar cuando una pestaña arrastra viajes de meses
          anteriores que ya se importaron.
        </p>
      </div>

      <div className="overflow-auto rounded-md border border-border sm:min-h-[200px] sm:flex-1">
        {items.length === 0 ? (
          <p className="px-3 py-10 text-center text-xs text-muted-foreground">
            Ningún duplicado coincide con la búsqueda.
          </p>
        ) : (
          <>
            {/* Desde md, la tabla completa. Abajo de eso la fila del Excel y la
                del viaje ya cargado no entran una al lado de la otra. */}
            <table className="hidden w-full min-w-[860px] text-xs md:table">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Pestaña → Chofer</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Ruta</th>
                  <th className="px-3 py-2 text-left">Remito</th>
                  <th className="px-3 py-2 text-right">Tn</th>
                  <th className="px-3 py-2 text-right">Importe</th>
                  <th className="px-3 py-2 text-left">Ya cargado como</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(({ sheet, viaje }, i) => (
                  <tr key={`${sheet.sheetName}-${i}`} className="hover:bg-muted/20">
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-foreground">{nombreDeChofer(sheet)}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {sheet.sheetName.trim()}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top font-mono whitespace-nowrap">
                      {formatFecha(viaje.fecha)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {viaje.saleDe} → {viaje.llegaA}
                      <ViaPill via={viaje.via} />
                      {viaje.material && (
                        <div className="text-[10px] text-muted-foreground">{viaje.material}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top font-mono">
                      {viaje.vacio ? (
                        <span className="font-bold text-[#C00000]">VACIO</span>
                      ) : (
                        viaje.remito
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top font-mono">
                      {viaje.ton != null ? num(viaje.ton) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right align-top font-mono">
                      {viaje.vacio ? (
                        "—"
                      ) : viaje.importe == null ? (
                        <span className="text-muted-foreground/70">sin importe</span>
                      ) : (
                        money(viaje.importe)
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <YaCargado dupDe={viaje.dupDe} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divide-y divide-border md:hidden">
              {items.map(({ sheet, viaje }, i) => (
                <div key={`${sheet.sheetName}-${i}`} className="px-3 py-2.5 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-foreground">
                      {nombreDeChofer(sheet)}
                    </span>
                    <span className="shrink-0 font-mono text-muted-foreground">
                      {formatFecha(viaje.fecha)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    {viaje.saleDe} → {viaje.llegaA}
                    <ViaPill via={viaje.via} />
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {viaje.vacio ? (
                      <span className="font-bold text-[#C00000]">VACIO</span>
                    ) : (
                      `Remito ${viaje.remito}`
                    )}
                    {viaje.ton != null && ` · ${num(viaje.ton)} tn`}
                    {!viaje.vacio && viaje.importe != null && ` · ${money(viaje.importe)}`}
                  </div>
                  <div className="mt-1.5">
                    <YaCargado dupDe={viaje.dupDe} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SheetRow({
  sheet,
  asignado,
  choferesDisponibles,
  onAsignar,
  expanded,
  onToggle,
  onVerDuplicados,
}: {
  sheet: SheetPreview;
  asignado: string | null;
  choferesDisponibles: { id: string; label: string }[];
  onAsignar: (choferId: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
  onVerDuplicados: () => void;
}) {
  const isAmbig = sheet.chofer.status === "ambiguo";
  const isMissing = sheet.chofer.status === "missing";
  const candidatos = sheet.chofer.status === "ambiguo" ? sheet.chofer.candidatos : [];
  const omitido = asignado === OMITIR_SHEET;
  const resuelto = !!asignado && !omitido;
  const importables = resuelto ? sheet.total - sheet.yaImportados : 0;
  const km = sheet.sumaKm + sheet.sumaKmVacios;

  // Candidatos primero (los que el sistema encontró por apellido) y después el
  // resto del padrón: son ~90 personas y el combobox trae buscador.
  const opciones = [
    {
      id: OMITIR_SHEET,
      label: isMissing ? "Omitir: no importar esta pestaña" : "Omitir esta pestaña",
    },
    ...candidatos.map((c) => ({ id: c.id, label: c.label, note: "sugerido" })),
    ...choferesDisponibles
      .filter((c) => !candidatos.some((k) => k.id === c.id))
      .map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-muted/30 ${!resuelto && !omitido ? "bg-muted/20" : ""}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 align-top">
          <div className="flex items-center gap-1">
            {expanded ? (
              <ChevronDown size={13} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={13} className="text-muted-foreground" />
            )}
            {resuelto ? (
              <CheckCircle2 size={13} className="text-[#10B981]" />
            ) : omitido ? (
              <XCircle size={13} className="text-muted-foreground" />
            ) : isAmbig ? (
              <AlertTriangle size={13} className="text-[#F59E0B]" />
            ) : (
              <XCircle size={13} className="text-[#EF4444]" />
            )}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          <div className="font-mono font-semibold text-foreground">
            {sheet.sheetName.trim() || "(sin nombre)"}
          </div>
          {sheet.chofer.status === "ok" && (
            <div className="text-muted-foreground">
              → {sheet.chofer.apellido}, {sheet.chofer.nombre}
            </div>
          )}
          {(isAmbig || isMissing) && (
            <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
              {isAmbig && (
                <div className="text-[#B45309]">
                  → ambiguo · {candidatos.map((c) => c.label).join(" / ")}
                </div>
              )}
              {isMissing && (
                <div className="text-[#B91C1C]">
                  → no está dado de alta en Legajos — cargalo en Choferes → Legajos y volvé a analizar
                </div>
              )}
              <Combobox
                options={opciones}
                value={asignado ?? ""}
                onValueChange={(id) => onAsignar(id === "" ? null : id)}
                placeholder={isMissing ? "Elegir qué hacer…" : "Asignar chofer…"}
                searchPlaceholder="Buscar chofer…"
                aria-label={`Chofer de la pestaña ${sheet.sheetName.trim()}`}
                triggerClassName="h-8 text-[11px] max-w-full sm:max-w-[280px]"
              />
            </div>
          )}
          {sheet.patentes.length > 0 && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/70">
              Patentes: <span className="font-mono">{sheet.patentes.join(" · ")}</span>
            </div>
          )}
          {sheet.warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-muted-foreground italic">
              {w}
            </div>
          ))}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono">
          <span className="font-semibold">{importables}</span>
          <span className="text-muted-foreground/60"> / {sheet.total}</span>
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">
          {num(sheet.vacios)}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono">
          {sheet.pendientesFacturar > 0 ? (
            <span className="font-semibold text-[#B45309]">{sheet.pendientesFacturar}</span>
          ) : (
            <span className="text-muted-foreground/60">0</span>
          )}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono">
          {sheet.yaImportados > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVerDuplicados();
              }}
              className="font-semibold text-primary hover:underline"
              title="Ver cuáles son"
            >
              {sheet.yaImportados}
            </button>
          ) : (
            <span className="text-muted-foreground/60">0</span>
          )}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">
          {sheet.sumaTon > 0 ? entero(sheet.sumaTon) : "—"}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">
          {km > 0 ? entero(km) : "—"}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono">{money(sheet.sumaImporte)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-muted/20 px-3 pt-0 pb-3">
            <ViajesDetalle viajes={sheet.viajes} />
          </td>
        </tr>
      )}
    </>
  );
}

function ViajesDetalle({ viajes }: { viajes: SheetViajePreview[] }) {
  if (viajes.length === 0) {
    return <div className="py-2 text-[11px] text-muted-foreground">Sin viajes en esta pestaña.</div>;
  }
  return (
    <div className="mt-1 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[720px] text-[11px]">
        <thead className="border-b border-border bg-card text-[9px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left">Día</th>
            <th className="px-2 py-1.5 text-left">Ruta</th>
            <th className="px-2 py-1.5 text-right">Km</th>
            <th className="px-2 py-1.5 text-left">Remito</th>
            <th className="px-2 py-1.5 text-left">Material</th>
            <th className="px-2 py-1.5 text-right">Tn</th>
            <th className="px-2 py-1.5 text-right">Importe</th>
            <th className="px-2 py-1.5 text-left">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {viajes.map((v, i) => (
            <tr key={i} className={v.dup ? "text-muted-foreground/70" : ""}>
              <td className="px-2 py-1.5 font-mono whitespace-nowrap">{formatFecha(v.fecha)}</td>
              <td className="px-2 py-1.5">
                {v.saleDe} → {v.llegaA}
                <ViaPill via={v.via} />
              </td>
              <td className="px-2 py-1.5 text-right font-mono">{v.km != null ? num(v.km) : "—"}</td>
              <td className="px-2 py-1.5 font-mono">
                {v.vacio ? (
                  // Igual que la planilla Excel del cliente y la hoja de ruta: "VACIO" en rojo.
                  <span className="font-bold text-[#C00000]">VACIO</span>
                ) : (
                  v.remito
                )}
              </td>
              <td className="px-2 py-1.5">{v.material ?? "—"}</td>
              <td className="px-2 py-1.5 text-right font-mono">{v.ton != null ? num(v.ton) : "—"}</td>
              <td className="px-2 py-1.5 text-right font-mono">{v.vacio ? "—" : money(v.importe)}</td>
              <td className="px-2 py-1.5">
                {v.dup ? (
                  // El tachado solo decía "este no va". El código dice cuál es el
                  // que ya está, que es lo que se pregunta después.
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Copy size={10} className="shrink-0 text-muted-foreground" />
                    Ya cargado
                    {v.dupDe && (
                      <Link
                        href={`/viajes?q=${encodeURIComponent(v.dupDe.codigo)}`}
                        target="_blank"
                        className="font-mono text-primary hover:underline"
                      >
                        {v.dupDe.codigo}
                      </Link>
                    )}
                  </span>
                ) : v.vacio ? (
                  <span className="text-muted-foreground/70">Vacío</span>
                ) : v.importe == null ? (
                  <span className="text-[#B45309]">Sin importe</span>
                ) : (
                  <span className="text-muted-foreground/70">A importar</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function HojaRutaPreviewPanel({
  preview,
  asignaciones,
  onAsignar,
  omitirFuturas,
  onOmitirFuturasChange,
}: {
  preview: NonNullable<HojaRutaPreviewState>;
  asignaciones: AsignacionSheet[];
  onAsignar: (sheetName: string, choferId: string | null) => void;
  omitirFuturas: boolean;
  onOmitirFuturasChange: (v: boolean) => void;
}) {
  const [vista, setVista] = useState<Vista>("pestanas");
  const [busqueda, setBusqueda] = useState("");
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const s = preview.summary;
  // `?? []` suelto crea un array nuevo por render y le rompe la memo de abajo.
  const sheets = useMemo(() => preview.sheets ?? [], [preview.sheets]);

  const toggleExpand = (sheetName: string) =>
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(sheetName)) next.delete(sheetName);
      else next.add(sheetName);
      return next;
    });

  // Mismo número que el botón de confirmar: si el tile no descontara las filas
  // futuras dejadas afuera, la tarjeta y el botón dirían cosas distintas.
  const futurasFuera = omitirFuturas
    ? contarFuturasImportables(preview.filasFuturas ?? [], asignaciones)
    : 0;
  const importables = contarImportables(sheets, asignaciones) - futurasFuera;
  const sinAsignar = sheetsSinChofer(sheets, asignaciones).length;
  const missing = sheetsMissingSinResolver(sheets, asignaciones);

  // Los duplicados en una sola lista: en la tabla por pestaña son un número
  // suelto, y lo que se quiere saber es CUÁLES son.
  const duplicados = useMemo(() => {
    const out: { sheet: SheetPreview; viaje: SheetViajePreview }[] = [];
    for (const sh of sheets) {
      for (const v of sh.viajes) if (v.dup) out.push({ sheet: sh, viaje: v });
    }
    return out.sort((a, b) => a.viaje.fecha.localeCompare(b.viaje.fecha));
  }, [sheets]);

  const nombreDeChofer = (sh: SheetPreview) =>
    sh.chofer.status === "ok"
      ? `${sh.chofer.apellido}, ${sh.chofer.nombre}`
      : sh.sheetName.trim();

  const q = busqueda.trim().toLowerCase();
  const coincide = (sh: SheetPreview) =>
    !q ||
    sh.sheetName.toLowerCase().includes(q) ||
    nombreDeChofer(sh).toLowerCase().includes(q);

  const sheetsVisibles = sheets.filter((sh) => {
    if (!coincide(sh)) return false;
    if (vista === "sin-chofer") return !choferRealDe(asignaciones, sh.sheetName);
    return true;
  });
  const duplicadosVisibles = duplicados.filter((d) => coincide(d.sheet));

  const irA = (v: Vista, filtro = "") => {
    setVista(v);
    setBusqueda(filtro);
  };

  // El período que cubre el archivo es lo que explica los duplicados: una
  // pestaña que arrastra filas de meses anteriores ya cargados.
  const periodo =
    s?.fechaMin && s?.fechaMax
      ? `${formatFecha(s.fechaMin)} → ${formatFecha(s.fechaMax)}`
      : null;

  return (
    <div className="flex flex-col gap-3 py-2 sm:min-h-0 sm:flex-1">
      {/* Resumen. Duplicados y pestañas sin chofer son además el acceso a esas
          filas: son los dos números por los que se pregunta. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="A importar"
          value={entero(importables)}
          sub={
            futurasFuera > 0
              ? `de ${entero(s?.totalViajes ?? 0)} filas · ${futurasFuera} afuera por fecha`
              : `de ${entero(s?.totalViajes ?? 0)} filas del Excel`
          }
          tone="success"
        />
        <Tile
          label="Pestañas"
          value={`${(s?.totalSheets ?? 0) - sinAsignar} / ${s?.totalSheets ?? 0}`}
          sub={sinAsignar > 0 ? `${sinAsignar} sin chofer` : "todas con chofer"}
          tone={sinAsignar > 0 ? "error" : "neutral"}
          onClick={sinAsignar > 0 ? () => irA("sin-chofer") : undefined}
          activo={vista === "sin-chofer"}
        />
        <Tile
          label="Duplicados"
          value={entero(s?.totalDuplicados ?? 0)}
          sub={(s?.totalDuplicados ?? 0) > 0 ? "ya cargados · ver cuáles" : "ninguno repetido"}
          onClick={(s?.totalDuplicados ?? 0) > 0 ? () => irA("duplicados") : undefined}
          activo={vista === "duplicados"}
        />
        <Tile
          label="Sin importe"
          value={entero(s?.totalPendientesFacturar ?? 0)}
          sub="quedan a facturar"
          tone={(s?.totalPendientesFacturar ?? 0) > 0 ? "warning" : "neutral"}
        />
        <Tile
          label="Vacíos"
          value={entero(s?.totalVacios ?? 0)}
          sub={`${entero(s?.totalTon ?? 0)} tn cargadas`}
        />
        <Tile
          label="Importe total"
          value={money(s?.totalImporte)}
          sub={periodo ? `Período ${periodo}` : undefined}
        />
      </div>

      {preview.warnings && preview.warnings.length > 0 && <Avisos warnings={preview.warnings} />}

      {(preview.filasFuturas?.length ?? 0) > 0 && (
        <FechasFuturas
          filas={preview.filasFuturas!}
          omitir={omitirFuturas}
          onOmitirChange={onOmitirFuturasChange}
        />
      )}

      {/* Barra de la vista: qué se está mirando + buscador. Con 63 pestañas,
          encontrar una a ojo es scrollear toda la lista. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-[8px] border border-border bg-card p-0.5">
          <SegBtn activo={vista === "pestanas"} onClick={() => irA("pestanas")}>
            Pestañas ({sheets.length})
          </SegBtn>
          {duplicados.length > 0 && (
            <SegBtn activo={vista === "duplicados"} onClick={() => irA("duplicados")}>
              Duplicados ({duplicados.length})
            </SegBtn>
          )}
          {sinAsignar > 0 && (
            <SegBtn activo={vista === "sin-chofer"} onClick={() => irA("sin-chofer")}>
              Sin chofer ({sinAsignar})
            </SegBtn>
          )}
        </div>

        <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
          <Search
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar pestaña o chofer…"
            className="h-8 w-full rounded-[8px] border border-border bg-card pr-7 pl-7 text-xs outline-none focus:border-primary"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {vista === "duplicados" ? (
        <DuplicadosPanel
          items={duplicadosVisibles}
          totales={duplicados.length}
          nombreDeChofer={nombreDeChofer}
        />
      ) : (
        <div className="overflow-auto rounded-md border border-border sm:min-h-[200px] sm:flex-1">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="w-8 px-3 py-2 text-left"></th>
                <th className="px-3 py-2 text-left">Pestaña → Chofer</th>
                <th className="px-3 py-2 text-right">Viajes</th>
                <th className="px-3 py-2 text-right">Vacíos</th>
                <th
                  className="px-3 py-2 text-right"
                  title="Viajes sin importe (pendientes de facturar)"
                >
                  Sin importe
                </th>
                <th className="px-3 py-2 text-right">Duplic.</th>
                <th className="px-3 py-2 text-right">Tn</th>
                <th className="px-3 py-2 text-right">Km</th>
                <th className="px-3 py-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sheetsVisibles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    {vista === "sin-chofer"
                      ? "Todas las pestañas tienen chofer."
                      : `Ninguna pestaña coincide con «${busqueda}».`}
                  </td>
                </tr>
              ) : (
                sheetsVisibles.map((sh) => (
                  <SheetRow
                    key={sh.sheetName}
                    sheet={sh}
                    asignado={
                      asignaciones.find((a) => a.sheetName === sh.sheetName)?.chofer_id ?? null
                    }
                    choferesDisponibles={preview.choferesDisponibles ?? []}
                    onAsignar={(id) => onAsignar(sh.sheetName, id)}
                    expanded={expandidas.has(sh.sheetName)}
                    onToggle={() => toggleExpand(sh.sheetName)}
                    onVerDuplicados={() => irA("duplicados", sh.sheetName.trim())}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {missing.length > 0 && (
        <div className="flex shrink-0 items-start gap-2.5 rounded-[8px] border border-border bg-card px-3 py-2.5 text-xs">
          <XCircle size={15} className="mt-px shrink-0 text-[#EF4444]" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-[#B91C1C]">
              {missing.map((sh) => `«${sh.sheetName.trim()}»`).join(", ")}
            </span>{" "}
            no corresponde a ningún chofer dado de alta. Cargalo en Choferes → Legajos y volvé
            a analizar el archivo, o resolvelo en la tabla (asignar chofer / omitir pestaña).
          </p>
        </div>
      )}
    </div>
  );
}
