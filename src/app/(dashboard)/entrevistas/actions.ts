"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { Database } from "@/types/database";
import { logEntrevistaAudit } from "./audit";
import {
  crearUrlSubidaAdjunto,
  vincularAdjuntos,
  getAdjuntos,
  deleteAdjunto,
  type AdjuntoCfg,
  type ArchivoMeta,
  type AdjuntoExistente,
  type CrearUrlResult,
} from "@/lib/adjuntos-server";

type EntrevistaInsert = Database["public"]["Tables"]["entrevistas"]["Insert"];

const PREOCUPACIONAL_VALUES = ["no_aplica", "pendiente", "apto", "no_apto"] as const;
const RESULTADO_VALUES = ["pendiente", "ingresa", "no_ingresa"] as const;
// "nuevo" se eliminó del flujo (14/07): la entrevista es el punto de entrada.
const ETAPAS = ["entrevista", "preocupacional", "ingresado", "descartado"] as const;
type Etapa = (typeof ETAPAS)[number];

// Etapa inicial del pipeline según los campos cargados (misma lógica que el backfill).
function etapaDesde(preocupacional: string, resultado: string): Etapa {
  if (resultado === "ingresa") return "ingresado";
  if (resultado === "no_ingresa") return "descartado";
  if (["pendiente", "apto", "no_apto"].includes(preocupacional)) return "preocupacional";
  return "entrevista";
}

// Adjuntos de CV: mismo modelo multi-archivo que el resto (tabla puente entrevista_archivos).
const CV_CFG: AdjuntoCfg = {
  bucket: "documentos-personal",
  junctionTable: "entrevista_archivos",
  entityColumn: "entrevista_id",
  folder: "cv-entrevistas",
};

export type EntrevistaFormData = {
  nombre: string;
  fecha_entrevista?: string;
  edad?: string;
  localidad?: string;
  telefono?: string;
  dni?: string;
  email?: string;
  puesto?: string;
  experiencia?: string;
  contacto_emergencia?: string;
  observaciones?: string;
  preocupacional: string;
  resultado: string;
  // Seguimiento post-entrevista (columnas del Excel, texto libre):
  preocupacional_nota?: string;
  aprobado?: string;
  entro?: string;
  se_mantuvo?: string;
};

function buildPayload(data: EntrevistaFormData): EntrevistaInsert | { error: string } {
  const nombre = data.nombre?.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  let edad: number | null = null;
  if (data.edad && data.edad.trim() !== "") {
    const n = Number(data.edad);
    if (!Number.isInteger(n) || n < 14 || n > 99) {
      return { error: "La edad debe ser un número entre 14 y 99." };
    }
    edad = n;
  }

  const preocupacional = PREOCUPACIONAL_VALUES.includes(data.preocupacional as never)
    ? data.preocupacional
    : "no_aplica";
  const resultado = RESULTADO_VALUES.includes(data.resultado as never)
    ? data.resultado
    : "pendiente";

  return {
    nombre,
    fecha_entrevista: data.fecha_entrevista || null,
    edad,
    localidad: data.localidad?.trim() || null,
    telefono: data.telefono?.trim() || null,
    dni: data.dni?.trim() || null,
    email: data.email?.trim() || null,
    puesto: data.puesto?.trim() || null,
    experiencia: data.experiencia?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    contacto_emergencia: data.contacto_emergencia?.trim() || null,
    preocupacional,
    resultado,
    preocupacional_nota: data.preocupacional_nota?.trim() || null,
    aprobado: data.aprobado?.trim() || null,
    entro: data.entro?.trim() || null,
    se_mantuvo: data.se_mantuvo?.trim() || null,
    // dni/email/puesto/experiencia y las de seguimiento son columnas nuevas, aún no en database.ts.
  } as unknown as EntrevistaInsert;
}

// El semáforo de la lista/tablero ya no guarda una "valoración" propia: ahora
// refleja y mueve la `etapa` del pipeline (ver setEtapaEntrevistaAction abajo).

