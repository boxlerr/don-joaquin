"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  crearUrlSubidaAdjunto,
  vincularAdjuntos,
  type AdjuntoCfg,
  type ArchivoMeta,
  type CrearUrlResult,
} from "@/lib/adjuntos-server";
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
  descripcion: string | null;
  nivel: string;
  periodicidad: string;
  dias_alerta: number | null;
  enviar_a: string | null;
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
    .select("id, codigo, nombre, descripcion, nivel, periodicidad, dias_alerta, enviar_a")
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
        requisito_descripcion: req.descripcion,
        nivel: req.nivel as ComplianceNivel,
        periodicidad: req.periodicidad as OrganismoChecklistRow["periodicidad"],
        dias_alerta: req.dias_alerta ?? 30,
        enviar_a: req.enviar_a ?? null,
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
      requisito_descripcion: req.descripcion,
      nivel: req.nivel as ComplianceNivel,
      periodicidad: req.periodicidad as OrganismoChecklistRow["periodicidad"],
      dias_alerta: req.dias_alerta ?? 30,
      enviar_a: req.enviar_a ?? null,
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

/**
 * Config de adjuntos del organismo: mismo bucket y misma tabla puente que el
 * resto de compliance, así los archivos viven todos en el mismo lugar.
 */
const ORGANISMO_ADJ: AdjuntoCfg = {
  bucket: "documentos-personal",
  folder: "compliance/organismos",
  junctionTable: "compliance_documento_archivos",
  entityColumn: "compliance_documento_id",
};

/** URL firmada para subir un archivo del organismo directo del navegador. */
export async function crearUrlSubidaOrganismoDocAction(input: {
  filename: string;
}): Promise<CrearUrlResult> {
  await requireArea("compliance", "write");
  return crearUrlSubidaAdjunto(ORGANISMO_ADJ, input.filename);
}

/**
 * Registra una presentación ante el organismo, con los archivos que la respaldan.
 *
 * Antes el archivo viajaba DENTRO del Server Action, en un FormData. Eso traía
 * tres límites que no hacían falta: uno solo por presentación, sólo PDF/PNG/JPG,
 * y un tope que además estaba mal — el diálogo prometía 10 MB pero
 * `serverActions.bodySizeLimit` es de 6 MB, así que un PDF de 7 MB fallaba con un
 * error opaco en vez del mensaje "Máximo 10MB" que el código creía estar dando.
 *
 * Ahora usa el mismo camino que el resto del sistema: el navegador sube directo
 * al Storage con una URL firmada y acá sólo llegan los metadatos. Sin tope de
 * Server Action, varios archivos y cualquier tipo de documento.
 */
