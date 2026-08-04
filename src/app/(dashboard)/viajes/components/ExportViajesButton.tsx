"use client";

// Exportar viajes. Hay dos formatos que se usan para cosas distintas —el listado
// plano para revisar y filtrar, y la hoja de ruta con una solapa por chofer, que
// es la que se imprime— y casi siempre se quiere un mes entero, no el rango que
// quedó puesto en los filtros. Así que el botón abre un panelito con esas dos
// decisiones en vez de exportar a ciegas.

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, ChevronDown, AlertCircle, Check } from "lucide-react";
import { descargarXlsxBase64 } from "@/lib/excel/download-client";
import { getAllViajesForExportAction } from "../actions";
import type { FaltaDato } from "../types";
import { exportarViajesXlsxAction } from "../export-action";

interface ExportViajesButtonProps {
  choferId?: string;
  desde?: string;
  hasta?: string;
  facturado?: boolean;
  esVacio?: boolean;
  incompleto?: boolean;
  falta?: FaltaDato;
  search?: string;
  destino?: string;
  disabled?: boolean;
}

type Formato = "listado" | "hoja_ruta";
type Periodo = "filtros" | "mes" | "todo";

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Los últimos 18 meses hasta hoy, del más nuevo al más viejo. */
function ultimosMeses(cantidad = 18): { valor: string; label: string }[] {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return {
      valor: `${d.getFullYear()}-${mm}`,
      label: `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    };
  });
}

/** Primer y último día de un mes "YYYY-MM". */
function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(y!, m!, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

function Opcion({
  activo,
  onClick,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`w-full rounded-[6px] border px-2.5 py-2 text-left transition-colors ${
        activo ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/50"
      }`}
    >
      <span
        className={`block text-[12px] font-medium ${activo ? "text-primary" : "text-foreground"}`}
      >
        {titulo}
      </span>
      <span className="block text-[11px] leading-snug text-muted-foreground">{detalle}</span>
    </button>
  );
}

export default function ExportViajesButton({
  choferId,
  desde,
  hasta,
  facturado,
  esVacio,
  incompleto,
  falta,
  search,
  destino,
  disabled,
}: ExportViajesButtonProps) {
  const meses = ultimosMeses();
  const [abierto, setAbierto] = useState(false);
  const [formato, setFormato] = useState<Formato>("listado");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [mes, setMes] = useState(meses[0]!.valor);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const hayFiltros = !!(
    desde ||
    hasta ||
    search ||
    destino ||
    falta ||
    typeof facturado === "boolean" ||
    typeof esVacio === "boolean" ||
    incompleto
  );

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  /** Con los filtros de pantalla, la hoja de ruta necesita un mes: se usa el de "desde". */
  const mesDeFiltros = () => (desde ? desde.slice(0, 7) : meses[0]!.valor);

  const exportar = async () => {
    setError(null);
    setCargando(true);
    try {
      // La hoja de ruta ya se arma en el servidor por mes: una solapa por chofer
      // con su ficha, las patentes y sus viajes. Se descarga directo.
      if (formato === "hoja_ruta") {
        const mesParam = periodo === "todo" ? "total" : periodo === "mes" ? mes : mesDeFiltros();
        // La ruta responde con Content-Disposition: attachment, así que un clic
        // sobre un <a> descarga sin sacar al usuario de la pantalla.
        const a = document.createElement("a");
        a.href = `/viajes/hoja-ruta/export?mes=${mesParam}`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setOk(true);
        setAbierto(false);
        setTimeout(() => setOk(false), 2500);
        return;
      }

      const rango =
        periodo === "mes"
          ? rangoDelMes(mes)
          : periodo === "todo"
            ? { desde: undefined, hasta: undefined }
            : { desde, hasta };
      const conFiltros = periodo === "filtros";

      const data = await getAllViajesForExportAction({
        choferId,
        desde: rango.desde,
        hasta: rango.hasta,
        // Pedir "un mes entero" o "todo" ignora los filtros de pantalla a
        // propósito: se pidió el mes completo, no el mes filtrado.
        facturado: conFiltros ? facturado : undefined,
        esVacio: conFiltros ? esVacio : undefined,
        incompleto: conFiltros ? incompleto : undefined,
        falta: conFiltros ? falta : undefined,
        search: conFiltros ? search : undefined,
        destino: conFiltros ? destino : undefined,
      });

      if (!data || data.length === 0) {
        throw new Error(
          periodo === "mes"
            ? `No hay viajes cargados en ${meses.find((m) => m.valor === mes)?.label ?? mes}.`
            : "No hay viajes para exportar con los filtros actuales.",
        );
      }

      let filename = choferId ? `viajes_chofer_${choferId}` : "viajes";
      if (periodo === "mes") filename += `_${mes}`;
      else if (conFiltros && (rango.desde || rango.hasta))
        filename += `_${[rango.desde, rango.hasta].filter(Boolean).join("_")}`;

      const { filename: nombre, base64 } = await exportarViajesXlsxAction(data, filename);
      descargarXlsxBase64(nombre, base64);
      setOk(true);
      setAbierto(false);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 sm:w-auto sm:justify-start"
      >
        {cargando ? (
          <Loader2 size={15} className="animate-spin text-primary" />
        ) : ok ? (
          <Check size={15} className="text-[#059669]" />
        ) : (
          <FileSpreadsheet size={15} className="text-[#059669]" />
        )}
        Exportar
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>

      {error && (
        <p className="absolute right-0 top-full z-50 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded-[6px] border border-[#B91C1C]/40 bg-card px-3 py-2 text-[12px] leading-snug text-[#B91C1C] shadow-lg">
          <AlertCircle size={12} className="mr-1 inline" />
          {error}
        </p>
      )}

      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(19rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Formato
          </p>
          <div className="space-y-1.5">
            <Opcion
              activo={formato === "listado"}
              onClick={() => setFormato("listado")}
              titulo="Listado"
              detalle="Una fila por viaje, con todas las columnas."
            />
            <Opcion
              activo={formato === "hoja_ruta"}
              onClick={() => setFormato("hoja_ruta")}
              titulo="Hoja de ruta"
              detalle="Una solapa por chofer, con su ficha y sus viajes."
            />
          </div>

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Período
          </p>
          <div className="space-y-1.5">
            {hayFiltros && (
              <Opcion
                activo={periodo === "filtros"}
                onClick={() => setPeriodo("filtros")}
                titulo="Lo que estoy viendo"
                detalle="Respeta las fechas y los filtros de la pantalla."
              />
            )}
            <Opcion
              activo={periodo === "mes"}
              onClick={() => setPeriodo("mes")}
              titulo="Un mes entero"
              detalle="El mes completo, sin los filtros de pantalla."
            />
            <Opcion
              activo={periodo === "todo"}
              onClick={() => setPeriodo("todo")}
              titulo="Todo"
              detalle="Desde el primer viaje cargado hasta hoy."
            />
          </div>

          {periodo === "mes" && (
            <div className="mt-2 grid max-h-40 grid-cols-3 sm:grid-cols-4 gap-1 overflow-y-auto rounded-[6px] border border-border p-1.5">
              {meses.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => setMes(m.valor)}
                  aria-pressed={mes === m.valor}
                  className={`rounded-[4px] px-1 py-2 sm:py-1 text-[11px] transition-colors ${
                    mes === m.valor
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {formato === "hoja_ruta" && periodo === "filtros" && (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              La hoja de ruta se arma por mes: se va a usar el mes de la fecha “desde”.
            </p>
          )}

          <button
            type="button"
            onClick={exportar}
            disabled={cargando}
            className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {cargando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            {cargando ? "Generando…" : "Descargar Excel"}
          </button>
        </div>
      )}
    </div>
  );
}
