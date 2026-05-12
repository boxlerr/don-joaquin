import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generarAlertas() {
  const supabase = createAdminClient();
  const hoy = new Date();
  const en30dias = new Date(hoy);
  en30dias.setDate(hoy.getDate() + 30);
  const hoyStr = hoy.toISOString().split("T")[0];
  const en30Str = en30dias.toISOString().split("T")[0];

  // Fetch existing pending alerts to avoid duplicates
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
    .lte("fecha_vencimiento", en30Str)
    .gte("fecha_vencimiento", hoyStr);

  for (const doc of docsCAMION ?? []) {
    const key = `vencimiento_doc_camion:${doc.id}`;
    if (existentesSet.has(key)) continue;
    const patente = (doc.camiones as any)?.patente ?? "Camión";
    const tipoNombre = (doc.tipos_documento as any)?.nombre ?? "documento";
    const diasRestantes = Math.ceil(
      (new Date(doc.fecha_vencimiento!).getTime() - hoy.getTime()) / 86400000
    );
    nuevasAlertas.push({
      tipo: "vencimiento_doc_camion",
      severidad: diasRestantes <= 7 ? "critica" : "advertencia",
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
    .lte("fecha_vencimiento", en30Str)
    .gte("fecha_vencimiento", hoyStr);

  for (const doc of docsCHOFER ?? []) {
    const key = `vencimiento_doc_chofer:${doc.id}`;
    if (existentesSet.has(key)) continue;
    const chofer = (doc.choferes as any);
    const nombre = chofer ? `${chofer.nombre} ${chofer.apellido}` : "Chofer";
    const tipoNombre = (doc.tipos_documento as any)?.nombre ?? "documento";
    const diasRestantes = Math.ceil(
      (new Date(doc.fecha_vencimiento!).getTime() - hoy.getTime()) / 86400000
    );
    nuevasAlertas.push({
      tipo: "vencimiento_doc_chofer",
      severidad: diasRestantes <= 7 ? "critica" : "advertencia",
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
    .lte("fecha_vencimiento", en30Str)
    .gte("fecha_vencimiento", hoyStr);

  for (const cheque of cheques ?? []) {
    const key = `vencimiento_cheque:${cheque.id}`;
    if (existentesSet.has(key)) continue;
    const diasRestantes = Math.ceil(
      (new Date(cheque.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000
    );
    nuevasAlertas.push({
      tipo: "vencimiento_cheque",
      severidad: diasRestantes <= 7 ? "critica" : "advertencia",
      titulo: `Cheque próximo a vencer — ${cheque.librador_nombre}`,
      mensaje: `Cheque de $${Number(cheque.importe).toLocaleString("es-AR")} de ${cheque.librador_nombre} vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`,
      entidad_id: cheque.id,
      entidad_tipo: "cheques",
      fecha_disparo: new Date().toISOString(),
      fecha_vencimiento: cheque.fecha_vencimiento,
    });
  }

  if (nuevasAlertas.length > 0) {
    await supabase.from("alertas").insert(nuevasAlertas as any);
  }

  return nuevasAlertas.length;
}
