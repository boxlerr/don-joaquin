import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { traerTodo } from "@/lib/supabase/traer-todo";
import { procesarNotificacionesCriticas } from "@/lib/notificaciones";
import { ENTIDAD_TIPOS_CADUCAN, HITOS_PERIODO_PRUEBA } from "@/lib/alertas-routing";
import {
  documentoRenovado,
  disparoPrestamo,
  semanalDeSemanaPasada,
  preavisoPrestamoPasado,
} from "@/lib/alertas-obsoletas";
import { hoyArgentina } from "@/lib/fecha-ar";
import { ensureProximoForm931 } from "@/app/(dashboard)/compliance/form-931/periodo";

// Hitos de antigüedad (en años) para los que se emite una alerta de aniversario.
// Los hitos más "rutinarios" (1/2/3/4) se omiten a propósito para no sobrecargar alertas.
const HITOS_ANIVERSARIO = [5, 10, 15, 20, 25, 30, 35, 40];

async function getUmbralesAlertas() {
  const supabase = createAdminClient();
  const claves = [
    "dias_alerta_vencimiento_default",
    "dias_alerta_cheque",
    "alerta_critico_dias",
    "alerta_viatico_pendiente_dias",
    "alerta_viaje_sin_cerrar_horas",
    "alerta_cumple_dias_preaviso",
    "alerta_aniversario_dias_preaviso",
    "alerta_ausencia_dias_preaviso",
    "alerta_insumo_precio_meses",
  ];

  const { data } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .in("clave", claves);

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const num = Number(row.valor);
    if (Number.isFinite(num)) map[row.clave] = num;
  }

  return {
    diasVencimientoDoc: map["dias_alerta_vencimiento_default"] ?? 30,
    diasVencimientoCheque: map["dias_alerta_cheque"] ?? 30,
    diasCritico: map["alerta_critico_dias"] ?? 7,
    diasViaticoPendiente: map["alerta_viatico_pendiente_dias"] ?? 7,
    horasViajeSinCerrar: map["alerta_viaje_sin_cerrar_horas"] ?? 48,
    diasCumplePreaviso: map["alerta_cumple_dias_preaviso"] ?? 30,
    diasAniversarioPreaviso: map["alerta_aniversario_dias_preaviso"] ?? 30,
    diasAusenciaPreaviso: map["alerta_ausencia_dias_preaviso"] ?? 7,
    mesesInsumoPrecio: map["alerta_insumo_precio_meses"] ?? 3,
  };
}

/** Suma `n` días a una fecha ISO (YYYY-MM-DD) y devuelve la nueva en el mismo formato. */
function sumarDiasISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Rollover automático de los vencimientos PERIÓDICOS a nivel EMPRESA (certificado de
 * cobertura c/30, libre deuda sindical c/120, pólizas anuales…). Si el último documento
 * de un requisito con `dias_periodicidad` ya venció, crea el/los siguiente(s) sumando el
 * período hasta que la próxima fecha caiga en el futuro, así las alertas nunca se cortan.
 * Idempotente y best-effort (nunca lanza). El F931 tiene su propio rollover (día 20).
 */
async function ensureProximosPeriodicos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  hoyIso: string,
): Promise<void> {
  try {
    const { data: reqs } = await supabase
      .from("compliance_requisitos")
      .select("id, dias_periodicidad")
      .eq("nivel", "empresa")
      .not("dias_periodicidad", "is", null);

    for (const req of (reqs ?? []) as { id: string; dias_periodicidad: number }[]) {
      if (!req.dias_periodicidad || req.dias_periodicidad <= 0) continue;

      const { data: ultimo } = await supabase
        .from("compliance_documentos")
        .select("fecha_vencimiento")
        .eq("requisito_id", req.id)
        .is("chofer_id", null)
        .is("camion_id", null)
        .not("fecha_vencimiento", "is", null)
        .order("fecha_vencimiento", { ascending: false })
        .limit(1)
        .maybeSingle();
      const venc = ultimo?.fecha_vencimiento as string | undefined;
      if (!venc || venc >= hoyIso) continue; // sin doc o el más reciente aún no venció

      let next = venc;
      // <= hoyIso: el próximo doc queda SIEMPRE en el futuro (nunca vence "hoy"),
      // así entra en la ventana de disparos 30/15/5 en las próximas corridas.
      for (let i = 0; i < 120 && next <= hoyIso; i++) next = sumarDiasISO(next, req.dias_periodicidad);
      if (next <= hoyIso) continue; // tope de seguridad: no convergió

      const { data: yaHay } = await supabase
        .from("compliance_documentos")
        .select("id")
        .eq("requisito_id", req.id)
        .is("chofer_id", null)
        .is("camion_id", null)
        .eq("fecha_vencimiento", next)
        .maybeSingle();
      if (yaHay?.id) continue;

      await supabase.from("compliance_documentos").insert({
        requisito_id: req.id,
        fecha_vencimiento: next,
        observaciones: "Renovación automática — ajustá la fecha real si difiere.",
      });
    }
  } catch (e) {
    console.error("ensureProximosPeriodicos:", e);
  }
}

/**
 * Apaga las efemérides cuya fecha ya pasó (cumpleaños, aniversarios, fin de
 * período de prueba).
 *
 * La fila nacía 'pendiente' con `fecha_vencimiento` = el día del evento y nada
 * la resolvía después, así que un cumpleaños de julio seguía llegando en agosto
 * — y encima como "Venció el 30/07/2026", que para un cumpleaños no significa
 * nada. Un documento vencido sí se sigue reclamando; un evento que pasó no tiene
 * ninguna acción posible.
 *
 * Cubre las efemérides y también las ausencias programadas (ver
 * ENTIDAD_TIPOS_CADUCAN): el aviso de ausencia existe para saber que alguien no
 * va a estar, así que apenas arranca deja de servir. Una del 13 de julio seguía
 * llegando el 5 de agosto.
 *
 * Se hace acá, sobre `estado`, porque TODA la app (pantalla, campana, badge y
 * mail) filtra por `estado = 'pendiente'`: apagarlas de raíz las saca de los
 * cinco lados a la vez. No toca el dedup: la clave incluye la fecha del evento
 * y las efemérides sólo se generan a futuro, así que resolver la del año pasado
 * no impide la del que viene. Best-effort: si falla, la generación sigue.
 *
 * `hoyIso` TIENE que ser la fecha argentina y no la de `toISOString()`: apagar
 * de más acá no tiene vuelta atrás. Con UTC, apretar "Actualizar alertas" un
 * 30/07 a las 21:30 ART marcaba resuelto el cumpleaños de HOY, y no se
 * regeneraba nunca — el bloque de cumpleaños descarta los `diffDays < 0` y el
 * del año siguiente queda a 364 días, fuera del preaviso.
 */
async function resolverEventosCaducos(
  supabase: ReturnType<typeof createAdminClient>,
  hoyIso: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("alertas")
      .update({ estado: "resuelta" })
      .eq("estado", "pendiente")
      .eq("tipo", "otro")
      .in("entidad_tipo", [...ENTIDAD_TIPOS_CADUCAN])
      .lt("fecha_vencimiento", hoyIso);
    if (error) console.error("[alertas] resolverEventosCaducos:", error);
  } catch (e) {
    console.error("[alertas] resolverEventosCaducos:", e);
  }
}

