import { redirect } from "next/navigation";

/**
 * Los DM de YPF se movieron a Viajes → DM y liquidaciones
 * (`/viajes/liquidaciones`). Esta ruta queda como redirect para bookmarks viejos.
 */
export default function DmYpfLegacyRedirect() {
  redirect("/viajes/liquidaciones?tab=dm");
}
