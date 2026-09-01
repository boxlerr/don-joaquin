import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { traerTodo } from "@/lib/supabase/traer-todo";
import { hoyArgentina } from "@/lib/fecha-ar";
import {
  construirProyeccion,
  mergeTopesFinanzas,
  TOPES_FINANZAS_CLAVE,
  type Cobertura,
  type Compromiso,
  type FacturacionMes,
  type FuenteEgreso,
  type MesProyectado,
  type TopesFinanzas,
} from "@/domain/finanzas/proyeccion";

/**
 * De dónde sale cada peso de la proyección.
 *
 * Vive acá y no en `prevision/actions.ts` porque tiene DOS consumidores que no
 * pueden decir cosas distintas: la pantalla `/prevision` y el aviso que sale por
 * la campana y por mail. Si cada uno armara su propia cuenta, tarde o temprano
 * el mail avisaría de un mes que la pantalla muestra en verde — y el que pierde
 * la discusión es el sistema.
 *
 * **La `cobertura` de cada fuente se declara acá y no se adivina**, porque es lo
 * que hace que el total sea honesto: el número SIEMPRE es un piso, y la
 * pantalla tiene que poder decir cuánto le falta y por qué. Bárbara ya avisó
 * que no van a cargar todos los costos — *"lo cual por el momento no va a
 * suceder"*—, así que un total que subestima en silencio no le sirve a nadie.
 */

/** Cuántos meses hacia adelante mira la proyección. */
export const MESES_ADELANTE = 6;
/** Cuántos meses cerrados se leen para promediar la facturación. */
const MESES_HISTORICO = 12;

function mesDeISO(iso: string): string {
  return iso.slice(0, 7);
}

