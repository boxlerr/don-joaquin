"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * "¿A dónde mandé gente?" — el pedido de Nico:
 *
 *   "Hoy paso tres viajes a Lomaser, dos viajes a Escobar. Para no tener que
 *    entrar chofer por chofer para ver a dónde fue el último viaje que le di,
 *    que haya un resumen que diga: Lomaser tenés estos tres choferes, Escobar
 *    tenés estos tres choferes."
 *
 * Es la hoja de ruta dada vuelta: ahí se entra por chofer y se ven sus destinos;
 * acá se entra por destino y se ven sus choferes.
 *
 * Devuelve también los viajes uno por uno, no sólo los totales: el resumen se
 * abre hasta ver la fecha, el remito y los km de cada viaje sin tener que
 * saltar a otra pantalla.
 */

export type ViajeDelResumen = {
  id: string;
  /** `V-2026-NNNNN`. Es el único orden confiable dentro de un mismo día. */
  codigo: string;
  fecha: string;
  origen: string | null;
  destino: string;
  km: number;
  kmVacios: number;
  toneladas: number | null;
  remito: string | null;
  monto: number | null;
  esVacio: boolean;
  cliente: string | null;
  material: string | null;
  /** Todavía no tiene chofer: se le puede asignar desde el mismo resumen. */
  sinChofer: boolean;
};

export type ChoferEnDestino = {
  chofer_id: string | null;
  chofer: string;
  /** Para el avatar: la silueta cambia según el área. */
  rol: string | null;
  /** Foto del legajo, firmada. null cuando todavía no subieron ninguna. */
  fotoUrl: string | null;
  camion: string | null;
  /** Marca del camión, para mostrar el logo en vez de un camioncito genérico. */
  camionMarca: string | null;
  /** Viajes que hizo en el período — todos, no sólo los que terminaron acá. */
  viajes: number;
  km: number;
  toneladas: number;
  /** Fecha del viaje con el que llegó a este lugar. */
  llegoEl: string;
  /** De dónde venía en ese último viaje: "fue a Lomaser después de Ramallo". */
  vinoDe: string | null;
  /** Sus viajes del período en orden cronológico: el último abajo. */
  detalle: ViajeDelResumen[];
};

export type DestinoResumen = {
  destino: string;
  /** Los choferes que QUEDARON acá (cada uno aparece en un solo lugar). */
  choferes: ChoferEnDestino[];
  /** Viajes que hicieron en el período esos choferes. */
  viajes: number;
  toneladas: number;
  km: number;
  /** La llegada más reciente a este lugar. */
  ultimaLlegada: string;
  /** Viajes a este destino que todavía no tienen chofer asignado. */
  sinChofer: number;
  sinChoferDetalle: ViajeDelResumen[];
};

export type ResumenDestinos = {
  desde: string;
  hasta: string;
  destinos: DestinoResumen[];
  totales: { viajes: number; destinos: number; choferes: number; sinChofer: number; km: number };
};

type Fila = {
  id: string;
  codigo: string;
  fecha_viaje: string;
  km_con_carga: number | null;
  km_vacios: number | null;
  tonelaje_real: number | null;
  nro_remito: string | null;
  monto_flete: number | null;
  material: string | null;
  es_vacio: boolean | null;
  chofer_id: string | null;
  origen: { nombre: string } | { nombre: string }[] | null;
  destino: { nombre: string } | { nombre: string }[] | null;
  chofer:
    | { nombre: string; apellido: string; rol: string | null }
    | { nombre: string; apellido: string; rol: string | null }[]
    | null;
  camion: { patente: string; marca: string | null } | { patente: string; marca: string | null }[] | null;
  cliente: { razon_social: string } | { razon_social: string }[] | null;
};

const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/**
 * URLs firmadas de las fotos del legajo, todas en una sola llamada por bucket.
 * Hoy casi nadie tiene foto cargada; en cuanto se suban aparecen solas.
 */
