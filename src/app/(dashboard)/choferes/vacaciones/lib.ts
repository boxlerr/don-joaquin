import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type VacacionesPeriodo = {
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
  corresponden: number;
  adeudados: number;
  tomados: number;
  disponibles: number;
  en_vacaciones_ahora: boolean;
};

export type VacacionesGlobal = {
  saldos: VacacionesSaldoChofer[];
  periodos: VacacionesPeriodo[];
};

function diasEntre(inicio: string, fin: string): number {
  const ini = new Date(inicio + "T00:00:00").getTime();
  const f = new Date(fin + "T00:00:00").getTime();
  return Math.max(1, Math.round((f - ini) / 86_400_000) + 1);
}

/**
 * Datos para la vista global de vacaciones: saldos por chofer (corresponden /
 * adeudados / tomados / disponibles, misma lógica que el legajo) y los períodos
 * de vacaciones cargados (ausencias con es_vacaciones) para el cronograma.
 */
export async function getVacacionesGlobal(): Promise<VacacionesGlobal> {
  const supabase = createAdminClient();
  const hoy = new Date().toISOString().split("T")[0]!;

  const [{ data: choferes }, { data: saldosRaw }, { data: ausencias }] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_vacaciones")
      .select("chofer_id, dias_correspondientes, dias_adeudados"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_ausencias")
      .select("chofer_id, fecha_inicio, fecha_fin, estado")
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

  const nombrePorChofer = new Map<string, { nombre: string; apellido: string }>();
  for (const c of choferes ?? []) nombrePorChofer.set(c.id, { nombre: c.nombre, apellido: c.apellido });

  // Períodos de vacaciones (para el cronograma) + acumulado de días tomados.
  const periodos: VacacionesPeriodo[] = [];
  const tomadosPorChofer = new Map<string, number>();
  const enVacacionesAhora = new Set<string>();

  for (const a of (ausencias ?? []) as {
    chofer_id: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
  }[]) {
    const info = nombrePorChofer.get(a.chofer_id);
    if (!info) continue; // chofer inactivo / fuera de dotación
    const dias = diasEntre(a.fecha_inicio, a.fecha_fin);
    tomadosPorChofer.set(a.chofer_id, (tomadosPorChofer.get(a.chofer_id) ?? 0) + dias);
    const enCurso = a.fecha_inicio <= hoy && a.fecha_fin >= hoy;
    if (enCurso) enVacacionesAhora.add(a.chofer_id);
    periodos.push({
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
    return {
      chofer_id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      corresponden: s.corresponden,
      adeudados: s.adeudados,
      tomados,
      disponibles: s.corresponden + s.adeudados - tomados,
      en_vacaciones_ahora: enVacacionesAhora.has(c.id),
    };
  });

  return { saldos, periodos };
}
