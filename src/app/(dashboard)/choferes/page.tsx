import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import AddChoferDialog from "./components/AddChoferDialog";
import ChoferesList from "./components/ChoferesList";
import HelpTutorialButton from "./help-tutorial-button";
import { redirect } from "next/navigation";

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

  const [{ data: choferes, count: total }, activos, inactivos, docs] = await Promise.all([
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
  ]);

  const choferesMapeados = choferes?.map((c) => ({
    ...c,
    foto: c.foto ? (Array.isArray(c.foto) ? c.foto[0] : c.foto) : null,
  }));

  return (
    <div className="p-8">
      <PageHeader
        title="Choferes"
        description="Legajo digital — sin acceso al sistema (gestión administrativa)"
        action={
          <div className="flex items-center gap-2">
            <HelpTutorialButton />
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

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total choferes" value={String(total ?? 0)} sub="En planilla" color="brand" />
        <StatCard label="Activos" value={String(activos.count ?? 0)} color="success" />
        <StatCard label="Inactivos" value={String(inactivos.count ?? 0)} color="warning" />
        <StatCard
          label="Documentos"
          value={String(docs.count ?? 0)}
          sub="Registrados en legajos"
          color="error"
        />
      </div>

      <ChoferesList choferes={choferesMapeados ?? []} />
    </div>
  );
}
