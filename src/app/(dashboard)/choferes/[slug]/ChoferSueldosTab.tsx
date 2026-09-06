"use client";

// Pestaña "Sueldos" del legajo (8vo feedback Bárbara, 08/07): registro de
// cuánto viene ganando la persona — últimos meses, promedio y comparación
// interanual. Solo visible con permiso de sueldos (confidencial).
//
// Hay dos registros distintos y se muestran los dos, sin sumarlos:
//
//   * Lo transferido: lo que salió a pagarse ese mes y por qué banco. Sale de la
//     nómina que se importa todos los meses y lo tiene TODA la gente, choferes
//     incluidos — para ellos es lo único que hay.
//   * La planilla de administración y taller: sueldo base y sus variables. Sólo
//     la tienen 13 personas, y es el costo del empleado, no lo que cobra: en
//     julio la planilla le da a HAIT $3.456.552 y la nómina $2.088.513.

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, CalendarDays, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import BancoChip from "@/components/ui/BancoChip";
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

  if (!data || (!data.meses.length && !data.nomina.length)) {
    return (
      <EmptyState
        icon={Wallet}
        message="Todavía no hay sueldos registrados para este legajo. Se cargan desde Sueldos → Importar Excel."
      />
    );
  }

  // Si en todo el historial no hay variables, se muestran solo mes y total.
  const hayVariables = data.meses.some(
    (m) => m.comision || m.combustible || m.plusYpf || m.sabados,
  );
  const hayAguinaldo = data.meses.some((m) => m.aguinaldo > 0);
  const hayEmbargos = data.nomina.some((m) => m.embargo > 0);

  // El "último" sale de la misma fuente que el promedio y el interanual, para
  // que los tres números hablen de lo mismo.
  const ultimo =
    data.fuenteKpis === "nomina"
      ? data.nomina[0]
        ? { mes: data.nomina[0].mes, total: data.nomina[0].total }
        : null
      : data.ultimo;
  const rotuloKpi = data.fuenteKpis === "nomina" ? "Último transferido" : "Último sueldo";

  const sube = (data.interanualPct ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {ultimo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet size={13} className="shrink-0" /> {rotuloKpi} ({mesLabel(ultimo.mes)})
            </div>
            <p className="mt-1 text-lg sm:text-xl font-semibold font-mono text-foreground">
              {pesos(ultimo.total)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays size={13} className="shrink-0" /> Promedio últimos 6 meses
            </div>
            <p className="mt-1 text-lg sm:text-xl font-semibold font-mono text-foreground">
              {data.promedio6 != null ? pesos(data.promedio6) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              {sube ? <TrendingUp size={13} className="mt-0.5 shrink-0" /> : <TrendingDown size={13} className="mt-0.5 shrink-0" />} Interanual (vs mismo mes
              del año pasado)
            </div>
            <p
              className={`mt-1 text-lg sm:text-xl font-semibold font-mono ${
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
      )}

      {/* Lo transferido, mes a mes, con el banco por el que salió. */}
      {data.nomina.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Lo transferido
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-muted px-3 sm:px-4 py-2.5 font-medium">Mes</th>
                  <th className="px-4 py-2.5 font-medium">Banco</th>
                  {hayEmbargos && <th className="px-4 py-2.5 font-medium text-right">Embargo</th>}
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.nomina.map((m) => (
                  <tr key={m.mes} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 sm:px-4 py-2 text-foreground">
                      {mesLabel(m.mes)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {m.bancos.map((b, i) => (
                          <span key={`${b.banco ?? "s"}-${i}`} className="inline-flex items-center gap-1.5">
                            {b.banco ? (
                              <BancoChip nombre={b.banco} />
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin banco</span>
                            )}
                            {/* El importe por banco sólo se escribe cuando cobra
                                partido; con uno solo sería repetir el total. */}
                            {m.bancos.length > 1 && (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {pesos(b.importe)}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    {hayEmbargos && (
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                        {m.embargo > 0 ? pesos(m.embargo) : "—"}
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
        </div>
      )}

      {/* Planilla de administración y taller — con las variables son 8 columnas:
          scrollea adentro de su caja y el mes queda fijo a la izquierda. */}
      {data.meses.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Planilla de administración y taller
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-muted px-3 sm:px-4 py-2.5 font-medium">Mes</th>
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
                    <td className="sticky left-0 z-10 bg-card px-3 sm:px-4 py-2 text-foreground whitespace-nowrap">{mesLabel(m.mes)}</td>
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
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los sueldos se liquidan en el sistema contable externo; acá se registran los importes
        importados del Excel mensual, como histórico y para control.
        {data.nomina.length > 0 && data.meses.length > 0 && (
          <> Los dos cuadros no se suman: uno es lo que se transfirió y el otro, el costo del puesto.</>
        )}
      </p>
    </div>
  );
}
