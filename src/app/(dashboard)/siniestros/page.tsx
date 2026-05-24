import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import SiniestrosClient from "./components/SiniestrosClient";

export const dynamic = "force-dynamic";

export default async function SiniestrosPage() {
  const user = await requireArea("logistica", "read");
  const canWrite = hasArea(user, "logistica", "write");
  const supabase = createAdminClient();

  const [{ data: siniestros }, { data: camiones }, { data: choferes }] =
    await Promise.all([
      supabase
        .from("siniestros")
        .select(
          `*, camion:camiones(patente, marca, modelo), chofer:choferes(nombre, apellido)`,
        )
        .order("fecha", { ascending: false }),
      supabase
        .from("camiones")
        .select("id, patente, marca, modelo")
        .order("patente"),
      supabase
        .from("choferes")
        .select("id, nombre, apellido")
        .order("nombre"),
    ]);

  return (
    <SiniestrosClient
      siniestros={siniestros ?? []}
      camiones={camiones ?? []}
      choferes={choferes ?? []}
      canWrite={canWrite}
    />
  );
}
