/**
 * Cuántos litros de gasoil le corresponden a un viaje según lo que cargó.
 *
 * Nico, 31/08/2026: *"que los choferes puedan cargar las toneladas para que les
 * devuelva los litros que tiene que cargar"* — y pasó el cuadro por el que hay
 * que multiplicar.
 *
 * La cuenta es una multiplicación, pero lo que se cuida acá es todo lo demás:
 * que el tramo exista, que las toneladas sean un número que un camión pueda
 * llevar, y que el resultado se redondee siempre igual. Un litro de más por
 * viaje, 60 veces al mes, deja de ser un detalle.
 */

/** Un tramo del cuadro, ya resuelto a nombres. */
export type TarifaGasoil = {
  origenId: string;
  destinoId: string;
  origen: string;
  destino: string;
  litrosPorTonelada: number;
};

export type ResultadoLitros =
  | { ok: true; litros: number; litrosPorTonelada: number; toneladas: number }
  | { ok: false; error: MotivoRechazo; mensaje: string };

export type MotivoRechazo =
  | "sin_tramo"
  | "toneladas_invalidas"
  | "toneladas_fuera_de_rango";

/**
 * Techo de cordura para las toneladas.
 *
 * No es una regla del negocio sino un atajo contra el dedo resbalado: el viaje
 * más cargado del sistema son 38 tn (verificado sobre los 1.015 viajes con
 * tonelaje cargado, mediana 35). 100 deja lugar de sobra a cualquier equipo real
 * y frena el 3500 que sale de tipear los kilos.
 */
export const TONELADAS_MAX = 100;

/**
 * Litros redondeados a un decimal, que es como se pide el gasoil en el surtidor.
 *
 * El `toPrecision` no es adorno: el producto viene con ruido de punto flotante y
 * ese ruido cambia el redondeo. 27,5 × 23,74 da `652.8499999999999` en vez de
 * 652,85, así que `Math.round(n * 10) / 10` devolvía **652,8 en lugar de 652,9**.
 * Un décimo por viaje no se nota; sesenta viajes por mes siempre para el mismo
 * lado, sí. Se limpia a más decimales de los que nadie usa antes de cortar.
 */
export function redondearLitros(n: number): number {
  return Math.round(Number(n.toPrecision(12)) * 10) / 10;
}

export function buscarTarifa(
  tarifas: TarifaGasoil[],
  origenId: string | null | undefined,
  destinoId: string | null | undefined,
): TarifaGasoil | null {
  if (!origenId || !destinoId) return null;
  return tarifas.find((t) => t.origenId === origenId && t.destinoId === destinoId) ?? null;
}

/**
 * El cálculo. Devuelve el motivo en palabras cuando no se puede: la pantalla
 * tiene que poder decir POR QUÉ no hay número, y "0 litros" no es una respuesta
 * — es la peor de todas, porque parece una.
 */
export function calcularLitros(
  tarifa: TarifaGasoil | null,
  toneladas: number | null | undefined,
): ResultadoLitros {
  if (!tarifa) {
    // No se completa con nada ni se estima por parecido. **El cuadro va tal cual
    // lo pasó Nico** (decisión de Julián, 01/09/2026): son doce tramos y punto.
    // "LAJE 20", por ejemplo, existe como punto de ruta pero no está en el
    // cuadro — y no se le inventa un rinde: la pantalla lo dice y ahí se corta.
    return {
      ok: false,
      error: "sin_tramo",
      mensaje: "Ese tramo todavía no tiene un valor cargado.",
    };
  }
  if (toneladas == null || !Number.isFinite(toneladas) || toneladas <= 0) {
    return {
      ok: false,
      error: "toneladas_invalidas",
      mensaje: "Poné cuántas toneladas cargó.",
    };
  }
  if (toneladas > TONELADAS_MAX) {
    return {
      ok: false,
      error: "toneladas_fuera_de_rango",
      mensaje: `${toneladas} toneladas no entran en un equipo. ¿No serán kilos?`,
    };
  }
  return {
    ok: true,
    litros: redondearLitros(toneladas * tarifa.litrosPorTonelada),
    litrosPorTonelada: tarifa.litrosPorTonelada,
    toneladas,
  };
}

/** Los orígenes del cuadro, ordenados y sin repetir. */
export function origenesDe(tarifas: TarifaGasoil[]): { id: string; nombre: string }[] {
  const m = new Map<string, string>();
  for (const t of tarifas) m.set(t.origenId, t.origen);
  return [...m.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Los destinos que ese origen tiene cargados.
 *
 * Se acotan al origen elegido a propósito: ofrecer un destino que no tiene valor
 * es ofrecer un camino a "ese tramo no tiene valor cargado".
 */
export function destinosDe(
  tarifas: TarifaGasoil[],
  origenId: string | null | undefined,
): { id: string; nombre: string }[] {
  if (!origenId) return [];
  const m = new Map<string, string>();
  for (const t of tarifas) if (t.origenId === origenId) m.set(t.destinoId, t.destino);
  return [...m.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * TODOS los destinos del cuadro, sin importar el origen.
 *
 * La tira de destinos los muestra siempre completos y marca los que ese origen
 * no tiene. Ofrecer sólo los válidos parece más prolijo, pero esconde el hueco:
 * si mañana entra un destino nuevo sin rinde, nadie se entera de que falta
 * cargarlo — simplemente no está. Así se ve, se toca, y la pantalla explica.
 */
export function destinosTodos(tarifas: TarifaGasoil[]): { id: string; nombre: string }[] {
  const m = new Map<string, string>();
  for (const t of tarifas) m.set(t.destinoId, t.destino);
  return [...m.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * ¿Se puede elegir con tiras de botones, o hace falta un desplegable?
 *
 * El `Combobox` del proyecto sólo dibuja buscador arriba de 7 opciones
 * (`combobox.tsx`, `searchThreshold`). Con 3 orígenes y 4 destinos son dos clics
 * y un popup para elegir entre algo que entra entero en la pantalla — y el que
 * lo va a tocar tiene el camión al lado, no un mouse.
 *
 * El umbral está acá y no en la vista para que sea una decisión y no una
 * apuesta: el día que las canteras sean quince, la pantalla vuelve sola al
 * desplegable sin que nadie se acuerde de mirarlo.
 */
export const MAX_ORIGENES_EN_TIRA = 6;
export const MAX_DESTINOS_EN_TIRA = 8;

export function conviveConTiras(origenes: number, destinos: number): boolean {
  return origenes <= MAX_ORIGENES_EN_TIRA && destinos <= MAX_DESTINOS_EN_TIRA;
}
