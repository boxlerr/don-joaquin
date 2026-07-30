import type { DestinoResumen, ResumenDestinos, ViajeDelResumen } from "../actions";

/**
 * Cómo se vería el resumen con la programación recién importada.
 *
 * NO toca la base. Son las 8 filas reales del `Prog.Viajes.XLSX` que mandó Nico
 * (4 circuitos ida+vuelta del 28 y 29/07), pasadas por las mismas reglas que
 * usa el importador, escritas a mano acá.
 *
 * Está hardcodeado a propósito: esos 8 viajes YA existen cargados en la base por
 * otra vía, así que importarlos de verdad duplicaría viajes reales — y `localhost`
 * escribe en producción, no hay base local. Esto es para mirar la pantalla, no
 * para tener datos.
 *
 * Las reglas aplicadas, las mismas del importador:
 * - origen = la columna `Centro` tal cual (A111 / A109)
 * - destino = `Destinat.mcía.`
 * - toneladas = `Ctd.de pedido` en KG dividido 1000
 * - km = 0 y chofer = null: el archivo no los trae
 */

/** Las 8 filas del archivo, tal como salen del parser. */
const FILAS = [
  { nro: "210061012", fecha: "2026-07-28", centro: "A111", destino: "FÁBRICA RAMALLO", material: "CEMENTO CPC E 40 ENSACADO", tn: 38 },
  { nro: "210061032", fecha: "2026-07-28", centro: "A109", destino: "LOMASER", material: "ESCORIA ALTO HORNO DESP", tn: 35 },
  { nro: "210061427", fecha: "2026-07-28", centro: "A111", destino: "FÁBRICA RAMALLO", material: "CEMENTO CPC E 40 ENSACADO", tn: 38 },
  { nro: "210061447", fecha: "2026-07-28", centro: "A109", destino: "LOMASER", material: "ESCORIA ALTO HORNO DESP", tn: 35.02 },
  { nro: "210061753", fecha: "2026-07-29", centro: "A111", destino: "FÁBRICA RAMALLO", material: "CEMENTO CPC E 40 ENSACADO", tn: 38 },
  { nro: "210061773", fecha: "2026-07-29", centro: "A109", destino: "LOMASER", material: "ESCORIA ALTO HORNO DESP", tn: 38 },
  { nro: "210061752", fecha: "2026-07-29", centro: "A111", destino: "FÁBRICA RAMALLO", material: "CEMENTO CPC E 40 ENSACADO", tn: 38 },
  { nro: "210061772", fecha: "2026-07-29", centro: "A109", destino: "LOMASER", material: "ESCORIA ALTO HORNO DESP", tn: 38 },
] as const;

const CLIENTE = "LOMA NEGRA CIASA";

function aViaje(f: (typeof FILAS)[number]): ViajeDelResumen {
  return {
    // Prefijo para que sea evidente que no es un id de la base.
    id: `mockup-${f.nro}`,
    fecha: f.fecha,
    origen: f.centro,
    destino: f.destino,
    km: 0,
    kmVacios: 0,
    toneladas: f.tn,
    remito: null,
    monto: null,
    esVacio: false,
    cliente: CLIENTE,
    material: f.material,
    sinChofer: true,
  };
}

export function resumenMockup(): ResumenDestinos {
  const porDestino = new Map<string, ViajeDelResumen[]>();
  for (const f of FILAS) {
    const v = aViaje(f);
    porDestino.set(v.destino, [...(porDestino.get(v.destino) ?? []), v]);
  }

  const destinos: DestinoResumen[] = [...porDestino.entries()]
    .map(([destino, viajes]) => ({
      destino,
      viajes: viajes.length,
      toneladas: viajes.reduce((s, v) => s + (v.toneladas ?? 0), 0),
      km: 0,
      // Ninguno tiene chofer: es exactamente el punto del importador.
      choferes: [],
      sinChofer: viajes.length,
      sinChoferDetalle: [...viajes].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    }))
    .sort((a, b) => b.viajes - a.viajes || a.destino.localeCompare(b.destino, "es"));

  return {
    desde: "2026-07-28",
    hasta: "2026-07-29",
    destinos,
    totales: {
      viajes: FILAS.length,
      destinos: destinos.length,
      choferes: 0,
      sinChofer: FILAS.length,
      km: 0,
    },
  };
}
