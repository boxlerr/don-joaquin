"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import type {
  ComplianceDestinatario,
  ComplianceEstado,
  ComplianceNivel,
  OrganismoChecklistRow,
} from "../types";

// `compliance_destinatarios` y las columnas `tipo_destinatario`/`destinatario_id` en
// `compliance_requisitos` son nuevas — no están en database.ts todavía.
// Se actualiza al regenerar los tipos tras aplicar las migraciones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcularEstado(
  fechaVencimiento: string | null,
  diasAlerta: number,
): { estado: ComplianceEstado; diasRestantes: number | null } {
  if (!fechaVencimiento) {
    return { estado: "vigente", diasRestantes: null };
  }

  const [y, m, d] = fechaVencimiento.split("-").map(Number);
  const hoy = new Date();
  const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const venceMidnight = new Date(y!, m! - 1, d!);
  const diffMs = venceMidnight.getTime() - hoyMidnight.getTime();
  const diasRestantes = Math.round(diffMs / 86400000);

  let estado: ComplianceEstado;
  if (diasRestantes < 0) {
    estado = "vencido";
  } else if (diasRestantes <= diasAlerta) {
    estado = "por_vencer";
  } else {
    estado = "vigente";
  }

  return { estado, diasRestantes };
}

// ---------------------------------------------------------------------------
// Leer lista de organismos activos
// ---------------------------------------------------------------------------

export async function getOrganismosAction(): Promise<ComplianceDestinatario[]> {
  await requireArea("compliance", "read");
  const supabase: AnyClient = createAdminClient();

  const { data } = await supabase
    .from("compliance_destinatarios")
    .select("id, codigo, nombre, descripcion, orden, activo")
    .eq("activo", true)
    .order("orden");

  return (data ?? []) as ComplianceDestinatario[];
}

// ---------------------------------------------------------------------------
// Checklist de requisitos de un organismo con estado calculado
// ---------------------------------------------------------------------------

type ReqRow = {
  id: string;
  codigo: string;
  nombre: string;
  nivel: string;
  periodicidad: string;
  dias_alerta: number | null;
};

type DocRow = {
  id: string;
  requisito_id: string;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  archivo_id: string | null;
  observaciones: string | null;
  created_at: string | null;
  created_by: string | null;
  usuarios: { nombre: string; apellido: string | null } | null;
};

export async function getOrganismoChecklistAction(destinatario_id: string): Promise<{
  destinatario: ComplianceDestinatario | null;
  rows: OrganismoChecklistRow[];
}> {
  await requireArea("compliance", "read");
  const supabase: AnyClient = createAdminClient();

  // Destinatario
  const { data: dest } = await supabase
    .from("compliance_destinatarios")
    .select("id, codigo, nombre, descripcion, orden, activo")
    .eq("id", destinatario_id)
    .single();

  if (!dest) return { destinatario: null, rows: [] };

  // Requisitos del organismo
  const { data: requisitos } = await supabase
    .from("compliance_requisitos")
    .select("id, codigo, nombre, nivel, periodicidad, dias_alerta")
    .eq("tipo_destinatario", "organismo")
    .eq("destinatario_id", destinatario_id)
    .eq("activo", true)
    .order("orden");

  const reqs = (requisitos ?? []) as ReqRow[];

  if (reqs.length === 0) {
    return { destinatario: dest as ComplianceDestinatario, rows: [] };
  }

  const requisitoIds = reqs.map((r) => r.id);

  // Documento más reciente por requisito (si existe), con info del usuario
  const { data: documentos } = await supabase
    .from("compliance_documentos")
    .select(`
      id,
      requisito_id,
      fecha_emision,
      fecha_vencimiento,
      archivo_id,
      observaciones,
      created_at,
      created_by,
      usuarios!compliance_documentos_created_by_fkey(nombre, apellido)
    `)
    .in("requisito_id", requisitoIds)
    .order("created_at", { ascending: false });

  // Tomamos el doc más reciente por requisito_id
  const docPorRequisito = new Map<string, {
    id: string;
    fecha_emision: string | null;
    fecha_vencimiento: string | null;
    archivo_id: string | null;
    observaciones: string | null;
    presentado_por_nombre: string | null;
    created_at: string | null;
  }>();

  for (const doc of (documentos ?? []) as DocRow[]) {
    if (!docPorRequisito.has(doc.requisito_id)) {
      const usuario = doc.usuarios;
      docPorRequisito.set(doc.requisito_id, {
        id: doc.id,
        fecha_emision: doc.fecha_emision,
        fecha_vencimiento: doc.fecha_vencimiento,
        archivo_id: doc.archivo_id,
        observaciones: doc.observaciones,
        presentado_por_nombre: usuario
          ? `${usuario.nombre}${usuario.apellido ? " " + usuario.apellido : ""}`
          : null,
        created_at: doc.created_at,
      });
    }
  }

  const rows: OrganismoChecklistRow[] = reqs.map((req) => {
    const doc = docPorRequisito.get(req.id) ?? null;

    if (!doc) {
      return {
        requisito_id: req.id,
        requisito_codigo: req.codigo,
        requisito_nombre: req.nombre,
        nivel: req.nivel as ComplianceNivel,
        periodicidad: req.periodicidad as OrganismoChecklistRow["periodicidad"],
        dias_alerta: req.dias_alerta ?? 30,
        documento_id: null,
        fecha_emision: null,
        fecha_vencimiento: null,
        archivo_id: null,
        observaciones: null,
        presentado_por_nombre: null,
        created_at: null,
        estado: "faltante",
        dias_restantes: null,
      };
    }

    const { estado, diasRestantes } = calcularEstado(doc.fecha_vencimiento, req.dias_alerta ?? 30);

    return {
      requisito_id: req.id,
      requisito_codigo: req.codigo,
      requisito_nombre: req.nombre,
      nivel: req.nivel as ComplianceNivel,
      periodicidad: req.periodicidad as OrganismoChecklistRow["periodicidad"],
      dias_alerta: req.dias_alerta ?? 30,
      documento_id: doc.id,
      fecha_emision: doc.fecha_emision,
      fecha_vencimiento: doc.fecha_vencimiento,
      archivo_id: doc.archivo_id,
      observaciones: doc.observaciones,
      presentado_por_nombre: doc.presentado_por_nombre,
      created_at: doc.created_at,
      estado,
      dias_restantes: diasRestantes,
    };
  });

  return { destinatario: dest as ComplianceDestinatario, rows };
}

