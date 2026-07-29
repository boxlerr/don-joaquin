"use client";

import { ArrowUpRight, ArrowDownRight, ArrowRightLeft } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import AddIngresoDialog from "./AddIngresoDialog";
import AddEgresoDialog from "./AddEgresoDialog";
import ImportMovimientosDialog from "./ImportMovimientosDialog";
import TransferirCajaDialog from "./TransferirCajaDialog";
import CajaDashboard from "./CajaDashboard";
import SincronizadorCaja from "./SincronizadorCaja";
import ViaticosPendientesPanel from "./ViaticosPendientesPanel";
import HelpTutorialButton from "../help-tutorial-button";
import CajaTabs from "../CajaTabs";
import type { ViaticoPendiente } from "./RendirViaticoDialog";
import type { CajaId } from "../actions";

/** Ingreso y Egreso son las acciones del día: más grandes que el resto del header. */
const BOTON_CARGA = "h-10 px-4 text-sm font-semibold";

type Props = {
  tiposGasto: { id: string; nombre: string; categoria: string }[];
  /** Meses con movimientos ("YYYY-MM"), ordenados descendente. */
  mesesConDatos: string[];
  /** Días con movimientos ("YYYY-MM-DD"), para marcarlos en el calendario. */
  fechasConDatos: string[];
  viaticos: ViaticoPendiente[];
  /** Puede cargar movimientos en la caja diaria (área caja ≥ write). */
  puedeOperar: boolean;
  /** Ve la caja grande (subsección caja_grande ≥ read). */
  puedeVerGrande: boolean;
  /** Opera la caja grande y transfiere entre cajas (caja_grande ≥ write). */
  puedeOperarGrande: boolean;
  /** Ve la solapa Gastos (subsección "gastos" ≥ read). */
  showGastos: boolean;
  /** Solapa activa, definida por la URL (?caja=grande). */
  caja: CajaId;
  /** Dirección (caja_saldo): decide qué se muestra en la caja chica. */
  puedeMarcarPrivado?: boolean;
  /** Primer día visible ("YYYY-MM-DD") cuando la caja chica es una ventana. */
  ventanaDesde?: string;
};

/**
 * Vista de la caja. La caja chica es la operativa: mismas cards, filtros y
 * movimientos para todos los roles —así dirección comprueba qué ve el personal—
 * acotada al último mes y sin los movimientos privados. Dirección (caja_saldo)
 * ve además el botón para ocultar/mostrar cada fila. La caja general (solapa
 * caja_grande) unifica el historial completo de las dos cajas, con lo privado
 * incluido y un selector para separarlas.
 */
export default function CajaViewCompleta({
  tiposGasto,
  mesesConDatos,
  fechasConDatos,
  viaticos,
  puedeOperar,
  puedeVerGrande,
  puedeOperarGrande,
  showGastos,
  caja,
  puedeMarcarPrivado = false,
  ventanaDesde,
}: Props) {
  const esGrande = caja === "grande";

  return (
    <>
      {/* Mantiene la caja al día con lo que pasa en otras sesiones. */}
      <SincronizadorCaja />

      <PageHeader
        title={esGrande ? "Caja General" : "Caja Chica"}
        description={
          esGrande
            ? "Historial completo de las dos cajas, con los movimientos privados"
            : "Últimos 30 días — se ve igual para todos los roles"
        }
        action={
          <div className="flex items-center gap-2">
            <HelpTutorialButton />
            {!esGrande && puedeOperar && (
              <>
                {/* La importación masiva es de dirección: revisa el histórico. */}
                {puedeMarcarPrivado && <ImportMovimientosDialog />}
                <AddIngresoDialog puedeMarcarPrivado={puedeMarcarPrivado}>
                  <Button variant="success" size="lg" className={BOTON_CARGA}>
                    <ArrowUpRight size={16} />
                    Ingreso
                  </Button>
                </AddIngresoDialog>
                <AddEgresoDialog tiposGasto={tiposGasto} puedeMarcarPrivado={puedeMarcarPrivado}>
                  <Button variant="danger" size="lg" className={BOTON_CARGA}>
                    <ArrowDownRight size={16} />
                    Egreso
                  </Button>
                </AddEgresoDialog>
              </>
            )}
            {esGrande && puedeOperarGrande && (
              <>
                <TransferirCajaDialog>
                  <Button variant="outline" size="sm">
                    <ArrowRightLeft size={14} />
                    Transferir entre cajas
                  </Button>
                </TransferirCajaDialog>
                <AddIngresoDialog caja="grande">
                  <Button variant="success" size="lg" className={BOTON_CARGA}>
                    <ArrowUpRight size={16} />
                    Ingreso
                  </Button>
                </AddIngresoDialog>
                <AddEgresoDialog caja="grande" tiposGasto={tiposGasto}>
                  <Button variant="danger" size="lg" className={BOTON_CARGA}>
                    <ArrowDownRight size={16} />
                    Egreso
                  </Button>
                </AddEgresoDialog>
              </>
            )}
          </div>
        }
      />

      {/* Una sola fila: Caja chica · Caja general · Gastos (mismo nivel). */}
      <CajaTabs activa={caja} showGrande={puedeVerGrande} showGastos={showGastos} />

      {/* key: al cambiar de solapa se resetea el período y recarga el resumen. */}
      <CajaDashboard
        key={caja}
        tiposGasto={tiposGasto}
        mesesConDatos={mesesConDatos}
        fechasConDatos={fechasConDatos}
        vista={esGrande ? "general" : "chica"}
        puedeMarcarPrivado={puedeMarcarPrivado}
        ventanaDesde={ventanaDesde}
      />

      {/* Los viáticos pendientes de rendir son parte del saldo: van en la vista
          de dirección, no en la caja chica. */}
      {esGrande && <ViaticosPendientesPanel viaticos={viaticos} canWrite={puedeOperar} />}
    </>
  );
}
