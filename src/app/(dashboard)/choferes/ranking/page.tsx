import { requireSeccion, hasSeccion } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import { Users } from "lucide-react";
import RankingTable from "./RankingTable";
import PeriodoSelector from "./PeriodoSelector";
import ExportButton from "./ExportButton";
import CriteriosButton from "./CriteriosButton";
import RankingHelpButton from "./help-tutorial-button";
import { computeRanking, resolverRango, getRankingCriterios } from "./lib";

export default async function RankingChoferes({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  const user = await requireSeccion("choferes_ranking", "read");
  const canWrite = hasSeccion(user, "choferes_ranking", "write");

  const params = await searchParams;
  const periodo = resolverRango(params);

  const criterios = await getRankingCriterios();
  const ranking = await computeRanking({
    desde: periodo.desde,
    hasta: periodo.hasta,
    criterios,
  });

  const periodoUrl = new URLSearchParams();
  periodoUrl.set("rango", periodo.rango);
  if (periodo.rango === "custom") {
    periodoUrl.set("desde", periodo.desde);
    periodoUrl.set("hasta", periodo.hasta);
  }
  const periodoQuery = periodoUrl.toString();

  return (
    <div className="p-8 space-y-4">
      <PageHeader
        title="Ranking de Choferes"
        description={`Período: ${periodo.label}`}
        action={
          <div className="flex items-center gap-2">
            <RankingHelpButton />
            {canWrite && <CriteriosButton criterios={criterios} />}
            <ExportButton
              rangoActual={periodo.rango}
              desdeActual={periodo.desde}
              hastaActual={periodo.hasta}
            />
            <Link
              href="/choferes"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Users size={14} />
              Ver legajos
            </Link>
          </div>
        }
      />
      <PeriodoSelector
        rangoActual={periodo.rango}
        desdeActual={periodo.desde}
        hastaActual={periodo.hasta}
      />
      <RankingTable ranking={ranking} periodoQuery={periodoQuery} criterios={criterios} />
    </div>
  );
}
