import PageHeader from "@/components/layout/PageHeader";
import { Lock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea, hasSeccion } from "@/lib/auth";
import { getUsuariosConSeccion } from "@/lib/permisos-usuarios";
import CajaViewCompleta from "./components/CajaViewCompleta";
import { getCategoriasLibresAction, getEgresosDelMesAction, getTopesCajaAction } from "./actions";
import { inicioDeMes } from "./topes";
import { hoyArgentina } from "@/lib/fecha-ar";
import CajaTabs from "./CajaTabs";
import { desdeVentanaCajaChica } from "./ventana";
import { filtrarMovimientosVisibles } from "./visibilidad";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ caja?: string }>;
}) {
  const user = await requireArea("caja", "read");
  const { caja: cajaParam } = await searchParams;

  // Cargar movimientos viene del área; la caja general (caja_grande) es una
  // subsección confidencial que se otorga aparte. Admin tiene todo.
  const puedeOperar = hasArea(user, "caja", "write");
  const puedeVerSaldo = hasSeccion(user, "caja_saldo", "read");
  // Ocultar un movimiento —y ver los ocultos— es del ADMINISTRADOR y de nadie
  // más (Julián, 24/08/2026). `caja_saldo` abre el saldo y el historial, pero no
  // alcanza para tapar ni destapar: eso lo decide una sola persona.
  const esAdmin = user.rol.codigo === "admin";
  const puedeMarcarPrivado = esAdmin;
  const puedeVerGrande = hasSeccion(user, "caja_grande", "read");
  // Gastos ahora es una solapa de Caja (antes sección propia del sidebar). El
  // permiso sigue siendo el mismo de siempre: la subsección "gastos".
  const puedeVerGastos = hasSeccion(user, "gastos", "read");

  // La solapa activa viaja en la URL (?caja=grande) para que las tres —chica,
  // general y gastos— sean enlaces del mismo nivel.
  const cajaActiva: "diaria" | "grande" =
    cajaParam === "grande" && puedeVerGrande ? "grande" : "diaria";
  const esVistaChica = cajaActiva === "diaria";

  // Sin saldo ni carga: solo el aviso de acceso restringido.
  if (!puedeVerSaldo && !puedeOperar) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Caja General"
          description="Movimientos digitales, viáticos y gastos — trazabilidad completa"
        />
        <CajaTabs activa={cajaActiva} showGrande={puedeVerGrande} showGastos={puedeVerGastos} />
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

  const [
    { data: tiposGasto },
    { data: fechasMovs },
    { data: viaticosRaw },
    direccion,
    categoriasLibres,
  ] = await Promise.all([
    supabase
      .from("tipos_gasto")
      .select("id, nombre, categoria")
      .eq("estado", "activo")
      .order("categoria")
      .order("nombre"),
    // Fechas de los movimientos: alimentan el calendario (qué días tienen
    // movimientos) y el mes inicial del período.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("caja_movimientos").select("fecha, caja, created_by"),
    // Los viáticos pendientes son parte del saldo: solo la vista completa.
    puedeVerSaldo
      ? supabase
          .from("viaticos")
          .select(
            "id, fecha_entrega, monto_entregado, observaciones, chofer:choferes!chofer_id(nombre, apellido)",
          )
          .eq("estado", "pendiente_rendicion")
          .order("fecha_entrega", { ascending: true })
      : Promise.resolve({ data: [] }),
    // Hace falta para tapar por autor lo que nadie decidió: en la caja chica
    // siempre, y en la general para todo el que no sea administrador.
    esVistaChica || !esAdmin
      ? getUsuariosConSeccion("caja_saldo", "read")
      : Promise.resolve(new Set<string>()),
    // Las categorías que se escribieron alguna vez: se ofrecen al cargar.
    getCategoriasLibresAction(),
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

  // Las marcas del calendario tienen que respetar lo mismo que la tabla: en la
  // caja chica, solo los días con movimientos visibles de la propia caja; en la
  // general, todo salvo lo oculto —que sólo ve el administrador—. Si no, un día
  // quedaba marcado y al abrirlo no había ningún movimiento.
  type FechaMov = { fecha: string; caja: string | null; created_by: string | null };
  const delaCaja = ((fechasMovs ?? []) as FechaMov[]).filter(
    (m) => !esVistaChica || (m.caja ?? "diaria") === "diaria",
  );
  const movsCalendario =
    esVistaChica || !esAdmin ? filtrarMovimientosVisibles(delaCaja, direccion) : delaCaja;

  // La caja chica es una ventana móvil: el historial largo vive en la general.
  const ventanaDesde = esVistaChica ? desdeVentanaCajaChica() : undefined;

  const fechasConDatos = [
    ...new Set(
      movsCalendario
        .map((m) => String(m.fecha).slice(0, 10))
        .filter((f) => !ventanaDesde || f >= ventanaDesde),
    ),
  ];
  const mesesConDatos = [...new Set(fechasConDatos.map((f) => f.slice(0, 7)))].sort().reverse();

  // El tope de gastos del mes y lo que ya salió. Se resuelve acá para que la
  // franja se dibuje con la pantalla y no aparezca de golpe un segundo después.
  const [topesCaja, egresosDelMes] = await Promise.all([
    getTopesCajaAction(),
    getEgresosDelMesAction(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <CajaViewCompleta
        tiposGasto={tiposGasto || []}
        categoriasLibres={categoriasLibres}
        mesesConDatos={mesesConDatos}
        fechasConDatos={fechasConDatos}
        viaticos={viaticosPendientes}
        puedeOperar={puedeOperar}
        puedeVerGrande={puedeVerGrande}
        caja={cajaActiva}
        showGastos={puedeVerGastos}
        puedeMarcarPrivado={puedeMarcarPrivado}
        ventanaDesde={ventanaDesde}
        topesCaja={topesCaja}
        egresosDelMes={egresosDelMes}
        mesEnCurso={inicioDeMes(hoyArgentina())}
        puedeEditarTopeGeneral={hasSeccion(user, "caja_grande", "write")}
      />
    </div>
  );
}
