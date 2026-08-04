"use client";

import { useEffect, useState } from "react";
import { formatFecha } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { getCuentaClienteAction, type CuentaResumen } from "./actions";

function fmt(n: number, moneda = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda || "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

const TIPO_LABEL: Record<string, { label: string; tone: "debe" | "haber" }> = {
  debe: { label: "Debe", tone: "debe" },
  debito: { label: "Débito", tone: "debe" },
  haber: { label: "Haber", tone: "haber" },
  credito: { label: "Crédito", tone: "haber" },
  pago: { label: "Pago", tone: "haber" },
  factura: { label: "Factura", tone: "debe" },
};

export default function CuentaTab({ clienteId }: { clienteId: string }) {
  const [data, setData] = useState<CuentaResumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    getCuentaClienteAction(clienteId).then((d) => {
      if (!cancel) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [clienteId]);

  if (loading) {
    return (
      <div className="py-10 flex items-center justify-center text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.movimientos.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground bg-card border border-dashed border-border rounded-[8px]">
        Este cliente todavía no tiene movimientos de cuenta corriente.
      </div>
    );
  }

  const moneda = data.movimientos[0]?.moneda ?? "ARS";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <Card label="Total debe" value={fmt(data.totalDebe, moneda)} tone="debe" />
        <Card label="Total haber" value={fmt(data.totalHaber, moneda)} tone="haber" />
        <Card
          label="Saldo"
          value={fmt(data.saldo, moneda)}
          tone={data.saldo > 0 ? "debe" : data.saldo < 0 ? "haber" : "neutral"}
          big
        />
      </div>

      {/* Tabla de consulta dentro de la ficha: scroll horizontal propio, sin
          convertirla en tarjetas (no es la pantalla, son 4 columnas). */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/40 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
            <tr>
              <th className="text-left px-3 py-2">Fecha</th>
              <th className="text-left px-3 py-2">Concepto</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-right px-3 py-2">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.movimientos.map((m) => {
              const meta = TIPO_LABEL[m.tipo] ?? { label: m.tipo, tone: "debe" as const };
              return (
                <tr key={m.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatFecha(m.fecha)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {m.concepto ?? <span className="text-muted-foreground/70">—</span>}
                    {m.categoria && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {m.categoria}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase " +
                        (meta.tone === "debe"
                          ? "bg-[#FEF2F2] text-[#B91C1C]"
                          : "bg-[#ECFDF5] text-[#047857]")
                      }
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td
                    className={
                      "px-3 py-2 text-right font-mono " +
                      (meta.tone === "debe" ? "text-[#B91C1C]" : "text-[#047857]")
                    }
                  >
                    {fmt(Number(m.monto), m.moneda || moneda)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone: "debe" | "haber" | "neutral";
  big?: boolean;
}) {
  const color =
    tone === "debe"
      ? "text-[#B91C1C]"
      : tone === "haber"
        ? "text-[#047857]"
        : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-[8px] p-3">
      <div className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
        {label}
      </div>
      <div className={`${big ? "text-lg" : "text-base"} font-bold mt-1 font-mono ${color}`}>
        {value}
      </div>
    </div>
  );
}
