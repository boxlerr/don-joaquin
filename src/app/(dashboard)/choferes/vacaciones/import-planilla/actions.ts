"use server";

import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logChoferAudit } from "../../audit";
import { saldosPorAnio, anioParaImputar } from "../derivar";
import {
  crearMatcher,
  parseCantidad,
  parseBloquesAnio,
  parseCronograma,
  rangosPorPersona,
  type EmpleadoRef,
  type Matriz,
  type SaldoPlanilla,
} from "./parser";

// Importador de la planilla de Bárbara con vista previa: parsea el Excel, lo
// compara contra el sistema y devuelve SOLO diferencias; nada se escribe hasta
// que el usuario confirma en el diálogo (aplicarImportarPlanillaAction).

export type ImportPeriodoNuevo = {
  chofer_id: string;
  empleado: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
};

export type ImportSaldoCambio = {
  chofer_id: string;
  empleado: string;
  anio: number;
  saldo_planilla: number;
  saldo_actual: number;
  otorgados_nuevo: number; // lo que hay que guardar para que el saldo derive al de la planilla
  // El preview compara SALDOS pero lo que se escribe son OTORGADOS, que es otro
  // número: ahí adentro se escondió el caso Trejo (28 → 16). Estos dos campos
  // permiten mostrar el antes→después de lo que realmente se va a guardar.
  otorgados_actual: number;
  origen_actual: string;
};

export type ImportPreview = {
  periodos: ImportPeriodoNuevo[];
  saldos: ImportSaldoCambio[];
  sinMatch: string[];
  avisos: string[];
};

function diasEntre(a: string, b: string): number {
  return (
    Math.round(
      (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000,
    ) + 1
  );
}

function hoja(wb: XLSX.WorkBook, patron: RegExp): Matriz {
  const nombre = wb.SheetNames.find((n) => patron.test(n.toLowerCase()));
  if (!nombre) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[nombre]!, {
    header: 1,
    raw: true,
    defval: null,
  }) as Matriz;
}

async function estadoActual(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
) {
  const [{ data: choferes }, { data: anios }, { data: periodos }] = await Promise.all([
    sb
      .from("choferes")
      .select("id, nombre, apellido, estado, es_demo")
      .or("es_demo.is.null,es_demo.eq.false"),
    sb.from("chofer_vacaciones_anios").select("chofer_id, anio, dias_correspondientes, origen"),
    sb
      .from("chofer_ausencias")
      .select("id, chofer_id, fecha_inicio, fecha_fin, anio_cargo")
      .eq("es_vacaciones", true)
      .is("deleted_at", null),
  ]);
  return {
    choferes: (choferes ?? []) as { id: string; nombre: string; apellido: string; estado: string }[],
    anios: (anios ?? []) as {
      chofer_id: string;
      anio: number;
      dias_correspondientes: number;
      origen: string | null;
    }[],
    periodos: (periodos ?? []) as {
      id: string;
      chofer_id: string;
      fecha_inicio: string;
      fecha_fin: string;
      anio_cargo: number | null;
    }[],
  };
}