async function firmarFotos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  choferIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (choferIds.length === 0) return out;

  const { data, error } = await supabase
    .from("choferes")
    .select("id, foto:documentos_archivos(bucket, path)")
    .in("id", choferIds);
  if (error) {
    // Una foto que no carga no puede tirar abajo el resumen.
    console.error("[resumen destinos] no se pudieron leer las fotos:", error);
    return out;
  }

  const porBucket = new Map<string, { id: string; path: string }[]>();
  for (const c of (data ?? []) as {
    id: string;
    foto: { bucket: string; path: string } | { bucket: string; path: string }[] | null;
  }[]) {
    const f = uno(c.foto);
    if (!f?.path) continue;
    const lista = porBucket.get(f.bucket) ?? [];
    lista.push({ id: c.id, path: f.path });
    porBucket.set(f.bucket, lista);
  }

  for (const [bucket, files] of porBucket) {
    const { data: urls } = await supabase.storage
      .from(bucket)
      .createSignedUrls(files.map((f) => f.path), 3600);
    ((urls ?? []) as { signedUrl: string | null }[]).forEach((row, i) => {
      const f = files[i];
      if (f && row.signedUrl) out.set(f.id, row.signedUrl);
    });
  }
  return out;
}

export async function getResumenDestinosAction(
  desde: string,
  hasta: string,
  opciones?: { incluirVacios?: boolean },
): Promise<ResumenDestinos> {
  await requireSeccion("viajes_listado", "read");
  const supabase = createAdminClient();

  // Paginado: el REST corta en 1000 y un mes cargado pasa ese tope.
  const filas: Fila[] = [];
  for (let desdeFila = 0; ; desdeFila += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("viajes")
      .select(
        `id, codigo, fecha_viaje, km_con_carga, km_vacios, tonelaje_real, nro_remito,
         monto_flete, material, es_vacio, chofer_id,
         origen:puntos_ruta!viajes_origen_id_fkey(nombre),
         destino:puntos_ruta!viajes_destino_id_fkey(nombre),
         chofer:choferes(nombre, apellido, rol),
         camion:camiones(patente, marca),
         cliente:clientes(razon_social)`,
      )
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .neq("estado", "cancelado")
      .order("fecha_viaje", { ascending: false })
      .range(desdeFila, desdeFila + 999);
    if (error) {
      // Sin esto, una consulta rota devolvía null y la pantalla decía "no hay
      // viajes en este período" — que es lo peor que puede pasar: un error que
      // se lee como un dato.
      console.error("[resumen destinos] no se pudieron leer los viajes:", error);
      throw new Error("No se pudieron leer los viajes. Probá de nuevo en un momento.");
    }
    const pagina = (data ?? []) as Fila[];
    filas.push(...pagina);
    if (pagina.length < 1000) break;
  }

  /**
   * Dos preguntas distintas, dos conjuntos distintos.
   *
   * - DÓNDE QUEDÓ el camión: cuentan TODOS los viajes, incluida la vuelta en
   *   vacío. El camión se mueve igual aunque vuelva sin carga.
   * - CUÁNTO TRABAJÓ (viajes, toneladas): sólo los que llevaron algo. Un
   *   retorno vacío no es "un viaje a ese destino".
   *
   * Confundirlas fue un bug real: Acosta hizo PLANTA SOLA → Darsena F 2 y
   * después Darsena F 2 → LOMASER en vacío, y la pantalla lo dejaba parado en
   * Darsena F 2 cuando el camión estaba en Lomaser. Pasaba en 273 de 1.030
   * días con viajes (26%).
   */
  const conCarga = opciones?.incluirVacios ? filas : filas.filter((f) => !f.es_vacio);

  const aViaje = (f: Fila, destino: string): ViajeDelResumen => ({
    sinChofer: !f.chofer_id,
    id: f.id,
    codigo: f.codigo,
    fecha: f.fecha_viaje,
    origen: uno(f.origen)?.nombre ?? null,
    destino,
    km: Number(f.km_con_carga ?? 0),
    kmVacios: Number(f.km_vacios ?? 0),
    toneladas: f.tonelaje_real == null ? null : Number(f.tonelaje_real),
    remito: f.nro_remito,
    monto: f.monto_flete == null ? null : Number(f.monto_flete),
    esVacio: !!f.es_vacio,
    cliente: uno(f.cliente)?.razon_social ?? null,
    material: f.material,
  });

  /**
   * Dónde quedó cada chofer.
   *
   * Antes cada chofer aparecía en TODOS los destinos a los que fue: Mehring
   * salía en Lomaser y en Ramallo porque hizo los dos viajes, y para decidir a
   * quién darle el próximo eso es ruido. Nico (30/07): *"me gustaría que figure
   * el último lugar al que llegaría"*.
   *
   * Así que cada chofer aparece UNA sola vez, en el destino de su último viaje.
   *
   * Dentro de un mismo día no hay hora, así que el orden lo da el código
   * (`V-2026-NNNNN`), que es secuencial por carga. Verificado con Mehring el
   * 29/07: 02080 LOMASER→RAMALLO y 02081 RAMALLO→LOMASER, así que quedó en
   * Lomaser — lo mismo que dice su hoja de ruta. `created_at` no serviría: los
   * dos viajes se cargaron en el mismo lote y tienen el mismo valor.
   *
   * OJO con los vacíos: para la POSICIÓN cuentan (el camión se mueve igual
   * aunque vuelva sin carga), para los CONTEOS no. Ver el comentario de arriba.
   *
   * No hay nada guardado que se pueda desactualizar: la posición se recalcula
   * cada vez que se lee, así que al cargar un viaje nuevo el chofer se mueve solo.
   */
  const esPosterior = (f: Fila, previo: Fila | undefined) =>
    !previo ||
    f.fecha_viaje > previo.fecha_viaje ||
    (f.fecha_viaje === previo.fecha_viaje && (f.codigo ?? "") > (previo.codigo ?? ""));

  const nombreDestino = (f: Fila) => uno(f.destino)?.nombre?.trim() || "Sin destino";

  // Acumulado del período por chofer + cuál fue su último viaje.
  type Acum = { viajes: Fila[]; ultimo: Fila };
  const porChofer = new Map<string, Acum>();
  // Viajes sin chofer, agrupados por el destino al que iban.
  const sinChoferPorDestino = new Map<string, ViajeDelResumen[]>();

  for (const f of filas) {
    // Los viajes sin chofer se agrupan por destino y no cuentan los vacíos: son
    // trabajo por asignar, y una vuelta en vacío no es trabajo.
    if (!f.chofer_id) {
      if (f.es_vacio && !opciones?.incluirVacios) continue;
      const destino = nombreDestino(f);
      const lista = sinChoferPorDestino.get(destino) ?? [];
      lista.push(aViaje(f, destino));
      sinChoferPorDestino.set(destino, lista);
      continue;
    }
    const previo = porChofer.get(f.chofer_id);
    if (previo) {
      previo.viajes.push(f);
      if (esPosterior(f, previo.ultimo)) previo.ultimo = f;
    } else {
      porChofer.set(f.chofer_id, { viajes: [f], ultimo: f });
    }
  }

  // Fotos del legajo de los choferes que aparecen. Va en su propia consulta y no
  // embebida en la de viajes: si el embed fallara, ahora tiraría error y se
  // caería toda la pantalla por un adorno.
  const fotoPorChofer = await firmarFotos(supabase, [...porChofer.keys()]);

  /**
   * Orden de lectura: del primero al último.
   *
   * El último viaje queda ABAJO, que es el que dice dónde terminó — se lee la
   * cadena de arriba hacia abajo como en la hoja de ruta, no al revés.
   */
  const cronologico = (a: ViajeDelResumen, b: ViajeDelResumen) =>
    a.fecha.localeCompare(b.fecha) || (a.codigo ?? "").localeCompare(b.codigo ?? "");

  const porDestino = new Map<string, DestinoResumen>();
  const vacio = (destino: string): DestinoResumen => ({
    destino,
    choferes: [],
    viajes: 0,
    toneladas: 0,
    km: 0,
    ultimaLlegada: "",
    sinChofer: 0,
    sinChoferDetalle: [],
  });

  for (const [choferId, acum] of porChofer) {
    const destino = nombreDestino(acum.ultimo);
    const d = porDestino.get(destino) ?? vacio(destino);
    porDestino.set(destino, d);

    const ch = uno(acum.ultimo.chofer);
    // El detalle muestra TODO, incluida la vuelta en vacío: es la que explica
    // por qué el camión terminó donde terminó.
    const detalle = acum.viajes.map((f) => aViaje(f, nombreDestino(f))).sort(cronologico);
    // Los conteos, en cambio, son de trabajo hecho: los vacíos no suman.
    const cargados = detalle.filter((v) => !v.esVacio);
    const km = cargados.reduce((s, v) => s + v.km, 0);
    const toneladas = cargados.reduce((s, v) => s + (v.toneladas ?? 0), 0);

    d.choferes.push({
      chofer_id: choferId,
      chofer: ch ? `${ch.apellido ?? ""}, ${ch.nombre ?? ""}`.trim() : "—",
      rol: ch?.rol ?? null,
      fotoUrl: fotoPorChofer.get(choferId) ?? null,
      camion: uno(acum.ultimo.camion)?.patente ?? null,
      camionMarca: uno(acum.ultimo.camion)?.marca ?? null,
      viajes: cargados.length,
      km,
      toneladas,
      llegoEl: acum.ultimo.fecha_viaje,
      vinoDe: uno(acum.ultimo.origen)?.nombre ?? null,
      detalle,
    });
    d.viajes += cargados.length;
    d.km += km;
    d.toneladas += toneladas;
    if (acum.ultimo.fecha_viaje > d.ultimaLlegada) d.ultimaLlegada = acum.ultimo.fecha_viaje;
  }

  // Un destino puede tener sólo viajes sin asignar y ningún chofer parado ahí:
  // igual tiene que aparecer, porque es trabajo que falta dar.
  for (const [destino, viajes] of sinChoferPorDestino) {
    const d = porDestino.get(destino) ?? vacio(destino);
    porDestino.set(destino, d);
    d.sinChofer = viajes.length;
    d.sinChoferDetalle = viajes.sort(cronologico);
  }

  const destinos = [...porDestino.values()]
    .map((d) => ({
      ...d,
      // El que llegó último arriba: es la foto más fresca de dónde está cada uno.
      choferes: d.choferes.sort(
        (a, b) => b.llegoEl.localeCompare(a.llegoEl) || a.chofer.localeCompare(b.chofer, "es"),
      ),
    }))
    // Donde hay más gente parada primero: es donde hay con qué trabajar.
    .sort(
      (a, b) =>
        b.choferes.length - a.choferes.length ||
        b.sinChofer - a.sinChofer ||
        a.destino.localeCompare(b.destino, "es"),
    );

  const choferesDistintos = new Set(
    conCarga.filter((f) => f.chofer_id).map((f) => f.chofer_id as string),
  );

  return {
    desde,
    hasta,
    destinos,
    totales: {
      viajes: conCarga.length,
      destinos: destinos.length,
      choferes: choferesDistintos.size,
      sinChofer: destinos.reduce((s, d) => s + d.sinChofer, 0),
      km: destinos.reduce((s, d) => s + d.km, 0),
    },
  };
}

