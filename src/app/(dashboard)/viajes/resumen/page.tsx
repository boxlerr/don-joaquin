import PageHeader from "@/components/layout/PageHeader";
import { hasSeccion, requireSeccion } from "@/lib/auth";
import { getResumenDestinosAction } from "./actions";
import ResumenDestinosClient from "./ResumenDestinosClient";

/** Hoy, en horario local (no UTC: si no, después de las 21 salta al día siguiente). */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dónde quedó cada chofer — el pedido de Nico.
 *
 * La hoja de ruta responde "¿qué hizo este chofer?". Esto responde "¿a quién
 * tengo en Lomaser para el próximo viaje?": cada chofer aparece una sola vez, en
 * el lugar donde terminó su último viaje.
 */
export default async function ResumenViajesPage() {
  const user = await requireSeccion("viajes_listado", "read");
  const hoy = hoyISO();
  const inicial = await getResumenDestinosAction(hoy, hoy);
  // Quien sólo puede mirar ve los mismos datos, sin los campos editables.
  const canWrite = hasSeccion(user, "viajes_listado", "write");

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Dónde quedó cada chofer"
        description="El último lugar al que llegó cada uno, para saber a quién le podés dar el próximo viaje"
      />
      <ResumenDestinosClient inicial={inicial} hoy={hoy} canWrite={canWrite} />
    </div>
  );
}
