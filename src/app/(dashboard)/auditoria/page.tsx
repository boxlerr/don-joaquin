import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion } from "@/lib/auth";
import { getGlobalAuditLogsAction, getAuditUsuariosAction } from "./actions";
import AuditoriaClient from "./components/AuditoriaClient";
import AuditoriaHelpButton from "./AuditoriaHelpButton";

export default async function AuditoriaPage() {
  await requireSeccion("auditoria", "read");
  const [result, usuarios] = await Promise.all([
    getGlobalAuditLogsAction(),
    getAuditUsuariosAction(),
  ]);

  const initialData = "error" in result ? { data: [], total: 0, refs: {} } : result;

  return (
    <div className="p-8">
      <PageHeader
        title="Auditoría del Sistema"
        description="Registro completo de operaciones críticas"
        action={<AuditoriaHelpButton />}
      />
      <AuditoriaClient initialData={initialData} usuarios={usuarios} />
    </div>
  );
}
