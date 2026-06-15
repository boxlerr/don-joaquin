import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import MantenimientoClient from "./components/MantenimientoClient";
import {
  getServiciosAction,
  getRoturasAction,
  getRoturasPorChoferAction,
  getAlertasProximosServicesAction,
  getReporteMantenimientoPorUnidadAction,
  getTiposServicioAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MantenimientoPage() {
  const user = await requireArea("mantenimiento", "read");
  const canWrite = hasArea(user, "mantenimiento", "write");
  const supabase = createAdminClient();

  const [
    servicios,
    roturas,
    roturasPorChofer,
    alertas,
    reportePorUnidad,
    tiposServicio,
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
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo, tercerizacion_estado, km_actual")
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
      tiposServicio={tiposServicio}
      camiones={camionesResult.data ?? []}
      acoplados={acopladosResult.data ?? []}
      choferes={choferesParaSelector}
      canWrite={canWrite}
    />
  );
}
