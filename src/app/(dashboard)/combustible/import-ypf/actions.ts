"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  buildYpfPreview,
  runYpfImport,
  type YpfPreviewData,
  type YpfConfirmData,
} from "./import-core-ypf";

export type { YpfPreviewData, YpfConfirmData } from "./import-core-ypf";

export async function previewYpfImportAction(formData: FormData): Promise<YpfPreviewData> {
  await requireArea("combustible", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá el reporte de consumos de YPF (.xlsx)." };
  }

  const supabase = createAdminClient();
  return buildYpfPreview(supabase, Buffer.from(await file.arrayBuffer()));
}

export async function confirmYpfImportAction(formData: FormData): Promise<YpfConfirmData> {
  const user = await requireArea("combustible", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Volvé a adjuntar el archivo para confirmar la importación." };
  }

  const supabase = createAdminClient();
  const result = await runYpfImport(supabase, Buffer.from(await file.arrayBuffer()), user.id);

  if ("ok" in result && result.ok) {
    revalidatePath("/combustible");
    revalidatePath("/camiones");
  }
  return result;
}
