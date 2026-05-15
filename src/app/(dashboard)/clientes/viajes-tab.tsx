"use client";

import { useEffect, useState } from "react";
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

const ESTADO_TONE: Record<string, string> = {
  finalizado: "bg-[#ECFDF5] text-[#047857]",
  en_curso: "bg-[#EFF6FF] text-[#1D4ED8]",
  programado: "bg-[#F1F5F9] text-[#475569]",
  cancelado: "bg-[#FEF2F2] text-[#B91C1C]",
};

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
      <div className="py-10 flex items-center justify-center text-[#475569]">
        <Loader2 size={18} className="animate-spin text-[#0088D1]" />
      </div>
    );
  }

  if (viajes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#475569] bg-white border border-dashed border-[#E2E8F0] rounded-[8px]">
        Este cliente todavía no tiene viajes registrados.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] text-[10px] font-semibold tracking-[0.18em] text-[#94A3B8] uppercase">
          <tr>
            <th className="text-left px-3 py-2">Código</th>
            <th className="text-left px-3 py-2">Fecha</th>
            <th className="text-left px-3 py-2">Ruta</th>
            <th className="text-left px-3 py-2">Estado</th>
            <th className="text-right px-3 py-2">Flete</th>
            <th className="text-right px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {viajes.map((v) => (
            <tr key={v.id} className="hover:bg-[#F8FAFC]">
              <td className="px-3 py-2 font-mono text-xs text-[#0088D1]">
                {v.codigo ?? "—"}
              </td>
              <td className="px-3 py-2 text-[#475569] whitespace-nowrap">
                {v.fecha_viaje ? new Date(v.fecha_viaje).toLocaleDateString("es-AR") : "—"}
              </td>
              <td className="px-3 py-2 text-[#0F172A]">
                <span className="inline-flex items-center gap-1 text-xs">
                  <span>{v.origen ?? "—"}</span>
                  <ArrowRight size={11} className="text-[#94A3B8]" />
                  <span>{v.destino ?? "—"}</span>
                </span>
                {v.tonelaje_real && (
                  <div className="text-[10px] text-[#94A3B8] mt-0.5">
                    {v.tonelaje_real} t
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " +
                    (ESTADO_TONE[v.estado] ?? "bg-[#F1F5F9] text-[#475569]")
                  }
                >
                  {v.estado.replace("_", " ")}
                </span>
                {v.facturado && (
                  <span className="ml-1 text-[9px] text-[#047857] uppercase font-semibold">
                    facturado
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[#0F172A]">
                {fmtMoney(v.monto_flete, v.moneda)}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/viajes?id=${v.id}`}
                  className="inline-flex items-center justify-center size-7 rounded-md text-[#475569] hover:text-[#0088D1] hover:bg-white border border-transparent hover:border-[#CBD5E1]"
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
  );
}
