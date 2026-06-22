import PageHeader from "@/components/layout/PageHeader";
import { requireArea } from "@/lib/auth";
import { getGlobalAuditLogsAction, getAuditUsuariosAction } from "./actions";
import AuditoriaClient from "./components/AuditoriaClient";

export default async function AuditoriaPage() {
  await requireArea("sistema", "read");
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
      />
      <AuditoriaClient initialData={initialData} usuarios={usuarios} />
    </div>
  );
}
