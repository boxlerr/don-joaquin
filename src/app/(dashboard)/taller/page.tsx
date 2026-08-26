import PageHeader from "@/components/layout/PageHeader";
import { hasArea, requireArea } from "@/lib/auth";
import { getDatosTallerAction, getFeedTallerAction } from "./actions";
import { hoyArgentina } from "@/lib/fecha-ar";
import TallerClient from "./TallerClient";

export default async function TallerPage() {
  const user = await requireArea("mantenimiento", "read");
  const canWrite = hasArea(user, "mantenimiento", "write");
  const [datos, feed] = await Promise.all([getDatosTallerAction(), getFeedTallerAction()]);
  const hoy = hoyArgentina();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Taller"
        description="Sacá la foto, escribí qué se hizo y listo"
      />
      <TallerClient datos={datos} feedInicial={feed} hoy={hoy} canWrite={canWrite} />
    </div>
  );
}
