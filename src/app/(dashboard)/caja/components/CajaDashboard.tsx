"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import MovimientosCajaTable from "./MovimientosCajaTable";
import { getCajaResumenAction, type CajaResumen } from "../actions";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "2026-05" → { desde: "2026-05-01", hasta: "2026-05-31" } */
function mesRange(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function sumarMeses(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  tiposGasto: { id: string; nombre: string; categoria: string }[];
  /** Meses con movimientos ("YYYY-MM"), ordenados descendente. */
  mesesConDatos: string[];
}

export default function CajaDashboard({ tiposGasto, mesesConDatos }: Props) {
  // "YYYY-MM" | "todos" | "custom" (rango manual desde la tabla)
  const [mes, setMes] = useState<string>(() => {
    const actual = mesActual();
    if (mesesConDatos.includes(actual)) return actual;
    return mesesConDatos[0] ?? actual;
  });
  const [rango, setRango] = useState<{ desde: string; hasta: string }>(() =>
    mes === "todos" || mes === "custom" ? { desde: "", hasta: "" } : mesRange(mes),
  );

  const [resumen, setResumen] = useState<CajaResumen | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener("caja:refresh", handler);
    return () => window.removeEventListener("caja:refresh", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCajaResumenAction({
      desde: rango.desde || undefined,
      hasta: rango.hasta || undefined,
    }).then((result) => {
      if (cancelled) return;
      if (!("error" in result)) setResumen(result);
    });
    return () => {
      cancelled = true;
    };
  }, [rango, refreshTick]);

  const seleccionarMes = (nuevo: string) => {
    setMes(nuevo);
    setRango(nuevo === "todos" ? { desde: "", hasta: "" } : mesRange(nuevo));
  };

  const navegarMes = (delta: number) => {
    const base = mes === "todos" || mes === "custom" ? mesActual() : mes;
    seleccionarMes(mes === "todos" || mes === "custom" ? base : sumarMeses(base, delta));
  };

  // El rango manual de la tabla pisa el mes seleccionado (modo "custom")
  const onRangeChange = (desde: string, hasta: string) => {
    setRango({ desde, hasta });
    if (!desde && !hasta) setMes("todos");
    else setMes("custom");
  };

  const opcionesMes = useMemo(() => {
    const meses = mesesConDatos.includes(mes) || mes === "todos" || mes === "custom"
      ? mesesConDatos
      : [mes, ...mesesConDatos].sort().reverse();
    const opts = meses.map((m) => ({ id: m, label: mesLabel(m) }));
    opts.push({ id: "todos", label: "Todos los movimientos" });
    if (mes === "custom") opts.push({ id: "custom", label: "Rango personalizado" });
    return opts;
  }, [mesesConDatos, mes]);

  const periodoLabel =
    mes === "todos"
      ? "Todos los movimientos"
      : mes === "custom"
        ? "Rango personalizado"
        : mesLabel(mes);

  const esMesActual = mes === mesActual();

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navegarMes(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={15} />
          </Button>
          <Combobox
            value={mes}
            onValueChange={(v) => v && seleccionarMes(v)}
            options={opcionesMes}
            searchable={false}
            triggerClassName="h-8 w-56 font-medium"
            aria-label="Seleccionar mes"
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navegarMes(1)}
            disabled={mes !== "todos" && mes !== "custom" && esMesActual}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={15} />
          </Button>
          {!esMesActual && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => seleccionarMes(mesActual())}
            >
              <CalendarDays size={13} />
              Mes actual
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Mostrando: <span className="font-semibold text-foreground">{periodoLabel}</span>
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Saldo actual"
          value={resumen ? `$ ${formatARS(resumen.saldoTotal)}` : "—"}
          sub="Caja general (histórico)"
          color="brand"
        />
        <StatCard
          label="Ingresos"
          value={resumen ? `$ ${formatARS(resumen.ingresos)}` : "—"}
          sub={periodoLabel}
          color="success"
        />
        <StatCard
          label="Egresos"
          value={resumen ? `$ ${formatARS(resumen.egresos)}` : "—"}
          sub={periodoLabel}
          color="error"
        />
        <StatCard
          label="Pendiente de cobro"
          value={resumen ? `$ ${formatARS(resumen.pendienteCobro)}` : "—"}
          sub="Fletes facturados sin cobrar"
          color="warning"
        />
        <StatCard
          label="Movimientos"
          value={resumen ? String(resumen.movimientos) : "—"}
          sub={periodoLabel}
          color="brand"
        />
      </div>

      <MovimientosCajaTable
        tiposGasto={tiposGasto}
        desde={rango.desde}
        hasta={rango.hasta}
        onRangeChange={onRangeChange}
      />
    </>
  );
}
