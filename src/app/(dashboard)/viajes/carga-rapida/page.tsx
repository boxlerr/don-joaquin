import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion } from "@/lib/auth";
import { getViajeFormData } from "../actions";
import CargaRapidaGrid from "./CargaRapidaGrid";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function CargaRapidaPage() {
  await requireSeccion("viajes_carga_rapida", "write");
  const formData = await getViajeFormData();

  if ("error" in formData) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">{formData.error}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Carga rápida de viajes"
        description="Cargá varios viajes de una sola vez. Cliente y tipo de carga aplican a todas las filas por defecto."
        action={
          <Link href="/viajes">
            <Button variant="outline" size="sm">
              <ArrowLeft size={14} />
              Volver al listado
            </Button>
          </Link>
        }
      />

      <CargaRapidaGrid data={formData} />
    </div>
  );
}
