"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  buildLomaPreview,
  runLomaImport,
  type ChoferAsignacion,
  type ConfirmLomaData,
  type LomaPreviewData,
} from "./import-core";

// La lógica vive en ./import-core.ts (sin "use server"). Acá queda solo la capa
// de auth + parseo del FormData + revalidación de rutas.

export type {
  RowPreview,
  ExpedidorPreview,
  ChoferAsignacion,
  ChoferMatch,
} from "./import-core";

export type LomaPreviewState = LomaPreviewData;
export type ConfirmLomaState = ConfirmLomaData;

export async function previewLomaImportAction(
  formData: FormData,
): Promise<LomaPreviewState> {
  await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá el archivo .xlsx para analizarlo." };
  }

  const supabase = createAdminClient();
  return buildLomaPreview(supabase, Buffer.from(await file.arrayBuffer()));
}

export async function confirmLomaImportAction(
  formData: FormData,
): Promise<ConfirmLomaState> {
  const user = await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Volvé a adjuntar el archivo para confirmar la carga." };
  }

  const expedidoresRaw = formData.get("expedidoresLoma");
  const asignacionesRaw = formData.get("asignaciones");
  if (typeof expedidoresRaw !== "string" || typeof asignacionesRaw !== "string") {
    return { error: "Faltan datos del preview (expedidores / asignaciones)." };
  }

  const crearNoCargados = formData.get("crearNoCargados") === "true";

  let expedidoresLoma: string[];
  let asignaciones: ChoferAsignacion[];
  try {
    expedidoresLoma = JSON.parse(expedidoresRaw);
    asignaciones = JSON.parse(asignacionesRaw);
  } catch {
    return { error: "Datos del preview inválidos." };
  }

  const supabase = createAdminClient();
  const result = await runLomaImport(
    supabase,
    Buffer.from(await file.arrayBuffer()),
    { expedidoresLoma, asignaciones, crearNoCargados },
    user.id,
    { archivo: file.name },
  );

  if (result?.ok) {
    revalidatePath("/viajes");
    revalidatePath("/viajes/hoja-ruta");
  }
  return result;
}
