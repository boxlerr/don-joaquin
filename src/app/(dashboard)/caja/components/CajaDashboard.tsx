"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import ResumenCaja from "./ResumenCaja";
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
import { periodoInicial, VENTANA_CAJA_CHICA_DIAS } from "../ventana";

/**
 * Qué se está mirando. El día suelto viene del calendario; "ventana" son los
 * últimos 30 días (lo que ES la caja chica) y con eso abre la pantalla; el mes
 * lo elige la navegación; "custom" lo activa el rango manual de la tabla.
 */
type Periodo =
  | { tipo: "ventana" }
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

function rangoDe(
  periodo: Periodo,
  ventanaDesde: string | undefined,
  hoy: string,
): { desde: string; hasta: string } {
  switch (periodo.tipo) {
    case "ventana":
      return { desde: ventanaDesde ?? "", hasta: hoy };
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
    case "ventana":
      return `Últimos ${VENTANA_CAJA_CHICA_DIAS} días`;
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
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoInicial(ventanaDesde, mesActual()));
  const hoy = hoyISO();
  const rango = rangoDe(periodo, ventanaDesde, hoy);

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
    // Desde la ventana ("Últimos 30 días") la flecha de atrás lleva al mes
    // pasado completo: es el paso hacia atrás que se espera, y la ventana ya
    // incluye lo que va del mes corriente.
    const base = periodo.tipo === "mes" ? periodo.mes : mesActual();
    const mes =
      periodo.tipo === "mes" || periodo.tipo === "ventana" ? sumarMeses(base, delta) : base;
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

  // Sin futuro: la caja no se carga hacia adelante. La ventana termina hoy, así
  // que también está "en el presente".
  const enElPresente =
    periodo.tipo === "ventana" ||
    (periodo.tipo === "mes" && periodo.mes === mesActual()) ||
    (periodo.tipo === "dia" && periodo.dia === hoy);

  // Mes elegido sin un solo movimiento, habiendo otro que sí tiene: el mes al
  // que se puede ir. `null` mientras carga el resumen (`movimientos` en null),
  // para no ofrecer un salto y borrarlo medio segundo después.
  const ultimoConDatos = mesesConDatos[0];
  const mesVacio =
    periodo.tipo === "mes" &&
    resumen?.movimientos === 0 &&
    ultimoConDatos &&
    ultimoConDatos !== periodo.mes
      ? ultimoConDatos
      : null;

  // Navegación del período: va en la franja superior de la barra de saldo, así
  // el control y el número que devuelve son un mismo bloque.
  const controles = (
    <div className="flex flex-wrap items-center gap-1.5">
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
        triggerClassName="w-44 justify-start sm:w-56"
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
            {/* La vuelta a la ventana con la que abre la pantalla: sin esto, el
                que se fue a mirar un día de julio no tenía cómo volver a "lo
                último" más que recargando. */}
            {ventanaDesde && periodo.tipo !== "ventana" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setPeriodo({ tipo: "ventana" });
                  cerrar();
                }}
              >
                Últimos {VENTANA_CAJA_CHICA_DIAS} días
              </Button>
            )}
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
          className="h-9 text-xs text-muted-foreground sm:h-8"
          onClick={() => setPeriodo({ tipo: "mes", mes: mesActual() })}
        >
          <CalendarDays size={13} />
          Mes actual
        </Button>
      )}

      {/* El mes elegido no tiene un solo movimiento y sí hay otro que sí: se
          OFRECE, no se salta. La pantalla se iba sola al último mes con datos y
          nadie entendía por qué estaba parado en julio un 11 de agosto. */}
      {mesVacio && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-muted-foreground sm:h-8"
          onClick={() => setPeriodo({ tipo: "mes", mes: mesVacio })}
        >
          Sin movimientos · ver {mesLabel(mesVacio)}
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
          triggerClassName="h-10 w-44 font-medium sm:h-8"
          aria-label="Filtrar por caja"
        />
      )}
    </div>
  );

  return (
    <>
      {/* El saldo es el real, sin descontar lo privado: es contra este número
          que se arquea la plata de la caja. */}
      <ResumenCaja
        cargando={resumen === null}
        saldo={resumen?.saldoTotal ?? null}
        saldoSub={`${CAJA_LABEL[cajaFiltro]} · histórico`}
        controles={controles}
        // Con la ventana como período, el propio selector ya lo dice: repetirlo
        // a la derecha era el mismo texto dos veces en la misma franja.
        nota={
          ventanaDesde && periodo.tipo !== "ventana"
            ? `Últimos ${VENTANA_CAJA_CHICA_DIAS} días`
            : null
        }
        hoy={resumen?.hoy ?? null}
        metricas={[
          {
            label: "Ingresos",
            value: resumen?.ingresos ?? null,
            sub: periodoLabel,
            tono: "ingreso",
          },
          {
            label: "Egresos",
            value: resumen?.egresos ?? null,
            sub: periodoLabel,
            tono: "egreso",
          },
          // El valor del flete entra con el remito → la facturación del período
          // ES el ingreso por viajes. Solo fuera de la caja general y para quien
          // ve el saldo: es información comercial, no operativa.
          ...(esGeneral && cajaFiltro === "diaria"
            ? [
                {
                  label: "Fletes facturados",
                  value: resumen?.fletesFacturados ?? null,
                  sub: `Ingresos por viajes · ${periodoLabel}`,
                  tono: "ingreso" as const,
                  href: "/viajes",
                },
              ]
            : []),
          {
            label: "Movimientos",
            value: resumen?.movimientos ?? null,
            formato: "cantidad",
            sub: periodoLabel,
          },
        ]}
      />

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
