import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { UserSearch, UserPlus, ClipboardCheck, UserCheck, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import { type Entrevista } from "./components/EntrevistasTable";
import EntrevistasView from "./components/EntrevistasView";
import EntrevistaFormDialog from "./components/EntrevistaFormDialog";
import EntrevistasHelpButton from "./components/EntrevistasHelpButton";
import ImportarButton from "./components/ImportarButton";

export default async function EntrevistasPage() {
  const user = await requireArea("rrhh", "read");
  const canWrite = hasArea(user, "rrhh", "write");
  const canDelete = hasArea(user, "rrhh", "write");

  const supabase = createAdminClient();
  // `as any`: `etapa` y la tabla `entrevista_archivos` son nuevas, aún no están en database.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data }, { data: cvs }] = await Promise.all([
    sb
      .from("entrevistas")
      .select(
        "id, nombre, fecha_entrevista, edad, localidad, telefono, dni, email, puesto, experiencia, motivo_descarte, observaciones, preocupacional, resultado, etapa, preocupacional_nota, aprobado, entro, se_mantuvo, contacto_emergencia, created_at",
      )
      .order("fecha_entrevista", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    sb.from("entrevista_archivos").select("entrevista_id"),
  ]);

  const cvCount = new Map<string, number>();
  for (const c of (cvs ?? []) as { entrevista_id: string }[]) {
    cvCount.set(c.entrevista_id, (cvCount.get(c.entrevista_id) ?? 0) + 1);
  }
  const entrevistas = ((data || []) as Entrevista[]).map((e) => ({ ...e, cv_count: cvCount.get(e.id) ?? 0 }));

  const total = entrevistas.length;
  const enProceso = entrevistas.filter((e) =>
    ["entrevista", "preocupacional"].includes(e.etapa ?? "entrevista"),
  ).length;
  const ingresaron = entrevistas.filter((e) => e.resultado === "ingresa").length;
  const preocupacionalPendiente = entrevistas.filter((e) => e.preocupacional === "pendiente").length;

  return (
    <div className="p-8">
      <PageHeader
        title="Entrevistas"
        description="Registro de personas entrevistadas: observaciones, preocupacional y si ingresan al transporte"
        action={
          <div className="flex items-center gap-2">
            <EntrevistasHelpButton />
            {canWrite && <ImportarButton />}
            {canWrite && (
              <EntrevistaFormDialog>
                <Button>
                  <UserPlus className="size-4" />
                  Nueva entrevista
                </Button>
              </EntrevistaFormDialog>
            )}
          </div>
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
          label="En proceso"
          value={String(enProceso)}
          sub="Entrevista o preocupacional"
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

      <EntrevistasView entrevistas={entrevistas} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