/** Parte una lista en tandas, para no armar un `in(...)` de mil ids. */
function enTandas<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function marcarResueltas(
  supabase: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<number> {
  let n = 0;
  for (const tanda of enTandas(ids, 200)) {
    const { error } = await supabase
      .from("alertas")
      .update({ estado: "resuelta" })
      .eq("estado", "pendiente")
      .in("id", tanda);
    if (error) console.error("[alertas] marcarResueltas:", error);
    else n += tanda.length;
  }
  return n;
}

/**
 * Apaga los reclamos que el trabajo del día ya dejó sin objeto.
 *
 * `resolverEventosCaducos` apaga lo que se termina solo al pasar la fecha. Esto
 * apaga la otra mitad, la que sí depende de que alguien haga algo: el documento
 * que se renovó y la cuota que se pagó. Faltaba por completo, y era la queja de
 * Ana del 10/08 — cargó 45 documentos el sábado y el lunes se los reclamaron
 * todos de nuevo, porque la alerta se quedó con la fecha vieja congelada.
 *
 * Tres cosas, todas sobre `estado` (que es por donde filtran pantalla, campana,
 * badge y mail) y todas best-effort: si algo falla, la generación sigue.
 *
 *  1. Documento renovado. La alerta guarda `fecha_vencimiento`; si el documento
 *     hoy vence después, sobra. Se mira en las tres tablas donde puede vivir un
 *     documento (chofer, camión y los de nivel empresa de compliance).
 *  2. Cuota pagada. El generador ya no las mira (`pagada = false`), pero las que
 *     habían quedado pendientes no se apagaban solas: 9 cuotas ya pagadas
 *     seguían reclamándose.
 *  3. Preaviso de préstamo que quedó atrás — el recordatorio de la semana pasada
 *     y el "mañana vence" de una cuota que ya venció. La alerta de vencido no se
 *     toca: ésa se reclama hasta que se pague.
 *
 * El aviso vuelve a salir solo cuando el documento renovado entre de nuevo en la
 * ventana de 30 días: la clave de dedup incluye la fecha de vencimiento, así que
 * la fecha nueva es una alerta nueva.
 */
async function resolverAlertasObsoletas(
  supabase: ReturnType<typeof createAdminClient>,
  hoyIso: string,
  lunesActual: string,
): Promise<void> {
  // --- 1. Documentos ya renovados ---
  try {
    const { data: pendientes } = await supabase
      .from("alertas")
      .select("id, tipo, entidad_id, entidad_tipo, fecha_vencimiento")
      .eq("estado", "pendiente")
      .in("tipo", ["vencimiento_doc_chofer", "vencimiento_doc_camion", "vencimiento_compliance"])
      .not("entidad_id", "is", null)
      .not("fecha_vencimiento", "is", null);

    // El F931 también entra como 'vencimiento_compliance' pero su entidad_id es
    // una presentación, no un documento: se apaga cuando se marcan los dos envíos.
    const candidatas = (pendientes ?? []).filter(
      (a) => a.tipo !== "vencimiento_compliance" || (a.entidad_tipo ?? "").startsWith("compliance:"),
    );

    if (candidatas.length > 0) {
      const ids = [...new Set(candidatas.map((a) => a.entidad_id!))];
      const vencActual = new Map<string, string>();
      for (const tabla of ["chofer_documentos", "camion_documentos", "compliance_documentos"]) {
        for (const tanda of enTandas(ids, 200)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from(tabla)
            .select("id, fecha_vencimiento")
            .in("id", tanda);
          for (const d of (data ?? []) as { id: string; fecha_vencimiento: string | null }[]) {
            if (d.fecha_vencimiento) vencActual.set(d.id, d.fecha_vencimiento);
          }
        }
      }

      const renovadas = candidatas
        .filter((a) => documentoRenovado(a.fecha_vencimiento, vencActual.get(a.entidad_id!)))
        .map((a) => a.id);
      if (renovadas.length > 0) {
        const n = await marcarResueltas(supabase, renovadas);
        console.log(`[alertas] ${n} aviso(s) de documentos ya renovados`);
      }
    }
  } catch (e) {
    console.error("[alertas] resolverAlertasObsoletas/documentos:", e);
  }

  // --- 2 y 3. Préstamos: cuota pagada o preaviso que quedó atrás ---
  try {
    const { data: pendPrestamo } = await supabase
      .from("alertas")
      .select("id, entidad_id, entidad_tipo, fecha_vencimiento")
      .eq("estado", "pendiente")
      .eq("tipo", "otro")
      .like("entidad_tipo", "prestamo_cuota:%");

    const filas = pendPrestamo ?? [];
    if (filas.length > 0) {
      const pagadas = new Set<string>();
      const idsCuota = [...new Set(filas.map((a) => a.entidad_id).filter(Boolean))] as string[];
      for (const tanda of enTandas(idsCuota, 200)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("prestamo_cuotas")
          .select("id, pagada")
          .eq("pagada", true)
          .in("id", tanda);
        for (const c of (data ?? []) as { id: string }[]) pagadas.add(c.id);
      }

      const obsoletas = filas
        .filter(
          (a) =>
            (a.entidad_id && pagadas.has(a.entidad_id)) ||
            semanalDeSemanaPasada(a.entidad_tipo, lunesActual) ||
            preavisoPrestamoPasado(a.entidad_tipo, a.fecha_vencimiento, hoyIso),
        )
        .map((a) => a.id);
      if (obsoletas.length > 0) {
        const n = await marcarResueltas(supabase, obsoletas);
        console.log(`[alertas] ${n} aviso(s) de cuotas pagadas o preavisos vencidos`);
      }
    }
  } catch (e) {
    console.error("[alertas] resolverAlertasObsoletas/prestamos:", e);
  }
}

export async function generarAlertas() {
  const supabase = createAdminClient();
  const hoy = new Date();
  // Día de hoy en ARGENTINA. El server corre en UTC (no hay TZ en vercel.json ni
  // en next.config.ts), así que de las 21:00 ART en adelante `toISOString()` ya
  // devolvía mañana y TODOS los cortes contra la base —que guarda fechas
  // argentinas— se corrían un día: el más caro era el de resolverEventosCaducos,
  // que apagaba para siempre el evento del día.
  const hoyStr = hoyArgentina();

  // Lunes de la semana en curso. Se usa como ancla de los recordatorios
  // semanales: la clave del aviso incluye este lunes, así sale una vez por
  // semana y vuelve a salir el lunes siguiente mientras siga pendiente.
  const lunesDeLaSemana = (() => {
    const d = new Date(hoy);
    const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
    d.setUTCDate(d.getUTCDate() - dow);
    return d.toISOString().split("T")[0]!;
  })();

  const umbrales = await getUmbralesAlertas();

  const enDocDias = new Date(hoy);
  enDocDias.setDate(hoy.getDate() + umbrales.diasVencimientoDoc);
  const enDocStr = enDocDias.toISOString().split("T")[0]!;

  const enChequeDias = new Date(hoy);
  enChequeDias.setDate(hoy.getDate() + umbrales.diasVencimientoCheque);
  const enChequeStr = enChequeDias.toISOString().split("T")[0]!;

  // Antes de mirar qué hay pendiente, apagar lo que ya no tiene sentido: las
  // efemérides que ocurrieron y los reclamos que alguien ya resolvió (documento
  // renovado, cuota pagada). Tiene que ir ANTES de leer `existentes`, si no las
  // alertas viejas bloquean por dedup la regeneración de las nuevas.
  await resolverEventosCaducos(supabase, hoyStr);
  await resolverAlertasObsoletas(supabase, hoyStr, lunesDeLaSemana);

  const { data: existentes } = await supabase
    .from("alertas")
    .select("entidad_id, entidad_tipo, tipo, fecha_vencimiento")
    .or(`estado.eq.pendiente,fecha_vencimiento.gte.${hoyStr}`);

  // La clave incluye SIEMPRE la fecha de vencimiento. Los avisos de documentos
  // deduplicaban sólo por `tipo:entidad_id`, así que una vez emitido el aviso de
  // un documento no volvía a salir NUNCA para ese documento: al renovarse, la
  // alerta vieja seguía viva con la fecha vieja y la nueva no podía nacer.
  // Con la fecha adentro, renovar un documento es un aviso nuevo cuando vuelva a
  // entrar en la ventana de 30 días, y la misma fecha sigue sin duplicarse.
  const existentesSet = new Set(
    (existentes ?? []).map((a) => `${a.tipo}:${a.entidad_id}:${a.entidad_tipo}:${a.fecha_vencimiento}`)
  );

  type NuevaAlerta = {
    tipo: string;
    severidad: string;
    titulo: string;
    mensaje: string;
    entidad_id: string | null;
    entidad_tipo: string;
    fecha_disparo: string;
    fecha_vencimiento?: string;
  };
  const nuevasAlertas: NuevaAlerta[] = [];

  // Camion documentos próximos a vencer
  const { data: docsCAMION } = await supabase
    .from("camion_documentos")
    .select("id, camion_id, fecha_vencimiento, camiones(patente), tipos_documento(nombre)")
    .not("fecha_vencimiento", "is", null)
    .lte("fecha_vencimiento", enDocStr)
    .gte("fecha_vencimiento", hoyStr);

  for (const doc of docsCAMION ?? []) {
    const key = `vencimiento_doc_camion:${doc.id}:camion_documentos:${doc.fecha_vencimiento}`;
    if (existentesSet.has(key)) continue;
    const camion = doc.camiones as { patente: string } | null;
    const tipoDocCamion = doc.tipos_documento as { nombre: string } | null;
    const patente = camion?.patente ?? "Camión";
    const tipoNombre = tipoDocCamion?.nombre ?? "documento";
    const diasRestantes = Math.ceil(
      (new Date(doc.fecha_vencimiento!).getTime() - hoy.getTime()) / 86400000
    );
    nuevasAlertas.push({
      tipo: "vencimiento_doc_camion",
      severidad: diasRestantes <= umbrales.diasCritico ? "critica" : "advertencia",
      titulo: `Vencimiento: ${tipoNombre} — ${patente}`,
      mensaje: `El documento "${tipoNombre}" del camión ${patente} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`,
      entidad_id: doc.id,
      entidad_tipo: "camion_documentos",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: doc.fecha_vencimiento!,
    });
  }

  // Chofer documentos próximos a vencer
  const { data: docsCHOFER } = await supabase
    .from("chofer_documentos")
    // `estado` para descartar egresados: conservan el legajo pero no generan
    // novedades nuevas (ver lib/chofer-egreso.ts). Sin esto, la licencia vencida
    // de alguien que se fue seguía disparando su mail crítico.
    .select("id, chofer_id, fecha_vencimiento, choferes(nombre, apellido, estado), tipos_documento(nombre)")
    .not("fecha_vencimiento", "is", null)
    .lte("fecha_vencimiento", enDocStr)
    .gte("fecha_vencimiento", hoyStr);

  for (const doc of docsCHOFER ?? []) {
    const key = `vencimiento_doc_chofer:${doc.id}:chofer_documentos:${doc.fecha_vencimiento}`;
    if (existentesSet.has(key)) continue;
    const chofer = doc.choferes as { nombre: string; apellido: string; estado?: string } | null;
    if (chofer?.estado === "baja") continue;
    const tipoDocChofer = doc.tipos_documento as { nombre: string } | null;
    const nombre = chofer ? `${chofer.nombre} ${chofer.apellido}` : "Chofer";
    const tipoNombre = tipoDocChofer?.nombre ?? "documento";
    const diasRestantes = Math.ceil(
      (new Date(doc.fecha_vencimiento!).getTime() - hoy.getTime()) / 86400000
    );
    nuevasAlertas.push({
      tipo: "vencimiento_doc_chofer",
      severidad: diasRestantes <= umbrales.diasCritico ? "critica" : "advertencia",
      titulo: `Vencimiento: ${tipoNombre} — ${nombre}`,
      mensaje: `El documento "${tipoNombre}" del chofer ${nombre} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`,
      entidad_id: doc.id,
      entidad_tipo: "chofer_documentos",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: doc.fecha_vencimiento!,
    });
  }

  // Cheques próximos a vencer: los recibidos en cartera (plata que entra) y los
  // nuestros todavía sin debitar (plata que sale). Filtrar sólo por "cartera"
  // dejaba a los propios sin avisar NUNCA: es un estado que un cheque nuestro
  // jamás tiene, así que uno que vencía mañana no disparaba nada.
  const { data: cheques } = await supabase
    .from("cheques")
    .select("id, librador_nombre, importe, fecha_vencimiento, origen, entregado_a")
    .in("estado", ["cartera", "emitido", "entregado"])
    .lte("fecha_vencimiento", enChequeStr)
    .gte("fecha_vencimiento", hoyStr);

  for (const cheque of cheques ?? []) {
    // Un cheque que cambia de fecha es un aviso nuevo, igual que un documento.
    const key = `vencimiento_cheque:${cheque.id}:cheques:${cheque.fecha_vencimiento}`;
    if (existentesSet.has(key)) continue;
    const diasRestantes = Math.ceil(
      (new Date(cheque.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000
    );
    const esPropio = (cheque as { origen?: string }).origen === "propio";
    const contraparte = esPropio
      ? (cheque as { entregado_a?: string | null }).entregado_a || "sin destinatario"
      : cheque.librador_nombre;
    const importeLabel = `$${Number(cheque.importe).toLocaleString("es-AR")}`;
    nuevasAlertas.push({
      tipo: "vencimiento_cheque",
      severidad: diasRestantes <= umbrales.diasCritico ? "critica" : "advertencia",
      titulo: esPropio
        ? `Cheque nuestro por debitarse — ${contraparte}`
        : `Cheque próximo a vencer — ${contraparte}`,
      mensaje: esPropio
        ? `Cheque nuestro de ${importeLabel} entregado a ${contraparte} se debita en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`
        : `Cheque de ${importeLabel} de ${contraparte} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`,
      entidad_id: cheque.id,
      entidad_tipo: "cheques",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: cheque.fecha_vencimiento,
    });
  }

  // Cumpleaños de todo el personal dentro del preaviso configurado
  const { data: choferesBday } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, fecha_nacimiento, rol")
    .eq("estado", "activo")
    .not("fecha_nacimiento", "is", null);

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  for (const chofer of choferesBday ?? []) {
    const parts = chofer.fecha_nacimiento!.split("-");
    if (parts.length !== 3) continue;

    const birthMonth = parseInt(parts[1]!, 10);
    const birthDay = parseInt(parts[2]!, 10);

    const hoyAnio = hoy.getFullYear();
    const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const anios = [hoyAnio - 1, hoyAnio, hoyAnio + 1];
    let minDiff = Infinity;
    let nextBdayMidnight = new Date();

    for (const anio of anios) {
      const bdayMidnight = new Date(anio, birthMonth - 1, birthDay);
      const diffTime = bdayMidnight.getTime() - hoyMidnight.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < minDiff) {
        minDiff = diffDays;
        nextBdayMidnight = bdayMidnight;
      }
    }

    if (minDiff <= umbrales.diasCumplePreaviso) {
      const yyyy = nextBdayMidnight.getFullYear();
      const mm = String(nextBdayMidnight.getMonth() + 1).padStart(2, "0");
      const dd = String(nextBdayMidnight.getDate()).padStart(2, "0");
      const nextBdayStr = `${yyyy}-${mm}-${dd}`;

      // Adm/mant tienen prioridad sobre choferes → entidad_tipo distinto para ordenar en UI
      const esAdmMant = chofer.rol === "administrativo" || chofer.rol === "mantenimiento";
      const entidadTipoCumple = esAdmMant ? "personal_cumple" : "choferes_cumple";

      const key = `otro:${chofer.id}:${entidadTipoCumple}:${nextBdayStr}`;
      if (existentesSet.has(key)) continue;

      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`;
      const diaMesStr = `${birthDay} de ${MESES[birthMonth - 1]}`;
      const nombreDia = DIAS_SEMANA[nextBdayMidnight.getDay()];
      const rolLabel = chofer.rol === "administrativo" ? "Admin" : chofer.rol === "mantenimiento" ? "Mantenimiento" : "Chofer";

      nuevasAlertas.push({
        tipo: "otro",
        severidad: "info",
        titulo: `Cumpleaños — ${nombreCompleto}`,
        mensaje: `${rolLabel} ${nombreCompleto} cumple años el ${diaMesStr} (${nombreDia}).`,
        entidad_id: chofer.id,
        entidad_tipo: entidadTipoCumple,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: nextBdayStr,
      });
    }
  }

  // Fin de período de prueba (6 meses desde alta_afip o, si no hay, desde fecha_ingreso)
  const { data: choferesIngreso } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, fecha_ingreso, alta_afip, rol")
    .eq("estado", "activo")
    .not("fecha_ingreso", "is", null);

  for (const chofer of choferesIngreso ?? []) {
    // alta_afip tiene prioridad: es la fecha oficial de inicio del período de prueba
    const fechaBase = chofer.alta_afip ?? chofer.fecha_ingreso;
    if (!fechaBase) continue;
    const parts = fechaBase.split("-");
    if (parts.length !== 3) continue;

    const ingresoYear = parseInt(parts[0]!, 10);
    const ingresoMonth = parseInt(parts[1]!, 10);
    const ingresoDay = parseInt(parts[2]!, 10);

    const finPruebaDate = new Date(ingresoYear, ingresoMonth - 1 + 6, ingresoDay);
    const finPruebaMidnight = new Date(finPruebaDate.getFullYear(), finPruebaDate.getMonth(), finPruebaDate.getDate());

    const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diffTime = finPruebaMidnight.getTime() - hoyMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Los días de disparo salen de HITOS_PERIODO_PRUEBA (30/15/5/0), la MISMA
    // lista con la que el mail decide qué mandar: mientras fueron dos listas
    // separadas, el aviso del día 0 no salía nunca por correo.
    if (HITOS_PERIODO_PRUEBA.includes(diffDays)) {
      const yyyy = finPruebaMidnight.getFullYear();
      const mm = String(finPruebaMidnight.getMonth() + 1).padStart(2, "0");
      const dd = String(finPruebaMidnight.getDate()).padStart(2, "0");
      const finPruebaStr = `${yyyy}-${mm}-${dd}`;

      const key = `otro:${chofer.id}:choferes_periodo_prueba:${finPruebaStr}`;
      if (existentesSet.has(key)) continue;

      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`;
      const severidad = diffDays <= 5 ? "critica" : diffDays === 15 ? "advertencia" : "info";

      const finPruebaMonthIndex = finPruebaMidnight.getMonth();
      const finPruebaDayNumber = finPruebaMidnight.getDate();
      const diaMesFinRealStr = `${finPruebaDayNumber} de ${MESES[finPruebaMonthIndex]}`;

      nuevasAlertas.push({
        tipo: "otro",
        severidad,
        titulo: `Fin período de prueba — ${nombreCompleto}`,
        mensaje:
          diffDays === 0
            ? `El período de prueba del chofer ${nombreCompleto} termina HOY (${diaMesFinRealStr}).`
            : `Al chofer ${nombreCompleto} le quedan ${diffDays} días para finalizar su período de prueba (Vence el ${diaMesFinRealStr}).`,
        entidad_id: chofer.id,
        entidad_tipo: "choferes_periodo_prueba",
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: finPruebaStr,
      });
    }
  }

  // Aniversarios de antigüedad:
  // - Choferes: solo en HITOS_ANIVERSARIO (5/10/15…)
  // - Adm/Mant: todos los años (≥ 1)
  for (const chofer of choferesIngreso ?? []) {
    const parts = chofer.fecha_ingreso!.split("-");
    if (parts.length !== 3) continue;

    const ingresoYear = parseInt(parts[0]!, 10);
    const ingresoMonth = parseInt(parts[1]!, 10);
    const ingresoDay = parseInt(parts[2]!, 10);

    const esAdmMant = chofer.rol === "administrativo" || chofer.rol === "mantenimiento";
    const entidadTipoAniv = esAdmMant ? "personal_aniversario" : "choferes_aniversario";
    const rolLabel = chofer.rol === "administrativo" ? "Admin" : chofer.rol === "mantenimiento" ? "Mantenimiento" : "Chofer";

    const hoyAnio = hoy.getFullYear();
    const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    for (const candidatoAnio of [hoyAnio, hoyAnio + 1]) {
      const aniosEnHito = candidatoAnio - ingresoYear;
      // Choferes: solo hitos; adm/mant: cualquier año >= 1
      const anioValido = esAdmMant ? aniosEnHito >= 1 : HITOS_ANIVERSARIO.includes(aniosEnHito);
      if (!anioValido) continue;

      const anivoMidnight = new Date(candidatoAnio, ingresoMonth - 1, ingresoDay);
      const diffTime = anivoMidnight.getTime() - hoyMidnight.getTime();
      const minDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (minDiff < 0 || minDiff > umbrales.diasAniversarioPreaviso) continue;

      const yyyy = anivoMidnight.getFullYear();
      const mm = String(anivoMidnight.getMonth() + 1).padStart(2, "0");
      const dd = String(anivoMidnight.getDate()).padStart(2, "0");
      const anivoStr = `${yyyy}-${mm}-${dd}`;

      const key = `otro:${chofer.id}:${entidadTipoAniv}:${anivoStr}`;
      if (existentesSet.has(key)) continue;

      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`;
      const mesStr = MESES[ingresoMonth - 1];

      nuevasAlertas.push({
        tipo: "otro",
        severidad: "info",
        titulo: `Aniversario ${aniosEnHito} año${aniosEnHito === 1 ? "" : "s"} — ${nombreCompleto}`,
        mensaje: `${rolLabel} ${nombreCompleto} cumple ${aniosEnHito} ${aniosEnHito === 1 ? "año" : "años"} en la empresa el ${ingresoDay} de ${mesStr}.`,
        entidad_id: chofer.id,
        entidad_tipo: entidadTipoAniv,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: anivoStr,
      });

      break; // solo el hito más próximo por persona
    }
  }

  // Saldo de vacaciones del año anterior por vencer el 31/12.
  // Se avisa en el último tramo del año (≤ 120 días) para los que aún tienen
  // saldo adeudado, que es exactamente lo que pierden si no lo toman.
  {
    const nombrePorId = new Map<string, string>();
    for (const c of choferesIngreso ?? []) nombrePorId.set(c.id, `${c.nombre} ${c.apellido}`);
    const anioActual = hoy.getFullYear();
    const fin31 = new Date(anioActual, 11, 31);
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diasHasta31 = Math.round((fin31.getTime() - hoyMid.getTime()) / 86400000);
    if (diasHasta31 >= 0 && diasHasta31 <= 120) {
      // Saldo por vencer = días otorgados del AÑO PASADO − períodos imputados a
      // ese año. Sólo el año anterior vence el 31/12 (el saldo del año X vence
      // el 31/12 del X+1): antes esto sumaba todos los años previos y la alerta
      // reclamaba días que el resto del sistema ya daba por vencidos.
      const anioPrevio = anioActual - 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbVac = supabase as any;
      const [{ data: aniosVac }, { data: periodosVac }] = await Promise.all([
        sbVac
          .from("chofer_vacaciones_anios")
          .select("chofer_id, anio, dias_correspondientes")
          .eq("anio", anioPrevio),
        sbVac
          .from("chofer_ausencias")
          .select("chofer_id, fecha_inicio, fecha_fin, anio_cargo")
          .eq("es_vacaciones", true)
          .is("deleted_at", null)
          .eq("anio_cargo", anioPrevio),
      ]);
      const adeudadosPorChofer = new Map<string, number>();
      for (const r of (aniosVac ?? []) as { chofer_id: string; dias_correspondientes: number }[]) {
        adeudadosPorChofer.set(
          r.chofer_id,
          (adeudadosPorChofer.get(r.chofer_id) ?? 0) + (r.dias_correspondientes ?? 0),
        );
      }
      for (const p of (periodosVac ?? []) as { chofer_id: string; fecha_inicio: string; fecha_fin: string }[]) {
        const ini = new Date(p.fecha_inicio + "T00:00:00").getTime();
        const fin = new Date(p.fecha_fin + "T00:00:00").getTime();
        const dias = Math.max(1, Math.round((fin - ini) / 86_400_000) + 1);
        adeudadosPorChofer.set(p.chofer_id, (adeudadosPorChofer.get(p.chofer_id) ?? 0) - dias);
      }
      const saldosVac = [...adeudadosPorChofer.entries()]
        .filter(([, dias]) => dias > 0)
        .map(([chofer_id, dias]) => ({ chofer_id, dias_adeudados: dias }));
      const vence31 = `${anioActual}-12-31`;
      for (const s of saldosVac) {
        const nombre = nombrePorId.get(s.chofer_id);
        if (!nombre) continue; // inactivo / fuera de dotación
        const key = `otro:${s.chofer_id}:choferes_vacaciones_saldo:${vence31}`;
        if (existentesSet.has(key)) continue;
        nuevasAlertas.push({
          tipo: "otro",
          severidad: diasHasta31 <= 30 ? "critica" : "advertencia",
          titulo: `Saldo de vacaciones por vencer — ${nombre}`,
          mensaje: `${nombre} tiene ${s.dias_adeudados} día${s.dias_adeudados !== 1 ? "s" : ""} de vacaciones de períodos anteriores que vencen el 31/12/${anioActual}.`,
          entidad_id: s.chofer_id,
          entidad_tipo: "choferes_vacaciones_saldo",
          fecha_disparo: new Date().toISOString(),
          fecha_vencimiento: vence31,
        });
      }
    }
  }

  // Compliance — organismos previos (SICOP, Secondi, etc.)
  // Consulta directa sobre compliance_documentos + compliance_requisitos (sin depender de la vista).
  // Solo procesa documentos con fecha_vencimiento; los sin vencimiento se ignoran.
  // `as any` porque columnas tipo_destinatario/destinatario_id son nuevas — actualizar al regenerar tipos.
  type OrgDocRow = {
    id: string;
    requisito_id: string;
    fecha_vencimiento: string | null;
    compliance_requisitos: {
      nombre: string;
      dias_alerta: number | null;
      tipo_destinatario: string;
      destinatario_id: string | null;
      enviar_a: string | null;
      compliance_destinatarios: { nombre: string } | null;
    } | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgDocsRes = await (supabase as any)
    .from("compliance_documentos")
    .select(`
      id,
      requisito_id,
      fecha_vencimiento,
      compliance_requisitos!inner(
        nombre,
        dias_alerta,
        tipo_destinatario,
        destinatario_id,
        enviar_a,
        compliance_destinatarios(nombre)
      )
    `)
    .not("fecha_vencimiento", "is", null)
    .eq("compliance_requisitos.tipo_destinatario", "organismo");
  const orgDocs = (orgDocsRes.data ?? []) as OrgDocRow[];

  // Tomamos solo el doc más reciente por requisito (mismo patrón que la vista)
  const latestOrgDoc = new Map<string, OrgDocRow>();
  for (const doc of orgDocs) {
    if (!latestOrgDoc.has(doc.requisito_id)) {
      latestOrgDoc.set(doc.requisito_id, doc);
    }
  }

  for (const doc of latestOrgDoc.values()) {
    if (!doc.fecha_vencimiento) continue;

    const req = doc.compliance_requisitos;
    if (!req) continue;

    const organismoNombre = req.compliance_destinatarios?.nombre ?? "Organismo";
    const diasAlertaReq = req.dias_alerta ?? umbrales.diasVencimientoDoc;

    const [y, m, d] = doc.fecha_vencimiento.split("-").map(Number);
    const venceMidnight = new Date(y!, m! - 1, d!);
    const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dias = Math.round((venceMidnight.getTime() - hoyMidnight.getTime()) / 86400000);

    type DisparoOrg = { umbral: "vencido" | "T5" | "T15" | "T30"; severidad: "info" | "advertencia" | "critica" };
    const disparos: DisparoOrg[] = [];
    if (dias < 0) disparos.push({ umbral: "vencido", severidad: "critica" });
    if (dias === 5 && diasAlertaReq >= 5) disparos.push({ umbral: "T5", severidad: "critica" });
    if (dias === 15 && diasAlertaReq >= 15) disparos.push({ umbral: "T15", severidad: "advertencia" });
    if (dias === 30 && diasAlertaReq >= 30) disparos.push({ umbral: "T30", severidad: "info" });
    if (disparos.length === 0) continue;

    for (const disparo of disparos) {
      const entidad_tipo = `organismo_compliance:${disparo.umbral}`;
      const key = `vencimiento_compliance:${doc.id}:${entidad_tipo}:${doc.fecha_vencimiento}`;
      if (existentesSet.has(key)) continue;

      // "A dónde se manda" (reunión Nico 02/07): que la alerta diga a qué
      // portal/mail enviar el doc, para cuando no está Noelia.
      const envioOrg = req.enviar_a ? ` Se manda a: ${req.enviar_a}.` : "";
      const mensaje =
        (disparo.umbral === "vencido"
          ? `El documento "${req.nombre}" presentado a ${organismoNombre} está vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}.`
          : `El documento "${req.nombre}" presentado a ${organismoNombre} vence en ${dias} día${dias !== 1 ? "s" : ""}.`) + envioOrg;

      nuevasAlertas.push({
        tipo: "vencimiento_compliance",
        severidad: disparo.severidad,
        titulo: `Compliance ${organismoNombre} — ${req.nombre}`,
        mensaje,
        entidad_id: doc.id,
        entidad_tipo,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: doc.fecha_vencimiento,
      });
    }
  }

  // Rollover de vencimientos periódicos de empresa (certificado c/30, libre deuda
  // c/120…): asegura que exista la próxima fecha antes de alertar, para que el aviso
  // no se corte cuando el período vence. Best-effort (no frena la generación).
  await ensureProximosPeriodicos(supabase, hoyStr);

  // Compliance — 3 disparos discretos (30 / 15 / 5 días) + vencido.
  // Cada disparo es una alerta distinta con su propia severidad. Se diferencian
  // por entidad_tipo ('compliance:T30' | 'T15' | 'T5' | 'vencido') para que el
  // dedup deje pasar uno por umbral.
  const { data: compliance } = await supabase
    .from("v_compliance_estado")
    .select(
      "requisito_id, requisito_codigo, requisito_nombre, cliente_aplica, nivel, chofer_id, chofer_nombre, camion_id, camion_patente, documento_id, fecha_vencimiento, estado, dias_restantes",
    )
    .not("fecha_vencimiento", "is", null);

  // "A dónde se manda" por requisito (la vista no lo trae): para que la alerta
  // diga a qué portal/mail enviar el doc (reunión Nico 02/07).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqEnvios } = await (supabase as any)
    .from("compliance_requisitos")
    .select("id, enviar_a")
    .not("enviar_a", "is", null);
  const envioPorRequisito = new Map<string, string>();
  for (const r of (reqEnvios ?? []) as { id: string; enviar_a: string | null }[]) {
    if (r.enviar_a) envioPorRequisito.set(r.id, r.enviar_a);
  }

  for (const row of compliance ?? []) {
    if (!row.fecha_vencimiento) continue;
    if (!row.requisito_id || !row.requisito_nombre) continue;

    const dias = row.dias_restantes;
    if (dias === null || dias === undefined) continue;

    // Definimos qué disparos aplican para este row
    type Disparo = { umbral: "vencido" | "T5" | "T15" | "T30"; severidad: "info" | "advertencia" | "critica" };
    const disparos: Disparo[] = [];
    // dias <= 0 cubre también el DÍA del vencimiento (dias === 0), que antes quedaba
    // sin aviso entre T5 y "vencido". El dedup por fecha_vencimiento evita repetir.
    if (dias <= 0) disparos.push({ umbral: "vencido", severidad: "critica" });
    if (dias === 5) disparos.push({ umbral: "T5", severidad: "critica" });
    if (dias === 15) disparos.push({ umbral: "T15", severidad: "advertencia" });
    if (dias === 30) disparos.push({ umbral: "T30", severidad: "info" });
    if (disparos.length === 0) continue;

    const target = row.chofer_nombre ?? row.camion_patente ?? "Empresa";
    const clienteLabel =
      row.cliente_aplica === "AMBOS"
        ? "Loma Negra y YPF"
        : row.cliente_aplica === "YPF"
        ? "YPF"
        : "Loma Negra";

    const entidad_id = row.documento_id ?? row.requisito_id;

    for (const d of disparos) {
      const entidad_tipo = `compliance:${d.umbral}`;
      const key = `vencimiento_compliance:${entidad_id}:${entidad_tipo}:${row.fecha_vencimiento}`;
      if (existentesSet.has(key)) continue;

      const envioReq = envioPorRequisito.get(row.requisito_id);
      const envioSufijo = envioReq ? ` Se manda a: ${envioReq}.` : "";
      const mensaje =
        (d.umbral === "vencido"
          ? (dias === 0
              ? `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} vence HOY.`
              : `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} está vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}.`)
          : `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} vence en ${dias} día${dias !== 1 ? "s" : ""}.`) + envioSufijo;

      nuevasAlertas.push({
        tipo: "vencimiento_compliance",
        severidad: d.severidad,
        titulo: `Compliance ${clienteLabel} — ${row.requisito_nombre} (${target})`,
        mensaje,
        entidad_id,
        entidad_tipo,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: row.fecha_vencimiento,
      });
    }
  }

  // Próximos services de mantenimiento (por fecha programada) — vencidos o por vencer.
  // Solo mira los services que dejaron un `proximo_service_fecha`. Las alertas por
  // km se ven en el tab del módulo; acá generamos las de fecha para la campana.
  const { data: proximosServices } = await supabase
    .from("mantenimientos")
    .select(
      "proximo_service_fecha, camion_id, acoplado_id, tipo_servicio:tipos_servicio(nombre), camion:camiones(patente), acoplado:acoplados(patente)"
    )
    .not("proximo_service_fecha", "is", null)
    .lte("proximo_service_fecha", enDocStr)
    .order("fecha", { ascending: false });

  const vistosServices = new Set<string>();
  for (const s of proximosServices ?? []) {
    if (!s.proximo_service_fecha) continue;
    const camion = s.camion as { patente: string } | null;
    const acoplado = s.acoplado as { patente: string } | null;
    const tsServ = s.tipo_servicio as { nombre: string } | null;
    const servicioNombre = tsServ?.nombre ?? "Service";
    const unidadId = s.camion_id ?? s.acoplado_id;
    if (!unidadId) continue;

    // Un aviso por unidad + tipo de servicio (el más reciente, por el order).
    const dedupUnidad = `${unidadId}::${servicioNombre}`;
    if (vistosServices.has(dedupUnidad)) continue;
    vistosServices.add(dedupUnidad);

    const patente = camion?.patente ?? acoplado?.patente ?? "Unidad";
    const diasRestantes = Math.ceil(
      (new Date(s.proximo_service_fecha).getTime() - hoy.getTime()) / 86400000
    );

    const key = `otro:${unidadId}:mantenimiento_proximo_service:${s.proximo_service_fecha}`;
    if (existentesSet.has(key)) continue;

    const vencido = diasRestantes < 0;
    const severidad = vencido || diasRestantes <= umbrales.diasCritico ? "critica" : "advertencia";
    const mensaje = vencido
      ? `El service "${servicioNombre}" de ${patente} está vencido hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? "s" : ""}.`
      : `El service "${servicioNombre}" de ${patente} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`;

    nuevasAlertas.push({
      tipo: "otro",
      severidad,
      titulo: `Service ${vencido ? "vencido" : "próximo"} — ${patente}`,
      mensaje,
      entidad_id: unidadId,
      entidad_tipo: "mantenimiento_proximo_service",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: s.proximo_service_fecha,
    });
  }

  // Ausencias / permisos programados de choferes que arrancan dentro del preaviso.
  // Da visibilidad para planificar la semana sin depender de "lo que recordó" logística.
  // `as any`: el select embebe `choferes(...)`, que el cliente tipado no infiere bien acá.
  const enAusenciaDias = new Date(hoy);
  enAusenciaDias.setDate(hoy.getDate() + umbrales.diasAusenciaPreaviso);
  const enAusenciaStr = enAusenciaDias.toISOString().split("T")[0]!;

  type AusenciaRow = {
    id: string;
    chofer_id: string;
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    choferes: { nombre: string; apellido: string } | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ausenciasRes = await (supabase as any)
    .from("chofer_ausencias")
    .select("id, chofer_id, tipo, fecha_inicio, fecha_fin, choferes(nombre, apellido)")
    .eq("estado", "autorizada")
    .is("deleted_at", null)
    .gte("fecha_inicio", hoyStr)
    .lte("fecha_inicio", enAusenciaStr);
  const ausencias = (ausenciasRes.data ?? []) as AusenciaRow[];

  for (const aus of ausencias) {
    const key = `otro:${aus.chofer_id}:chofer_ausencia:${aus.fecha_inicio}`;
    if (existentesSet.has(key)) continue;

    const chofer = Array.isArray(aus.choferes) ? aus.choferes[0] : aus.choferes;
    const nombre = chofer ? `${chofer.nombre} ${chofer.apellido}` : "Chofer";

    const [iy, im, idd] = aus.fecha_inicio.split("-").map(Number);
    const inicioMidnight = new Date(iy!, im! - 1, idd!);
    const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diasRestantes = Math.round((inicioMidnight.getTime() - hoyMidnight.getTime()) / 86400000);

    const inicioLabel = `${idd} de ${MESES[im! - 1]}`;
    const [, fm, fdd] = aus.fecha_fin.split("-").map(Number);
    const finLabel = `${fdd} de ${MESES[fm! - 1]}`;
    const rango = aus.fecha_inicio === aus.fecha_fin ? `el ${inicioLabel}` : `del ${inicioLabel} al ${finLabel}`;
    const cuando =
      diasRestantes === 0 ? "hoy" : `en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`;

    nuevasAlertas.push({
      tipo: "otro",
      severidad: "info",
      titulo: `Ausencia programada — ${nombre}`,
      mensaje: `${nombre} no estará disponible ${rango} (${aus.tipo}). Empieza ${cuando}.`,
      entidad_id: aus.chofer_id,
      entidad_tipo: "chofer_ausencia",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: aus.fecha_inicio,
    });
  }

  // Impuestos (Finanzas) — vencimientos pendientes de presentar. Disparos discretos
  // 30 / 15 / 5 días + vencido, igual que compliance. Se apagan al marcar "presentado".
  // `as any`: impuesto_vencimientos es tabla nueva, aún no está en database.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: impuestos } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("id, nombre, organismo, fecha_vencimiento")
    .eq("presentado", false)
    .not("fecha_vencimiento", "is", null);

  for (const imp of (impuestos ?? []) as {
    id: string; nombre: string; organismo: string | null; fecha_vencimiento: string;
  }[]) {
    const [iy, im, idd] = imp.fecha_vencimiento.split("-").map(Number);
    const venceMid = new Date(iy!, im! - 1, idd!);
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dias = Math.round((venceMid.getTime() - hoyMid.getTime()) / 86400000);

    type DispImp = { umbral: "vencido" | "T5" | "T15" | "T30"; severidad: "info" | "advertencia" | "critica" };
    const disparos: DispImp[] = [];
    if (dias < 0) disparos.push({ umbral: "vencido", severidad: "critica" });
    if (dias === 5) disparos.push({ umbral: "T5", severidad: "critica" });
    if (dias === 15) disparos.push({ umbral: "T15", severidad: "advertencia" });
    if (dias === 30) disparos.push({ umbral: "T30", severidad: "info" });
    if (disparos.length === 0) continue;

    const org = imp.organismo ? ` (${imp.organismo})` : "";
    for (const d of disparos) {
      const entidad_tipo = `impuesto:${d.umbral}`;
      const key = `otro:${imp.id}:${entidad_tipo}:${imp.fecha_vencimiento}`;
      if (existentesSet.has(key)) continue;

      const mensaje =
        d.umbral === "vencido"
          ? `El impuesto "${imp.nombre}"${org} venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""} y no figura presentado.`
          : `El impuesto "${imp.nombre}"${org} vence en ${dias} día${dias !== 1 ? "s" : ""}.`;

      nuevasAlertas.push({
        tipo: "otro",
        severidad: d.severidad,
        titulo: `Impuesto ${d.umbral === "vencido" ? "vencido" : "por vencer"} — ${imp.nombre}`,
        mensaje,
        entidad_id: imp.id,
        entidad_tipo,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: imp.fecha_vencimiento,
      });
    }
  }

  // Préstamos bancarios (Finanzas) — cuotas por vencer o vencidas sin marcar
  // como pagadas (audio Bárbara 02/07: "ojo, mañana vence el préstamo de
  // Galicia, cuota 44 de 48"). Disparos discretos 7 días / 1 día / vencida;
  // se apagan al tildar la cuota como pagada.
  // `as any`: prestamo_cuotas es tabla nueva, aún no está en database.ts.
  // Paginado: hoy son 852 cuotas impagas de préstamos activos, a un paso de las
  // 1000. Si se corta, hay cuotas que simplemente nunca generan alerta.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cuotasPrestamo = await traerTodo<any>(
    (from, to) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("prestamo_cuotas")
        .select("id, nro, fecha_vencimiento, importe, prestamo:prestamos!inner(banco, tasa, cuotas_total, estado)")
        .eq("pagada", false)
        .eq("prestamo.estado", "activo")
        .order("id", { ascending: true })
        .range(from, to),
    { etiqueta: "cuotas de préstamo impagas" },
  );

  for (const cu of (cuotasPrestamo ?? []) as {
    id: string;
    nro: number;
    fecha_vencimiento: string;
    importe: number;
    prestamo: { banco: string; tasa: number | null; cuotas_total: number };
  }[]) {
    const pr = Array.isArray(cu.prestamo) ? cu.prestamo[0] : cu.prestamo;
    if (!pr) continue;
    const [py, pm, pd] = cu.fecha_vencimiento.split("-").map(Number);
    const venceMid = new Date(py!, pm! - 1, pd!);
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dias = Math.round((venceMid.getTime() - hoyMid.getTime()) / 86400000);

    // Disparos por VENTANA, no por igualdad exacta de días. Antes eran
    // `dias === 7` y `dias === 1`: si el cron no corría justo ese día (o los
    // datos se cargaban unas horas más tarde), el aviso no salía nunca —
    // la condición ya no volvía a ser verdadera al día siguiente.
    //
    // UNO solo por cuota, el más urgente: las tres ventanas se superponían
    // (`dias <= 1` y `dias <= 7` cubrían lo mismo) y la misma cuota salía como
    // vencida, por vencer y de esta semana en el mismo mail.
    const disparos = [disparoPrestamo(dias, lunesDeLaSemana)].filter((d) => d !== null);
    if (disparos.length === 0) continue;

    const cuotaLabel = `cuota ${cu.nro}/${pr.cuotas_total}`;
    const tasaLabel = pr.tasa != null ? ` · tasa ${Number(pr.tasa).toLocaleString("es-AR")}%` : "";
    const importeLabel = `$${Math.round(Number(cu.importe)).toLocaleString("es-AR")}`;
    const [vy, vm, vd] = cu.fecha_vencimiento.split("-");
    const venceLabel = `${vd}/${vm}/${vy}`;

    for (const d of disparos) {
      const entidad_tipo = `prestamo_cuota:${d.umbral}`;
      const key = `otro:${cu.id}:${entidad_tipo}:${cu.fecha_vencimiento}`;
      if (existentesSet.has(key)) continue;

      const mensaje =
        d.clase === "vencido"
          ? `La ${cuotaLabel} de ${pr.banco} (${importeLabel}${tasaLabel}) venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""} y no figura pagada.`
          : d.clase === "inminente"
            ? dias === 0
              ? `Hoy vence la ${cuotaLabel} de ${pr.banco}: ${importeLabel}${tasaLabel}.`
              : `Mañana vence la ${cuotaLabel} de ${pr.banco}: ${importeLabel}${tasaLabel}.`
            : `Esta semana vence la ${cuotaLabel} de ${pr.banco}: ${importeLabel}${tasaLabel}. Vence el ${venceLabel}${dias > 1 ? ` (en ${dias} días)` : ""}.`;

      const tituloEstado =
        d.clase === "vencido"
          ? "cuota vencida"
          : d.clase === "inminente"
            ? "cuota por vencer"
            : "cuota de esta semana";

      nuevasAlertas.push({
        tipo: "otro",
        severidad: d.severidad,
        titulo: `Préstamo ${pr.banco} — ${tituloEstado} (${cu.nro}/${pr.cuotas_total})`,
        mensaje,
        entidad_id: cu.id,
        entidad_tipo,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: cu.fecha_vencimiento,
      });
    }
  }

  // Formulario 931 (Compliance) — debe enviarse a YPF (Nico) y a Loma (Noelia).
  // Bloqueante: sin 931 no puede cargar nadie. Disparos discretos 30/15/5 + vencido;
  // se apaga cuando AMBOS envíos están marcados. Usa tipo "vencimiento_compliance"
  // para rutear al toggle "Compliance Loma/YPF" (llega a todos los que lo tengan).
  // Asegura que el próximo período (día 20) exista antes de alertar, así el aviso
  // sale aunque nadie haya abierto la pantalla del F931 este mes. Sin usuario (cron).
  await ensureProximoForm931(supabase, null, hoy);

  // `as any`: form931_presentaciones es tabla nueva, aún no está en database.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form931 } = await (supabase as any)
    .from("form931_presentaciones")
    .select("id, periodo, fecha_limite, enviado_ypf, enviado_loma")
    .or("enviado_ypf.eq.false,enviado_loma.eq.false");

  // A dónde se presenta el 931 (SICOP, Secondi, portal YPF…): parámetro editable,
  // para que la alerta lo diga aunque no esté Noelia (reunión Nico 02/07).
  const { data: paramEnvio931 } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", "form931_enviar_a")
    .maybeSingle();
  const envio931 = paramEnvio931?.valor?.trim()
    ? ` Se presenta en: ${paramEnvio931.valor.trim()}.`
    : "";

  for (const f of (form931 ?? []) as {
    id: string; periodo: string | null; fecha_limite: string; enviado_ypf: boolean; enviado_loma: boolean;
  }[]) {
    if (f.enviado_ypf && f.enviado_loma) continue; // por las dudas
    const [iy, im, idd] = f.fecha_limite.split("-").map(Number);
    const venceMid = new Date(iy!, im! - 1, idd!);
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dias = Math.round((venceMid.getTime() - hoyMid.getTime()) / 86400000);

    type DispF931 = { umbral: "vencido" | "T5" | "T15" | "T30"; severidad: "info" | "advertencia" | "critica" };
    const disparos: DispF931[] = [];
    if (dias < 0) disparos.push({ umbral: "vencido", severidad: "critica" });
    if (dias === 5) disparos.push({ umbral: "T5", severidad: "critica" });
    if (dias === 15) disparos.push({ umbral: "T15", severidad: "advertencia" });
    if (dias === 30) disparos.push({ umbral: "T30", severidad: "info" });
    if (disparos.length === 0) continue;

    const faltan = [!f.enviado_ypf ? "YPF" : null, !f.enviado_loma ? "Loma Negra" : null]
      .filter(Boolean)
      .join(" y ");
    const periodoLabel = f.periodo ? ` ${f.periodo}` : "";

    for (const d of disparos) {
      const entidad_tipo = `form931:${d.umbral}`;
      const key = `vencimiento_compliance:${f.id}:${entidad_tipo}:${f.fecha_limite}`;
      if (existentesSet.has(key)) continue;

      const mensaje =
        d.umbral === "vencido"
          ? `El Formulario 931${periodoLabel} venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""} y falta enviarlo a ${faltan}. Es bloqueante: sin 931 no puede cargar nadie.${envio931}`
          : `El Formulario 931${periodoLabel} vence en ${dias} día${dias !== 1 ? "s" : ""} y falta enviarlo a ${faltan}.${envio931}`;

      nuevasAlertas.push({
        tipo: "vencimiento_compliance",
        severidad: d.severidad,
        titulo: `Formulario 931 ${d.umbral === "vencido" ? "VENCIDO" : "por vencer"} — falta ${faltan}`,
        mensaje,
        entidad_id: f.id,
        entidad_tipo,
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: f.fecha_limite,
      });
    }
  }

  // Catálogo de insumos — recordatorio de actualización de precios. Una sola
  // alerta agregada por mes si hay insumos activos con el precio viejo, para que
  // administración lo refresque y el costo por chofer siga siendo confiable.
  // El vencimiento se fija a fin de mes para que la alerta siga "viva" (y no se
  // duplique) aunque se la marque leída dentro del mismo mes.
  {
    const limite = new Date(hoy);
    limite.setMonth(limite.getMonth() - umbrales.mesesInsumoPrecio);
    const limiteStr = limite.toISOString().split("T")[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("insumos_catalogo")
      .select("id", { count: "exact", head: true })
      .eq("estado", "activo")
      .lt("precio_actualizado_en", limiteStr);
    const desactualizados = count ?? 0;
    if (desactualizados > 0) {
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      const finMesStr = `${finMes.getFullYear()}-${String(finMes.getMonth() + 1).padStart(2, "0")}-${String(finMes.getDate()).padStart(2, "0")}`;
      // entidad_id null (alerta agregada, no apunta a una fila puntual). La clave
      // de dedup se arma igual que existentesSet: `otro:${entidad_id}:${entidad_tipo}:${fecha_venc}`.
      const key = `otro:${null}:insumo_precio_desactualizado:${finMesStr}`;
      if (!existentesSet.has(key)) {
        const mesesTxt = `${umbrales.mesesInsumoPrecio} mes${umbrales.mesesInsumoPrecio !== 1 ? "es" : ""}`;
        nuevasAlertas.push({
          tipo: "otro",
          severidad: "info",
          titulo: "Actualizar precios del catálogo de insumos",
          mensaje: `Hay ${desactualizados} insumo${desactualizados !== 1 ? "s" : ""} del catálogo con el precio sin actualizar hace más de ${mesesTxt}. Revisalos en Mantenimiento → Insumos.`,
          entidad_id: null,
          entidad_tipo: "insumo_precio_desactualizado",
          fecha_disparo: new Date().toISOString(),
          fecha_vencimiento: finMesStr,
        });
      }
    }
  }

  // Tope mensual de préstamos: avisa apenas lo que hay que pagar en un mes se
  // pasa del número que fijaron. Es el pedido del padre de Bárbara — "ojo que
  // noviembre lo tenés complicadísimo" — y la gracia es enterarse con meses de
  // anticipación, no el día 1. Mira los próximos 6 meses.
  try {
    const { data: paramTope } = await supabase
      .from("parametros_sistema")
      .select("valor")
      .eq("clave", "prestamos_topes")
      .maybeSingle();

    let topeMes: number | null = null;
    if (paramTope?.valor) {
      try {
        const raw = JSON.parse(paramTope.valor as string) as { mes?: unknown };
        const n = Number(raw?.mes);
        topeMes = Number.isFinite(n) && n > 0 ? n : null;
      } catch {
        topeMes = null;
      }
    }

    if (topeMes != null) {
      const finVentana = new Date(hoy.getFullYear(), hoy.getMonth() + 6, 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cuotasTope = await traerTodo<any>(
        (from, to) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("prestamo_cuotas")
            .select("fecha_vencimiento, importe")
            .eq("pagada", false)
            .gte("fecha_vencimiento", hoyStr)
            .lte("fecha_vencimiento", finVentana.toISOString().split("T")[0]!)
            .order("id", { ascending: true })
            .range(from, to),
        { etiqueta: "cuotas para el tope mensual" },
      );

      const porMes = new Map<string, number>();
      for (const c of (cuotasTope ?? []) as { fecha_vencimiento: string; importe: number }[]) {
        const mes = c.fecha_vencimiento.slice(0, 7);
        porMes.set(mes, (porMes.get(mes) ?? 0) + Number(c.importe));
      }

      const MESES_NOMBRE = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
      ];
      for (const [mes, total] of [...porMes].sort()) {
        if (total <= topeMes) continue;
        // Se dispara una vez por mes excedido; si después baja y vuelve a
        // subir, la clave sigue siendo la misma y no repite.
        const key = `otro:${mes}:prestamos_tope_mensual:${mes}-01`;
        if (existentesSet.has(key)) continue;

        const [y, m] = mes.split("-").map(Number);
        const nombreMes = `${MESES_NOMBRE[m! - 1]} de ${y}`;
        const exceso = total - topeMes;
        const pct = Math.round((exceso / topeMes) * 100);
        const plata = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

        nuevasAlertas.push({
          tipo: "otro",
          severidad: "advertencia",
          titulo: `Préstamos: ${nombreMes} se pasa del tope`,
          mensaje: `En ${nombreMes} hay que pagar ${plata(total)} de cuotas de préstamos: ${plata(exceso)} más que el tope de ${plata(topeMes)} (${pct}% por encima).`,
          entidad_id: null,
          entidad_tipo: "prestamos_tope_mensual",
          fecha_disparo: new Date().toISOString(),
          fecha_vencimiento: `${mes}-01`,
        });
      }
    }
  } catch (e) {
    console.error("[alertas] tope mensual de préstamos:", e);
  }

  if (nuevasAlertas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("alertas").insert(nuevasAlertas as any);
  }

  // Envío inmediato de críticas por email. Encapsulado: un fallo de correo
  // (SMTP caído, etc.) nunca debe romper la generación de alertas.
  try {
    await procesarNotificacionesCriticas();
  } catch (e) {
    console.error("[alertas] notificación de críticas falló:", e);
  }

  return nuevasAlertas.length;
}
