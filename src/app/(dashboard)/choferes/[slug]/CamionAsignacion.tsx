"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, Loader2, Pencil, X, Check } from "lucide-react";
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
}: {
  choferId: string;
  camionActual: CamionAsignado | null;
  historial: CamionHistorialItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [opciones, setOpciones] = useState<CamionAsignable[] | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [sel, setSel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    setEditing(true);
    setError(null);
    setSel("");
    if (!opciones) {
      setLoadingOpts(true);
      try {
        setOpciones(await listCamionesAsignablesAction());
      } catch {
        setError("No se pudieron cargar los camiones.");
      } finally {
        setLoadingOpts(false);
      }
    }
  };

  const confirmar = () => {
    if (!sel) return;
    startTransition(async () => {
      const res = await asignarCamionAction(choferId, sel);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const desasignar = () => {
    startTransition(async () => {
      const res = await desasignarCamionAction(choferId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 py-0.5">
      {!editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          {camionActual ? (
            <span className="text-sm text-foreground">
              <span className="font-mono">{camionActual.patente}</span>
              {[camionActual.marca, camionActual.modelo].filter(Boolean).length > 0 && (
                <span className="text-muted-foreground">
                  {" "}· {[camionActual.marca, camionActual.modelo].filter(Boolean).join(" ")}
                  {camionActual.ano ? ` (${camionActual.ano})` : ""}
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/60">Sin asignación</span>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={abrir} disabled={pending}>
            <Pencil size={11} /> {camionActual ? "Cambiar" : "Asignar camión"}
          </Button>
          {camionActual && (
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
                  label: `${c.patente}${c.chofer_nombre ? ` — ocupado por ${c.chofer_nombre}` : " — libre"}`,
                })),
              ]}
              searchPlaceholder="Buscar patente..."
              triggerClassName="h-8 min-w-[280px] text-xs"
            />
          )}
          <Button type="button" variant="brand" size="sm" className="h-7 text-xs" onClick={confirmar} disabled={pending || !sel}>
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirmar
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={pending}>
            Cancelar
          </Button>
        </div>
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
