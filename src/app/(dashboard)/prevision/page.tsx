import PageHeader from "@/components/layout/PageHeader";
import { hasSeccion, requireSeccion } from "@/lib/auth";
import { getPrevisionAction } from "./actions";
import PrevisionClient from "./PrevisionClient";

export default async function PrevisionPage() {
  const user = await requireSeccion("prevision", "read");
  const canWrite = hasSeccion(user, "prevision", "write");
  const datos = await getPrevisionAction();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Cómo vienen los próximos meses"
        description="Lo que hay que pagar, contra lo que se espera facturar"
      />
      <PrevisionClient datos={datos} canWrite={canWrite} />
    </div>
  );
}
