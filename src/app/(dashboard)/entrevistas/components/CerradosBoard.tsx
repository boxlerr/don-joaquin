"use client";

// Cerrados del tablero: Ingresaron / No ingresaron en dos columnas compactas,
// ordenadas por fecha (lo último arriba) y paginadas de a poco — así la
// columna de descartados no se vuelve infinita con los años. El detalle
// completo vive en la ficha (click) y en la vista Tabla.

import { useMemo, useState } from "react";
import { UserCheck, UserX, ChevronDown, MapPin, Calendar } from "lucide-react";
import Semaforo from "./Semaforo";
import type { Entrevista } from "./EntrevistasTable";

const INICIAL = 6;
const PASO = 12;

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const fechaDe = (e: Entrevista) => e.fecha_entrevista ?? e.created_at.slice(0, 10);

export default function CerradosBoard({
  entrevistas, onVerMas,
}: {
  entrevistas: Entrevista[];
  onVerMas: (e: Entrevista) => void;
}) {
  const [limIngresaron, setLimIngresaron] = useState(INICIAL);
  const [limDescartados, setLimDescartados] = useState(INICIAL);

  const ingresaron = useMemo(
    () => entrevistas.filter((e) => (e.etapa ?? "") === "ingresado")
      .sort((a, b) => fechaDe(b).localeCompare(fechaDe(a))),
    [entrevistas],
  );
  const descartados = useMemo(
    () => entrevistas.filter((e) => (e.etapa ?? "") === "descartado")
      .sort((a, b) => fechaDe(b).localeCompare(fechaDe(a))),
    [entrevistas],
  );

  // Ojo: div clickeable (no <button>) porque el semáforo de adentro ya tiene
  // botones y HTML no permite botones anidados (rompía la hidratación).
  const card = (e: Entrevista, esDescartado: boolean) => (
    <div
      key={e.id}
      role="button"
      tabIndex={0}
      onClick={() => onVerMas(e)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onVerMas(e); }
      }}
      className="w-full cursor-pointer rounded-lg border border-border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary"
      title={`Ver la ficha de ${e.nombre}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-foreground">{e.nombre}</span>
        <span onClick={(ev) => ev.stopPropagation()}>
          <Semaforo entrevistaId={e.id} etapa={e.etapa} canWrite={false} size={10} />
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {e.fecha_entrevista && (
          <span className="inline-flex items-center gap-1"><Calendar size={10} />{fmtFecha(e.fecha_entrevista)}</span>
        )}
        {e.localidad && (
          <span className="inline-flex items-center gap-1"><MapPin size={10} />{e.localidad}</span>
        )}
      </div>
      {esDescartado && e.motivo_descarte && (
        <p className="mt-1 line-clamp-2 text-[11px] italic text-rose-600/90">Motivo: {e.motivo_descarte}</p>
      )}
      {!esDescartado && e.se_mantuvo && (
        <p className="mt-1 line-clamp-1 text-[11px] italic text-orange-600/90">Se mantuvo: {e.se_mantuvo}</p>
      )}
    </div>
  );

  const columna = (
    titulo: string,
    icono: React.ReactNode,
    items: Entrevista[],
    limite: number,
    setLimite: (n: number) => void,
    badge: string,
    esDescartado: boolean,
  ) => {
    const visibles = items.slice(0, limite);
    const restantes = items.length - visibles.length;
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-2.5">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge}`}>
            {icono} {titulo}
          </span>
          <span className="text-lg font-bold text-foreground">{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="py-5 text-center text-[11px] text-muted-foreground/60">Todavía nadie.</p>
          ) : (
            visibles.map((e) => card(e, esDescartado))
          )}
        </div>
        {restantes > 0 && (
          <button
            type="button"
            onClick={() => setLimite(limite + PASO)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border bg-card py-2.5 sm:py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown size={12} /> Mostrar {Math.min(PASO, restantes)} más ({restantes} restantes)
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-bold text-foreground">Cerrados ({ingresaron.length + descartados.length})</h3>
        <p className="text-xs text-muted-foreground">
          Lo último arriba. El detalle completo está en la ficha (click) y en la vista Tabla.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {columna("Ingresaron", <UserCheck size={11} />, ingresaron, limIngresaron, setLimIngresaron,
          "bg-emerald-50 text-emerald-700 border-emerald-200/60", false)}
        {columna("No ingresaron", <UserX size={11} />, descartados, limDescartados, setLimDescartados,
          "bg-rose-50 text-rose-600 border-rose-200/60", true)}
      </div>
    </section>
  );
}
