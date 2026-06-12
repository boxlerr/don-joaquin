import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Índice de rotación de choferes (pedido 1/06).
// Se calcula 100% sobre datos que ya existen en `choferes`: fecha_ingreso,
// fecha_egreso, motivo_egreso y estado. No requiere tablas nuevas.
// ---------------------------------------------------------------------------

export type ChoferMotivoEgreso = "renuncia" | "despido" | "jubilacion" | "otro";

export const MOTIVO_LABEL: Record<string, string> = {
  renuncia: "Renuncia",
  despido: "Despido",
  jubilacion: "Jubilación",
  otro: "Otro",
  sin_especificar: "Sin especificar",
};

type ChoferRotacion = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  fecha_ingreso: string | null;
  fecha_egreso: string | null;
  motivo_egreso: string | null;
  estado: string;
};

export type EgresadoDelAnio = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  fecha_ingreso: string | null;
  fecha_egreso: string;
  motivo: string;
  antiguedad_anios: number | null;
};

export type RotacionData = {
  anio: number;
  dotacion_inicio: number;
  dotacion_fin: number;
  dotacion_promedio: number;
  dotacion_actual: number;
  altas: number;
  bajas: number;
  indice_rotacion: number;
  antiguedad_promedio_bajas: number | null;
  por_motivo: { motivo: string; label: string; count: number }[];
  egresados: EgresadoDelAnio[];
};

async function getChoferes(): Promise<ChoferRotacion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, localidad, fecha_ingreso, fecha_egreso, motivo_egreso, estado");
  return (data ?? []) as ChoferRotacion[];
}

/**
 * Años con movimiento (altas o bajas) + el año actual, de mayor a menor.
 * Sirve para poblar el selector sin ofrecer años vacíos.
 */
function aniosConDatos(choferes: ChoferRotacion[]): number[] {
  const anios = new Set<number>([new Date().getFullYear()]);
  for (const c of choferes) {
    if (c.fecha_ingreso) anios.add(Number(c.fecha_ingreso.slice(0, 4)));
    if (c.fecha_egreso) anios.add(Number(c.fecha_egreso.slice(0, 4)));
  }
  return [...anios].filter((a) => Number.isFinite(a)).sort((a, b) => b - a);
}

/** ¿El chofer estaba en la flota en la fecha `iso`? */
function activoEn(c: ChoferRotacion, iso: string): boolean {
  // Sin fecha de ingreso: si hoy sigue activo, asumimos que ya estaba antes del período.
  const ingresoOk = c.fecha_ingreso ? c.fecha_ingreso <= iso : c.estado === "activo";
  if (!ingresoOk) return false;
  // Egresado solo "deja de estar" a partir de su fecha de egreso.
  if (c.estado === "baja") {
    return c.fecha_egreso ? c.fecha_egreso > iso : false;
  }
  return true;
}

function computeRotacion(choferes: ChoferRotacion[], anio: number): RotacionData {
  const inicio = `${anio}-01-01`;
  const fin = `${anio}-12-31`;

  const dotacion_inicio = choferes.filter((c) => activoEn(c, inicio)).length;
  const dotacion_fin = choferes.filter((c) => activoEn(c, fin)).length;
  const dotacion_promedio = (dotacion_inicio + dotacion_fin) / 2;
  const dotacion_actual = choferes.filter((c) => c.estado === "activo").length;

  const altas = choferes.filter(
    (c) => c.fecha_ingreso && c.fecha_ingreso >= inicio && c.fecha_ingreso <= fin,
  ).length;

  const bajasArr = choferes.filter(
    (c) => c.estado === "baja" && c.fecha_egreso && c.fecha_egreso >= inicio && c.fecha_egreso <= fin,
  );
  const bajas = bajasArr.length;

  const indice_rotacion = dotacion_promedio > 0 ? (bajas / dotacion_promedio) * 100 : 0;

  // Desglose de bajas por motivo.
  const motivoCount = new Map<string, number>();
  for (const c of bajasArr) {
    const m = c.motivo_egreso ?? "sin_especificar";
    motivoCount.set(m, (motivoCount.get(m) ?? 0) + 1);
  }
  const por_motivo = [...motivoCount.entries()]
    .map(([motivo, count]) => ({ motivo, label: MOTIVO_LABEL[motivo] ?? motivo, count }))
    .sort((a, b) => b.count - a.count);

  // Antigüedad de los que se fueron (en años) + lista detallada.
  const antiguedades: number[] = [];
  const egresados: EgresadoDelAnio[] = bajasArr
    .map((c) => {
      let antiguedad_anios: number | null = null;
      if (c.fecha_ingreso && c.fecha_egreso) {
        const ms = new Date(c.fecha_egreso).getTime() - new Date(c.fecha_ingreso).getTime();
        antiguedad_anios = Math.max(0, Math.round((ms / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10);
        antiguedades.push(antiguedad_anios);
      }
      return {
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        localidad: c.localidad,
        fecha_ingreso: c.fecha_ingreso,
        fecha_egreso: c.fecha_egreso as string,
        motivo: MOTIVO_LABEL[c.motivo_egreso ?? "sin_especificar"] ?? "Sin especificar",
        antiguedad_anios,
      };
    })
    .sort((a, b) => b.fecha_egreso.localeCompare(a.fecha_egreso));

  const antiguedad_promedio_bajas =
    antiguedades.length > 0
      ? Math.round((antiguedades.reduce((s, n) => s + n, 0) / antiguedades.length) * 10) / 10
      : null;

  return {
    anio,
    dotacion_inicio,
    dotacion_fin,
    dotacion_promedio: Math.round(dotacion_promedio * 10) / 10,
    dotacion_actual,
    altas,
    bajas,
    indice_rotacion: Math.round(indice_rotacion * 10) / 10,
    antiguedad_promedio_bajas,
    por_motivo,
    egresados,
  };
}

export async function getRotacion(anio?: number): Promise<{
  data: RotacionData;
  anios: number[];
  egresados_sin_fecha: number;
}> {
  const choferes = await getChoferes();
  const anios = aniosConDatos(choferes);
  const anioResuelto = anio && anios.includes(anio) ? anio : anios[0] ?? new Date().getFullYear();
  // Egresados marcados como baja pero sin fecha de egreso: no se pueden imputar a
  // ningún año, así que quedan fuera de la rotación. Se avisa para completarlos.
  const egresados_sin_fecha = choferes.filter((c) => c.estado === "baja" && !c.fecha_egreso).length;
  return { data: computeRotacion(choferes, anioResuelto), anios, egresados_sin_fecha };
}
