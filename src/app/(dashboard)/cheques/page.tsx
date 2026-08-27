import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import AddChequeDialog from "./components/AddChequeDialog";
import ChequesList, { type ChequeRow } from "./components/ChequesList";
import type { ChequeOrigen } from "./transiciones";
import { vistaDeParam } from "./resumen";
import ExportChequesButton from "./components/ExportChequesButton";
import HelpTutorialButton from "./help-tutorial-button";

/** Suma días a un ISO (YYYY-MM-DD) sin que el huso mueva la fecha. */
function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n));
  return dt.toISOString().split("T")[0]!;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ChequesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const user = await requireSeccion("cheques", "read");
  const canWrite = hasSeccion(user, "cheques", "write");
  const supabase = createAdminClient();
  // Se puede llegar con una cifra ya abierta (?vista=avisos desde el resumen del
  // día). Se valida acá: un valor cualquiera en la URL no tiene por qué llegar
  // hasta el estado del listado.
  const vistaInicial = vistaDeParam((await searchParams).vista);

  const hoy = new Date().toISOString().split("T")[0];
  // eslint-disable-next-line react-hooks/purity -- server component: se ejecuta una vez por request
  const en7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    { data: bancos },
    { data: cheques },
    { data: libradores },
    { data: historial },
    { data: paramAviso },
  ] = await Promise.all([
    supabase.from("bancos").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase
      .from("cheques")
      .select(
        "id, numero, tipo, origen, importe, fecha_emision, fecha_vencimiento, librador_nombre, librador_cuit, concepto, estado, entregado_a, sucursal_banco, cuenta_corriente, observaciones, created_at, banco:bancos(nombre), cliente:clientes(razon_social)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false }),
    // Sugerencias de librador. Es un catálogo propio, no se deriva de los
    // cheques: así lo que se escribe queda guardado y se puede sacar de la
    // lista sin tocar los cheques ya cargados.
    supabase.from("libradores").select("id, nombre, cuit").order("nombre"),
    // El historial de estados es lo que permite saber cómo estaba la cartera al
    // cierre de cada mes, y no sólo cómo está hoy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("cheque_historial_estado")
      .select("cheque_id, estado_nuevo, fecha")
      .order("fecha", { ascending: true }),
    // Con cuántos días de anticipación avisa el sistema. Es el mismo corte que
    // usa el aviso (`dias_alerta_cheque`), y hace falta acá para que la vista
    // "los que el sistema está avisando" muestre exactamente los que contó.
    supabase
      .from("parametros_sistema")
      .select("valor")
      .eq("clave", "dias_alerta_cheque")
      .maybeSingle(),
  ]);

  const diasAviso = Number(paramAviso?.valor);
  const hastaAviso = sumarDias(hoy, Number.isFinite(diasAviso) && diasAviso > 0 ? diasAviso : 30);

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
    created_at: (c as { created_at?: string | null }).created_at ?? null,
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
        historial={(historial ?? []) as never}
        vistaInicial={vistaInicial}
        hastaAviso={hastaAviso}
      />
    </div>
  );
}
