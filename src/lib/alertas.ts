import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
  };
}

export async function generarAlertas() {
  const supabase = createAdminClient();
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0]!;

  const umbrales = await getUmbralesAlertas();

  const enDocDias = new Date(hoy);
  enDocDias.setDate(hoy.getDate() + umbrales.diasVencimientoDoc);
  const enDocStr = enDocDias.toISOString().split("T")[0]!;

  const enChequeDias = new Date(hoy);
  enChequeDias.setDate(hoy.getDate() + umbrales.diasVencimientoCheque);
  const enChequeStr = enChequeDias.toISOString().split("T")[0]!;

  const { data: existentes } = await supabase
    .from("alertas")
    .select("entidad_id, entidad_tipo, tipo, fecha_vencimiento")
    .or(`estado.eq.pendiente,fecha_vencimiento.gte.${hoyStr}`);

  const existentesSet = new Set(
    (existentes ?? []).map((a) =>
      a.tipo === "otro" || a.tipo === "vencimiento_compliance"
        ? `${a.tipo}:${a.entidad_id}:${a.entidad_tipo}:${a.fecha_vencimiento}`
        : `${a.tipo}:${a.entidad_id}`
    )
  );

  type NuevaAlerta = {
    tipo: string;
    severidad: string;
    titulo: string;
    mensaje: string;
    entidad_id: string;
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
    const key = `vencimiento_doc_camion:${doc.id}`;
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
    .select("id, chofer_id, fecha_vencimiento, choferes(nombre, apellido), tipos_documento(nombre)")
    .not("fecha_vencimiento", "is", null)
    .lte("fecha_vencimiento", enDocStr)
    .gte("fecha_vencimiento", hoyStr);

  for (const doc of docsCHOFER ?? []) {
    const key = `vencimiento_doc_chofer:${doc.id}`;
    if (existentesSet.has(key)) continue;
    const chofer = doc.choferes as { nombre: string; apellido: string } | null;
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

  // Cheques en cartera próximos a vencer
  const { data: cheques } = await supabase
    .from("cheques")
    .select("id, librador_nombre, importe, fecha_vencimiento")
    .eq("estado", "cartera")
    .lte("fecha_vencimiento", enChequeStr)
    .gte("fecha_vencimiento", hoyStr);

  for (const cheque of cheques ?? []) {
    const key = `vencimiento_cheque:${cheque.id}`;
    if (existentesSet.has(key)) continue;
    const diasRestantes = Math.ceil(
      (new Date(cheque.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000
    );
    nuevasAlertas.push({
      tipo: "vencimiento_cheque",
      severidad: diasRestantes <= umbrales.diasCritico ? "critica" : "advertencia",
      titulo: `Cheque próximo a vencer — ${cheque.librador_nombre}`,
      mensaje: `Cheque de $${Number(cheque.importe).toLocaleString("es-AR")} de ${cheque.librador_nombre} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`,
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

    if (diffDays === 30 || diffDays === 15 || diffDays === 5) {
      const yyyy = finPruebaMidnight.getFullYear();
      const mm = String(finPruebaMidnight.getMonth() + 1).padStart(2, "0");
      const dd = String(finPruebaMidnight.getDate()).padStart(2, "0");
      const finPruebaStr = `${yyyy}-${mm}-${dd}`;

      const key = `otro:${chofer.id}:choferes_periodo_prueba:${finPruebaStr}`;
      if (existentesSet.has(key)) continue;

      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`;
      const severidad = diffDays === 5 ? "critica" : diffDays === 15 ? "advertencia" : "info";

      const finPruebaMonthIndex = finPruebaMidnight.getMonth();
      const finPruebaDayNumber = finPruebaMidnight.getDate();
      const diaMesFinRealStr = `${finPruebaDayNumber} de ${MESES[finPruebaMonthIndex]}`;

      nuevasAlertas.push({
        tipo: "otro",
        severidad,
        titulo: `Fin período de prueba — ${nombreCompleto}`,
        mensaje: `Al chofer ${nombreCompleto} le quedan ${diffDays} días para finalizar su período de prueba (Vence el ${diaMesFinRealStr}).`,
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

      const mensaje =
        disparo.umbral === "vencido"
          ? `El documento "${req.nombre}" presentado a ${organismoNombre} está vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}.`
          : `El documento "${req.nombre}" presentado a ${organismoNombre} vence en ${dias} día${dias !== 1 ? "s" : ""}.`;

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

  for (const row of compliance ?? []) {
    if (!row.fecha_vencimiento) continue;
    if (!row.requisito_id || !row.requisito_nombre) continue;

    const dias = row.dias_restantes;
    if (dias === null || dias === undefined) continue;

    // Definimos qué disparos aplican para este row
    type Disparo = { umbral: "vencido" | "T5" | "T15" | "T30"; severidad: "info" | "advertencia" | "critica" };
    const disparos: Disparo[] = [];
    if (dias < 0) disparos.push({ umbral: "vencido", severidad: "critica" });
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

      const mensaje =
        d.umbral === "vencido"
          ? `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} está vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}.`
          : `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} vence en ${dias} día${dias !== 1 ? "s" : ""}.`;

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

  if (nuevasAlertas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("alertas").insert(nuevasAlertas as any);
  }

  return nuevasAlertas.length;
}
