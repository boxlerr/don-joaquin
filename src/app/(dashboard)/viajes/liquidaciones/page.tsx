import { requireSeccion, hasArea } from "@/lib/auth";
import { listDmYpfAction } from "./dm-actions";
import { listLiqLomaAction } from "./liq-actions";
import LiquidacionesClient from "./LiquidacionesClient";

/**
 * Viajes → DM y liquidaciones.
 *
 * El DM de YPF y las liquidaciones de fletes de Loma Negra viven acá (parte de
 * Viajes), no en Compliance: son los documentos que completan la hoja de ruta
 * (tonelaje + importe por viaje) y se importan desde Viajes → Importar.
 */
export default async function ViajesLiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireSeccion("viajes_liquidaciones", "read");
  const canDelete = hasArea(user, "viajes", "write");
  const { tab } = await searchParams;

  const [dms, liqs] = await Promise.all([listDmYpfAction(), listLiqLomaAction()]);

  return (
    <LiquidacionesClient
      dms={dms}
      liqs={liqs}
      canDelete={canDelete}
      initial={tab === "liq" ? "liq" : "dm"}
    />
  );
}
