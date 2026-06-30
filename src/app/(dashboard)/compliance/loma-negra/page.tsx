import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getComplianceEstadoAction } from "../actions";
import { listLiqLomaAction } from "./liq/actions";
import ComplianceLomaPage from "./ComplianceLomaPage";

/**
 * Página unificada de Compliance — Loma Negra.
 *
 * Misma estructura que `/compliance/ypf`: tabs internos con el "Checklist"
 * (papeleta de documentación al vencimiento) y las "Liquidaciones" (los Excels
 * de fletes que Loma paga, importados vía Viajes → Importar liquidación Loma,
 * con su archivo original guardado).
 *
 * Esta ruta estática sobrescribe la versión dinámica `[cliente]/page.tsx`
 * solo para Loma Negra.
 */
export default async function ComplianceLomaRoute() {
  const user = await requireSeccion("compliance_loma", "read");
  const canWrite = hasSeccion(user, "compliance_loma", "write");
  const canDelete = hasSeccion(user, "compliance_loma", "admin");

  const [{ rows, requisitos }, liqs] = await Promise.all([
    getComplianceEstadoAction("LOMA_NEGRA"),
    listLiqLomaAction(),
  ]);

  return (
    <ComplianceLomaPage
      rows={rows}
      requisitos={requisitos}
      canWrite={canWrite}
      canDelete={canDelete}
      liqs={liqs}
    />
  );
}
