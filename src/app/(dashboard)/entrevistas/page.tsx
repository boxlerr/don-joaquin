import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { UserSearch, UserPlus, ClipboardCheck, UserCheck, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import EntrevistasTable, { type Entrevista } from "./components/EntrevistasTable";
import EntrevistaFormDialog from "./components/EntrevistaFormDialog";

export default async function EntrevistasPage() {
  const user = await requireArea("rrhh", "read");
  const canWrite = hasArea(user, "rrhh", "write");
  const canDelete = hasArea(user, "rrhh", "admin");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("entrevistas")
    .select(
      "id, nombre, fecha_entrevista, edad, localidad, telefono, observaciones, preocupacional, resultado, created_at",
    )
    .order("fecha_entrevista", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const entrevistas = (data || []) as Entrevista[];

  const total = entrevistas.length;
  const pendientes = entrevistas.filter((e) => e.resultado === "pendiente").length;
  const ingresaron = entrevistas.filter((e) => e.resultado === "ingresa").length;
  const preocupacionalPendiente = entrevistas.filter((e) => e.preocupacional === "pendiente").length;

  return (
    <div className="p-8">
      <PageHeader
        title="Entrevistas"
        description="Registro de personas entrevistadas: observaciones, preocupacional y si ingresan al transporte"
        action={
          canWrite ? (
            <EntrevistaFormDialog>
              <Button>
                <UserPlus className="size-4" />
                Nueva entrevista
              </Button>
            </EntrevistaFormDialog>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total entrevistados"
          value={String(total)}
          sub="Personas registradas"
          color="brand"
          icon={UserSearch}
        />
        <StatCard
          label="Pendientes"
          value={String(pendientes)}
          sub="En evaluación / sin definir"
          color="warning"
          icon={Clock}
        />
        <StatCard
          label="Ingresaron"
          value={String(ingresaron)}
          sub="Entraron al transporte"
          color="success"
          icon={UserCheck}
        />
        <StatCard
          label="Preocupacional a realizar"
          value={String(preocupacionalPendiente)}
          sub="Tienen el examen pendiente"
          color="error"
          icon={ClipboardCheck}
        />
      </div>

      <EntrevistasTable entrevistas={entrevistas} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
