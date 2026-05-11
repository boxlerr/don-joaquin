import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import ClientesList from "./clientes-list";

export default async function ClientesPage() {
  const supabase = createAdminClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select(
      "id, razon_social, nombre_comercial, cuit, domicilio_fiscal, localidad, provincia, condicion_iva, es_multinacional, estado, observaciones"
    )
    .order("razon_social");

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        description="Gestión estratégica de cartera"
        action={
          <Button variant="outline" size="sm">
            <Download size={14} />
            Exportar CC
          </Button>
        }
      />

      <ClientesList clientes={clientes ?? []} />
    </div>
  );
}
