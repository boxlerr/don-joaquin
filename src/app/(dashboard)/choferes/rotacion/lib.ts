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
  updated_at: string | null;
};

export type AltaDelAnio = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  fecha_ingreso: string;
  /** Si al día de hoy sigue activo o ya se fue (para el badge de la lista). */
  estado: string;
};

export type EgresadoDelAnio = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  fecha_ingreso: string | null;
  fecha_egreso: string;
  /** true cuando la fecha no es un egreso real cargado sino la fecha en que el
   *  sistema registró la baja (carga masiva, sin fecha de egreso). Corregible
   *  desde el legajo. */
  fecha_aprox: boolean;
  motivo: string;
  antiguedad_anios: number | null;
};

/**
 * Fecha efectiva de baja de un chofer. Preferimos la fecha de egreso real; si
 * falta (típico de altas/bajas cargadas en masa, que no pasan por la acción de
 * baja del legajo), caemos a la fecha en que se registró el cambio (`updated_at`)
 * para no perder al egresado en la rotación. Devuelve YYYY-MM-DD o null.
 */
function fechaBajaEfectiva(c: ChoferRotacion): string | null {
  if (c.fecha_egreso) return c.fecha_egreso;
  if (c.estado === "baja" && c.updated_at) return c.updated_at.slice(0, 10);
  return null;
}

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
  altas_detalle: AltaDelAnio[];
  egresados: EgresadoDelAnio[];
};

async function getChoferes(): Promise<ChoferRotacion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, localidad, fecha_ingreso, fecha_egreso, motivo_egreso, estado, updated_at");
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
    const baja = fechaBajaEfectiva(c);
    if (baja) anios.add(Number(baja.slice(0, 4)));
  }
  return [...anios].filter((a) => Number.isFinite(a)).sort((a, b) => b - a);
}

/** ¿El chofer estaba en la flota en la fecha `iso`? */
function activoEn(c: ChoferRotacion, iso: string): boolean {
  // Sin fecha de ingreso: si hoy sigue activo, asumimos que ya estaba antes del período.
  const ingresoOk = c.fecha_ingreso ? c.fecha_ingreso <= iso : c.estado === "activo";
  if (!ingresoOk) return false;
  // Egresado solo "deja de estar" a partir de su fecha de baja efectiva.
  if (c.estado === "baja") {
    const baja = fechaBajaEfectiva(c);
    return baja ? baja > iso : false;
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

  const altasArr = choferes.filter(
    (c) => c.fecha_ingreso && c.fecha_ingreso >= inicio && c.fecha_ingreso <= fin,
  );
  const altas = altasArr.length;
  const altas_detalle: AltaDelAnio[] = altasArr
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      localidad: c.localidad,
      fecha_ingreso: c.fecha_ingreso as string,
      estado: c.estado,
    }))
    .sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso));

  // Una baja cuenta en el año de su fecha efectiva (egreso real o, si falta, la
  // fecha en que se registró la baja). Guardamos esa fecha resuelta por chofer.
  const bajasArr = choferes
    .map((c) => ({ c, baja: fechaBajaEfectiva(c) }))
    .filter(({ c, baja }) => c.estado === "baja" && baja && baja >= inicio && baja <= fin);
  const bajas = bajasArr.length;

  const indice_rotacion = dotacion_promedio > 0 ? (bajas / dotacion_promedio) * 100 : 0;

  // Desglose de bajas por motivo.
  const motivoCount = new Map<string, number>();
  for (const { c } of bajasArr) {
    const m = c.motivo_egreso ?? "sin_especificar";
    motivoCount.set(m, (motivoCount.get(m) ?? 0) + 1);
  }
  const por_motivo = [...motivoCount.entries()]
    .map(([motivo, count]) => ({ motivo, label: MOTIVO_LABEL[motivo] ?? motivo, count }))
    .sort((a, b) => b.count - a.count);

  // Antigüedad de los que se fueron (en años) + lista detallada.
  const antiguedades: number[] = [];
  const egresados: EgresadoDelAnio[] = bajasArr
    .map(({ c, baja }) => {
      const fechaBaja = baja as string;
      let antiguedad_anios: number | null = null;
      if (c.fecha_ingreso) {
        const ms = new Date(fechaBaja).getTime() - new Date(c.fecha_ingreso).getTime();
        antiguedad_anios = Math.max(0, Math.round((ms / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10);
        antiguedades.push(antiguedad_anios);
      }
      return {
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        localidad: c.localidad,
        fecha_ingreso: c.fecha_ingreso,
        fecha_egreso: fechaBaja,
        fecha_aprox: !c.fecha_egreso, // vino del fallback (fecha de registro)
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
    altas_detalle,
    egresados,
  };
}

export async function getRotacion(anio?: number): Promise<{
  data: RotacionData;
  anios: number[];
  /** Bajas que se imputan por la fecha en que se registró la baja (sin fecha de
   *  egreso real cargada). Aparecen igual, pero se avisa para corregir la fecha. */
  egresados_fecha_aprox: number;
}> {
  const choferes = await getChoferes();
  const anios = aniosConDatos(choferes);
  const anioResuelto = anio && anios.includes(anio) ? anio : anios[0] ?? new Date().getFullYear();
  // Bajas sin fecha de egreso real: ahora SÍ se computan (usando la fecha de
  // registro como aproximación), pero se cuentan para avisar que conviene cargar
  // la fecha exacta desde el legajo.
  const egresados_fecha_aprox = choferes.filter((c) => c.estado === "baja" && !c.fecha_egreso).length;
  return { data: computeRotacion(choferes, anioResuelto), anios, egresados_fecha_aprox };
}
