import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import MantenimientoClient from "./components/MantenimientoClient";

export const dynamic = "force-dynamic";

export default async function MantenimientoPage() {
  const user = await requireArea("flota", "read");
  const canWrite = hasArea(user, "flota", "write");
  const supabase = createAdminClient();
  const [camionesResult, choferesResult] = await Promise.all([
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo")
      .order("patente"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido"),
  ]);

  return (
    <MantenimientoClient
      dbCamiones={camionesResult.data || []}
      dbChoferes={choferesResult.data || []}
      canWrite={canWrite}
    />
  );
}

