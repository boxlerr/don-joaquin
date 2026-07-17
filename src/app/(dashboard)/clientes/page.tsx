import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import ClientesList from "./clientes-list";
import ExportClientesButton from "./export-clientes-button";

export default async function ClientesPage() {
  const user = await requireSeccion("clientes", "read");
  const canWrite = hasSeccion(user, "clientes", "write");
  const supabase = createAdminClient();

  const [{ data: clientes }, { data: sucursales }] = await Promise.all([
    supabase
      .from("clientes")
      .select(
        "id, razon_social, nombre_comercial, cuit, domicilio_fiscal, localidad, provincia, condicion_iva, estado, observaciones, email, telefono"
      )
      .order("razon_social"),
    supabase.from("cliente_sucursales").select("cliente_id"),
  ]);

  const sucursalesCount: Record<string, number> = {};
  for (const s of sucursales ?? []) {
    sucursalesCount[s.cliente_id] = (sucursalesCount[s.cliente_id] ?? 0) + 1;
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        description="Gestión estratégica de cartera"
        action={<ExportClientesButton />}
      />

      <ClientesList clientes={clientes ?? []} sucursalesCount={sucursalesCount} canWrite={canWrite} />
    </div>
  );
}