export async function uploadOrganismoDocAction(input: {
  requisito_id: string;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  observaciones?: string | null;
  destinatario_slug?: string;
  archivos?: ArchivoMeta[];
}) {
  const user = await requireArea("compliance", "write");
  const supabase: AnyClient = createAdminClient();

  const { requisito_id } = input;
  const fecha_emision = input.fecha_emision || null;
  const fecha_vencimiento = input.fecha_vencimiento || null;
  const observaciones = input.observaciones?.trim() || null;
  const destinatario_slug = input.destinatario_slug || "";
  const archivos = input.archivos ?? [];

  if (!requisito_id) return { error: "Requisito requerido" };

  const { data: req } = await supabase
    .from("compliance_requisitos")
    .select("codigo, destinatario_id")
    .eq("id", requisito_id)
    .single();
  if (!req) return { error: "Requisito no encontrado" };

  const { data: doc, error: dbError } = await supabase
    .from("compliance_documentos")
    .insert({
      requisito_id,
      chofer_id: null,
      camion_id: null,
      periodo: null,
      fecha_emision,
      fecha_vencimiento, // nullable tras la migración
      archivo_id: null,
      observaciones,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (dbError || !doc) return { error: "Error al guardar la presentación" };

  const nuevoDocId = (doc as { id: string }).id;

  // Vincular todos los archivos y dejar el primero como portada (`archivo_id`),
  // que es lo que muestra el botón "Ver" del checklist.
  let fallidos = 0;
  if (archivos.length > 0) {
    const r = await vincularAdjuntos(ORGANISMO_ADJ, nuevoDocId, archivos, user.id);
    fallidos = r.fallidos;
    const { data: primero } = await supabase
      .from(ORGANISMO_ADJ.junctionTable)
      .select("archivo_id")
      .eq(ORGANISMO_ADJ.entityColumn, nuevoDocId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if ((primero as { archivo_id: string } | null)?.archivo_id) {
      await supabase
        .from("compliance_documentos")
        .update({ archivo_id: (primero as { archivo_id: string }).archivo_id })
        .eq("id", nuevoDocId);
    }
  }

  // La carga de compliance no dejaba ninguna huella en auditoría: se sabía quién
  // había cambiado una fecha, pero no quién presentó el documento — que es lo que
  // hay que poder mostrar si el organismo pregunta.
  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "cargar_presentacion_organismo",
    entidad_tipo: "compliance_documentos",
    entidad_id: nuevoDocId,
    valores_nuevos: {
      requisito_id,
      fecha_emision,
      fecha_vencimiento,
      archivos: archivos.length,
    },
  });

  revalidatePath("/compliance");
  revalidatePath(`/compliance/organismos/${destinatario_slug}`, "layout");
  return fallidos > 0 ? { success: true, fallidos } : { success: true };
}

// ---------------------------------------------------------------------------
// ABM de requisitos del organismo
//
// Hasta acá, SICOP y Secondi eran pantallas de solo lectura sobre una tabla que
// no se podía llenar desde ningún lado: el estado vacío decía "agregá requisitos
// desde la base de datos", que para Noelia no es una instrucción, es una pared.
// De los 21 requisitos cargados, CERO son de organismo, justamente por esto.
//
// El código se genera solo a partir del nombre. Es una clave interna que nadie
// de la oficina tiene por qué inventar, y si la escriben a mano vuelve con
// espacios y acentos.
// ---------------------------------------------------------------------------

const NIVELES: ComplianceNivel[] = ["chofer", "unidad", "empresa"];
const PERIODICIDADES = ["mensual", "anual", "renovable", "unica"] as const;
export type OrganismoPeriodicidad = (typeof PERIODICIDADES)[number];

/** Nombre → código interno: "Habilitación de tránsito" → "HABILITACION_DE_TRANSITO". */
function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

type RequisitoInput = {
  nombre: string;
  descripcion?: string | null;
  nivel: ComplianceNivel;
  periodicidad: OrganismoPeriodicidad;
  dias_alerta: number;
  enviar_a?: string | null;
};

function validarRequisito(input: RequisitoInput): string | null {
  if (!input.nombre?.trim()) return "El nombre es obligatorio";
  if (!NIVELES.includes(input.nivel)) return "Nivel inválido";
  if (!PERIODICIDADES.includes(input.periodicidad)) return "Periodicidad inválida";
  // La base tiene CHECK (dias_alerta > 0): sin esto vuelve un error de Postgres crudo.
  if (!Number.isFinite(input.dias_alerta) || input.dias_alerta <= 0) {
    return "Los días de aviso tienen que ser un número mayor a 0";
  }
  if (input.dias_alerta > 365) return "Los días de aviso no pueden pasar de 365";
  return null;
}

export async function crearRequisitoOrganismoAction(
  input: RequisitoInput & { destinatario_id: string; destinatario_slug: string },
) {
  const user = await requireArea("compliance", "write");
  const supabase: AnyClient = createAdminClient();

  const invalido = validarRequisito(input);
  if (invalido) return { error: invalido };
  if (!input.destinatario_id) return { error: "Organismo requerido" };

  const nombre = input.nombre.trim();
  const codigoBase = codigoDesdeNombre(nombre);
  if (!codigoBase) return { error: "El nombre tiene que tener al menos una letra o número" };

  // El código es único en toda la tabla, así que puede chocar con el de otro
  // organismo o con uno de cliente. Se desambigua con un sufijo en vez de
  // devolverle al usuario un error de clave duplicada que no puede resolver.
  let codigo = codigoBase;
  for (let i = 2; i <= 20; i++) {
    const { data: existe } = await supabase
      .from("compliance_requisitos")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!existe) break;
    codigo = `${codigoBase.slice(0, 37)}_${i}`;
  }

  // Se agrega al final de la lista del organismo.
  const { data: ultimo } = await supabase
    .from("compliance_requisitos")
    .select("orden")
    .eq("tipo_destinatario", "organismo")
    .eq("destinatario_id", input.destinatario_id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((ultimo as { orden: number } | null)?.orden ?? 0) + 1;

  const { data, error } = await supabase
    .from("compliance_requisitos")
    .insert({
      codigo,
      nombre,
      descripcion: input.descripcion?.trim() || null,
      nivel: input.nivel,
      periodicidad: input.periodicidad,
      dias_alerta: input.dias_alerta,
      enviar_a: input.enviar_a?.trim() || null,
      tipo_destinatario: "organismo",
      destinatario_id: input.destinatario_id,
      // cliente_aplica no aplica a organismos, pero la columna es NOT NULL.
      cliente_aplica: "AMBOS",
      activo: true,
      orden,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el requisito" };

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "crear_requisito_compliance",
    entidad_tipo: "compliance_requisitos",
    entidad_id: (data as { id: string }).id,
    valores_nuevos: { codigo, nombre, nivel: input.nivel, destinatario_id: input.destinatario_id },
  });

  revalidatePath("/compliance");
  revalidatePath(`/compliance/organismos/${input.destinatario_slug}`, "layout");
  return { success: true, id: (data as { id: string }).id };
}

export async function editarRequisitoOrganismoAction(
  input: RequisitoInput & { id: string; destinatario_slug: string },
) {
  const user = await requireArea("compliance", "write");
  const supabase: AnyClient = createAdminClient();

  const invalido = validarRequisito(input);
  if (invalido) return { error: invalido };
  if (!input.id) return { error: "Requisito requerido" };

  const { data: prev } = await supabase
    .from("compliance_requisitos")
    .select("nombre, descripcion, nivel, periodicidad, dias_alerta, enviar_a")
    .eq("id", input.id)
    .maybeSingle();
  if (!prev) return { error: "Requisito no encontrado" };

  // El código NO se toca al editar: es la clave con la que ya quedaron atadas
  // las presentaciones y los archivos que están en el Storage.
  const upd = {
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
    nivel: input.nivel,
    periodicidad: input.periodicidad,
    dias_alerta: input.dias_alerta,
    enviar_a: input.enviar_a?.trim() || null,
  };

  const { error } = await supabase.from("compliance_requisitos").update(upd).eq("id", input.id);
  if (error) return { error: "No se pudo guardar el requisito" };

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "editar_requisito_compliance",
    entidad_tipo: "compliance_requisitos",
    entidad_id: input.id,
    valores_anteriores: prev,
    valores_nuevos: upd,
  });

  revalidatePath("/compliance");
  revalidatePath(`/compliance/organismos/${input.destinatario_slug}`, "layout");
  return { success: true };
}

