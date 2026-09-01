import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeMetricas } from "./compute";
import type { BajaRotacion, AltaDelAnio, ParamAnio, DotacionEstimada } from "./compute";
import { egresadosSinCruzar } from "@/domain/rotacion/cruce-legajo";

// Data layer de rotación: arma el dataset crudo (bajas + parámetros + altas +
// dotación estimada por año) y el cliente recalcula KPIs/charts/tabla al filtrar
// o comparar, al instante. Fuente de verdad de las bajas: `rotacion_bajas`.

export type RotacionDataset = {
  bajas: BajaRotacion[];
  params: ParamAnio[];
  estimadas: DotacionEstimada[];
  altas: AltaDelAnio[];
  anios: number[];
  bases: string[];
  dotacion_actual: number;
  anio_actual: number;
  /** Egresados del legajo que NO están en `rotacion_bajas` (fleteros aparte).
   *  Vacío es lo normal; si trae gente, el índice está mintiendo para abajo. */
  sin_cruzar: EgresadoSinCruzar[];
};

export type EgresadoSinCruzar = {
  id: string;
  nombre: string;
  apellido: string;
  fecha_egreso: string | null;
};

type ChoferRow = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  fecha_ingreso: string | null;
  fecha_egreso: string | null;
  estado: string;
  rol: string | null;
  updated_at: string | null;
};

function fechaBajaEfectiva(c: ChoferRow): string | null {
  if (c.fecha_egreso) return c.fecha_egreso;
  if (c.estado === "baja" && c.updated_at) return c.updated_at.slice(0, 10);
  return null;
}

function activoEn(c: ChoferRow, iso: string): boolean {
  const ingresoOk = c.fecha_ingreso ? c.fecha_ingreso <= iso : c.estado === "activo";
  if (!ingresoOk) return false;
  if (c.estado === "baja") {
    const baja = fechaBajaEfectiva(c);
    return baja ? baja > iso : false;
  }
  return true;
}

export async function getRotacionDataset(): Promise<RotacionDataset> {
  const supabase = createAdminClient();
  const [{ data: choferesRaw }, bajasRes, anualRes] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, localidad, fecha_ingreso, fecha_egreso, estado, rol, updated_at"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("rotacion_bajas").select("*").order("fecha_egreso", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("rotacion_anual").select("anio, flota_inicial, flota_final"),
  ]);

  const choferes = (choferesRaw ?? []) as ChoferRow[];
  const bajas = (bajasRes.data ?? []) as BajaRotacion[];
  const params = (anualRes.data ?? []) as ParamAnio[];

  // Años con datos: parámetros ∪ bajas ∪ movimiento en choferes ∪ año actual.
  const anio_actual = new Date().getFullYear();
  const aniosSet = new Set<number>([anio_actual]);
  for (const b of bajas) aniosSet.add(b.anio);
  for (const p of params) aniosSet.add(p.anio);
  for (const c of choferes) {
    if (c.fecha_ingreso) aniosSet.add(Number(c.fecha_ingreso.slice(0, 4)));
    const baja = fechaBajaEfectiva(c);
    if (baja) aniosSet.add(Number(baja.slice(0, 4)));
  }
  const anios = [...aniosSet].filter((a) => Number.isFinite(a)).sort((a, b) => b - a);

  // Dotación estimada desde el roster (fallback para años sin parámetros).
  const estimadas: DotacionEstimada[] = anios.map((anio) => ({
    anio,
    inicial: choferes.filter((c) => activoEn(c, `${anio}-01-01`)).length,
    final: choferes.filter((c) => activoEn(c, `${anio}-12-31`)).length,
  }));

  // Altas: roster real (choferes con fecha de ingreso). El cliente filtra por año.
  const altas: AltaDelAnio[] = choferes
    .filter((c) => c.fecha_ingreso)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      localidad: c.localidad,
      fecha_ingreso: c.fecha_ingreso as string,
      estado: c.estado,
    }));

  const bases = [...new Set(bajas.map((b) => b.base_zona).filter((b): b is string => !!b))].sort();
  const dotacion_actual = choferes.filter((c) => c.estado === "activo").length;

  // El cruce con el legajo. Se calcula acá y no en un script porque tiene que
  // estar SIEMPRE: si el día de mañana alguien queda egresado sin baja —por el
  // importador, o porque falló el guardado— la pantalla lo dice sola.
  const sin_cruzar: EgresadoSinCruzar[] = egresadosSinCruzar(choferes, bajas)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre ?? "",
      apellido: c.apellido ?? "",
      fecha_egreso: c.fecha_egreso,
    }))
    .sort((a, b) => (b.fecha_egreso ?? "").localeCompare(a.fecha_egreso ?? ""));

  return { bajas, params, estimadas, altas, anios, bases, dotacion_actual, anio_actual, sin_cruzar };
}

/**
 * Resumen compacto de rotación de un año (retrocompat para el módulo Reportes):
 * dotación actual, altas, bajas e índice de rotación total.
 */
export async function getRotacion(anio?: number): Promise<{
  data: { anio: number; dotacion_actual: number; altas: number; bajas: number; indice_rotacion: number };
}> {
  const ds = await getRotacionDataset();
  const a = anio && ds.anios.includes(anio) ? anio : ds.anios[0] ?? new Date().getFullYear();
  const m = computeMetricas({
    anio: a,
    bajas: ds.bajas.filter((b) => b.anio === a),
    param: ds.params.find((p) => p.anio === a) ?? null,
    estimada: ds.estimadas.find((e) => e.anio === a) ?? null,
    altasCount: ds.altas.filter((x) => x.fecha_ingreso.slice(0, 4) === String(a)).length,
  });
  return {
    data: { anio: a, dotacion_actual: ds.dotacion_actual, altas: m.altas, bajas: m.bajas, indice_rotacion: m.ir_total },
  };
}
