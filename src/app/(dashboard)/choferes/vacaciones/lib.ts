import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  derivarVacaciones,
  saldosPorAnio,
  aniosCumplidos,
  diasPorAntiguedad,
  ROL_A_SECTOR,
  type SaldoAnio,
  type VacacionesSector,
  type Semaforo,
} from "./derivar";

export type { VacacionesSector, SaldoAnio } from "./derivar";

export type VacacionesPeriodo = {
  id: string;
  chofer_id: string;
  nombre: string;
  apellido: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
  estado: string;
  observaciones: string | null;
  anio_cargo: number | null; // null = histórico, no descuenta del saldo
  en_curso: boolean;
  viajes_conflicto: number; // viajes asignados al chofer dentro del período
};

export type VacacionesSaldoChofer = {
  chofer_id: string;
  nombre: string;
  apellido: string;
  sector: VacacionesSector;
  fecha_ingreso: string | null;
  anios: number;
  hito: string;
  corresponden: number; // días otorgados del año en curso
  adeudados: number; // saldo restante de años anteriores (derivado)
  total: number;
  tomados: number; // días de períodos iniciados en el año en curso (informativo)
  disponibles: number; // suma de saldos restantes vigentes (derivado, sin vencidos)
  dias_vencidos: number; // saldo de años que ya vencieron (31/12 del año siguiente)
  saldos_anio: SaldoAnio[]; // desglose por año (otorgados / usados / saldo)
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
  // Máximo de ausentes por semana antes de marcarla en rojo: 10% de los
  // choferes activos, nunca menos de 4 (antes era un 4 fijo).
  umbralAusentes: number;
};

function diasEntre(inicio: string, fin: string): number {
  const ini = new Date(inicio + "T00:00:00").getTime();
  const f = new Date(fin + "T00:00:00").getTime();
  return Math.max(1, Math.round((f - ini) / 86_400_000) + 1);
}

/**
 * Datos para la vista global de vacaciones. Los días otorgados por año viven en
 * `chofer_vacaciones_anios`; cada período descuenta del año al que está imputado
 * (`anio_cargo`). El saldo de cada año y los disponibles se derivan de ahí, así
 * un mismo período nunca descuenta dos veces.
 */
