"use client";

import { useEffect, useState } from "react";
import { formatFecha } from "@/lib/utils";
import Link from "next/link";
import { Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { getViajesClienteAction, type ViajeReciente } from "./actions";

function fmtMoney(n: number | null, moneda: string | null) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda || "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ViajesTab({ clienteId }: { clienteId: string }) {
  const [viajes, setViajes] = useState<ViajeReciente[] | null>(null);

  useEffect(() => {
    let cancel = false;
    getViajesClienteAction(clienteId).then((data) => {
      if (!cancel) setViajes(data);
    });
    return () => {
      cancel = true;
    };
  }, [clienteId]);

  if (!viajes) {
    return (
      <div className="py-10 flex items-center justify-center text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-primary" />
      </div>
    );
  }

  if (viajes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground bg-card border border-dashed border-border rounded-[8px]">
        Este cliente todavía no tiene viajes registrados.
      </div>
    );
  }

  // Tabla de consulta dentro de la ficha: scroll horizontal propio. No se
  // convierte en tarjetas porque no es la pantalla principal del módulo.
  return (
    <div className="bg-card border border-border rounded-[8px] overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/40 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
          <tr>
            <th className="text-left px-3 py-2">Código</th>
            <th className="text-left px-3 py-2">Fecha</th>
            <th className="text-left px-3 py-2">Ruta</th>
            <th className="text-left px-3 py-2">Remito</th>
            <th className="text-right px-3 py-2">Flete</th>
            <th className="text-right px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {viajes.map((v) => (
            <tr key={v.id} className="hover:bg-muted/40">
              <td className="px-3 py-2 font-mono text-xs text-primary">
                {v.codigo ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {v.fecha_viaje ? formatFecha(v.fecha_viaje) : "—"}
              </td>
              <td className="px-3 py-2 text-foreground">
                <span className="inline-flex items-center gap-1 text-xs">
                  <span>{v.origen ?? "—"}</span>
                  <ArrowRight size={11} className="text-muted-foreground/70" />
                  <span>{v.destino ?? "—"}</span>
                </span>
                {v.tonelaje_real && (
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {v.tonelaje_real} t
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " +
                    (v.facturado ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF2F2] text-[#B91C1C]")
                  }
                >
                  {v.facturado ? "Con remito" : "Sin remito"}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-foreground">
                {fmtMoney(v.monto_flete, v.moneda)}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/viajes?id=${v.id}`}
                  className="inline-flex items-center justify-center size-9 md:size-7 rounded-md text-muted-foreground hover:text-primary hover:bg-card border border-transparent hover:border-[#CBD5E1]"
                  title="Ver viaje"
                >
                  <ExternalLink size={13} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
