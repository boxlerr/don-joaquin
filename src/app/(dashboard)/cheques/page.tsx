import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
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
  const user = await requireArea("finanzas", "read");
  const canWrite = hasArea(user, "finanzas", "write");
  const supabase = createAdminClient();

  const hoy = new Date().toISOString().split("T")[0];
  // eslint-disable-next-line react-hooks/purity -- server component: se ejecuta una vez por request
  const en7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    { data: bancos },
    { data: cheques, count: totalCheques },
    { data: libradoresRaw },
  ] = await Promise.all([
    supabase.from("bancos").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase
      .from("cheques")
      .select(
        "id, numero, importe, fecha_emision, fecha_vencimiento, librador_nombre, concepto, estado, banco:bancos(nombre), cliente:clientes(razon_social)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false }),
    // Libradores ya usados (para autocompletar nombre + CUIT en el alta)
    supabase
      .from("cheques")
      .select("librador_nombre, librador_cuit")
      .not("librador_nombre", "is", null),
  ]);

  // Libradores distintos con su CUIT (preferimos la fila que tenga CUIT cargado)
  const libradoresMap = new Map<string, string | null>();
  for (const l of libradoresRaw ?? []) {
    const nombre = (l.librador_nombre ?? "").trim();
    if (!nombre) continue;
    if (!libradoresMap.has(nombre) || (!libradoresMap.get(nombre) && l.librador_cuit)) {
      libradoresMap.set(nombre, l.librador_cuit ?? null);
    }
  }
  const libradores = [...libradoresMap.entries()]
    .map(([nombre, cuit]) => ({ nombre, cuit }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Loma Negra siempre disponible como sugerencia (es el librador habitual),
  // aunque todavía no se haya cargado ningún cheque suyo.
  if (!libradores.some((l) => l.nombre.toLowerCase() === "loma negra")) {
    libradores.unshift({ nombre: "Loma Negra", cuit: null });
  }

  const rows: ChequeRow[] = (cheques ?? []).map((c) => ({
    id: c.id,
    numero: c.numero,
    importe: Number(c.importe),
    fecha_emision: c.fecha_emision,
    fecha_vencimiento: c.fecha_vencimiento,
    librador_nombre: c.librador_nombre,
    concepto: c.concepto,
    estado: c.estado,
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
              <AddChequeDialog libradores={libradores} bancos={bancos ?? []}>
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

      <ChequesList cheques={rows} bancos={bancos ?? []} />
    </div>
  );
}
