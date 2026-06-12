import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { requireArea } from "@/lib/auth";
import { getPlanillaDiariaData } from "./actions";
import PlanillaDiariaClient from "./PlanillaDiariaClient";
import HelpTutorialButton from "./help-tutorial-button";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function PlanillaDiariaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireArea("viajes", "read");

  const { fecha: fechaParam } = await searchParams;
  const hoy = new Date().toISOString().slice(0, 10);
  const fecha = fechaParam && ISO.test(fechaParam) ? fechaParam : hoy;

  const data = await getPlanillaDiariaData(fecha);

  return (
    <div className="p-8">
      <PageHeader
        title="Planilla diaria"
        description="Asigná qué chofer maneja cada camión hoy. La carga de viajes toma esta unidad por defecto (siempre editable)."
        action={
          <div className="flex items-center gap-2">
            <HelpTutorialButton />
            <Link href="/viajes">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} />
                Volver al listado
              </Button>
            </Link>
          </div>
        }
      />

      {"error" in data ? (
        <p className="text-sm text-red-600">{data.error}</p>
      ) : (
        <PlanillaDiariaClient key={fecha} data={data} />
      )}
    </div>
  );
}
