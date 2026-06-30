import { requireSeccion, hasSeccion } from "@/lib/auth";
import { listChoferesMesAction } from "./actions";
import HojaRutaMensualClient from "./HojaRutaMensualClient";

/**
 * Vista "Hoja de Ruta mensual" — réplica del Excel del cliente.
 * Sidebar con choferes (cada uno = una "página" del Excel) + selector
 * de mes arriba. Click en un chofer → panel derecho con todos sus
 * viajes del mes con las mismas columnas que el Excel maestro.
 */
export default async function HojaRutaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; chofer?: string }>;
}) {
  const user = await requireSeccion("viajes_hoja_ruta", "read");
  const canWrite = hasSeccion(user, "viajes_hoja_ruta", "write");
  const { mes: mesQS, chofer: choferQS } = await searchParams;

  // Mes default: el actual (formato YYYY-MM)
  const mesActual = new Date().toISOString().slice(0, 7);
  const mes = mesQS ?? mesActual;

  const choferes = await listChoferesMesAction(mes);

  return (
    <HojaRutaMensualClient
      mesInicial={mes}
      choferIdInicial={choferQS ?? null}
      choferes={choferes}
      canWrite={canWrite}
    />
  );
}