export async function previewImportarPlanillaAction(base64: string): Promise<ImportPreview | { error: string }> {
  // Mismo gate que TODAS las demás escrituras de vacaciones. Antes pedía
  // requireArea("logistica","write"), así que alguien sin permiso sobre la
  // subsección Vacaciones podía reescribir los saldos de la dotación entera
  // desde acá — y es justo la escritura que peor auditaba.
  await requireSeccion("choferes_vacaciones", "write");
  if (!base64 || base64.length > 15_000_000) return { error: "Archivo inválido o demasiado grande." };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer", cellDates: true });
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es el Excel de la planilla (.xlsx)?" };
  }

  const cantidad = hoja(wb, /cantidad de dias/);
  const cronoChoferes = hoja(wb, /cronograma choferes/);
  const cronoOfi = hoja(wb, /cronograma ofi/);
  const hoja2 = hoja(wb, /^hoja2$/);
  const taller = hoja(wb, /taller/);
  if (cantidad.length === 0 && cronoChoferes.length === 0) {
    return { error: "El archivo no tiene las hojas esperadas (CANTIDAD DE DIAS / CRONOGRAMA CHOFERES). ¿Es la planilla de vacaciones?" };
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { choferes, anios, periodos } = await estadoActual(sb);

  const empleados: EmpleadoRef[] = choferes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    activo: c.estado === "activo",
  }));
  const matcher = crearMatcher(empleados);

  const hoy = new Date().toISOString().slice(0, 10);
  const anioActual = new Date().getFullYear();
  const avisos: string[] = [];
  const sinMatchSet = new Set<string>();

  // ── saldos por año según la planilla (TALLER/Hoja2 pisan a CANTIDAD) ───────
  const planillaPorId = new Map<string, { empleado: EmpleadoRef; porAnio: Map<number, number> }>();
  const cargarSaldos = (lista: SaldoPlanilla[]) => {
    for (const s of lista) {
      const m = matcher(s.nombre);
      if (m.tipo === "ambiguo") {
        avisos.push(`"${s.nombre}" es ambiguo entre ${m.candidatos.join(" / ")} — no se importa su saldo`);
        continue;
      }
      if (m.tipo === "sin_match") {
        sinMatchSet.add(s.nombre);
        continue;
      }
      if (!m.empleado.activo) {
        avisos.push(`${m.empleado.apellido}, ${m.empleado.nombre} figura en la planilla pero está de baja en el sistema`);
        continue;
      }
      const e = planillaPorId.get(m.empleado.id) ?? { empleado: m.empleado, porAnio: new Map<number, number>() };
      for (const [anio, v] of s.porAnio) e.porAnio.set(anio, v);
      planillaPorId.set(m.empleado.id, e);
    }
  };
  cargarSaldos(parseCantidad(cantidad));
  cargarSaldos(parseBloquesAnio(hoja2));
  cargarSaldos(parseBloquesAnio(taller));

  // ── estado actual del sistema ──────────────────────────────────────────────
  const otorgadosPor = new Map<string, Map<number, number>>();
  const origenPor = new Map<string, Map<number, string>>();
  for (const a of anios) {
    const m = otorgadosPor.get(a.chofer_id) ?? new Map<number, number>();
    m.set(a.anio, a.dias_correspondientes ?? 0);
    otorgadosPor.set(a.chofer_id, m);
    const o = origenPor.get(a.chofer_id) ?? new Map<number, string>();
    o.set(a.anio, a.origen ?? "antiguedad");
    origenPor.set(a.chofer_id, o);
  }
  const usadosPor = new Map<string, Map<number, number>>();
  for (const p of periodos) {
    if (p.anio_cargo == null) continue;
    const m = usadosPor.get(p.chofer_id) ?? new Map<number, number>();
    m.set(p.anio_cargo, (m.get(p.anio_cargo) ?? 0) + diasEntre(p.fecha_inicio, p.fecha_fin));
    usadosPor.set(p.chofer_id, m);
  }

  // ── períodos del cronograma que el sistema no tiene (vigentes/futuros) ─────
  // Solo miramos las últimas semanas hacia adelante: lo histórico ya está
  // cargado y sus apodos viejos no deben ensuciar la lista de "sin match".
  const corte = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const presencias = [...parseCronograma(cronoChoferes), ...parseCronograma(cronoOfi)].filter(
    (p) => p.fecha >= corte,
  );
  const { rangos, sinMatch: sinMatchCrono } = rangosPorPersona(presencias, matcher);
  for (const n of sinMatchCrono) sinMatchSet.add(n);

  const periodosNuevos: ImportPeriodoNuevo[] = [];
  for (const r of rangos) {
    if (r.fecha_fin < hoy) continue; // histórico: no se importa desde acá
    if (!r.empleado.activo) continue;
    const solapa = periodos.some(
      (p) => p.chofer_id === r.empleado.id && p.fecha_inicio <= r.fecha_fin && p.fecha_fin >= r.fecha_inicio,
    );
    if (solapa) continue;
    if (r.dias > 35) {
      avisos.push(`${r.empleado.apellido}: rango de ${r.dias} días (${r.fecha_inicio} → ${r.fecha_fin}) parece un error de la planilla — no se propone`);
      continue;
    }
    periodosNuevos.push({
      chofer_id: r.empleado.id,
      empleado: `${r.empleado.apellido}, ${r.empleado.nombre}`,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      dias: r.dias,
    });
  }

  // ── diferencias de saldos (solo año pasado y actual) ───────────────────────
  const saldosCambios: ImportSaldoCambio[] = [];
  for (const { empleado, porAnio } of planillaPorId.values()) {
    // los períodos nuevos de esta importación ya van a descontar: se simulan
    const diasNuevos = periodosNuevos
      .filter((p) => p.chofer_id === empleado.id)
      .reduce((a, p) => a + p.dias, 0);
    for (const anio of [anioActual - 1, anioActual]) {
      const v = porAnio.get(anio);
      if (v == null) continue;
      const otorgados = otorgadosPor.get(empleado.id)?.get(anio) ?? 0;
      const usados = usadosPor.get(empleado.id)?.get(anio) ?? 0;
      const saldoActual = otorgados - usados;
      // la planilla ya suele tener neteados los períodos que estamos por
      // importar: si coincide contemplándolos, no hay nada que cambiar
      if (v === saldoActual || v === saldoActual - diasNuevos) continue;
      saldosCambios.push({
        chofer_id: empleado.id,
        empleado: `${empleado.apellido}, ${empleado.nombre}`,
        anio,
        saldo_planilla: v,
        saldo_actual: saldoActual,
        otorgados_nuevo: v + usados,
        otorgados_actual: otorgados,
        origen_actual: origenPor.get(empleado.id)?.get(anio) ?? "antiguedad",
      });
    }
    const viejos = [...porAnio.entries()].filter(([a, v]) => a < anioActual - 1 && v > 0);
    if (viejos.length > 0) {
      avisos.push(
        `${empleado.apellido}: la planilla muestra saldos de años vencidos (${viejos.map(([a, v]) => `${a}: ${v}`).join(", ")}) — el sistema los considera vencidos, no se importan`,
      );
    }
  }

  saldosCambios.sort((a, b) => a.empleado.localeCompare(b.empleado) || a.anio - b.anio);
  return {
    periodos: periodosNuevos,
    saldos: saldosCambios,
    sinMatch: [...sinMatchSet].sort(),
    avisos,
  };
}

