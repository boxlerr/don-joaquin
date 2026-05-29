import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import MantenimientoClient from "./components/MantenimientoClient";
import {
  getServiciosAction,
  getRoturasAction,
  getRoturasPorChoferAction,
  getAlertasProximosServicesAction,
  getTiposServicioAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MantenimientoPage() {
  const user = await requireArea("flota", "read");
  const canWrite = hasArea(user, "flota", "write");
  const supabase = createAdminClient();

  const [
    servicios,
    roturas,
    roturasPorChofer,
    alertas,
    tiposServicio,
    camionesResult,
    acopladosResult,
    choferesResult,
  ] = await Promise.all([
    getServiciosAction(),
    getRoturasAction(),
    getRoturasPorChoferAction(),
    getAlertasProximosServicesAction(),
    getTiposServicioAction(),
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo, tercerizacion_estado")
      .eq("estado", "activo")
      .order("patente"),
    supabase
      .from("acoplados")
      .select("id, patente, marca, modelo")
      .eq("estado", "activo")
      .order("patente"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido"),
  ]);

  return (
    <MantenimientoClient
      servicios={servicios}
      roturas={roturas}
      roturasPorChofer={roturasPorChofer}
      alertas={alertas}
      tiposServicio={tiposServicio}
      camiones={camionesResult.data ?? []}
      acoplados={acopladosResult.data ?? []}
      choferes={choferesResult.data ?? []}
      canWrite={canWrite}
    />
  );
}