// ── Guardado parcial desde la ficha (drawer): solo los campos editados ──────
const PATCH_TEXTO = [
  "observaciones", "preocupacional_nota", "aprobado", "entro", "se_mantuvo",
  "motivo_descarte", "contacto_emergencia", "telefono", "dni", "email",
  "puesto", "experiencia", "localidad",
] as const;
type PatchCampoTexto = (typeof PATCH_TEXTO)[number];

export type EntrevistaPatch = Partial<Record<PatchCampoTexto, string>> & {
  preocupacional?: string;
  resultado?: string;
  fecha_entrevista?: string;
  edad?: string;
};

export async function patchEntrevistaAction(id: string, patch: EntrevistaPatch) {
  const user = await requireArea("rrhh", "write");

  const cambios: Record<string, unknown> = {};
  for (const campo of PATCH_TEXTO) {
    if (campo in patch) cambios[campo] = patch[campo]?.trim() || null;
  }
  if ("preocupacional" in patch) {
    if (!PREOCUPACIONAL_VALUES.includes(patch.preocupacional as never)) return { error: "Preocupacional inválido." };
    cambios.preocupacional = patch.preocupacional;
  }
  if ("resultado" in patch) {
    if (!RESULTADO_VALUES.includes(patch.resultado as never)) return { error: "Resultado inválido." };
    cambios.resultado = patch.resultado;
  }
  if ("fecha_entrevista" in patch) {
    const f = patch.fecha_entrevista?.trim();
    if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return { error: "Fecha inválida." };
    cambios.fecha_entrevista = f || null;
  }
  if ("edad" in patch) {
    const raw = patch.edad?.trim();
    if (!raw) cambios.edad = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 14 || n > 99) return { error: "La edad debe ser un número entre 14 y 99." };
      cambios.edad = n;
    }
  }
  if (!Object.keys(cambios).length) return { success: true };

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Si cambió el preocupacional o el resultado desde la ficha, recalcular la
  // etapa del pipeline: si no, el tablero y los KPIs ("En proceso"/"Ingresaron")
  // quedan desincronizados con lo que se editó acá.
  if ("preocupacional" in patch || "resultado" in patch) {
    const { data: est } = await sb.from("entrevistas").select("preocupacional, resultado").eq("id", id).single();
    cambios.etapa = etapaDesde(
      (cambios.preocupacional ?? est?.preocupacional ?? "no_aplica") as string,
      (cambios.resultado ?? est?.resultado ?? "pendiente") as string,
    );
  }

  const { data: anterior } = await sb.from("entrevistas").select(Object.keys(cambios).join(", ")).eq("id", id).single();
  const { error } = await sb.from("entrevistas").update(cambios).eq("id", id);
  if (error) {
    console.error("Error al guardar la ficha:", error);
    return { error: "No se pudieron guardar los cambios." };
  }
  await logEntrevistaAudit(id, "editar", anterior ?? null, cambios, user.id);
  revalidatePath("/entrevistas");
  return { success: true };
}

export async function addEntrevistaAction(data: EntrevistaFormData) {
  const user = await requireArea("rrhh", "write");
  const payload = buildPayload(data);
  if ("error" in payload) return payload;

  const supabase = createAdminClient();
  const etapa = etapaDesde(payload.preocupacional as string, payload.resultado as string);
  const { data: inserted, error } = await supabase
    .from("entrevistas")
    // etapa: columna nueva del pipeline, aún no está en database.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...payload, etapa } as any)
    .select("id")
    .single();

  if (error) {
    console.error("Error al insertar entrevista:", error);
    return { error: "No se pudo registrar la entrevista." };
  }

  if (inserted?.id) {
    await logEntrevistaAudit(inserted.id, "crear", null, payload, user.id);
  }

  revalidatePath("/entrevistas");
  return { success: true };
}