export async function aplicarImportarPlanillaAction(data: {
  periodos: { chofer_id: string; fecha_inicio: string; fecha_fin: string }[];
  saldos: { chofer_id: string; anio: number; dias_correspondientes: number }[];
}) {
  const user = await requireSeccion("choferes_vacaciones", "write");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const hoyStr = new Date().toLocaleDateString("es-AR");
  const errores: string[] = [];

  // 1) Saldos primero (así los períodos nuevos se imputan sobre lo actualizado).
  let saldosAplicados = 0;
  let respetados = 0;
  for (const s of (data.saldos ?? []).slice(0, 300)) {
    const dias = Math.trunc(Number(s.dias_correspondientes));
    if (!Number.isFinite(dias) || dias < 0 || !Number.isInteger(s.anio)) {
      errores.push("Saldo inválido");
      continue;
    }
    // Se relee la fila destino en vez de confiar en lo que mandó el cliente: la
    // regla "lo que cargó una persona no lo pisa un automático" tiene que valer
    // aunque alguien llame la action a mano.
    const { data: destino } = await sb
      .from("chofer_vacaciones_anios")
      .select("dias_correspondientes, origen")
      .eq("chofer_id", s.chofer_id)
      .eq("anio", s.anio)
      .maybeSingle();
    if (destino?.origen === "humano") {
      respetados++;
      continue;
    }
    const previoDias: number | null = destino?.dias_correspondientes ?? null;
    const previoOrigen: string | null = destino?.origen ?? null;

    const { error } = await sb.from("chofer_vacaciones_anios").upsert(
      {
        chofer_id: s.chofer_id,
        anio: s.anio,
        dias_correspondientes: dias,
        // La procedencia va en `origen`. Antes se machacaba la observación con
        // "Importado de planilla (fecha)", pisando lo que hubiera escrito una
        // persona para justificar ese número.
        observaciones: null,
        origen: "planilla",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chofer_id,anio" },
    );
    if (error) {
      errores.push("No se pudo actualizar un saldo");
      continue;
    }
    saldosAplicados++;
    // Con el valor ANTERIOR. Antes iba `null` aunque el upsert pisaba: es la
    // firma exacta del caso Trejo — quedaba la constancia de que se importó 16 y
    // ninguna de que había 28, así que no se podía ni revertir ni explicar.
    await logChoferAudit(
      s.chofer_id,
      "vacaciones_saldo_editado",
      { anio: s.anio, dias_correspondientes: previoDias, origen: previoOrigen },
      { anio: s.anio, dias_correspondientes: dias, origen: "import_planilla" },
      user.id,
      { tipo: "chofer_vacaciones_anio", id: `${s.chofer_id}:${s.anio}` },
    );
  }

  // 2) Períodos nuevos, imputados al año más viejo con saldo.
  let periodosCreados = 0;
  for (const p of (data.periodos ?? []).slice(0, 200)) {
    if (!p.fecha_inicio || !p.fecha_fin || p.fecha_fin < p.fecha_inicio) {
      errores.push("Período con fechas inválidas");
      continue;
    }
    const { data: solapados } = await sb
      .from("chofer_ausencias")
      .select("id")
      .eq("chofer_id", p.chofer_id)
      .is("deleted_at", null)
      .lte("fecha_inicio", p.fecha_fin)
      .gte("fecha_fin", p.fecha_inicio)
      .limit(1);
    if ((solapados ?? []).length > 0) {
      errores.push("Un período se solapa con una ausencia ya cargada");
      continue;
    }
    const [{ data: aniosCh }, { data: periodosCh }] = await Promise.all([
      sb
        .from("chofer_vacaciones_anios")
        .select("anio, dias_correspondientes, observaciones")
        .eq("chofer_id", p.chofer_id)
        .order("anio"),
      sb
        .from("chofer_ausencias")
        .select("fecha_inicio, fecha_fin, anio_cargo")
        .eq("chofer_id", p.chofer_id)
        .eq("es_vacaciones", true)
        .is("deleted_at", null)
        .not("anio_cargo", "is", null),
    ]);
    const usados = new Map<number, number>();
    for (const x of (periodosCh ?? []) as { fecha_inicio: string; fecha_fin: string; anio_cargo: number }[]) {
      usados.set(x.anio_cargo, (usados.get(x.anio_cargo) ?? 0) + diasEntre(x.fecha_inicio, x.fecha_fin));
    }
    const saldos = saldosPorAnio(
      ((aniosCh ?? []) as { anio: number; dias_correspondientes: number; observaciones: string | null }[]).map((r) => ({
        anio: r.anio,
        dias: r.dias_correspondientes ?? 0,
        observaciones: r.observaciones,
      })),
      usados,
    );
    const { data: creada, error } = await sb
      .from("chofer_ausencias")
      .insert({
        chofer_id: p.chofer_id,
        tipo: "Vacaciones",
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        estado: "autorizada",
        autorizado_por: user.id,
        observaciones: `Importado de planilla (${hoyStr})`,
        es_vacaciones: true,
        justificada: true,
        anio_cargo: anioParaImputar(saldos, p.fecha_inicio),
        origen: "planilla",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      errores.push("No se pudo crear un período");
      continue;
    }
    periodosCreados++;
    // Con el id del período. Antes el alta quedaba a nombre del chofer mientras
    // las ediciones y cancelaciones posteriores del MISMO período se auditaban
    // como chofer_ausencia: la cadena de vida arrancaba huérfana.
    await logChoferAudit(
      p.chofer_id,
      "ausencia_creada",
      null,
      { tipo: "Vacaciones", fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin, origen: "import_planilla" },
      user.id,
      creada?.id ? { tipo: "chofer_ausencia", id: creada.id as string } : undefined,
    );
  }

  revalidatePath("/choferes/vacaciones");
  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/viajes");
  return { success: true, periodosCreados, saldosAplicados, respetados, errores };
}
