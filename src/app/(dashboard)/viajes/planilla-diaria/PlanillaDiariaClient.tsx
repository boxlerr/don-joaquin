"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import ImprimirPlanillaButton from "./ImprimirPlanillaButton";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
  CopyCheck,
} from "lucide-react";
import {
  getPlanillaDiariaData,
  guardarPlanillaDiariaAction,
  type PlanillaDiariaData,
} from "./actions";

type Fila = {
  chofer_id: string;
  nombre: string;
  apellido: string;
  camion_habitual_id: string | null;
  /** "" = sin asignar */
  camion_id: string;
  observaciones: string;
};

function fechaAnterior(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildFilas(data: PlanillaDiariaData): Fila[] {
  return data.choferes.map((c) => ({
    chofer_id: c.chofer_id,
    nombre: c.nombre,
    apellido: c.apellido,
    camion_habitual_id: c.camion_habitual_id,
    // Si hay asignación del día la usamos; si no, sugerimos el habitual.
    camion_id: c.camion_asignado_id ?? c.camion_habitual_id ?? "",
    observaciones: c.observaciones ?? "",
  }));
}

export default function PlanillaDiariaClient({ data }: { data: PlanillaDiariaData }) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>(() => buildFilas(data));
  const [guardando, setGuardando] = useState(false);
  const [copiando, startCopiar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  // Qué chofer(es) tienen cada camión hoy — para marcar ocupado/libre en el selector.
  const ocupadoPor = useMemo(() => {
    const m = new Map<string, { id: string; label: string }[]>();
    for (const f of filas) {
      if (!f.camion_id) continue;
      const arr = m.get(f.camion_id) ?? [];
      arr.push({ id: f.chofer_id, label: f.apellido });
      m.set(f.camion_id, arr);
    }
    return m;
  }, [filas]);

  // Opciones del selector de UNA fila: verde = libre · ámbar = ocupado por otro
  // chofer ese día (mostrando su apellido).
  const opcionesCamion = (f: Fila): ComboboxOption[] =>
    data.camiones.map((c) => {
      const otros = (ocupadoPor.get(c.id) ?? []).filter((o) => o.id !== f.chofer_id);
      return otros.length
        ? {
            id: c.id,
            label: c.label,
            tone: "busy" as const,
            note: otros.map((o) => o.label).join(", "),
          }
        : { id: c.id, label: c.label, tone: "free" as const };
    });

  // Detección de camión repetido en el mismo día.
  const camionesDuplicados = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const f of filas) {
      if (f.camion_id) cuenta.set(f.camion_id, (cuenta.get(f.camion_id) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [filas]);

  const hayDuplicados = camionesDuplicados.size > 0;
  const asignados = filas.filter((f) => f.camion_id).length;

  const setCamion = (choferId: string, camionId: string) =>
    setFilas((prev) =>
      prev.map((f) => (f.chofer_id === choferId ? { ...f, camion_id: camionId } : f)),
    );

  const setObs = (choferId: string, obs: string) =>
    setFilas((prev) =>
      prev.map((f) => (f.chofer_id === choferId ? { ...f, observaciones: obs } : f)),
    );

  const restaurarHabituales = () => {
    setFilas((prev) =>
      prev.map((f) => ({ ...f, camion_id: f.camion_habitual_id ?? "", observaciones: "" })),
    );
    setResultado(null);
  };

  const cambiarFecha = (nueva: string) => {
    if (nueva && nueva !== data.fecha) {
      router.push(`/viajes/planilla-diaria?fecha=${nueva}`);
    }
  };

  const copiarDiaAnterior = () => {
    setResultado(null);
    startCopiar(async () => {
      const prev = await getPlanillaDiariaData(fechaAnterior(data.fecha));
      if ("error" in prev) {
        setResultado({ ok: false, mensaje: prev.error });
        return;
      }
      const mapa = new Map(prev.choferes.map((c) => [c.chofer_id, c.camion_asignado_id]));
      setFilas((cur) =>
        cur.map((f) => {
          const camionAyer = mapa.get(f.chofer_id);
          return camionAyer ? { ...f, camion_id: camionAyer } : f;
        }),
      );
      setResultado({ ok: true, mensaje: "Se copió la asignación del día anterior. Revisá y guardá." });
    });
  };

  const handleGuardar = async () => {
    if (hayDuplicados) {
      setResultado({ ok: false, mensaje: "Hay un camión asignado a más de un chofer. Corregí antes de guardar." });
      return;
    }
    setGuardando(true);
    setResultado(null);

    const res = await guardarPlanillaDiariaAction({
      fecha: data.fecha,
      items: filas.map((f) => ({
        chofer_id: f.chofer_id,
        camion_id: f.camion_id || null,
        observaciones: f.observaciones.trim() || null,
      })),
    });

    setGuardando(false);

    if (res.ok) {
      setResultado({ ok: true, mensaje: `Planilla guardada: ${res.guardadas} chofer(es) con camión asignado.` });
      router.refresh();
    } else {
      setResultado({ ok: false, mensaje: res.error });
    }
  };

  return (
    <div className="space-y-5">
      {/* Barra superior: fecha + atajos */}
      <div className="bg-card border border-border rounded-[8px] px-5 py-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Fecha</label>
          <input
            type="date"
            value={data.fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="h-9 px-3 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copiarDiaAnterior}
            disabled={copiando}
            className="gap-1.5 h-9 text-xs"
          >
            {copiando ? <Loader2 size={13} className="animate-spin" /> : <CopyCheck size={13} />}
            Copiar día anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={restaurarHabituales}
            className="gap-1.5 h-9 text-xs"
          >
            <RotateCcw size={13} />
            Restaurar habituales
          </Button>
          <ImprimirPlanillaButton fecha={data.fecha} />
        </div>

        <div className="self-center ml-auto flex items-center gap-3 text-xs text-muted-foreground/80">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> ocupado
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>{asignados} de {filas.length} choferes con camión</span>
        </div>
      </div>

      {/* Grilla */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {["Chofer", "Camión del día", "Observaciones"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs border-b border-border whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const esHabitual = !!f.camion_id && f.camion_id === f.camion_habitual_id;
                const duplicado = !!f.camion_id && camionesDuplicados.has(f.camion_id);
                return (
                  <tr
                    key={f.chofer_id}
                    className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${duplicado ? "bg-red-50/50" : ""}`}
                  >
                    {/* Chofer */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="font-medium text-foreground">
                        {f.apellido}, {f.nombre}
                      </span>
                    </td>

                    {/* Camión */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Combobox
                          value={f.camion_id}
                          onValueChange={(v) => setCamion(f.chofer_id, v)}
                          options={opcionesCamion(f)}
                          placeholder="— Sin asignar —"
                          searchPlaceholder="Buscar patente..."
                          clearable
                          invalid={duplicado}
                          triggerClassName="h-8 w-48 text-xs"
                        />
                        {esHabitual && !duplicado && (
                          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                            habitual
                          </span>
                        )}
                        {duplicado && (
                          <span title="Camión asignado a otro chofer">
                            <AlertTriangle size={14} className="text-red-500" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Observaciones */}
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={f.observaciones}
                        onChange={(e) => setObs(f.chofer_id, e.target.value)}
                        placeholder="Opcional (ej: reemplaza a Pérez)"
                        maxLength={500}
                        className="h-8 w-full min-w-[220px] px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>
                  </tr>
                );
              })}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No hay choferes activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback */}
      {resultado && (
        <div
          className={`flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border ${
            resultado.ok
              ? "bg-[#ECFDF5] border-[#6EE7B7] text-[#064E3B]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]"
          }`}
        >
          {resultado.ok ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#10B981]" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
          )}
          <span className="font-medium">{resultado.mensaje}</span>
        </div>
      )}

      {/* Guardar */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleGuardar}
          disabled={guardando || hayDuplicados}
          className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold px-8 h-10 gap-2"
        >
          {guardando ? (
            <><Loader2 size={15} className="animate-spin" /> Guardando...</>
          ) : (
            <><CheckCircle2 size={15} /> Guardar planilla</>
          )}
        </Button>
      </div>
    </div>
  );
}
