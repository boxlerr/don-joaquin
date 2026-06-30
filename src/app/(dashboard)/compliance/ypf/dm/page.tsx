import { requireSeccion } from "@/lib/auth";
import { listDmYpfAction } from "./actions";
import DmYpfListClient from "./DmYpfListClient";

/**
 * Listado de Documentos de Medición (DM) de YPF.
 *
 * Cada DM es la papeleta quincenal firmada por YPF que certifica las
 * toneladas transportadas, la tarifa por ruta y el total a facturar.
 * El importador de viajes guarda acá el PDF original + metadatos.
 *
 * Bárbara y el contador entran a esta página para:
 *  - Confirmar qué quincenas ya están cargadas en el sistema
 *  - Bajar el PDF original firmado por YPF si lo necesitan
 *  - Ver los viajes asociados a cada DM (cuántos son, cuadran)
 */
export default async function DmYpfPage() {
  await requireSeccion("compliance_ypf", "read");
  const dms = await listDmYpfAction();

  return <DmYpfListClient dms={dms} />;
}