export async function updateEntrevistaAction(id: string, data: EntrevistaFormData) {
  const user = await requireArea("rrhh", "write");
  const payload = buildPayload(data);
  if ("error" in payload) return payload;

  const supabase = createAdminClient();

  const { data: anterior } = await supabase
    .from("entrevistas")
    .select("*")
    .eq("id", id)
    .single();

  // Recalcular la etapa del pipeline con lo cargado (igual que al crear), para
  // que "Editar todo" no deje el tablero desincronizado.
  const etapa = etapaDesde(payload.preocupacional as string, payload.resultado as string);
  const { error } = await supabase
    .from("entrevistas")
    // etapa: columna del pipeline, aún no tipada en database.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...payload, etapa } as any)
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar entrevista:", error);
    return { error: "No se pudo actualizar la entrevista." };
  }

  await logEntrevistaAudit(id, "editar", anterior ?? null, payload, user.id);

  revalidatePath("/entrevistas");
  return { success: true };
}

export async function deleteEntrevistaAction(id: string) {
  const user = await requireArea("rrhh", "write");
  const supabase = createAdminClient();

  const { data: anterior } = await supabase
    .from("entrevistas")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("entrevistas").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar entrevista:", error);
    return { error: "No se pudo eliminar la entrevista." };
  }

  await logEntrevistaAudit(id, "eliminar", anterior ?? null, null, user.id);

  revalidatePath("/entrevistas");
  return { success: true };
}

// ── Pipeline: mover de etapa ────────────────────────────────────────────────
export async function setEtapaEntrevistaAction(id: string, etapa: string, motivo?: string) {
  const user = await requireArea("rrhh", "write");
  if (!ETAPAS.includes(etapa as Etapa)) return { error: "Etapa inválida." };

  const supabase = createAdminClient();
  // Sincronizamos resultado + motivo con la etapa: terminales → ingresa/no_ingresa;
  // no terminales → vuelven a 'pendiente' y limpian el motivo (evita que al mover
  // una card HACIA ATRÁS quede un resultado/motivo viejo desincronizado).
  const patch: Record<string, unknown> = { etapa };
  if (etapa === "ingresado") { patch.resultado = "ingresa"; patch.motivo_descarte = null; }
  else if (etapa === "descartado") { patch.resultado = "no_ingresa"; patch.motivo_descarte = motivo?.trim() || null; }
  else { patch.resultado = "pendiente"; patch.motivo_descarte = null; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: anterior } = await sb.from("entrevistas").select("etapa, resultado, preocupacional").eq("id", id).single();
  // Al mandarlo al preocupacional, el examen queda "a realizar" si no estaba definido.
  if (etapa === "preocupacional" && (anterior?.preocupacional ?? "no_aplica") === "no_aplica") {
    patch.preocupacional = "pendiente";
  }
  const { error } = await sb.from("entrevistas").update(patch).eq("id", id);
  if (error) {
    console.error("Error al mover etapa:", error);
    return { error: "No se pudo mover la etapa." };
  }
  await logEntrevistaAudit(id, "editar", anterior ?? null, patch, user.id);
  revalidatePath("/entrevistas");
  return { success: true };
}

// ── CVs adjuntos (multi-archivo) ────────────────────────────────────────────
export async function crearUrlSubidaCvAction(input: { filename: string }): Promise<CrearUrlResult> {
  await requireArea("rrhh", "write");
  return crearUrlSubidaAdjunto(CV_CFG, input.filename);
}

export async function vincularCvAction(entrevistaId: string, archivos: ArchivoMeta[]) {
  const user = await requireArea("rrhh", "write");
  const r = await vincularAdjuntos(CV_CFG, entrevistaId, archivos, user.id);
  revalidatePath("/entrevistas");
  return r.fallidos > 0 ? { ok: true, fallidos: r.fallidos } : { ok: true };
}

export async function getCvsAction(entrevistaId: string): Promise<AdjuntoExistente[]> {
  await requireArea("rrhh", "read");
  return getAdjuntos(CV_CFG, entrevistaId);
}

export async function deleteCvAction(adjuntoId: string) {
  await requireArea("rrhh", "write");
  const r = await deleteAdjunto(CV_CFG, adjuntoId);
  revalidatePath("/entrevistas");
  return r;
}