/**
 * Da de baja un requisito.
 *
 * Si nunca se presentó nada, se borra de verdad — es un error de tipeo y no
 * tiene sentido dejarlo. Si ya tiene presentaciones, se desactiva: borrarlo se
 * llevaría puesto el historial y los archivos, que es lo que hay que poder
 * mostrarle a un organismo si pregunta.
 */
export async function eliminarRequisitoOrganismoAction(input: {
  id: string;
  destinatario_slug: string;
}) {
  const user = await requireArea("compliance", "write");
  const supabase: AnyClient = createAdminClient();
  if (!input.id) return { error: "Requisito requerido" };

  const { data: req } = await supabase
    .from("compliance_requisitos")
    .select("nombre, codigo")
    .eq("id", input.id)
    .maybeSingle();
  if (!req) return { error: "Requisito no encontrado" };

  const { count } = await supabase
    .from("compliance_documentos")
    .select("id", { count: "exact", head: true })
    .eq("requisito_id", input.id);

  const tienePresentaciones = (count ?? 0) > 0;

  if (tienePresentaciones) {
    const { error } = await supabase
      .from("compliance_requisitos")
      .update({ activo: false })
      .eq("id", input.id);
    if (error) return { error: "No se pudo dar de baja el requisito" };
  } else {
    const { error } = await supabase.from("compliance_requisitos").delete().eq("id", input.id);
    if (error) return { error: "No se pudo eliminar el requisito" };
  }

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: tienePresentaciones ? "desactivar_requisito_compliance" : "eliminar_requisito_compliance",
    entidad_tipo: "compliance_requisitos",
    entidad_id: input.id,
    valores_anteriores: req,
    valores_nuevos: { presentaciones: count ?? 0 },
  });

  revalidatePath("/compliance");
  revalidatePath(`/compliance/organismos/${input.destinatario_slug}`, "layout");
  return {
    success: true,
    desactivado: tienePresentaciones,
    presentaciones: count ?? 0,
  };
}
