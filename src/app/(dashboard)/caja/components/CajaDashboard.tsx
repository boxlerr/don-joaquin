"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Truck,
  Wallet,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import CalendarioPopover from "@/components/ui/CalendarioPopover";
import { Combobox } from "@/components/ui/combobox";
import MovimientosCajaTable from "./MovimientosCajaTable";
import {
  getCajaResumenAction,
  type CajaFiltro,
  type CajaResumen,
  type CajaVista,
} from "../actions";
import { VENTANA_CAJA_CHICA_DIAS } from "../ventana";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Qué se está mirando. El día suelto viene del calendario; el mes es el período
 * por defecto; "custom" lo activa el rango manual de la tabla.
 */
type Periodo =
  | { tipo: "mes"; mes: string }
  | { tipo: "dia"; dia: string }
  | { tipo: "todos" }
  | { tipo: "custom"; desde: string; hasta: string };

/** "2026-05" → { desde: "2026-05-01", hasta: "2026-05-31" } */
function mesRange(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function rangoDe(periodo: Periodo): { desde: string; hasta: string } {
  switch (periodo.tipo) {
    case "mes":
      return mesRange(periodo.mes);
    case "dia":
      return { desde: periodo.dia, hasta: periodo.dia };
    case "custom":
      return { desde: periodo.desde, hasta: periodo.hasta };
    case "todos":
      return { desde: "", hasta: "" };
  }
}

function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function diaLabel(dia: string): string {
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}

function periodoLabelDe(periodo: Periodo): string {
  switch (periodo.tipo) {
    case "mes":
      return mesLabel(periodo.mes);
    case "dia":
      return diaLabel(periodo.dia);
    case "custom":
      return "Rango personalizado";
    case "todos":
      return "Todos los movimientos";
  }
}

function hoyISO(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate(),
  ).padStart(2, "0")}`;
}

function mesActual(): string {
  return hoyISO().slice(0, 7);
}

function sumarMeses(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sumarDias(dia: string, delta: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  const fecha = new Date(y, m - 1, d + delta);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
    fecha.getDate(),
  ).padStart(2, "0")}`;
}

interface Props {
  tiposGasto: { id: string; nombre: string; categoria: string }[];
  /** Meses con movimientos ("YYYY-MM"), ordenados descendente. */
  mesesConDatos: string[];
  /** Días con movimientos ("YYYY-MM-DD"), para marcarlos en el calendario. */
  fechasConDatos?: string[];
  /**
   * Qué pantalla es: la caja chica (operativa, igual para todos los roles) o la
   * general de dirección, que arranca con las dos cajas juntas y suma el
   * selector para separarlas.
   */
  vista?: CajaVista;
  /** Dirección puede cambiar la privacidad de un movimiento desde la tabla. */
  puedeMarcarPrivado?: boolean;
  /** Primer día visible ("YYYY-MM-DD"). La caja chica es una ventana móvil. */
  ventanaDesde?: string;
}

const CAJA_LABEL: Record<CajaFiltro, string> = {
  todas: "Todas las cajas",
  diaria: "Caja chica",
  grande: "Caja general",
};

