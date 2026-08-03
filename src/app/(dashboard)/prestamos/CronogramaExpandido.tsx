"use client";

/**
 * El cronograma que se abre debajo del préstamo: una pastilla por cuota.
 *
 * Los meses que faltan se agregan ACÁ y no en un formulario aparte, porque la
 * pregunta difícil —¿van antes o después?— se contesta sola mirando dónde está
 * el botón: uno queda pegado a la primera cuota y el otro después de la última.
 * De un lado son historia (ya pagadas), del otro es lo que viene.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { agregarCuotasAction, type CuotaRow, type PrestamoRow } from "./actions";
import { mesesAlFinal, mesesAlInicio } from "./cronograma";

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

const CHIP = "flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs";

export default function CronogramaExpandido({
  prestamo,
  canWrite,
  hoy,
  savingId,
  onTogglePagada,
  onEditCuota,
}: {
  prestamo: PrestamoRow;
  canWrite: boolean;
  /** Hoy en ISO, para pintar de rojo las vencidas. */
  hoy: string;
  /** Id de la cuota que se está guardando, para deshabilitar su casillero. */
  savingId: string | null;
  onTogglePagada: (cuotaId: string, pagada: boolean) => void;
  onEditCuota: (cuota: CuotaRow) => void;
}) {
  const router = useRouter();
  /** Qué punta se está usando para agregar; null = ninguna. */
  const [donde, setDonde] = useState<"inicio" | "final" | null>(null);
  const [meses, setMeses] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number.parseInt(meses, 10);
  const nuevas =
    donde && Number.isInteger(n) && n > 0
      ? donde === "inicio"
        ? mesesAlInicio(prestamo.cuotas, n)
        : mesesAlFinal(prestamo.cuotas, n)
      : [];

  const abrir = (d: "inicio" | "final") => {
    setDonde(d);
    setMeses("");
    setError(null);
  };
  const cerrar = () => {
    setDonde(null);
    setMeses("");
    setError(null);
  };

  const agregar = async () => {
    if (nuevas.length === 0 || !donde) return;
    setGuardando(true);
    setError(null);
    const res = await agregarCuotasAction(prestamo.id, { meses: nuevas.length, donde });
    setGuardando(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    cerrar();
    router.refresh();
  };

  // Los pagos mensuales sin fin reponen sus cuotas solos: no hay nada que sumar.
  const puedeAgregar = canWrite && !prestamo.es_recurrente && prestamo.cuotas.length > 0;

  const botonAgregar = (d: "inicio" | "final") => {
    if (donde === d) {
      return (
        <div className={`${CHIP} border-primary/60 bg-card`}>
          <input
            type="number"
            min="1"
            max="120"
            autoFocus
            value={meses}
            disabled={guardando}
            onChange={(e) => setMeses(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") agregar();
              if (e.key === "Escape") cerrar();
            }}
            placeholder="meses"
            className="w-full min-w-0 bg-transparent text-xs tabular-nums text-foreground outline-none"
          />
          <button
            type="button"
            onClick={agregar}
            disabled={nuevas.length === 0 || guardando}
            title="Agregar"
            className="shrink-0 rounded p-0.5 text-[#059669] hover:bg-emerald-50 disabled:opacity-30"
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            title="Cancelar"
            className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => abrir(d)}
        title={
          d === "inicio"
            ? "Agregar cuotas anteriores: las que ya se pagaron y no están cargadas"
            : "Agregar cuotas al final: el préstamo sigue después de la última"
        }
        className={`${CHIP} justify-center border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary`}
      >
        <Plus size={12} className="shrink-0" />
        {d === "inicio" ? "meses antes" : "meses después"}
      </button>
    );
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        {puedeAgregar && botonAgregar("inicio")}

        {prestamo.cuotas.map((c) => {
          const vencida = !c.pagada && c.fecha_vencimiento < hoy;
          return (
            <div
              key={c.id}
              className={`${CHIP} ${
                c.pagada
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                  : vencida
                    ? "border-red-200 bg-red-50/70 text-red-700"
                    : "border-border bg-card text-foreground"
              }`}
            >
              <label className="flex min-w-0 cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={c.pagada}
                  disabled={!canWrite || savingId === c.id}
                  onChange={(e) => onTogglePagada(c.id, e.target.checked)}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-600"
                  title={c.pagada ? "Marcar como no pagada" : "Marcar como pagada"}
                />
                <span className="truncate">
                  <b className="tabular-nums">{c.nro}</b> · {fmtFecha(c.fecha_vencimiento)}
                </span>
              </label>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onEditCuota(c)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-primary"
                  title={`Editar cuota (${ars(c.importe)})`}
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          );
        })}

        {puedeAgregar && botonAgregar("final")}
      </div>

      {/* Un solo renglón, y sólo mientras se está escribiendo el número. */}
      {donde && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {error ? (
            <span className="text-[#B91C1C]">{error}</span>
          ) : nuevas.length > 0 ? (
            <>
              {donde === "inicio" ? (
                <>
                  <b className="text-foreground">{nuevas.length}</b> cuota
                  {nuevas.length !== 1 ? "s" : ""} ya pagada{nuevas.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <b className="text-foreground">{nuevas.length}</b> cuota
                  {nuevas.length !== 1 ? "s" : ""} por pagar
                </>
              )}
              , de {fmtFecha(nuevas[0]!.fecha_vencimiento)} a{" "}
              {fmtFecha(nuevas.at(-1)!.fecha_vencimiento)} · quedan{" "}
              {prestamo.cuotas.length + nuevas.length} en total
              {guardando ? " · guardando…" : ""}
            </>
          ) : donde === "inicio" ? (
            "Cuántos meses faltan antes de la cuota 1. Entran como ya pagados."
          ) : (
            "Cuántos meses sigue el préstamo después de la última cuota."
          )}
        </p>
      )}
    </>
  );
}
