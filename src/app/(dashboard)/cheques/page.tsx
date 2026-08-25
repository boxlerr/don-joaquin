import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
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

  // La cartera es sólo lo que nos deben: un cheque nuestro es plata que sale y
  // se cuenta aparte.
  const enCartera = rows.filter((c) => c.origen === "recibido" && c.estado === "cartera");
  const totalEnCartera = enCartera.reduce((acc, c) => acc + c.importe, 0);
  const porVencer = enCartera.filter(
    (c) => c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= en7dias
  );
  const totalPorVencer = porVencer.reduce((acc, c) => acc + c.importe, 0);
  const vencidos = enCartera.filter((c) => c.fecha_vencimiento < hoy);
  const totalVencidos = vencidos.reduce((acc, c) => acc + c.importe, 0);

  // Cheques nuestros que todavía no se cobraron: plata comprometida.
  const propiosPendientes = rows.filter(
    (c) => c.origen === "propio" && (c.estado === "emitido" || c.estado === "entregado")
  );
  const totalPropiosPendientes = propiosPendientes.reduce((acc, c) => acc + c.importe, 0);
  // Los cheques nuestros se cuentan contra los nuestros, no contra el total: la
  // tarjeta decía "6 cheques registrados" cuando el propio era uno solo.
  const propios = rows.filter((c) => c.origen === "propio");

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

      {/* KPI: dos columnas en celular (son número + rótulo corto), cuatro desde lg. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="En cartera"
          value={`$${formatARS(totalEnCartera)}`}
          sub={`${enCartera.length} cheque${enCartera.length === 1 ? "" : "s"} a cobrar`}
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
        <StatCard
          label="Cheques nuestros"
          value={`$${formatARS(totalPropiosPendientes)}`}
          sub={
            propios.length === 0
              ? "ninguno registrado"
              : propiosPendientes.length === 0
                ? `${propios.length} registrado${propios.length === 1 ? "" : "s"} · todos debitados`
                : `${propiosPendientes.length} sin debitar de ${propios.length}`
          }
          color="neutral"
        />
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
