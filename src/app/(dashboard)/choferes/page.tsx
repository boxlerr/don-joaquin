import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import AddChoferDialog from "./components/AddChoferDialog";
import ChoferesList from "./components/ChoferesList";
import HelpTutorialButton from "./help-tutorial-button";
import { redirect } from "next/navigation";
import { ImportChoferesButton } from "./components/ChoferesIO";
import ChoferesStats from "./components/ChoferesStats";
import ChoferesLocalidadChart from "./components/ChoferesLocalidadChart";
import type { LocalidadData } from "./components/ChoferesLocalidadChart";

export default async function ChoferesPage({
  searchParams,
}: {
  searchParams: Promise<{ documentoId?: string }>;
}) {
  const user = await requireSeccion("choferes", "read");
  const canWrite = hasSeccion(user, "choferes", "write");
  const supabase = createAdminClient();

  const { documentoId } = await searchParams;
  if (documentoId) {
    const { data: docData } = await supabase
      .from("chofer_documentos")
      .select("chofer_id")
      .eq("id", documentoId)
      .single();
    if (docData?.chofer_id) {
      redirect(`/choferes/${docData.chofer_id}?tab=documentos`);
    }
  }

  const [
    { data: choferes },
    activos,
    inactivos,
    docs,
    { data: vencidosDocs },
    { data: porVencerDocs },
    { data: camionesAsignados },
  ] = await Promise.all([
    supabase
      .from("choferes")
      .select("*, foto:documentos_archivos(bucket, path)", { count: "exact" })
      .order("apellido"),
    supabase
      .from("choferes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo"),
    supabase
      .from("choferes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "inactivo"),
    supabase.from("chofer_documentos").select("*", { count: "exact", head: true }),
    supabase
      .from("v_chofer_documentos_vigencia")
      .select("id, chofer, chofer_id, tipo_documento, fecha_vencimiento, dias_restantes, estado_vigencia")
      .eq("estado_vigencia", "vencido")
      .order("fecha_vencimiento", { ascending: true }),
    supabase
      .from("v_chofer_documentos_vigencia")
      .select("id, chofer, chofer_id, tipo_documento, fecha_vencimiento, dias_restantes, estado_vigencia")
      .eq("estado_vigencia", "por_vencer")
      .order("fecha_vencimiento", { ascending: true }),
    // Camión fijo de cada chofer (para el aviso "sin camión asignado" en la tarjeta).
    // Sin filtrar por estado del camión: así la tarjeta muestra lo mismo que el
    // legajo (que lee camion_actual sin filtro), aunque el camión esté fuera de servicio.
    supabase
      .from("camiones")
      // marca/modelo además de la patente: en el legajo se quiere ver qué
      // maneja, y también se busca por eso ("iveco").
      .select("patente, marca, modelo, chofer_actual_id")
      .not("chofer_actual_id", "is", null),
  ]);

  // chofer_id -> camión que tiene asignado hoy (si tiene).
  const camionPorChofer = new Map<
    string,
    { patente: string; marca: string | null; modelo: string | null }
  >();
  for (const c of camionesAsignados ?? []) {
    if (c.chofer_actual_id)
      camionPorChofer.set(c.chofer_actual_id, {
        patente: c.patente,
        marca: c.marca,
        modelo: c.modelo,
      });
  }

  const choferesMapeados = choferes?.map((c) => ({
    ...c,
    dni: c.dni ?? "",
    foto: c.foto ? (Array.isArray(c.foto) ? c.foto[0] : c.foto) : null,
    camion_patente: camionPorChofer.get(c.id)?.patente ?? null,
    camion_marca: camionPorChofer.get(c.id)?.marca ?? null,
    camion_modelo: camionPorChofer.get(c.id)?.modelo ?? null,
  }));

  // Desglose por rol — solo personal vigente (los egresados/baja salen del conteo:
  // tienen su propia sección "Historial de Choferes Egresados"). Los choferes legacy
  // sin rol seteado se cuentan como "chofer".
  const personal = (choferes ?? []).filter((c) => c.estado !== "baja");
  const rolDe = (c: { rol?: string | null }) => (c.rol ?? "chofer") as string;
  const choferesCount = personal.filter((c) => rolDe(c) === "chofer").length;
  const administrativoCount = personal.filter((c) => rolDe(c) === "administrativo").length;
  const mantenimientoCount = personal.filter((c) => rolDe(c) === "mantenimiento").length;
  const fleteroCount = personal.filter((c) => rolDe(c) === "fletero").length;
  const totalPersonalActivo = personal.length;

  // Distribución por localidad (excluye baja, agrupa y ordena desc)
  const localidadMap = new Map<string, LocalidadData["choferes"]>();
  for (const c of choferes ?? []) {
    if (c.estado === "baja") continue;
    const loc = c.localidad?.trim() || "Sin datos";
    const lista = localidadMap.get(loc) ?? [];
    lista.push({ id: c.id, nombre: c.nombre, apellido: c.apellido, estado: c.estado });
    localidadMap.set(loc, lista);
  }
  const localidadData: LocalidadData[] = Array.from(localidadMap.entries())
    .map(([localidad, choferesLoc]) => ({
      localidad,
      cantidad: choferesLoc.length,
      choferes: choferesLoc.sort((a, b) =>
        `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es", {
          sensitivity: "base",
        }),
      ),
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 12);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Personal"
        description="Legajo digital de todo el personal (choferes, administración, mantenimiento y fleteros)"
        action={
          // En celular la acción ocupa el ancho del header (PageHeader la baja
          // debajo del título): los tres botones envuelven en vez de empujar
          // la página de costado.
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <HelpTutorialButton />
            {canWrite && (
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
                <ImportChoferesButton />
              </div>
            )}
            {canWrite && (
              <AddChoferDialog>
                <Button variant="brand" size="sm">
                  <Plus size={14} />
                  Nuevo legajo
                </Button>
              </AddChoferDialog>
            )}
          </div>
        }
      />

      <ChoferesStats
        total={totalPersonalActivo}
        activos={activos.count ?? 0}
        inactivos={inactivos.count ?? 0}
        choferesCount={choferesCount}
        administrativoCount={administrativoCount}
        mantenimientoCount={mantenimientoCount}
        fleteroCount={fleteroCount}
        totalDocs={docs.count ?? 0}
        vencidosCount={vencidosDocs?.length ?? 0}
        porVencerCount={porVencerDocs?.length ?? 0}
        vencidosDocs={vencidosDocs ?? []}
        porVencerDocs={porVencerDocs ?? []}
      />

      <ChoferesLocalidadChart data={localidadData} />

      <ChoferesList choferes={choferesMapeados ?? []} />
    </div>
  );
}
