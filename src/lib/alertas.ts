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
    .select("entidad_id, tipo")
    .eq("estado", "pendiente");

  const existentesSet = new Set(
    (existentes ?? []).map((a) => `${a.tipo}:${a.entidad_id}`)
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

  if (nuevasAlertas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("alertas").insert(nuevasAlertas as any);
  }

  return nuevasAlertas.length;
}
