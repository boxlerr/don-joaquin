"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, Loader2, Pencil, X, Check, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  asignarCamionAction,
  desasignarCamionAction,
  listCamionesAsignablesAction,
  type CamionAsignable,
} from "./actions";
import type { CamionAsignado, CamionHistorialItem } from "./types";

const fmt = (s: string | null) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return d ? `${d}/${m}/${y}` : s;
};

export default function CamionAsignacion({
  choferId,
  camionActual,
  historial,
  egresado = false,
}: {
  choferId: string;
  camionActual: CamionAsignado | null;
  historial: CamionHistorialItem[];
  /** Egresado: no se le asigna una unidad nueva. El historial se sigue viendo. */
  egresado?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [opciones, setOpciones] = useState<CamionAsignable[] | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [sel, setSel] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Muestra local del camión recién asignado + a quién se le quitó, para no
  // depender de que el refetch del server refresque a tiempo (era el bug de
  // "carga y lo deja vacío").
  const [asignado, setAsignado] = useState<CamionAsignado | null>(camionActual);
  const [aviso, setAviso] = useState<string | null>(null);
  // Si el server manda un camión distinto (p. ej. cambió desde la planilla),
  // adoptamos ese valor: la muestra local nunca queda desincronizada del prop.
  // Comparamos por id (el prop es un objeto nuevo en cada render del server).
  const camActualId = camionActual?.id ?? null;
  const [propPrevioId, setPropPrevioId] = useState<string | null>(camActualId);
  if (propPrevioId !== camActualId) {
    setPropPrevioId(camActualId);
    setAsignado(camionActual);
  }

  // El camión elegido (si está ocupado por otro chofer, avisamos del "robo").
  const selOpt = opciones?.find((o) => o.id === sel);
  const ocupadoPorOtro = !!selOpt?.chofer_nombre;

  const abrir = async () => {
    setEditing(true);
    setError(null);
    setAviso(null);
    setSel("");
    // Siempre refrescamos: quién ocupa cada camión pudo cambiar desde la última vez.
    setLoadingOpts(true);
    try {
      setOpciones(await listCamionesAsignablesAction());
    } catch {
      setError("No se pudieron cargar los camiones.");
    } finally {
      setLoadingOpts(false);
    }
  };

  const confirmar = () => {
    if (!sel) return;
    setError(null);
    startTransition(async () => {
      const res = await asignarCamionAction(choferId, sel);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res.camion) setAsignado(res.camion);
      setAviso(
        res.quitadoA
          ? `Camión asignado. Se lo quitaste a ${res.quitadoA}, que quedó sin camión.`
          : "Camión asignado.",
      );
      setEditing(false);
      router.refresh();
    });
  };

  const desasignar = () => {
    setError(null);
    startTransition(async () => {
      const res = await desasignarCamionAction(choferId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setAsignado(null);
      setAviso(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 py-0.5">
      {!editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          {asignado ? (
            <span className="text-sm text-foreground">
              <span className="font-mono">{asignado.patente}</span>
              {[asignado.marca, asignado.modelo].filter(Boolean).length > 0 && (
                <span className="text-muted-foreground">
                  {" "}· {[asignado.marca, asignado.modelo].filter(Boolean).join(" ")}
                  {asignado.ano ? ` (${asignado.ano})` : ""}
                </span>
              )}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                egresado ? "text-muted-foreground" : "font-medium text-[#B45309]"
              }`}
            >
              <Truck size={12} /> Sin camión asignado
            </span>
          )}
          {!egresado && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={abrir} disabled={pending}>
              <Pencil size={11} /> {asignado ? "Cambiar" : "Asignar camión"}
            </Button>
          )}
          {asignado && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700"
              onClick={desasignar}
              disabled={pending}
            >
              {pending ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />} Desasignar
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {loadingOpts ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Cargando camiones…
              </span>
            ) : (
              <Combobox
                value={sel}
                onValueChange={setSel}
                options={[
                  { id: "", label: "— Elegí un camión —" },
                  ...(opciones ?? []).map((c) => ({
                    id: c.id,
                    label: c.patente,
                    tone: c.chofer_nombre ? ("busy" as const) : ("free" as const),
                    note: c.chofer_nombre
                      ? c.chofer_egresado
                        ? `${c.chofer_nombre} (egresado)`
                        : c.chofer_nombre
                      : undefined,
                  })),
                ]}
                searchPlaceholder="Buscar patente..."
                triggerClassName="h-8 min-w-[280px] text-xs"
              />
            )}
            <Button type="button" variant="brand" size="sm" className="h-7 text-xs" onClick={confirmar} disabled={pending || !sel}>
              {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirmar
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditing(false); setError(null); }} disabled={pending}>
              Cancelar
            </Button>
          </div>

          {/* Aviso de "robo": el camión elegido lo tiene otro chofer. */}
          {ocupadoPorOtro && selOpt && (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                Este camión lo tiene <span className="font-semibold">{selOpt.chofer_nombre}</span>
                {selOpt.chofer_egresado ? " (egresado)" : ""}. Al confirmar se lo quitás y queda sin camión.
              </span>
            </p>
          )}
        </div>
      )}

      {aviso && !editing && (
        <p className="flex items-start gap-1.5 text-xs text-[#047857]">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {aviso}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {historial.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            Historial de camiones
          </p>
          <ul className="space-y-0.5">
            {historial.slice(0, 8).map((h) => (
              <li key={h.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Truck size={11} className="text-muted-foreground/60 shrink-0" />
                <span className="font-mono text-foreground">{h.patente}</span>
                <span>
                  · {fmt(h.desde)} →{" "}
                  {h.hasta ? fmt(h.hasta) : <span className="text-[#047857] font-medium">actual</span>}
                </span>
                {h.motivo_cambio && <span className="italic">· {h.motivo_cambio}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
