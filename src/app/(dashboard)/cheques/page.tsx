import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import AddChequeDialog from "./components/AddChequeDialog";
import ChequesList, { type ChequeRow } from "./components/ChequesList";
import type { ChequeOrigen } from "./transiciones";
import ExportChequesButton from "./components/ExportChequesButton";
import HelpTutorialButton from "./help-tutorial-button";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ChequesPage() {
  const user = await requireSeccion("cheques", "read");
  const canWrite = hasSeccion(user, "cheques", "write");
  const supabase = createAdminClient();

  const hoy = new Date().toISOString().split("T")[0];
  // eslint-disable-next-line react-hooks/purity -- server component: se ejecuta una vez por request
  const en7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    { data: bancos },
    { data: cheques },
    { data: libradores },
  ] = await Promise.all([
    supabase.from("bancos").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase
      .from("cheques")
      .select(
        "id, numero, tipo, origen, importe, fecha_emision, fecha_vencimiento, librador_nombre, librador_cuit, concepto, estado, entregado_a, sucursal_banco, cuenta_corriente, observaciones, banco:bancos(nombre), cliente:clientes(razon_social)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false }),
    // Sugerencias de librador. Es un catálogo propio, no se deriva de los
    // cheques: así lo que se escribe queda guardado y se puede sacar de la
    // lista sin tocar los cheques ya cargados.
    supabase.from("libradores").select("id, nombre, cuit").order("nombre"),
  ]);

  const rows: ChequeRow[] = (cheques ?? []).map((c) => ({
    id: c.id,
    numero: c.numero,
    tipo: c.tipo,
    origen: (c as { origen?: ChequeOrigen }).origen ?? "recibido",
    importe: Number(c.importe),
    fecha_emision: c.fecha_emision,
    fecha_vencimiento: c.fecha_vencimiento,
    librador_nombre: c.librador_nombre,
    librador_cuit: c.librador_cuit,
    concepto: c.concepto,
    estado: c.estado,
    entregado_a: c.entregado_a,
    sucursal_banco: c.sucursal_banco,
    cuenta_corriente: c.cuenta_corriente,
    observaciones: c.observaciones,
    banco: Array.isArray(c.banco) ? (c.banco[0] ?? null) : c.banco,
    cliente: Array.isArray(c.cliente) ? (c.cliente[0] ?? null) : c.cliente,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Gestión de Cheques"
        description="Cartera completa con trazabilidad por estado"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HelpTutorialButton />
            <ExportChequesButton />
            {canWrite && (
              <AddChequeDialog libradores={libradores ?? []} bancos={bancos ?? []}>
                <Button variant="brand" size="sm">
                  <Plus size={14} />
                  Registrar cheque
                </Button>
              </AddChequeDialog>
            )}
          </div>
        }
      />

      <ChequesList
        cheques={rows}
        bancos={bancos ?? []}
        libradores={libradores ?? []}
        canWrite={canWrite}
        hoy={hoy}
        en7dias={en7dias}
      />
    </div>
  );
}
