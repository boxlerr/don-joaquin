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
 * O sea, dado vuelta respecto de la hoja de ruta: ahí se entra por chofer y se
 * ven sus destinos; acá se entra por destino y se ven sus choferes.
 */

export type ChoferEnDestino = {
  chofer_id: string | null;
  chofer: string;
  camion: string | null;
  viajes: number;
  /** Fecha del último viaje que se le dio a ese destino, en el rango. */
  ultimo: string;
};

export type DestinoResumen = {
  destino: string;
  viajes: number;
  toneladas: number;
  km: number;
  choferes: ChoferEnDestino[];
  /** Viajes del destino que todavía no tienen chofer asignado. */
  sinChofer: number;
};

export type ResumenDestinos = {
  desde: string;
  hasta: string;
  destinos: DestinoResumen[];
  totales: { viajes: number; destinos: number; choferes: number; sinChofer: number };
};

type Fila = {
  fecha_viaje: string;
  km_con_carga: number | null;
  tonelaje_real: number | null;
  es_vacio: boolean | null;
  chofer_id: string | null;
  destino: { nombre: string } | { nombre: string }[] | null;
  chofer: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null;
  camion: { patente: string } | { patente: string }[] | null;
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
        `fecha_viaje, km_con_carga, tonelaje_real, es_vacio, chofer_id,
         destino:puntos_ruta!viajes_destino_id_fkey(nombre),
         chofer:choferes(nombre, apellido),
         camion:camiones(patente)`,
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

  const porDestino = new Map<string, DestinoResumen>();
  const porDestinoChofer = new Map<string, Map<string, ChoferEnDestino>>();

  for (const f of utiles) {
    const destino = uno(f.destino)?.nombre?.trim() || "Sin destino";
    let d = porDestino.get(destino);
    if (!d) {
      d = { destino, viajes: 0, toneladas: 0, km: 0, choferes: [], sinChofer: 0 };
      porDestino.set(destino, d);
      porDestinoChofer.set(destino, new Map());
    }
    d.viajes += 1;
    d.toneladas += Number(f.tonelaje_real ?? 0);
    d.km += Number(f.km_con_carga ?? 0);

    if (!f.chofer_id) {
      d.sinChofer += 1;
      continue;
    }
    const ch = uno(f.chofer);
    const nombre = ch ? `${ch.apellido ?? ""}, ${ch.nombre ?? ""}`.trim() : "—";
    const mapa = porDestinoChofer.get(destino)!;
    const previo = mapa.get(f.chofer_id);
    if (previo) {
      previo.viajes += 1;
      // Las filas vienen de la más nueva a la más vieja, pero no se asume.
      if (f.fecha_viaje > previo.ultimo) previo.ultimo = f.fecha_viaje;
    } else {
      mapa.set(f.chofer_id, {
        chofer_id: f.chofer_id,
        chofer: nombre,
        camion: uno(f.camion)?.patente ?? null,
        viajes: 1,
        ultimo: f.fecha_viaje,
      });
    }
  }

  const destinos = [...porDestino.values()]
    .map((d) => ({
      ...d,
      choferes: [...(porDestinoChofer.get(d.destino)?.values() ?? [])].sort(
        (a, b) => b.ultimo.localeCompare(a.ultimo) || b.viajes - a.viajes,
      ),
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
    },
  };
}