export default function CajaDashboard({
  tiposGasto,
  mesesConDatos,
  fechasConDatos = [],
  vista = "chica",
  puedeMarcarPrivado = false,
  ventanaDesde,
}: Props) {
  const esGeneral = vista === "general";
  const [cajaFiltro, setCajaFiltro] = useState<CajaFiltro>(esGeneral ? "todas" : "diaria");
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const actual = mesActual();
    return { tipo: "mes", mes: mesesConDatos.includes(actual) ? actual : mesesConDatos[0] ?? actual };
  });
  const rango = rangoDe(periodo);

  const [resumen, setResumen] = useState<CajaResumen | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // `caja:refresh` = el propio usuario cargó algo · `caja:sync` = puede haber
  // cambiado en otra sesión. Los dos recalculan los totales.
  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener("caja:refresh", handler);
    window.addEventListener("caja:sync", handler);
    return () => {
      window.removeEventListener("caja:refresh", handler);
      window.removeEventListener("caja:sync", handler);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCajaResumenAction({
      desde: rango.desde || undefined,
      hasta: rango.hasta || undefined,
      vista,
      caja: cajaFiltro,
    }).then((result) => {
      if (cancelled) return;
      if (!("error" in result)) setResumen(result);
    });
    return () => {
      cancelled = true;
    };
  }, [rango.desde, rango.hasta, refreshTick, cajaFiltro, vista]);

  // Las flechas mueven el período que se esté mirando: día a día si hay un día
  // elegido, mes a mes si no. No se puede salir de la ventana de la caja chica.
  const navegar = (delta: number) => {
    if (periodo.tipo === "dia") {
      const dia = sumarDias(periodo.dia, delta);
      if (ventanaDesde && dia < ventanaDesde) return;
      setPeriodo({ tipo: "dia", dia });
      return;
    }
    const base = periodo.tipo === "mes" ? periodo.mes : mesActual();
    const mes = periodo.tipo === "mes" ? sumarMeses(base, delta) : base;
    if (ventanaDesde && mesRange(mes).hasta < ventanaDesde) return;
    setPeriodo({ tipo: "mes", mes });
  };

  // El rango manual de la tabla pisa el período elegido (modo "custom").
  const onRangeChange = (desde: string, hasta: string) => {
    if (!desde && !hasta) setPeriodo({ tipo: "todos" });
    else setPeriodo({ tipo: "custom", desde, hasta });
  };

  const diasConDatos = useMemo(() => new Set(fechasConDatos), [fechasConDatos]);
  const periodoLabel = periodoLabelDe(periodo);
  const hoy = hoyISO();

  // Cuántas cards quedan: la facturación solo está en la caja chica de dirección.
  const cardsGrid =
    esGeneral && cajaFiltro === "diaria" ? "lg:grid-cols-5" : "lg:grid-cols-4";

  // Sin futuro: la caja no se carga hacia adelante.
  const enElPresente =
    (periodo.tipo === "mes" && periodo.mes === mesActual()) ||
    (periodo.tipo === "dia" && periodo.dia === hoy);

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navegar(-1)}
            aria-label={periodo.tipo === "dia" ? "Día anterior" : "Mes anterior"}
          >
            <ChevronLeft size={15} />
          </Button>

          <CalendarioPopover
            value={periodo.tipo === "dia" ? periodo.dia : null}
            onSelect={(fecha) => setPeriodo({ tipo: "dia", dia: fecha })}
            triggerLabel={periodoLabel}
            triggerClassName="w-56 justify-start"
            ariaLabel="Elegir día o período"
            maxDate={hoy}
            minDate={ventanaDesde}
            hoy={hoy}
            mesInicial={periodo.tipo === "mes" ? periodo.mes : undefined}
            marca={(fecha) =>
              diasConDatos.has(fecha)
                ? {
                    className:
                      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 font-semibold border border-emerald-200/60",
                    title: "Hay movimientos este día",
                  }
                : undefined
            }
            pie={(cerrar) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      const mes =
                        periodo.tipo === "dia" ? periodo.dia.slice(0, 7) : mesActual();
                      setPeriodo({ tipo: "mes", mes });
                      cerrar();
                    }}
                  >
                    Todo el mes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setPeriodo({ tipo: "todos" });
                      cerrar();
                    }}
                  >
                    Todo
                  </Button>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-emerald-50 border border-emerald-200/60" />
                  días con movimientos
                </span>
              </div>
            )}
          />

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navegar(1)}
            disabled={enElPresente}
            aria-label={periodo.tipo === "dia" ? "Día siguiente" : "Mes siguiente"}
          >
            <ChevronRight size={15} />
          </Button>
          {!enElPresente && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => setPeriodo({ tipo: "mes", mes: mesActual() })}
            >
              <CalendarDays size={13} />
              Mes actual
            </Button>
          )}

          {/* Vista general: las dos cajas juntas, con la opción de separarlas. */}
          {esGeneral && (
            <Combobox
              value={cajaFiltro}
              onValueChange={(v) => v && setCajaFiltro(v as CajaFiltro)}
              options={(["todas", "diaria", "grande"] as CajaFiltro[]).map((id) => ({
                id,
                label: CAJA_LABEL[id],
              }))}
              searchable={false}
              triggerClassName="h-8 w-44 font-medium"
              aria-label="Filtrar por caja"
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Mostrando: <span className="font-semibold text-foreground">{periodoLabel}</span>
          {ventanaDesde && (
            <span className="ml-2 text-muted-foreground/80">
              · últimos {VENTANA_CAJA_CHICA_DIAS} días
            </span>
          )}
        </p>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 ${cardsGrid}`}>
        {/* El saldo es el real, sin descontar lo privado: es contra este número
            que se arquea la plata de la caja. */}
        <StatCard
          label="Saldo actual"
          value={resumen ? `$ ${formatARS(resumen.saldoTotal)}` : "—"}
          sub={`${CAJA_LABEL[cajaFiltro]} (histórico)`}
          color="brand"
          icon={Wallet}
        />
        <StatCard
          label="Ingresos"
          value={resumen ? `$ ${formatARS(resumen.ingresos)}` : "—"}
          sub={periodoLabel}
          color="success"
          icon={ArrowUpRight}
        />
        {/* El valor del flete entra con el remito → la facturación del período ES
            el ingreso por viajes. Solo fuera de la caja general y para quien ve
            el saldo: es información comercial, no operativa. */}
        {esGeneral && cajaFiltro === "diaria" && (
          <StatCard
            label="Fletes facturados"
            value={
              resumen?.fletesFacturados != null
                ? `$ ${formatARS(resumen.fletesFacturados)}`
                : "—"
            }
            sub={`Ingresos por viajes · ${periodoLabel}`}
            color="success"
            icon={Truck}
            href="/viajes"
          />
        )}
        <StatCard
          label="Egresos"
          value={resumen ? `$ ${formatARS(resumen.egresos)}` : "—"}
          sub={periodoLabel}
          color="error"
          icon={ArrowDownRight}
        />
        <StatCard
          label="Movimientos"
          value={resumen ? String(resumen.movimientos) : "—"}
          sub={periodoLabel}
          color="brand"
          icon={ReceiptText}
        />
      </div>

      <MovimientosCajaTable
        tiposGasto={tiposGasto}
        desde={rango.desde}
        hasta={rango.hasta}
        onRangeChange={onRangeChange}
        vista={vista}
        caja={cajaFiltro}
        minDate={ventanaDesde}
        mostrarColumnaCaja={cajaFiltro === "todas"}
        puedeMarcarPrivado={puedeMarcarPrivado}
      />
    </>
  );
}