export function sumarMeses(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export type DatosPrevision = {
  proyeccion: MesProyectado[];
  topes: TopesFinanzas;
  /** Fuentes que hoy no pueden aportar, con el motivo en palabras. */
  faltantes: { fuente: FuenteEgreso; motivo: string }[];
};

/**
 * Arma la proyección leyendo la base. **No verifica permisos**: el que llama
 * decide (la pantalla exige `prevision:read`; el cron corre sin usuario).
 */
export async function cargarPrevision(): Promise<DatosPrevision> {
  const supabase = createAdminClient();

  const hoy = hoyArgentina();
  const mesActual = mesDeISO(hoy);
  const hasta = sumarMeses(mesActual, MESES_ADELANTE);
  const desdeHistorico = `${sumarMeses(mesActual, -MESES_HISTORICO)}-01`;

  const [paramTopes, cuotas, chequesPropios, sueldosBase, viajes, ausencias] = await Promise.all([
    supabase.from("parametros_sistema").select("valor").eq("clave", TOPES_FINANZAS_CLAVE).maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("prestamo_cuotas")
      .select("id, nro, fecha_vencimiento, importe, prestamo:prestamos!inner(banco, estado)")
      .eq("pagada", false)
      .gte("fecha_vencimiento", `${mesActual}-01`)
      .lte("fecha_vencimiento", `${hasta}-31`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("cheques")
      .select("id, numero, importe, fecha_vencimiento, entregado_a")
      .eq("origen", "propio")
      .in("estado", ["emitido", "entregado"])
      .gte("fecha_vencimiento", `${mesActual}-01`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("sueldos_admin_aumentos")
      .select("chofer_id, vigente_desde, sueldo_base")
      .lte("vigente_desde", `${mesActual}-01`)
      .order("vigente_desde", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traerTodo<any>(
      (from: number, to: number) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("viajes")
          .select("fecha_viaje, monto_flete, moneda, tipo_cambio")
          .not("monto_flete", "is", null)
          .gte("fecha_viaje", desdeHistorico)
          .lt("fecha_viaje", `${mesActual}-01`)
          .order("id")
          .range(from, to),
      { etiqueta: "facturación histórica para la previsión" },
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_ausencias")
      .select("chofer_id, fecha_inicio, fecha_fin")
      .is("deleted_at", null)
      .gte("fecha_fin", `${mesActual}-01`)
      .lte("fecha_inicio", `${hasta}-31`),
  ]);

  // ── Compromisos ───────────────────────────────────────────────────────────
  const compromisos: Compromiso[] = [];

  for (const c of (cuotas.data ?? []) as {
    id: string;
    nro: number;
    fecha_vencimiento: string;
    importe: number;
    prestamo: { banco: string; estado: string } | { banco: string; estado: string }[];
  }[]) {
    const pr = Array.isArray(c.prestamo) ? c.prestamo[0] : c.prestamo;
    if (!pr || pr.estado === "cancelado") continue;
    compromisos.push({
      fuente: "prestamos",
      fecha: c.fecha_vencimiento,
      monto: Number(c.importe) || 0,
    });
  }

  for (const c of (chequesPropios.data ?? []) as {
    numero: string | null;
    importe: number;
    fecha_vencimiento: string;
    entregado_a: string | null;
  }[]) {
    compromisos.push({
      fuente: "cheques",
      fecha: c.fecha_vencimiento,
      monto: Number(c.importe) || 0,
    });
  }

  // Sueldos: el último básico vigente de cada persona, repetido hacia adelante.
  // No es una predicción fina —no contempla aumentos futuros ni el aguinaldo—,
  // y por eso la fuente va declarada como parcial.
  const baseVigente = new Map<string, number>();
  for (const r of (sueldosBase.data ?? []) as {
    chofer_id: string;
    vigente_desde: string;
    sueldo_base: number;
  }[]) {
    const base = Number(r.sueldo_base) || 0;
    if (base > 0) baseVigente.set(String(r.chofer_id), base);
  }
  const sueldoMensual = [...baseVigente.values()].reduce((a, b) => a + b, 0);
  if (sueldoMensual > 0) {
    for (let i = 0; i < MESES_ADELANTE; i++) {
      const mes = sumarMeses(mesActual, i);
      compromisos.push({
        fuente: "sueldos",
        fecha: `${mes}-01`,
        monto: sueldoMensual,
      });
    }
  }

  // ── Facturación histórica ─────────────────────────────────────────────────
  const porMes = new Map<string, number>();
  for (const v of (viajes ?? []) as {
    fecha_viaje: string | null;
    monto_flete: number | null;
    moneda: string | null;
    tipo_cambio: number | null;
  }[]) {
    if (!v.fecha_viaje) continue;
    const monto =
      v.moneda === "USD"
        ? Number(v.monto_flete ?? 0) * Number(v.tipo_cambio ?? 0)
        : Number(v.monto_flete ?? 0);
    if (!monto) continue;
    const mes = mesDeISO(v.fecha_viaje);
    porMes.set(mes, (porMes.get(mes) ?? 0) + monto);
  }
  const historicoFacturacion: FacturacionMes[] = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, monto]) => ({ mes, monto }));

  // ── Ausentes por mes ──────────────────────────────────────────────────────
  // Es el cruce que ella nombró y que nadie hacía: seis choferes de vacaciones
  // son seis camiones que no facturan.
  const ausentesPorMes: Record<string, number> = {};
  for (let i = 0; i < MESES_ADELANTE; i++) {
    const mes = sumarMeses(mesActual, i);
    const ini = `${mes}-01`;
    const fin = `${mes}-31`;
    const gente = new Set<string>();
    for (const a of (ausencias.data ?? []) as {
      chofer_id: string;
      fecha_inicio: string;
      fecha_fin: string;
    }[]) {
      if (a.fecha_inicio <= fin && a.fecha_fin >= ini) gente.add(a.chofer_id);
    }
    ausentesPorMes[mes] = gente.size;
  }

  // ── Cobertura: qué tan completa está cada fuente HOY ──────────────────────
  const cobertura: Record<FuenteEgreso, Cobertura> = {
    prestamos: "firme",
    cheques: "firme",
    sueldos: sueldoMensual > 0 ? "parcial" : "sin_datos",
    // `impuesto_vencimientos` guarda la fecha y si se presentó, pero NO el
    // monto. Sin importe no puede aportar un peso a la cuenta.
    impuestos: "sin_datos",
  };

  const faltantes: DatosPrevision["faltantes"] = [
    {
      fuente: "impuestos" as const,
      motivo: "El sistema guarda cuándo vence cada impuesto, pero no cuánto se paga.",
    },
    ...(cobertura.sueldos === "parcial"
      ? [
          {
            fuente: "sueldos" as const,
            motivo:
              "Entra la planilla de administración y taller. La liquidación de choferes se hace fuera del sistema.",
          },
        ]
      : [
          {
            fuente: "sueldos" as const,
            motivo: "No hay ninguna planilla de sueldos cargada.",
          },
        ]),
  ];

  let topes = mergeTopesFinanzas(null);
  if (paramTopes.data?.valor) {
    try {
      topes = mergeTopesFinanzas(JSON.parse(paramTopes.data.valor as string));
    } catch {
      // Un JSON roto en parámetros no puede dejar la pantalla sin abrir.
    }
  }

  const proyeccion = construirProyeccion({
    compromisos,
    historicoFacturacion,
    ausentesPorMes,
    cobertura,
    topes,
    mesActual,
    meses: MESES_ADELANTE,
  });

  return { proyeccion, topes, faltantes };
}
