"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Receipt,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import AddIngresoDialog from "./AddIngresoDialog";
import AddEgresoDialog from "./AddEgresoDialog";
import AddViaticoDialog from "./AddViaticoDialog";
import ImportMovimientosDialog from "./ImportMovimientosDialog";
import TransferirCajaDialog from "./TransferirCajaDialog";
import CajaDashboard from "./CajaDashboard";
import ViaticosPendientesPanel from "./ViaticosPendientesPanel";
import HelpTutorialButton from "../help-tutorial-button";
import CajaTabs from "../CajaTabs";
import type { ViaticoPendiente } from "./RendirViaticoDialog";
import type { CajaId } from "../actions";

type ChoferOption = {
  id: string;
  nombre: string;
  apellido: string;
  disabled?: boolean;
  motivo?: string;
};

type Props = {
  tiposGasto: { id: string; nombre: string; categoria: string }[];
  choferes: ChoferOption[];
  /** Meses con movimientos ("YYYY-MM"), ordenados descendente. */
  mesesConDatos: string[];
  viaticos: ViaticoPendiente[];
  /** Puede cargar movimientos en la caja diaria (área caja ≥ write). */
  puedeOperar: boolean;
  /** Ve la caja grande (subsección caja_grande ≥ read). */
  puedeVerGrande: boolean;
  /** Opera la caja grande y transfiere entre cajas (caja_grande ≥ write). */
  puedeOperarGrande: boolean;
  /** Ve la solapa Gastos (subsección "gastos" ≥ read). */
  showGastos: boolean;
  /** Caja activa, definida por la URL (?caja=grande). */
  caja: CajaId;
};

/**
 * Vista completa de la caja (requiere caja_saldo). Si además tiene caja_grande,
 * aparece el switcher de cajas: la caja activa filtra dashboard + tabla y
 * cambia los botones de carga del header para apuntar a la caja correcta.
 */
export default function CajaViewCompleta({
  tiposGasto,
  choferes,
  mesesConDatos,
  viaticos,
  puedeOperar,
  puedeVerGrande,
  puedeOperarGrande,
  showGastos,
  caja,
}: Props) {
  const esGrande = caja === "grande";

  return (
    <>
      <PageHeader
        title="Caja General"
        description="Movimientos digitales, viáticos y gastos — trazabilidad completa"
        action={
          <div className="flex items-center gap-2">
            <HelpTutorialButton />
            {!esGrande && puedeOperar && (
              <>
                <ImportMovimientosDialog />
                <AddViaticoDialog choferes={choferes}>
                  <Button variant="outline" size="sm">
                    <Receipt size={14} />
                    Registrar viático
                  </Button>
                </AddViaticoDialog>
                <AddIngresoDialog>
                  <Button variant="success" size="sm">
                    <ArrowUpRight size={14} />
                    Ingreso
                  </Button>
                </AddIngresoDialog>
                <AddEgresoDialog tiposGasto={tiposGasto}>
                  <Button variant="danger" size="sm">
                    <ArrowDownRight size={14} />
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
                  <Button variant="success" size="sm">
                    <ArrowUpRight size={14} />
                    Ingreso
                  </Button>
                </AddIngresoDialog>
                <AddEgresoDialog caja="grande" tiposGasto={tiposGasto}>
                  <Button variant="danger" size="sm">
                    <ArrowDownRight size={14} />
                    Egreso
                  </Button>
                </AddEgresoDialog>
              </>
            )}
          </div>
        }
      />

      {/* Una sola fila: Caja diaria · Caja grande · Gastos (mismo nivel). */}
      <CajaTabs activa={caja} showGrande={puedeVerGrande} showGastos={showGastos} />

      {/* key: al cambiar de caja se resetea el mes/rango y recarga el resumen. */}
      <CajaDashboard key={caja} tiposGasto={tiposGasto} mesesConDatos={mesesConDatos} caja={caja} />

      {/* Los viáticos son operativos: viven en la caja diaria. */}
      {!esGrande && <ViaticosPendientesPanel viaticos={viaticos} canWrite={puedeOperar} />}
    </>
  );
}
