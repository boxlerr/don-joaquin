import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

async function getUmbralesAlertas() {
  const supabase = createAdminClient();
  const claves = [
    "dias_alerta_vencimiento_default",
    "dias_alerta_cheque",
    "alerta_critico_dias",
    "alerta_viatico_pendiente_dias",
    "alerta_viaje_sin_cerrar_horas",
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
      a.tipo === "otro"
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

  // Cumpleaños de choferes dentro de los próximos 7 días
  const { data: choferesBday } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, fecha_nacimiento")
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

    if (minDiff <= 7) {
      const yyyy = nextBdayMidnight.getFullYear();
      const mm = String(nextBdayMidnight.getMonth() + 1).padStart(2, "0");
      const dd = String(nextBdayMidnight.getDate()).padStart(2, "0");
      const nextBdayStr = `${yyyy}-${mm}-${dd}`;

      const key = `otro:${chofer.id}:choferes_cumple:${nextBdayStr}`;
      if (existentesSet.has(key)) continue;

      const nombreCompleto = `${chofer.nombre} ${chofer.apellido}`;
      const diaMesStr = `${birthDay} de ${MESES[birthMonth - 1]}`;
      const nombreDia = DIAS_SEMANA[nextBdayMidnight.getDay()];

      nuevasAlertas.push({
        tipo: "otro",
        severidad: "info",
        titulo: `Cumpleaños — ${nombreCompleto}`,
        mensaje: `El chofer ${nombreCompleto} cumple años el ${diaMesStr} (${nombreDia}).`,
        entidad_id: chofer.id,
        entidad_tipo: "choferes_cumple",
        fecha_disparo: new Date().toISOString(),
        fecha_vencimiento: nextBdayStr,
      });
    }
  }

  // Fin de período de prueba (6 meses) a los 30, 15 y 5 días antes
  const { data: choferesIngreso } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, fecha_ingreso")
    .eq("estado", "activo")
    .not("fecha_ingreso", "is", null);

  for (const chofer of choferesIngreso ?? []) {
    const parts = chofer.fecha_ingreso!.split("-");
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

  // Compliance — documentos por vencer o vencidos a presentar a Loma Negra / YPF
  const { data: compliance } = await supabase
    .from("v_compliance_estado")
    .select(
      "requisito_id, requisito_codigo, requisito_nombre, cliente_aplica, nivel, dias_alerta, chofer_id, chofer_nombre, camion_id, camion_patente, documento_id, documento_fuente, fecha_vencimiento, estado, dias_restantes",
    )
    .in("estado", ["por_vencer", "vencido"]);

  for (const row of compliance ?? []) {
    if (!row.fecha_vencimiento) continue;
    if (!row.requisito_id || !row.requisito_nombre) continue;

    // Dedupe key — una alerta única por documento (o requisito faltante) + fecha
    const entidadKey =
      row.documento_id ??
      `${row.requisito_id}:${row.chofer_id ?? ""}:${row.camion_id ?? ""}`;
    const key = `vencimiento_compliance:${entidadKey}`;
    if (existentesSet.has(key)) continue;

    const target =
      row.chofer_nombre ?? row.camion_patente ?? "Empresa";
    const clienteLabel =
      row.cliente_aplica === "AMBOS"
        ? "Loma Negra y YPF"
        : row.cliente_aplica === "YPF"
        ? "YPF"
        : "Loma Negra";

    const dias = row.dias_restantes ?? 0;
    const severidad =
      row.estado === "vencido" || dias <= umbrales.diasCritico ? "critica" : "advertencia";

    const mensaje =
      row.estado === "vencido"
        ? `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} está vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}.`
        : `El documento "${row.requisito_nombre}" (${target}) que se presenta a ${clienteLabel} vence en ${dias} día${dias !== 1 ? "s" : ""}.`;

    nuevasAlertas.push({
      tipo: "vencimiento_compliance",
      severidad,
      titulo: `Compliance ${clienteLabel} — ${row.requisito_nombre} (${target})`,
      mensaje,
      entidad_id: row.documento_id ?? row.requisito_id,
      entidad_tipo: row.documento_fuente ?? "compliance_requisitos",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: row.fecha_vencimiento,
    });
  }

  if (nuevasAlertas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("alertas").insert(nuevasAlertas as any);
  }

  return nuevasAlertas.length;
}