export async function getVacacionesGlobal(): Promise<VacacionesGlobal> {
  const supabase = createAdminClient();
  const ahora = new Date();
  const finPeriodoY = ahora.getFullYear();
  const inicioPeriodo = `${finPeriodoY}-01-01`;
  const hoy = ahora.toISOString().split("T")[0]!;

  const [{ data: choferes }, { data: aniosRaw }, { data: ausencias }] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, rol, fecha_ingreso, es_demo")
      .eq("estado", "activo")
      .order("apellido"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_vacaciones_anios")
      .select("chofer_id, anio, dias_correspondientes, observaciones")
      .order("anio"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_ausencias")
      .select("id, chofer_id, tipo, fecha_inicio, fecha_fin, estado, observaciones, anio_cargo")
      .eq("es_vacaciones", true)
      .is("deleted_at", null),
  ]);

  // Sin demo: la dotación real. (`es_demo` puede venir null en datos viejos.)
  const dotacion = (choferes ?? []).filter((c) => (c as { es_demo?: boolean | null }).es_demo !== true);

  const otorgadosPorChofer = new Map<string, { anio: number; dias: number; observaciones: string | null }[]>();
  for (const r of (aniosRaw ?? []) as {
    chofer_id: string;
    anio: number;
    dias_correspondientes: number;
    observaciones: string | null;
  }[]) {
    const lista = otorgadosPorChofer.get(r.chofer_id) ?? [];
    lista.push({ anio: r.anio, dias: r.dias_correspondientes ?? 0, observaciones: r.observaciones });
    otorgadosPorChofer.set(r.chofer_id, lista);
  }

  // Alta automática del período en curso: si a alguien de la dotación le falta
  // la fila del año (ingresó hace poco, o arrancó un año nuevo), se crea sola
  // con los días por antigüedad. Así en enero "se reinician" sin tocar nada.
  const faltantesAnio = dotacion
    .filter((c) => {
      const ingreso = (c as { fecha_ingreso: string | null }).fecha_ingreso;
      if (!ingreso) return false;
      return !(otorgadosPorChofer.get(c.id) ?? []).some((r) => r.anio === finPeriodoY);
    })
    .map((c) => {
      const ingreso = (c as { fecha_ingreso: string | null }).fecha_ingreso!;
      return {
        chofer_id: c.id,
        anio: finPeriodoY,
        dias_correspondientes: diasPorAntiguedad(aniosCumplidos(ingreso, finPeriodoY)),
        observaciones: `Alta automática del período ${finPeriodoY} (días por antigüedad)`,
      };
    });
  if (faltantesAnio.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("chofer_vacaciones_anios")
      .upsert(faltantesAnio, { onConflict: "chofer_id,anio", ignoreDuplicates: true });
    for (const f of faltantesAnio) {
      const lista = otorgadosPorChofer.get(f.chofer_id) ?? [];
      lista.push({ anio: f.anio, dias: f.dias_correspondientes, observaciones: f.observaciones });
      otorgadosPorChofer.set(f.chofer_id, lista);
    }
  }

  const infoPorChofer = new Map<string, { nombre: string; apellido: string }>();
  for (const c of dotacion) infoPorChofer.set(c.id, { nombre: c.nombre, apellido: c.apellido });

  const periodos: VacacionesPeriodo[] = [];
  const tomadosPorChofer = new Map<string, number>();
  const usadosPorChofer = new Map<string, Map<number, number>>();
  const enVacacionesAhora = new Set<string>();

  for (const a of (ausencias ?? []) as {
    id: string;
    chofer_id: string;
    tipo: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    observaciones: string | null;
    anio_cargo: number | null;
  }[]) {
    const info = infoPorChofer.get(a.chofer_id);
    if (!info) continue; // empleado inactivo / fuera de dotación
    const dias = diasEntre(a.fecha_inicio, a.fecha_fin);
    if (a.fecha_inicio >= inicioPeriodo) {
      tomadosPorChofer.set(a.chofer_id, (tomadosPorChofer.get(a.chofer_id) ?? 0) + dias);
    }
    if (a.anio_cargo != null) {
      const usados = usadosPorChofer.get(a.chofer_id) ?? new Map<number, number>();
      usados.set(a.anio_cargo, (usados.get(a.anio_cargo) ?? 0) + dias);
      usadosPorChofer.set(a.chofer_id, usados);
    }
    const enCurso = a.fecha_inicio <= hoy && a.fecha_fin >= hoy;
    if (enCurso) enVacacionesAhora.add(a.chofer_id);
    periodos.push({
      id: a.id,
      chofer_id: a.chofer_id,
      nombre: info.nombre,
      apellido: info.apellido,
      tipo: a.tipo ?? "Vacaciones",
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      dias,
      estado: a.estado,
      observaciones: a.observaciones ?? null,
      anio_cargo: a.anio_cargo ?? null,
      en_curso: enCurso,
      viajes_conflicto: 0,
    });
  }
  periodos.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

  // Choques con viajes: para los períodos vigentes o futuros, cuántos viajes
  // tiene asignados el chofer dentro del período (se marcan en el cronograma).
  const periodosVigentes = periodos.filter((p) => p.fecha_fin >= hoy);
  if (periodosVigentes.length > 0) {
    const choferIds = [...new Set(periodosVigentes.map((p) => p.chofer_id))];
    const maxFin = periodosVigentes.reduce((m, p) => (p.fecha_fin > m ? p.fecha_fin : m), hoy);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: viajesRaw } = await (supabase as any)
      .from("viajes")
      .select("chofer_id, fecha_viaje")
      .in("chofer_id", choferIds)
      .neq("estado", "cancelado")
      .gte("fecha_viaje", hoy)
      .lte("fecha_viaje", maxFin);
    const viajesPorChofer = new Map<string, string[]>();
    for (const v of (viajesRaw ?? []) as { chofer_id: string; fecha_viaje: string }[]) {
      const l = viajesPorChofer.get(v.chofer_id) ?? [];
      l.push(v.fecha_viaje);
      viajesPorChofer.set(v.chofer_id, l);
    }
    for (const p of periodosVigentes) {
      const fechas = viajesPorChofer.get(p.chofer_id);
      if (!fechas) continue;
      p.viajes_conflicto = fechas.filter((f) => f >= p.fecha_inicio && f <= p.fecha_fin).length;
    }
  }

  const saldos: VacacionesSaldoChofer[] = dotacion.map((c) => {
    const saldosAnio = saldosPorAnio(
      otorgadosPorChofer.get(c.id) ?? [],
      usadosPorChofer.get(c.id) ?? new Map(),
    );
    const corresponden = saldosAnio.find((s) => s.anio === finPeriodoY)?.otorgados ?? 0;
    // El saldo del año X vence el 31/12 del año X+1: solo el año pasado sigue
    // vigente como "adeudado"; lo anterior ya venció (se muestra aparte).
    const adeudados = saldosAnio.filter((s) => s.anio === finPeriodoY - 1).reduce((a, s) => a + s.saldo, 0);
    const diasVencidos = saldosAnio
      .filter((s) => s.anio < finPeriodoY - 1)
      .reduce((a, s) => a + Math.max(0, s.saldo), 0);
    const disponibles = saldosAnio.filter((s) => s.anio >= finPeriodoY - 1).reduce((a, s) => a + s.saldo, 0);
    const tomados = tomadosPorChofer.get(c.id) ?? 0;
    const rol = (c as { rol: string | null }).rol;
    const ingreso = (c as { fecha_ingreso: string | null }).fecha_ingreso;
    const d = derivarVacaciones({
      rol,
      fecha_ingreso: ingreso,
      corresponden,
      adeudados,
      disponibles,
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
      corresponden,
      adeudados,
      total: d.total,
      tomados,
      disponibles,
      dias_vencidos: diasVencidos,
      saldos_anio: saldosAnio,
      dias_segun_antiguedad: d.diasSegunAntiguedad,
      desfasaje: d.desfasaje,
      vence_saldo: d.vence_saldo,
      vence_periodo: d.vence_periodo,
      proximo_hito: d.proximo_hito,
      semaforo: d.semaforo,
      en_vacaciones_ahora: enVacacionesAhora.has(c.id),
    };
  });

  const choferesActivos = dotacion.filter((c) => (ROL_A_SECTOR[(c as { rol: string | null }).rol ?? ""] ?? "Chofer") === "Chofer").length;
  const umbralAusentes = Math.max(4, Math.round(choferesActivos * 0.1));

  return { saldos, periodos, finPeriodoY, umbralAusentes };
}
