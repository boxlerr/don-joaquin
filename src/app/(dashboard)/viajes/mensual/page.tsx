import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import MensualPorChofer from "./MensualPorChofer";

export default async function ViajesMensualPage() {
  await requireSeccion("viajes_listado", "read");

  return (
    <div className="p-8">
      <PageHeader
        title="Viajes por chofer — mensual"
        description="Resumen de viajes, km, tonelaje y flete de cada chofer en el mes seleccionado"
        action={
          <Link href="/viajes">
            <Button variant="outline" size="sm">
              <ArrowLeft size={14} />
              Volver al listado
            </Button>
          </Link>
        }
      />

      <MensualPorChofer />
    </div>
  );
}
