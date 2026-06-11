import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import AddIngresoDialog from "./components/AddIngresoDialog";
import AddEgresoDialog from "./components/AddEgresoDialog";
import AddViaticoDialog from "./components/AddViaticoDialog";
import ImportMovimientosDialog from "./components/ImportMovimientosDialog";
import CajaDashboard from "./components/CajaDashboard";
import HelpTutorialButton from "./help-tutorial-button";

export default async function CajaPage() {
  const user = await requireArea("caja", "read");
  const canWrite = hasArea(user, "caja", "write");
  const supabase = createAdminClient();

  const [{ data: tiposGasto }, { data: choferesRaw }, { data: fechasMovs }] =
    await Promise.all([
      supabase
        .from("tipos_gasto")
        .select("id, nombre, categoria")
        .eq("estado", "activo")
        .order("categoria")
        .order("nombre"),
      supabase
        .from("choferes")
        .select("id, nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso")
        .eq("estado", "activo")
        .order("apellido"),
      supabase.from("caja_movimientos").select("fecha"),
    ]);

  const choferes = (choferesRaw ?? []).map((c) => {
    const estado = getLegajoEstado(c);
    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      disabled: !estado.completo,
      motivo: estado.completo ? undefined : `Legajo incompleto. Falta: ${estado.faltantes.join(", ")}`,
    };
  });

  const mesesConDatos = [
    ...new Set((fechasMovs ?? []).map((m) => String(m.fecha).slice(0, 7))),
  ]
    .sort()
    .reverse();

  return (
    <div className="p-8">
      <PageHeader
        title="Caja General"
        description="Movimientos digitales, viáticos y gastos — trazabilidad completa"
        action={
          <div className="flex items-center gap-2">
            <HelpTutorialButton />
            {canWrite && (
              <>
                <ImportMovimientosDialog />
              <AddViaticoDialog choferes={choferes}>
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
              </>
            )}
          </div>
        }
      />

      <CajaDashboard tiposGasto={tiposGasto || []} mesesConDatos={mesesConDatos} />
    </div>
  );
}
