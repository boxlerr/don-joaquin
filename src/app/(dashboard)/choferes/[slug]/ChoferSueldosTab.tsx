"use client";

// Pestaña "Sueldos" del legajo (8vo feedback Bárbara, 08/07): registro de
// cuánto viene ganando la persona — últimos meses, promedio y comparación
// interanual. Solo visible con permiso de sueldos (confidencial).

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, CalendarDays, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getChoferSueldosHistorialAction,
  type SueldosHistorial,
  type SueldoHistorialMes,
} from "./actions";

const pesos = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR");

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};

export default function ChoferSueldosTab({ chofer_id }: { chofer_id: string }) {
  const [data, setData] = useState<SueldosHistorial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    getChoferSueldosHistorialAction(chofer_id).then((res) => {
      if (!vivo) return;
      if ("error" in res) setError(res.error);
      else setData(res);
      setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [chofer_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon={Wallet} message={error} />;
  }

  if (!data || !data.meses.length) {
    return (
      <EmptyState
        icon={Wallet}
        message="Todavía no hay sueldos registrados para este legajo. Se cargan desde Sueldos → Importar Excel."
      />
    );
  }

  // Si en todo el historial no hay variables, se muestran solo mes y total
  // (caso choferes: un importe por mes).
  const hayVariables = data.meses.some(
    (m) => m.comision || m.combustible || m.plusYpf || m.sabados,
  );
  const hayAguinaldo = data.meses.some((m) => m.aguinaldo > 0);

  const sube = (data.interanualPct ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet size={13} /> Último sueldo ({mesLabel(data.ultimo!.mes)})
          </div>
          <p className="mt-1 text-xl font-semibold font-mono text-foreground">
            {pesos(data.ultimo!.total)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays size={13} /> Promedio últimos 6 meses
          </div>
          <p className="mt-1 text-xl font-semibold font-mono text-foreground">
            {data.promedio6 != null ? pesos(data.promedio6) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {sube ? <TrendingUp size={13} /> : <TrendingDown size={13} />} Interanual (vs mismo mes
            del año pasado)
          </div>
          <p
            className={`mt-1 text-xl font-semibold font-mono ${
              data.interanualPct == null
                ? "text-muted-foreground"
                : sube
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {data.interanualPct != null
              ? `${data.interanualPct >= 0 ? "+" : ""}${data.interanualPct.toFixed(1)}%`
              : "—"}
          </p>
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Mes</th>
              <th className="px-4 py-2.5 font-medium text-right">Sueldo base</th>
              {hayVariables && (
                <>
                  <th className="px-4 py-2.5 font-medium text-right">Comisión</th>
                  <th className="px-4 py-2.5 font-medium text-right">Combustible</th>
                  <th className="px-4 py-2.5 font-medium text-right">Plus YPF</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sábados</th>
                </>
              )}
              {hayAguinaldo && <th className="px-4 py-2.5 font-medium text-right">Aguinaldo</th>}
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.meses.map((m: SueldoHistorialMes) => (
              <tr key={m.mes} className="hover:bg-muted/20">
                <td className="px-4 py-2 text-foreground whitespace-nowrap">{mesLabel(m.mes)}</td>
                <td className="px-4 py-2 text-right font-mono text-foreground">
                  {m.sueldoBase > 0 ? pesos(m.sueldoBase) : "—"}
                </td>
                {hayVariables && (
                  <>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                      {m.comision ? pesos(m.comision) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                      {m.combustible ? pesos(m.combustible) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                      {m.plusYpf ? pesos(m.plusYpf) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                      {m.sabados ? pesos(m.sabados) : "—"}
                    </td>
                  </>
                )}
                {hayAguinaldo && (
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                    {m.aguinaldo ? pesos(m.aguinaldo) : "—"}
                  </td>
                )}
                <td className="px-4 py-2 text-right font-mono font-semibold text-foreground">
                  {pesos(m.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Los sueldos se liquidan en el sistema contable externo; acá se registran los importes
        importados del Excel mensual, como histórico y para control.
      </p>
    </div>
  );
}
