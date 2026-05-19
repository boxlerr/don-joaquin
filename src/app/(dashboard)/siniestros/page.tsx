import { createAdminClient } from "@/lib/supabase/admin";
import SiniestrosClient from "./components/SiniestrosClient";

export const dynamic = "force-dynamic";

export default async function SiniestrosPage() {
  const supabase = createAdminClient();

  // Fetch real trucks and drivers from existing tables
  const [
    { data: camiones },
    { data: choferes }
  ] = await Promise.all([
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo")
      .order("patente"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .order("nombre")
  ]);

  const listCamiones = camiones || [];
  const listChoferes = choferes || [];

  return (
    <SiniestrosClient
      camiones={listCamiones}
      choferes={listChoferes}
    />
  );
}