export type ChoferParaAsignar = {
  id: string;
  nombre: string;
  /** El camión que le corresponde ese día (planilla diaria o el habitual). */
  camionId: string | null;
  patente: string | null;
};

/**
 * Los choferes que se le pueden poner a un viaje de esa fecha, con la unidad que
 * manejaban ese día.
 *
 * El camión no se elige a mano: sale de la planilla diaria de la fecha del viaje
 * y, si ese día no hay planilla, del camión habitual. Es la misma prioridad que
 * usa la carga de viajes — si la planilla cambió, acá cambia también.
 */
export async function getChoferesParaAsignarAction(fecha: string): Promise<ChoferParaAsignar[]> {
  await requireSeccion("viajes_listado", "read");
  const supabase = createAdminClient();

  const [choferes, camiones, planilla] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido", { ascending: true }),
    supabase.from("camiones").select("id, patente, chofer_actual_id").eq("estado", "activo"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("asignacion_diaria").select("chofer_id, camion_id").eq("fecha", fecha),
  ]);
  if (choferes.error) {
    console.error("[resumen destinos] no se pudieron leer los choferes:", choferes.error);
    throw new Error("No se pudo cargar la lista de choferes.");
  }

  const patentePorCamion = new Map<string, string>();
  const camionPorChofer = new Map<string, string>();
  for (const c of (camiones.data ?? []) as {
    id: string;
    patente: string;
    chofer_actual_id: string | null;
  }[]) {
    patentePorCamion.set(c.id, c.patente);
    if (c.chofer_actual_id) camionPorChofer.set(c.chofer_actual_id, c.id);
  }
  // La planilla de ese día pisa al habitual: un titular puede faltar y otro
  // tomar su unidad por un día.
  for (const a of (planilla?.data ?? []) as { chofer_id: string; camion_id: string | null }[]) {
    if (a.camion_id) camionPorChofer.set(a.chofer_id, a.camion_id);
  }

  return ((choferes.data ?? []) as { id: string; nombre: string; apellido: string }[]).map((c) => {
    const camionId = camionPorChofer.get(c.id) ?? null;
    return {
      id: c.id,
      nombre: `${c.apellido ?? ""}, ${c.nombre ?? ""}`.trim(),
      camionId,
      patente: camionId ? (patentePorCamion.get(camionId) ?? null) : null,
    };
  });
}

