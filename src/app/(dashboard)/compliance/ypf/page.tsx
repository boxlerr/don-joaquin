import { requireArea, hasArea } from "@/lib/auth";
import { getComplianceEstadoAction } from "../actions";
import { listDmYpfAction } from "./dm/actions";
import ComplianceYpfPage from "./ComplianceYpfPage";

/**
 * Página unificada de Compliance — YPF.
 *
 * En vez de tener dos rutas separadas (`/compliance/ypf` y
 * `/compliance/ypf/dm`), todo vive bajo `/compliance/ypf` con tabs
 * internos: "Checklist" (la papeleta de documentación que se presenta
 * al vencimiento) y "Documentos DM" (los PDFs firmados por YPF que
 * cargamos vía el importador).
 *
 * Esta ruta sobrescribe la versión dinámica `[cliente]/page.tsx` solo
 * para YPF; Loma Negra y otros clientes siguen pasando por ese.
 */
export default async function ComplianceYpfRoute() {
  const user = await requireArea("compliance", "read");
  const canWrite = hasArea(user, "compliance", "write");

  const [{ rows, requisitos }, dms] = await Promise.all([
    getComplianceEstadoAction("YPF"),
    listDmYpfAction(),
  ]);

  return (
    <ComplianceYpfPage
      rows={rows}
      requisitos={requisitos}
      canWrite={canWrite}
      dms={dms}
    />
  );
}
