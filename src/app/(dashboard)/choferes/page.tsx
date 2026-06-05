import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import AddChoferDialog from "./components/AddChoferDialog";
import ChoferesList from "./components/ChoferesList";
import HelpTutorialButton from "./help-tutorial-button";
import { redirect } from "next/navigation";
import { ImportChoferesButton } from "./components/ChoferesIO";
import ChoferesStats from "./components/ChoferesStats";
import ChoferesLocalidadChart from "./components/ChoferesLocalidadChart";
import type { LocalidadData } from "./components/ChoferesLocalidadChart";

export default async function ChoferesPage({
  searchParams,
}: {
  searchParams: Promise<{ documentoId?: string }>;
}) {
  const user = await requireArea("logistica", "read");
  const canWrite = hasArea(user, "logistica", "write");
  const supabase = createAdminClient();

  const { documentoId } = await searchParams;
  if (documentoId) {
    const { data: docData } = await supabase
      .from("chofer_documentos")
      .select("chofer_id")
      .eq("id", documentoId)
      .single();
    if (docData?.chofer_id) {
      redirect(`/choferes/${docData.chofer_id}?tab=documentos`);
    }
  }

  const [
    { data: choferes, count: total },
    activos,
    inactivos,
    docs,
    { data: vencidosDocs },
    { data: porVencerDocs },
  ] = await Promise.all([
    supabase
      .from("choferes")
      .select("*, foto:documentos_archivos(bucket, path)", { count: "exact" })
      .order("apellido"),
    supabase
      .from("choferes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo"),
    supabase
      .from("choferes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "inactivo"),
    supabase.from("chofer_documentos").select("*", { count: "exact", head: true }),
    supabase
      .from("v_chofer_documentos_vigencia")
      .select("id, chofer, chofer_id, tipo_documento, fecha_vencimiento, dias_restantes, estado_vigencia")
      .eq("estado_vigencia", "vencido")
      .order("fecha_vencimiento", { ascending: true }),
    supabase
      .from("v_chofer_documentos_vigencia")
      .select("id, chofer, chofer_id, tipo_documento, fecha_vencimiento, dias_restantes, estado_vigencia")
      .eq("estado_vigencia", "por_vencer")
      .order("fecha_vencimiento", { ascending: true }),
  ]);

  const choferesMapeados = choferes?.map((c) => ({
    ...c,
    dni: c.dni ?? "",
    foto: c.foto ? (Array.isArray(c.foto) ? c.foto[0] : c.foto) : null,
  }));

  // Desglose por rol (los choferes legacy sin rol seteado se cuentan como "chofer").
  const personal = choferes ?? [];
  const rolDe = (c: { rol?: string | null }) => (c.rol ?? "chofer") as string;
  const choferesCount = personal.filter((c) => rolDe(c) === "chofer").length;
  const administrativoCount = personal.filter((c) => rolDe(c) === "administrativo").length;
  const mantenimientoCount = personal.filter((c) => rolDe(c) === "mantenimiento").length;

  // Distribución por localidad (excluye baja, agrupa y ordena desc)
  const localidadMap = new Map<string, number>();
  for (const c of choferes ?? []) {
    if (c.estado === "baja") continue;
    const loc = c.localidad?.trim() || "Sin datos";
    localidadMap.set(loc, (localidadMap.get(loc) ?? 0) + 1);
  }
  const localidadData: LocalidadData[] = Array.from(localidadMap.entries())
    .map(([localidad, cantidad]) => ({ localidad, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 12);

  return (
    <div className="p-8">
      <PageHeader
        title="Choferes"
        description="Legajo digital — sin acceso al sistema (gestión administrativa)"
        action={
          <div className="flex items-center gap-2.5">
            <HelpTutorialButton />
            {canWrite && (
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
                <ImportChoferesButton />
              </div>
            )}
            {canWrite && (
              <AddChoferDialog>
                <Button variant="brand" size="sm">
                  <Plus size={14} />
                  Nuevo chofer
                </Button>
              </AddChoferDialog>
            )}
          </div>
        }
      />

      <ChoferesStats
        total={total ?? 0}
        activos={activos.count ?? 0}
        inactivos={inactivos.count ?? 0}
        choferesCount={choferesCount}
        administrativoCount={administrativoCount}
        mantenimientoCount={mantenimientoCount}
        totalDocs={docs.count ?? 0}
        vencidosCount={vencidosDocs?.length ?? 0}
        porVencerCount={porVencerDocs?.length ?? 0}
        vencidosDocs={vencidosDocs ?? []}
        porVencerDocs={porVencerDocs ?? []}
      />

      <ChoferesLocalidadChart data={localidadData} />

      <ChoferesList choferes={choferesMapeados ?? []} />
    </div>
  );
}