// ---------------------------------------------------------------------------
// Cargar presentación de un requisito de organismo
// ---------------------------------------------------------------------------

export async function uploadOrganismoDocAction(formData: FormData) {
  const user = await requireArea("compliance", "write");
  const supabase: AnyClient = createAdminClient();

  const requisito_id = formData.get("requisito_id") as string;
  const fecha_emision = (formData.get("fecha_emision") as string) || null;
  const fecha_vencimiento = (formData.get("fecha_vencimiento") as string) || null;
  const observaciones = (formData.get("observaciones") as string) || null;
  // Archivo OPCIONAL: se puede registrar solo el vencimiento/observaciones.
  const fileRaw = formData.get("file");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  const destinatario_slug = (formData.get("destinatario_slug") as string) || "";

  if (!requisito_id) return { error: "Requisito requerido" };
  if (file && file.size > 10 * 1024 * 1024) return { error: "Máximo 10MB" };

  const { data: req } = await supabase
    .from("compliance_requisitos")
    .select("codigo, destinatario_id")
    .eq("id", requisito_id)
    .single();
  if (!req) return { error: "Requisito no encontrado" };

  let archivoId: string | null = null;
  if (file) {
    const ext = file.name.split(".").pop();
    const storagePath = `compliance/organismos/${(req as { codigo: string }).codigo}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos-personal")
      .upload(storagePath, file);
    if (uploadError) return { error: "Error al subir el archivo" };

    const { data: archivo, error: archivoError } = await supabase
      .from("documentos_archivos")
      .insert({
        bucket: "documentos-personal",
        nombre_original: file.name,
        path: storagePath,
        tamano_bytes: file.size,
        mime_type: file.type,
        subido_por: user.id,
      })
      .select("id")
      .single();
    if (archivoError || !archivo) return { error: "Error al registrar el archivo" };
    archivoId = (archivo as { id: string }).id;
  }

  const { error: dbError } = await supabase.from("compliance_documentos").insert({
    requisito_id,
    chofer_id: null,
    camion_id: null,
    periodo: null,
    fecha_emision,
    fecha_vencimiento,  // nullable tras la migración
    archivo_id: archivoId,
    observaciones,
    created_by: user.id,
  });
  if (dbError) return { error: "Error al guardar la presentación" };

  revalidatePath(`/compliance/organismos/${destinatario_slug}`);
  return { success: true };
}
