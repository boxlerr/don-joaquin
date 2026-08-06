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
import ChoferesLocalidades from "./components/ChoferesLocalidades";
import type { ChoferLocalidad, LocalidadData } from "./components/ChoferesLocalidades";
import { cortesUltimos12Meses, serieDotacion } from "@/lib/dotacion";

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
    docsAlDia,
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
    // "Al día" = los que no vencen pronto y los que directamente no vencen (un
    // título no caduca). Se cuenta en la base y no restando del total: si algún
    // día el total y la vista dejaran de coincidir, la resta daría negativo.
    supabase
      .from("v_chofer_documentos_vigencia")
      .select("*", { count: "exact", head: true })
      .in("estado_vigencia", ["vigente", "sin_vencimiento"]),
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

  // Dotación de los últimos 12 meses, para la línea de cada tarjeta. Entra TODA
  // la gente (también los egresados): son ellos los que hacen bajar la curva en
  // el mes en que se fueron.
  const cortes = cortesUltimos12Meses(new Date());
  const serieDe = (filtro: (c: { rol?: string | null }) => boolean) =>
    serieDotacion((choferes ?? []).filter(filtro), cortes);
  const series = {
    total: serieDe(() => true),
    chofer: serieDe((c) => rolDe(c) === "chofer"),
    administrativo: serieDe((c) => rolDe(c) === "administrativo"),
    mantenimiento: serieDe((c) => rolDe(c) === "mantenimiento"),
    fletero: serieDe((c) => rolDe(c) === "fletero"),
  };

  // Distribución por localidad (excluye baja, agrupa y ordena desc).
  //
  // Se agrupa sin distinguir mayúsculas ni acentos: "AZUL" y "Azul" son la misma
  // localidad y como grupos separados el resumen mentía (Azul es 13, no 11 y 2).
  // Es sólo para este resumen — el legajo de cada persona sigue mostrando la
  // localidad exactamente como está cargada.
  const claveLocalidad = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "el", "y"]);
  const tituloLocalidad = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");

  const porApellido = (a: ChoferLocalidad, b: ChoferLocalidad) =>
    `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es", {
      sensitivity: "base",
    });

  const localidadMap = new Map<string, { grafias: string[]; gente: ChoferLocalidad[] }>();
  const sinLocalidad: ChoferLocalidad[] = [];
  for (const c of choferes ?? []) {
    if (c.estado === "baja") continue;
    const persona: ChoferLocalidad = {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      estado: c.estado,
      rol: c.rol ?? null,
    };
    const loc = c.localidad?.trim();
    if (!loc) {
      sinLocalidad.push(persona);
      continue;
    }
    const clave = claveLocalidad(loc);
    const grupo = localidadMap.get(clave) ?? { grafias: [], gente: [] };
    grupo.grafias.push(loc);
    grupo.gente.push(persona);
    localidadMap.set(clave, grupo);
  }

  const localidadData: LocalidadData[] = Array.from(localidadMap.values())
    .map(({ grafias, gente }) => {
      // De todas las formas en que se escribió, gana la más usada: el nombre que
      // se muestra sale de los datos, no de una lista nuestra.
      const conteo = new Map<string, number>();
      for (const g of grafias) conteo.set(g, (conteo.get(g) ?? 0) + 1);
      const masUsada = Array.from(conteo.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"),
      )[0]![0];
      return {
        localidad: tituloLocalidad(masUsada),
        cantidad: gente.length,
        choferes: gente.sort(porApellido),
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad || a.localidad.localeCompare(b.localidad, "es"));

  sinLocalidad.sort(porApellido);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Legajos"
        description="Legajo digital de todo el personal: choferes, administración, mantenimiento y fleteros"
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
        series={series}
        totalDocs={docs.count ?? 0}
        alDiaCount={docsAlDia.count ?? 0}
        vencidosCount={vencidosDocs?.length ?? 0}
        porVencerCount={porVencerDocs?.length ?? 0}
        vencidosDocs={vencidosDocs ?? []}
        porVencerDocs={porVencerDocs ?? []}
      />

      <ChoferesLocalidades localidades={localidadData} sinLocalidad={sinLocalidad} />

      <ChoferesList choferes={choferesMapeados ?? []} />
    </div>
  );
}