/**
 * Ponerle el chofer a un viaje que entró sin asignar.
 *
 * Es el paso que el Excel de la programación no trae y que Nico hoy hace con
 * lapicera: subraya el número de transporte y escribe el nombre al lado. Acá se
 * hace desde el mismo resumen, sin ir al listado.
 */
export async function asignarChoferViajeAction(
  viajeId: string,
  choferId: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("viajes_listado", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: viaje } = await (supabase as any)
    .from("viajes")
    .select("id, fecha_viaje, chofer_id, camion_id")
    .eq("id", viajeId)
    .maybeSingle();
  if (!viaje) return { error: "El viaje ya no existe." };

  const choferes = await getChoferesParaAsignarAction(viaje.fecha_viaje as string);
  const elegido = choferes.find((c) => c.id === choferId);
  if (!elegido) return { error: "Ese chofer no está activo." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("viajes")
    .update({
      chofer_id: choferId,
      // Si ya tenía camión puesto a mano, no se lo cambia.
      camion_id: viaje.camion_id ?? elegido.camionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", viajeId);
  if (error) return { error: error.message };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "viaje",
    entidadId: viajeId,
    valoresAnteriores: { chofer_id: viaje.chofer_id, camion_id: viaje.camion_id },
    valoresNuevos: { chofer_id: choferId, camion_id: viaje.camion_id ?? elegido.camionId },
    metadata: { origen: "resumen_destinos" },
  });

  revalidatePath("/viajes");
  revalidatePath("/viajes/resumen");
  return { ok: true };
}

/**
 * Los meses que tienen viajes cargados, del más nuevo al más viejo. Alimenta el
 * selector para poder mirar cualquier mes hacia atrás: el histórico no hay que
 * "guardarlo", son los viajes de siempre — lo que faltaba era poder pedirlos.
 */
export async function getMesesConViajesAction(): Promise<string[]> {
  await requireSeccion("viajes_listado", "read");
  const supabase = createAdminClient();

  const meses = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("viajes")
      .select("fecha_viaje")
      .neq("estado", "cancelado")
      .order("fecha_viaje", { ascending: false })
      .range(desde, desde + 999);
    if (error) {
      console.error("[resumen destinos] no se pudieron leer los meses:", error);
      break;
    }
    const pagina = (data ?? []) as { fecha_viaje: string }[];
    for (const r of pagina) meses.add(r.fecha_viaje.slice(0, 7));
    if (pagina.length < 1000) break;
  }
  return [...meses].sort((a, b) => b.localeCompare(a));
}
