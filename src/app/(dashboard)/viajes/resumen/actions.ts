"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";

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
};

export type ChoferEnDestino = {
  chofer_id: string | null;
  chofer: string;
  camion: string | null;
  viajes: number;
  km: number;
  toneladas: number;
  /** Fecha del último viaje que se le dio a ese destino, dentro del rango. */
  ultimo: string;
  detalle: ViajeDelResumen[];
};

export type DestinoResumen = {
  destino: string;
  viajes: number;
  toneladas: number;
  km: number;
  choferes: ChoferEnDestino[];
  /** Viajes del destino que todavía no tienen chofer asignado. */
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
  chofer: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
  camion: { patente: string } | { patente: string }[] | null;
  cliente: { nombre: string } | { nombre: string }[] | null;
};

const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

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
    const { data } = await (supabase as any)
      .from("viajes")
      .select(
        `id, fecha_viaje, km_con_carga, km_vacios, tonelaje_real, nro_remito,
         monto_flete, material, es_vacio, chofer_id,
         origen:puntos_ruta!viajes_origen_id_fkey(nombre),
         destino:puntos_ruta!viajes_destino_id_fkey(nombre),
         chofer:choferes(nombre, apellido),
         camion:camiones(patente),
         cliente:clientes(nombre)`,
      )
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .neq("estado", "cancelado")
      .order("fecha_viaje", { ascending: false })
      .range(desdeFila, desdeFila + 999);
    const pagina = (data ?? []) as Fila[];
    filas.push(...pagina);
    if (pagina.length < 1000) break;
  }

  // Los retornos vacíos no son "un viaje a ese destino": inflarían el conteo.
  const utiles = opciones?.incluirVacios ? filas : filas.filter((f) => !f.es_vacio);

  const aViaje = (f: Fila, destino: string): ViajeDelResumen => ({
    id: f.id,
    fecha: f.fecha_viaje,
    origen: uno(f.origen)?.nombre ?? null,
    destino,
    km: Number(f.km_con_carga ?? 0),
    kmVacios: Number(f.km_vacios ?? 0),
    toneladas: f.tonelaje_real == null ? null : Number(f.tonelaje_real),
    remito: f.nro_remito,
    monto: f.monto_flete == null ? null : Number(f.monto_flete),
    esVacio: !!f.es_vacio,
    cliente: uno(f.cliente)?.nombre ?? null,
    material: f.material,
  });

  const porDestino = new Map<string, DestinoResumen>();
  const porDestinoChofer = new Map<string, Map<string, ChoferEnDestino>>();

  for (const f of utiles) {
    const destino = uno(f.destino)?.nombre?.trim() || "Sin destino";
    let d = porDestino.get(destino);
    if (!d) {
      d = {
        destino,
        viajes: 0,
        toneladas: 0,
        km: 0,
        choferes: [],
        sinChofer: 0,
        sinChoferDetalle: [],
      };
      porDestino.set(destino, d);
      porDestinoChofer.set(destino, new Map());
    }
    const viaje = aViaje(f, destino);
    d.viajes += 1;
    d.toneladas += viaje.toneladas ?? 0;
    d.km += viaje.km;

    if (!f.chofer_id) {
      d.sinChofer += 1;
      d.sinChoferDetalle.push(viaje);
      continue;
    }

    const ch = uno(f.chofer);
    const nombre = ch ? `${ch.apellido ?? ""}, ${ch.nombre ?? ""}`.trim() : "—";
    const mapa = porDestinoChofer.get(destino)!;
    const previo = mapa.get(f.chofer_id);
    if (previo) {
      previo.viajes += 1;
      previo.km += viaje.km;
      previo.toneladas += viaje.toneladas ?? 0;
      previo.detalle.push(viaje);
      // Las filas vienen de la más nueva a la más vieja, pero no se asume.
      if (f.fecha_viaje > previo.ultimo) previo.ultimo = f.fecha_viaje;
    } else {
      mapa.set(f.chofer_id, {
        chofer_id: f.chofer_id,
        chofer: nombre,
        camion: uno(f.camion)?.patente ?? null,
        viajes: 1,
        km: viaje.km,
        toneladas: viaje.toneladas ?? 0,
        ultimo: f.fecha_viaje,
        detalle: [viaje],
      });
    }
  }

  const destinos = [...porDestino.values()]
    .map((d) => ({
      ...d,
      sinChoferDetalle: d.sinChoferDetalle.sort((a, b) => b.fecha.localeCompare(a.fecha)),
      choferes: [...(porDestinoChofer.get(d.destino)?.values() ?? [])]
        .map((c) => ({ ...c, detalle: c.detalle.sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
        .sort((a, b) => b.ultimo.localeCompare(a.ultimo) || b.viajes - a.viajes),
    }))
    // El destino con más movimiento primero: es a donde hay que mirar.
    .sort((a, b) => b.viajes - a.viajes || a.destino.localeCompare(b.destino, "es"));

  const choferesDistintos = new Set(
    utiles.filter((f) => f.chofer_id).map((f) => f.chofer_id as string),
  );

  return {
    desde,
    hasta,
    destinos,
    totales: {
      viajes: utiles.length,
      destinos: destinos.length,
      choferes: choferesDistintos.size,
      sinChofer: destinos.reduce((s, d) => s + d.sinChofer, 0),
      km: destinos.reduce((s, d) => s + d.km, 0),
    },
  };
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
    const { data } = await (supabase as any)
      .from("viajes")
      .select("fecha_viaje")
      .neq("estado", "cancelado")
      .order("fecha_viaje", { ascending: false })
      .range(desde, desde + 999);
    const pagina = (data ?? []) as { fecha_viaje: string }[];
    for (const r of pagina) meses.add(r.fecha_viaje.slice(0, 7));
    if (pagina.length < 1000) break;
  }
  return [...meses].sort((a, b) => b.localeCompare(a));
}
