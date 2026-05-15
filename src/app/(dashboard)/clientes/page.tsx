import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import ClientesList from "./clientes-list";
import ExportCCButton from "./export-cc-button";

export default async function ClientesPage() {
  const supabase = createAdminClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select(
      "id, razon_social, nombre_comercial, cuit, domicilio_fiscal, localidad, provincia, condicion_iva, es_multinacional, estado, observaciones, email, telefono"
    )
    .order("razon_social");

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        description="Gestión estratégica de cartera"
        action={<ExportCCButton />}
      />

      <ClientesList clientes={clientes ?? []} />
    </div>
  );
}
