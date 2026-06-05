"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Calendar, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import {
  getHistorialChoferesDeCamionAction,
  type ChoferHistorialDeCamion,
} from "../actions";

/**
 * Tab "Choferes" del detalle del camión: muestra el historial de qué choferes
 * manejaron esta unidad. Útil cuando hay rotación (enfermos, roturas) y querés
 * saber quién la usó en cada periodo.
 */
export default function CamionChoferesTab({ camionId }: { camionId: string }) {
  const [items, setItems] = useState<ChoferHistorialDeCamion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getHistorialChoferesDeCamionAction(camionId).then((rows) => {
      if (!cancel) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [camionId]);

  if (loading) {
    return (
      <div className="py-10 flex items-center justify-center text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Este camión todavía no tiene choferes asignados.
      </div>
    );
  }

  const activo = items.find((it) => it.hasta === null);
  const historicos = items.filter((it) => it.hasta !== null);

  return (
    <div className="space-y-5">
      {/* Chofer actual destacado */}
      <section>
        <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
          Chofer actual
        </h3>
        {activo ? (
          <div className="bg-[#E1F5FE] dark:bg-sky-500/10 border border-[#BAE6FD] dark:border-sky-500/30 rounded-lg p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-full bg-card text-primary flex items-center justify-center shrink-0">
                <Users size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activo.chofer
                    ? `${activo.chofer.apellido}, ${activo.chofer.nombre}`
                    : "Sin nombre"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar size={11} />
                  Desde {formatFecha(activo.desde)}
                </p>
              </div>
            </div>
            <Link
              href={`/choferes/${activo.chofer_id}`}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver legajo
              <ExternalLink size={11} />
            </Link>
          </div>
        ) : (
          <div className="bg-muted/40 border border-dashed border-border rounded-lg p-4 text-sm text-muted-foreground italic">
            Sin chofer asignado actualmente.
          </div>
        )}
      </section>

      {/* Historial de choferes anteriores */}
      {historicos.length > 0 && (
        <section>
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
            Choferes anteriores ({historicos.length})
          </h3>
          <ul className="space-y-2">
            {historicos.map((it) => (
              <li
                key={it.id}
                className="bg-card border border-border rounded-lg p-3 flex items-start gap-3"
              >
                <span className="size-8 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0">
                  <Users size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/choferes/${it.chofer_id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {it.chofer
                      ? `${it.chofer.apellido}, ${it.chofer.nombre}`
                      : "Chofer eliminado"}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <Calendar size={11} />
                    {formatFecha(it.desde)}
                    <ArrowRight size={11} className="text-muted-foreground/70" />
                    {it.hasta ? formatFecha(it.hasta) : "actual"}
                  </p>
                  {it.motivo_cambio && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">
                      {it.motivo_cambio}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[10px] text-muted-foreground/70 italic">
        Los cambios de asignación se registran automáticamente. Los choferes
        rotan unidades cuando hay enfermos o reparaciones — esta vista refleja
        esos cambios.
      </p>
    </div>
  );
}

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
