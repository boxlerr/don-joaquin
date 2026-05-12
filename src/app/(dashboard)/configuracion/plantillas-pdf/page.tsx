import PageHeader from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import PlantillasManager from "./PlantillasManager";

export default async function PlantillasPDFPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: plantillas } = await supabase
    .from("plantillas_pdf")
    .select("id, nombre, descripcion, tipo, estado, created_at, updated_at, created_by")
    .neq("estado", "eliminada")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Plantillas PDF"
        description="Gestión de diseños para documentos generados automáticamente"
      />

      <PlantillasManager plantillas={plantillas ?? []} />

      <div className="p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
        <p className="text-sm text-[#1E3A8A]">
          <strong>Nota:</strong> Las plantillas se generan en HTML/CSS y se convierten a PDF.
          El editor visual de cada template estará disponible en una próxima versión.
        </p>
      </div>
    </div>
  );
}
