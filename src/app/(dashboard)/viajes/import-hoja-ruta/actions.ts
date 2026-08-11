"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  buildHojaRutaPreview,
  runHojaRutaImport,
  type AsignacionSheet,
  type ConfirmImportData,
  type HojaRutaPreviewData,
} from "./import-core";

// La lógica real vive en ./import-core.ts (sin "use server") para poder
// ejecutarla también desde scripts de mantenimiento. Acá solo queda la capa
// de auth + parseo del FormData + revalidación de rutas.

export type {
  AsignacionSheet,
  ChoferMatch,
  FilaFutura,
  FilaFueraDeMes,
  SheetPreview,
  SheetViajePreview,
  ViajesPorMes,
  ViajeYaCargado,
} from "./import-core";

export type HojaRutaPreviewState = HojaRutaPreviewData;
export type ConfirmHojaRutaState = ConfirmImportData;

export async function previewHojaRutaImportAction(
  formData: FormData,
): Promise<HojaRutaPreviewState> {
  await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá el archivo .xlsx para analizarlo." };
  }

  const supabase = createAdminClient();
  return buildHojaRutaPreview(supabase, Buffer.from(await file.arrayBuffer()));
}

export async function confirmHojaRutaImportAction(
  formData: FormData,
): Promise<ConfirmHojaRutaState> {
  const user = await requireArea("viajes", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Volvé a adjuntar el archivo para confirmar la carga." };
  }
  const asignacionesRaw = formData.get("asignaciones");
  if (typeof asignacionesRaw !== "string") {
    return { error: "Faltan las asignaciones chofer-sheet del preview." };
  }
  let asignaciones: AsignacionSheet[];
  try {
    asignaciones = JSON.parse(asignacionesRaw);
  } catch {
    return { error: "Asignaciones inválidas." };
  }

  const supabase = createAdminClient();
  const result = await runHojaRutaImport(
    supabase,
    Buffer.from(await file.arrayBuffer()),
    asignaciones,
    user.id,
    {
      archivo: file.name,
      omitirFechasFuturas: formData.get("omitirFechasFuturas") === "1",
    },
  );

  if (result?.ok) {
    revalidatePath("/viajes");
    revalidatePath("/viajes/hoja-ruta");
  }
  return result;
}
