"use client";

import { useEffect, useState } from "react";
import { History, Loader2, Paperclip } from "lucide-react";
import AdjuntosEditable from "@/components/ui/AdjuntosEditable";
import {
  crearUrlSubidaImpuestoAction,
  deleteArchivoImpuestoAction,
  getArchivosImpuestoAction,
  getHistorialImpuestoAction,
  vincularArchivosImpuestoAction,
  type ImpuestoRow,
} from "../actions";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Detalle de un impuesto: sus comprobantes y el historial de períodos
 * anteriores. El historial son las filas del mismo nombre — cada fila ya es un
 * período, así que no hace falta guardar nada aparte.
 */
export default function ImpuestoDetalle({
  impuesto,
  canWrite,
}: {
  impuesto: ImpuestoRow;
  canWrite: boolean;
}) {
  const [historial, setHistorial] = useState<ImpuestoRow[] | null>(null);

  useEffect(() => {
    let vivo = true;
    getHistorialImpuestoAction(impuesto.nombre, impuesto.id)
      .then((r) => {
        if (vivo) setHistorial(r);
      })
      .catch(() => {
        if (vivo) setHistorial([]);
      });
    return () => {
      vivo = false;
    };
  }, [impuesto.nombre, impuesto.id]);

  return (
    <div className="grid grid-cols-1 gap-5 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5 sm:gap-6 lg:grid-cols-2">
      {/* Comprobantes de ESTE período */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Paperclip size={13} />
          Comprobantes
        </div>
        <AdjuntosEditable
          entidadId={impuesto.id}
          getArchivos={getArchivosImpuestoAction}
          crearUrlSubida={(input) => crearUrlSubidaImpuestoAction(input, impuesto.id)}
          vincularArchivos={vincularArchivosImpuestoAction}
          deleteArchivo={deleteArchivoImpuestoAction}
          canEdit={canWrite}
          addLabel="Adjuntar comprobante"
          emptyHint="Opcional — hay impuestos que sólo tienen fecha."
        />
      </div>

      {/* Historial: los períodos anteriores del mismo impuesto */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <History size={13} />
          Historial de {impuesto.nombre}
        </div>

        {historial === null ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" />
            Buscando períodos anteriores…
          </div>
        ) : historial.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">
            Todavía no hay otros períodos cargados de este impuesto.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[360px] text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Período</th>
                  <th className="px-3 py-2 text-left font-bold">Vencía</th>
                  <th className="px-3 py-2 text-left font-bold">Se presentó</th>
                  <th className="px-3 py-2 text-right font-bold">Archivos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historial.map((h) => {
                  const tarde =
                    h.fecha_presentacion !== null && h.fecha_presentacion > h.fecha_vencimiento;
                  return (
                    <tr key={h.id}>
                      <td className="px-3 py-2 text-foreground">{h.periodo ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {fmt(h.fecha_vencimiento)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {h.fecha_presentacion ? (
                          <span className={tarde ? "text-amber-700" : "text-emerald-700"}>
                            {fmt(h.fecha_presentacion)}
                            {tarde && " (tarde)"}
                          </span>
                        ) : (
                          <span className="text-red-600">sin presentar</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {h.archivos > 0 ? h.archivos : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
