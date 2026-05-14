import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import AddIngresoDialog from "./components/AddIngresoDialog";
import AddEgresoDialog from "./components/AddEgresoDialog";
import AddViaticoDialog from "./components/AddViaticoDialog";
import ImportMovimientosDialog from "./components/ImportMovimientosDialog";
import MovimientosCajaTable from "./components/MovimientosCajaTable";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function CajaPage() {
  const supabase = createAdminClient();

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [
    { data: tiposGasto },
    { count: totalMovimientos },
    { data: choferes },
    { data: ingresosMesData },
    { data: egresosMesData },
    { data: saldoData },
  ] = await Promise.all([
    supabase
      .from("tipos_gasto")
      .select("id, nombre, categoria")
      .eq("estado", "activo")
      .order("categoria")
      .order("nombre"),
    supabase.from("caja_movimientos").select("*", { count: "exact", head: true }),
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido"),
    supabase
      .from("caja_movimientos")
      .select("monto")
      .eq("tipo", "ingreso")
      .gte("fecha", inicioMes),
    supabase
      .from("caja_movimientos")
      .select("monto")
      .eq("tipo", "egreso")
      .gte("fecha", inicioMes),
    supabase.from("caja_movimientos").select("tipo, monto"),
  ]);

  const ingresosMes =
    ingresosMesData?.reduce((acc, m) => acc + Number(m.monto || 0), 0) ?? 0;
  const egresosMes =
    egresosMesData?.reduce((acc, m) => acc + Number(m.monto || 0), 0) ?? 0;
  const saldoActual =
    saldoData?.reduce(
      (acc, m) =>
        acc + (m.tipo === "ingreso" ? Number(m.monto) : -Number(m.monto)),
      0
    ) ?? 0;

  return (
    <div className="p-8">
      <PageHeader
        title="Caja General"
        description="Movimientos digitales, viáticos y gastos — trazabilidad completa"
        action={
          <div className="flex items-center gap-2">
            <ImportMovimientosDialog />
            <AddViaticoDialog choferes={choferes || []}>
              <Button variant="outline" size="sm">
                <Receipt size={14} />
                Registrar viático
              </Button>
            </AddViaticoDialog>
            <AddIngresoDialog>
              <Button variant="success" size="sm">
                <ArrowUpRight size={14} />
                Ingreso
              </Button>
            </AddIngresoDialog>
            <AddEgresoDialog tiposGasto={tiposGasto || []}>
              <Button variant="danger" size="sm">
                <ArrowDownRight size={14} />
                Egreso
              </Button>
            </AddEgresoDialog>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Saldo actual"
          value={`$ ${formatARS(saldoActual)}`}
          sub="Caja general"
          color="brand"
        />
        <StatCard
          label="Ingresos del mes"
          value={`$ ${formatARS(ingresosMes)}`}
          color="success"
        />
        <StatCard
          label="Egresos del mes"
          value={`$ ${formatARS(egresosMes)}`}
          color="error"
        />
        <StatCard
          label="Movimientos"
          value={String(totalMovimientos ?? 0)}
          sub="Total registrados"
          color="warning"
        />
      </div>

      <MovimientosCajaTable tiposGasto={tiposGasto || []} />
    </div>
  );
}
