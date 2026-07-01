import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import MantenimientoClient from "./components/MantenimientoClient";
import {
  getServiciosAction,
  getRoturasAction,
  getRoturasPorChoferAction,
  getAlertasProximosServicesAction,
  getReporteMantenimientoPorUnidadAction,
  getTiposServicioAction,
  getInsumosAction,
  getCostoRepuestosPorChoferAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Tab = "servicios" | "roturas" | "insumos" | "alertas" | "reportes";
const TABS_VALIDAS: Tab[] = ["servicios", "roturas", "insumos", "alertas", "reportes"];

export default async function MantenimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireSeccion("mantenimiento_servicios", "read");
  const canWrite = hasSeccion(user, "mantenimiento_servicios", "write");
  const supabase = createAdminClient();

  const { tab } = await searchParams;
  const initialTab = TABS_VALIDAS.includes(tab as Tab) ? (tab as Tab) : undefined;

  const [
    servicios,
    roturas,
    roturasPorChofer,
    alertas,
    reportePorUnidad,
    tiposServicio,
    insumos,
    costoPorChofer,
    camionesResult,
    acopladosResult,
    choferesResult,
  ] = await Promise.all([
    getServiciosAction(),
    getRoturasAction(),
    getRoturasPorChoferAction(),
    getAlertasProximosServicesAction(),
    getReporteMantenimientoPorUnidadAction(),
    getTiposServicioAction(),
    getInsumosAction(),
    getCostoRepuestosPorChoferAction(),
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo, tercerizacion_estado, km_actual, chofer_actual_id")
      .eq("estado", "activo")
      .order("patente"),
    supabase
      .from("acoplados")
      .select("id, patente, marca, modelo")
      .eq("estado", "activo")
      .order("patente"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso")
      .eq("estado", "activo")
      .order("apellido"),
  ]);

  const choferesParaSelector = (choferesResult.data ?? []).map((c) => {
    const estado = getLegajoEstado(c);
    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      disabled: !estado.completo,
      motivo: estado.completo ? undefined : `Legajo incompleto. Falta: ${estado.faltantes.join(", ")}`,
    };
  });

  return (
    <MantenimientoClient
      servicios={servicios}
      roturas={roturas}
      roturasPorChofer={roturasPorChofer}
      alertas={alertas}
      reportePorUnidad={reportePorUnidad}
      insumos={insumos}
      costoPorChofer={costoPorChofer}
      tiposServicio={tiposServicio}
      camiones={camionesResult.data ?? []}
      acoplados={acopladosResult.data ?? []}
      choferes={choferesParaSelector}
      canWrite={canWrite}
      initialTab={initialTab}
    />
  );
}
