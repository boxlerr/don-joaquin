import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import SiniestrosClient from "./components/SiniestrosClient";

export const dynamic = "force-dynamic";

export default async function SiniestrosPage() {
  await requireArea("logistica", "read");
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
    />
  );
}
