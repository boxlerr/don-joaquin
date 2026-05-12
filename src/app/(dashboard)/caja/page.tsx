import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Wallet, ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import AddIngresoDialog from "./components/AddIngresoDialog";
import AddEgresoDialog from "./components/AddEgresoDialog";
import AddViaticoDialog from "./components/AddViaticoDialog";

export default async function CajaPage() {
  const supabase = createAdminClient();

  const [{ data: tiposGasto }, { count: totalMovimientos }, { data: choferes }] = await Promise.all([
    supabase
      .from("tipos_gasto")
      .select("id, nombre, categoria")
      .eq("estado", "activo")
      .order("categoria")
      .order("nombre"),
    supabase.from("caja_movimientos").select("*", { count: "exact", head: true }),
    supabase.from("choferes").select("id, nombre, apellido").eq("estado", "activo").order("apellido"),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Caja General"
        description="Movimientos digitales, viáticos y gastos — trazabilidad completa"
        action={
          <div className="flex items-center gap-2">
            <AddViaticoDialog choferes={choferes || []}>
              <Button variant="outline" size="sm">
                <Receipt size={14} />
                Registrar viático
              </Button>
            </AddViaticoDialog>
            <AddIngresoDialog>
              <Button variant="outline" size="sm">
                <ArrowUpRight size={14} />
                Ingreso
              </Button>
            </AddIngresoDialog>
            <AddEgresoDialog tiposGasto={tiposGasto || []}>
              <Button variant="brand" size="sm">
                <ArrowDownRight size={14} />
                Egreso
              </Button>
            </AddEgresoDialog>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Saldo actual" value="—" sub="Caja general" color="brand" />
        <StatCard label="Ingresos del mes" value="—" color="success" />
        <StatCard label="Egresos del mes" value="—" color="error" />
        <StatCard label="Movimientos" value={String(totalMovimientos ?? 0)} sub="Total registrados" color="warning" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Movimientos de Caja</h2>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" className="text-sm w-auto" />
            <Input type="date" className="text-sm w-auto" />
            <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
              <option value="">Todos los tipos de gasto ({tiposGasto?.length ?? 0})</option>
              {tiposGasto?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <Input type="search" placeholder="Buscar..." className="w-44 text-sm" />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {[
                "Fecha",
                "Concepto",
                "Tipo",
                "Vinculado a",
                "Medio de pago",
                "Monto",
                "Saldo acum.",
                "Usuario",
              ].map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-[#475569] uppercase tracking-wide"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <EmptyTableRow message="Sin movimientos registrados" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
