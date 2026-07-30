import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import AddChequeDialog from "./components/AddChequeDialog";
import ChequesList, { type ChequeRow } from "./components/ChequesList";
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
    { data: cheques, count: totalCheques },
    { data: libradores },
  ] = await Promise.all([
    supabase.from("bancos").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase
      .from("cheques")
      .select(
        "id, numero, tipo, importe, fecha_emision, fecha_vencimiento, librador_nombre, librador_cuit, concepto, estado, sucursal_banco, cuenta_corriente, observaciones, banco:bancos(nombre), cliente:clientes(razon_social)",
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
    importe: Number(c.importe),
    fecha_emision: c.fecha_emision,
    fecha_vencimiento: c.fecha_vencimiento,
    librador_nombre: c.librador_nombre,
    librador_cuit: c.librador_cuit,
    concepto: c.concepto,
    estado: c.estado,
    sucursal_banco: c.sucursal_banco,
    cuenta_corriente: c.cuenta_corriente,
    observaciones: c.observaciones,
    banco: Array.isArray(c.banco) ? (c.banco[0] ?? null) : c.banco,
    cliente: Array.isArray(c.cliente) ? (c.cliente[0] ?? null) : c.cliente,
  }));

  const enCartera = rows.filter((c) => c.estado === "cartera");
  const totalEnCartera = enCartera.reduce((acc, c) => acc + c.importe, 0);
  const porVencer = enCartera.filter(
    (c) => c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= en7dias
  );
  const totalPorVencer = porVencer.reduce((acc, c) => acc + c.importe, 0);
  const vencidos = enCartera.filter((c) => c.fecha_vencimiento < hoy);
  const totalVencidos = vencidos.reduce((acc, c) => acc + c.importe, 0);

  return (
    <div className="p-8">
      <PageHeader
        title="Gestión de Cheques"
        description="Cartera completa con trazabilidad por estado"
        action={
          <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="En cartera"
          value={`$${formatARS(totalEnCartera)}`}
          sub={`${enCartera.length} cheque${enCartera.length === 1 ? "" : "s"}`}
          color="brand"
        />
        <StatCard
          label="Por vencer"
          value={`$${formatARS(totalPorVencer)}`}
          sub={`${porVencer.length} en próximos 7 días`}
          color="warning"
        />
        <StatCard
          label="Vencidos"
          value={`$${formatARS(totalVencidos)}`}
          sub={`${vencidos.length} sin gestionar`}
          color="error"
        />
        <StatCard label="Total registrados" value={String(totalCheques ?? 0)} color="success" />
      </div>

      <ChequesList
        cheques={rows}
        bancos={bancos ?? []}
        libradores={libradores ?? []}
        canWrite={canWrite}
      />
    </div>
  );
}
