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
 * Resumen por destino — el pedido de Nico: entrar por dónde fueron, no por
 * quién fue. La hoja de ruta responde "¿qué hizo este chofer?"; esto responde
 * "¿a quién mandé a Lomaser?".
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
        title="A dónde fueron"
        description="Los viajes agrupados por destino, con qué chofer fue a cada uno"
      />
      <ResumenDestinosClient inicial={inicial} hoy={hoy} canWrite={canWrite} />
    </div>
  );
}
