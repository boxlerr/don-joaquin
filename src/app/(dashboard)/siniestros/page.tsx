import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import SiniestrosClient from "./components/SiniestrosClient";

export const dynamic = "force-dynamic";

export default async function SiniestrosPage() {
  const user = await requireSeccion("siniestros", "read");
  const canWrite = hasSeccion(user, "siniestros", "write");
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
        .select("id, nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso, estado")
        .order("nombre"),
    ]);

  // Los egresados quedan en la lista pero deshabilitados: hay que poder abrir y
  // editar un siniestro viejo de alguien que después se fue, pero no cargarle
  // uno nuevo. Mismo mecanismo que ya existía para el legajo incompleto.
  const choferesParaSelector = (choferes ?? []).map((c) => {
    const estado = getLegajoEstado(c);
    const egresado = c.estado === "baja";
    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      disabled: egresado || !estado.completo,
      motivo: egresado
        ? "Chofer egresado"
        : estado.completo
          ? undefined
          : `Legajo incompleto. Falta: ${estado.faltantes.join(", ")}`,
    };
  });

  return (
    <SiniestrosClient
      siniestros={siniestros ?? []}
      camiones={camiones ?? []}
      choferes={choferesParaSelector}
      canWrite={canWrite}
    />
  );
}
