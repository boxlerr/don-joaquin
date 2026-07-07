import "server-only";

// Inflación mensual (IPC nivel general, INDEC) desde la API pública de
// argentinadatos.com. Devuelve la variación % mes a mes. Se cachea 12 h (revalidate)
// para no pegarle a la API en cada carga y actualizarse solo cuando INDEC publica.

const API_URL = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion";

export type InflacionMes = { mes: string; valor: number }; // mes = "YYYY-MM", valor = variación % del mes

export type InflacionData = {
  serie: InflacionMes[]; // ascendente por mes
  ultimoMes: string | null; // "YYYY-MM" del último dato publicado
  ultimoValor: number | null; // variación % de ese mes
  /** Próxima publicación de INDEC (estimada: ~día 14 del mes subsiguiente al último dato). */
  proximoAnuncio: { fecha: string; mesLabel: string } | null;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function proximoAnuncioDesde(ultimoMes: string): { fecha: string; mesLabel: string } {
  const [y, m] = ultimoMes.split("-").map(Number); // m = 1-based
  // El próximo IPC es el mes siguiente al último publicado; INDEC lo difunde
  // ~mediados del mes subsiguiente. Ej: último dato mayo → se anuncia junio a mediados de julio.
  const mesAnunciar = new Date(y!, m!, 1); // 0-based m = ultimoMes + 1 (el mes a anunciar)
  const fecha = new Date(y!, m! + 1, 14); // día 14 del mes subsiguiente (estimado)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { fecha: fmt(fecha), mesLabel: `${MESES[mesAnunciar.getMonth()]} ${mesAnunciar.getFullYear()}` };
}

export async function getInflacion(): Promise<InflacionData> {
  const vacio: InflacionData = { serie: [], ultimoMes: null, ultimoValor: null, proximoAnuncio: null };
  try {
    const res = await fetch(API_URL, { next: { revalidate: 43200 } }); // 12 h
    if (!res.ok) return vacio;
    const raw = (await res.json()) as { fecha: string; valor: number }[];
    if (!Array.isArray(raw)) return vacio;
    const serie = raw
      .filter((r) => r && typeof r.fecha === "string" && typeof r.valor === "number")
      .map((r) => ({ mes: r.fecha.slice(0, 7), valor: r.valor }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
    if (serie.length === 0) return vacio;
    const ultimo = serie[serie.length - 1]!;
    return {
      serie,
      ultimoMes: ultimo.mes,
      ultimoValor: ultimo.valor,
      proximoAnuncio: proximoAnuncioDesde(ultimo.mes),
    };
  } catch {
    return vacio;
  }
}

/** Inflación acumulada (compuesta) entre dos meses inclusive, en %. Null si falta dato. */
export function inflacionAcumulada(serie: InflacionMes[], desde: string, hasta: string): number | null {
  if (!serie.length || desde > hasta) return null;
  const tramo = serie.filter((s) => s.mes >= desde && s.mes <= hasta);
  if (tramo.length === 0) return null;
  const factor = tramo.reduce((acc, s) => acc * (1 + s.valor / 100), 1);
  return (factor - 1) * 100;
}
