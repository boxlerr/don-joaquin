import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { derivarVacaciones, type VacacionesSector, type Semaforo } from "./derivar";

export type { VacacionesSector } from "./derivar";

export type VacacionesPeriodo = {
  id: string;
  chofer_id: string;
  nombre: string;
  apellido: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
  estado: string;
  en_curso: boolean;
};

export type VacacionesSaldoChofer = {
  chofer_id: string;
  nombre: string;
  apellido: string;
  sector: VacacionesSector;
  fecha_ingreso: string | null;
  anios: number;
  hito: string;
  corresponden: number;
  adeudados: number;
  total: number;
  tomados: number;
  disponibles: number;
  dias_segun_antiguedad: number;
  desfasaje: boolean; // los días cargados no coinciden con la antigüedad actual
  vence_saldo: string | null;
  vence_periodo: string;
  proximo_hito: string;
  semaforo: Semaforo;
  en_vacaciones_ahora: boolean;
};

export type VacacionesGlobal = {
  saldos: VacacionesSaldoChofer[];
  periodos: VacacionesPeriodo[];
  finPeriodoY: number;
};

function diasEntre(inicio: string, fin: string): number {
  const ini = new Date(inicio + "T00:00:00").getTime();
  const f = new Date(fin + "T00:00:00").getTime();
  return Math.max(1, Math.round((f - ini) / 86_400_000) + 1);
}

/**
 * Datos para la vista global de vacaciones. Saldos por empleado con todos los
 * campos derivados (sector, antigüedad, hito, total, vencimientos, próximo hito
 * y semáforo) + los períodos cargados para el cronograma. Los "tomados" cuentan
 * sólo el período en curso (≥ 1/1 del año actual) porque el saldo del año
 * anterior ya viene neto.
 */
export async function getVacacionesGlobal(): Promise<VacacionesGlobal> {
  const supabase = createAdminClient();
  const ahora = new Date();
  const finPeriodoY = ahora.getFullYear();
  const inicioPeriodo = `${finPeriodoY}-01-01`;
  const hoy = ahora.toISOString().split("T")[0]!;

  const [{ data: choferes }, { data: saldosRaw }, { data: ausencias }] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, rol, fecha_ingreso")
      .eq("estado", "activo")
      .order("apellido"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_vacaciones")
      .select("chofer_id, dias_correspondientes, dias_adeudados"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_ausencias")
      .select("id, chofer_id, fecha_inicio, fecha_fin, estado")
      .eq("es_vacaciones", true)
      .is("deleted_at", null),
  ]);

  const saldoPorChofer = new Map<string, { corresponden: number; adeudados: number }>();
  for (const s of (saldosRaw ?? []) as { chofer_id: string; dias_correspondientes: number; dias_adeudados: number }[]) {
    saldoPorChofer.set(s.chofer_id, {
      corresponden: s.dias_correspondientes ?? 0,
      adeudados: s.dias_adeudados ?? 0,
    });
  }

  const infoPorChofer = new Map<string, { nombre: string; apellido: string }>();
  for (const c of choferes ?? []) infoPorChofer.set(c.id, { nombre: c.nombre, apellido: c.apellido });

  const periodos: VacacionesPeriodo[] = [];
  const tomadosPorChofer = new Map<string, number>();
  const enVacacionesAhora = new Set<string>();

  for (const a of (ausencias ?? []) as {
    id: string;
    chofer_id: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
  }[]) {
    const info = infoPorChofer.get(a.chofer_id);
    if (!info) continue; // empleado inactivo / fuera de dotación
    const dias = diasEntre(a.fecha_inicio, a.fecha_fin);
    if (a.fecha_inicio >= inicioPeriodo) {
      tomadosPorChofer.set(a.chofer_id, (tomadosPorChofer.get(a.chofer_id) ?? 0) + dias);
    }
    const enCurso = a.fecha_inicio <= hoy && a.fecha_fin >= hoy;
    if (enCurso) enVacacionesAhora.add(a.chofer_id);
    periodos.push({
      id: a.id,
      chofer_id: a.chofer_id,
      nombre: info.nombre,
      apellido: info.apellido,
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      dias,
      estado: a.estado,
      en_curso: enCurso,
    });
  }
  periodos.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

  const saldos: VacacionesSaldoChofer[] = (choferes ?? []).map((c) => {
    const s = saldoPorChofer.get(c.id) ?? { corresponden: 0, adeudados: 0 };
    const tomados = tomadosPorChofer.get(c.id) ?? 0;
    const rol = (c as { rol: string | null }).rol;
    const ingreso = (c as { fecha_ingreso: string | null }).fecha_ingreso;
    const d = derivarVacaciones({
      rol,
      fecha_ingreso: ingreso,
      corresponden: s.corresponden,
      adeudados: s.adeudados,
      tomados,
      finPeriodoY,
    });
    return {
      chofer_id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      sector: d.sector,
      fecha_ingreso: ingreso,
      anios: d.anios,
      hito: d.hito,
      corresponden: s.corresponden,
      adeudados: s.adeudados,
      total: d.total,
      tomados,
      disponibles: d.disponibles,
      dias_segun_antiguedad: d.diasSegunAntiguedad,
      desfasaje: d.desfasaje,
      vence_saldo: d.vence_saldo,
      vence_periodo: d.vence_periodo,
      proximo_hito: d.proximo_hito,
      semaforo: d.semaforo,
      en_vacaciones_ahora: enVacacionesAhora.has(c.id),
    };
  });

  return { saldos, periodos, finPeriodoY };
}
