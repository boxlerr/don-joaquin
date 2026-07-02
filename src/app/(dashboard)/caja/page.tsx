import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, EyeOff, Lock, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea, hasSeccion } from "@/lib/auth";
import { getLegajoEstado } from "@/lib/chofer-validation";
import AddIngresoDialog from "./components/AddIngresoDialog";
import AddEgresoDialog from "./components/AddEgresoDialog";
import AddViaticoDialog from "./components/AddViaticoDialog";
import CajaViewCompleta from "./components/CajaViewCompleta";
import MisMovimientosRecientes from "./components/MisMovimientosRecientes";
import HelpTutorialButton from "./help-tutorial-button";

export default async function CajaPage() {
  const user = await requireArea("caja", "read");

  // Operar ≠ ver (pedido de Bárbara): cargar movimientos viene del área, pero
  // el saldo/historial (caja_saldo) y la caja grande (caja_grande) son
  // subsecciones confidenciales que se otorgan aparte. Admin tiene todo.
  const puedeOperar = hasArea(user, "caja", "write");
  const puedeVerSaldo = hasSeccion(user, "caja_saldo", "read");
  const puedeVerGrande = hasSeccion(user, "caja_grande", "read");
  const puedeOperarGrande = hasSeccion(user, "caja_grande", "write");

  // Sin saldo ni carga: solo el aviso de acceso restringido.
  if (!puedeVerSaldo && !puedeOperar) {
    return (
      <div className="p-8">
        <PageHeader
          title="Caja General"
          description="Movimientos digitales, viáticos y gastos — trazabilidad completa"
        />
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
          <Lock size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            No tenés acceso al detalle de la caja. Si necesitás verlo, pedile a un administrador
            que te habilite la sección.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();

  const [{ data: tiposGasto }, { data: choferesRaw }, { data: fechasMovs }, { data: viaticosRaw }] =
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
      // Fechas y viáticos pendientes solo hacen falta para la vista completa.
      puedeVerSaldo
        ? supabase.from("caja_movimientos").select("fecha")
        : Promise.resolve({ data: [] as { fecha: string }[] }),
      puedeVerSaldo
        ? supabase
            .from("viaticos")
            .select(
              "id, fecha_entrega, monto_entregado, observaciones, chofer:choferes!chofer_id(nombre, apellido)",
            )
            .eq("estado", "pendiente_rendicion")
            .order("fecha_entrega", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  type ChoferRef = { nombre: string | null; apellido: string | null };
  const viaticosPendientes = (viaticosRaw ?? []).map((v) => {
    const ch = (Array.isArray(v.chofer) ? v.chofer[0] : v.chofer) as ChoferRef | null;
    return {
      id: v.id,
      chofer: ch ? `${ch.apellido ?? ""} ${ch.nombre ?? ""}`.trim() || "—" : "—",
      fecha_entrega: v.fecha_entrega,
      monto_entregado: Number(v.monto_entregado ?? 0),
      observaciones: v.observaciones ?? null,
    };
  });

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

  // Modo operador: puede cargar movimientos de la caja diaria pero el saldo y
  // el historial completo son privados. Solo ve sus propias cargas recientes.
  if (!puedeVerSaldo) {
    return (
      <div className="p-8">
        <PageHeader
          title="Caja General"
          description="Carga de movimientos de la caja diaria"
          action={
            <div className="flex items-center gap-2">
              <HelpTutorialButton />
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
            </div>
          }
        />

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-6">
          <EyeOff size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            Podés cargar movimientos de la caja; el saldo y el historial completo son privados.
            Abajo se muestran solo los movimientos que cargaste vos.
          </p>
        </div>

        <MisMovimientosRecientes />
      </div>
    );
  }

  // Vista completa (caja_saldo): dashboard + tabla + viáticos, con el switcher
  // de caja grande si corresponde.
  return (
    <div className="p-8">
      <CajaViewCompleta
        tiposGasto={tiposGasto || []}
        choferes={choferes}
        mesesConDatos={mesesConDatos}
        viaticos={viaticosPendientes}
        puedeOperar={puedeOperar}
        puedeVerGrande={puedeVerGrande}
        puedeOperarGrande={puedeOperarGrande}
      />
    </div>
  );
}
