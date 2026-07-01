"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Tipos para el listado de liquidaciones de Loma (Excels importados)
// ---------------------------------------------------------------------------

export type LiqLomaRow = {
  id: string;
  periodo_desde: string | null; // ISO YYYY-MM-DD (derivado del min/max de fechas)
  periodo_hasta: string | null;
  total_importe_ars: number | null;
  fletes_count: number;
  estado: "importado" | "conciliado";
  importado_en: string;
  // Cuántos viajes quedaron vinculados a esta liquidación (por liq_loma_id)
  viajes_count: number;
  // Para descargar el Excel original
  archivo_id: string | null;
  archivo_nombre: string | null;
};

// ---------------------------------------------------------------------------
// Listado de liquidaciones ordenado por importación (más reciente primero)
// ---------------------------------------------------------------------------

export async function listLiqLomaAction(): Promise<LiqLomaRow[]> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: liqs, error } = await (supabase as any)
    .from("compliance_liq_loma")
    .select(
      "id, periodo_desde, periodo_hasta, total_importe_ars, fletes_count, estado, importado_en, archivo_id, archivo:documentos_archivos(nombre_original)",
    )
    .order("importado_en", { ascending: false });

  if (error || !liqs) {
    console.error("Error listando liquidaciones Loma:", error);
    return [];
  }

  // Conteo de viajes vinculados a cada liquidación (una sola query agregada)
  const ids: string[] = liqs.map((d: { id: string }) => d.id);
  const conteoPorLiq = new Map<string, number>();
  if (ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: counts } = await (supabase as any)
      .from("viajes")
      .select("liq_loma_id")
      .in("liq_loma_id", ids);
    for (const c of (counts ?? []) as { liq_loma_id: string }[]) {
      conteoPorLiq.set(c.liq_loma_id, (conteoPorLiq.get(c.liq_loma_id) ?? 0) + 1);
    }
  }

  return liqs.map(
    (d: {
      id: string;
      periodo_desde: string | null;
      periodo_hasta: string | null;
      total_importe_ars: number | string | null;
      fletes_count: number | null;
      estado: "importado" | "conciliado";
      importado_en: string;
      archivo_id: string | null;
      archivo: { nombre_original: string } | { nombre_original: string }[] | null;
    }) => {
      const arch = Array.isArray(d.archivo) ? d.archivo[0] : d.archivo;
      return {
        id: d.id,
        periodo_desde: d.periodo_desde,
        periodo_hasta: d.periodo_hasta,
        total_importe_ars:
          d.total_importe_ars != null ? Number(d.total_importe_ars) : null,
        fletes_count: d.fletes_count ?? 0,
        estado: d.estado,
        importado_en: d.importado_en,
        archivo_id: d.archivo_id,
        archivo_nombre: arch?.nombre_original ?? null,
        viajes_count: conteoPorLiq.get(d.id) ?? 0,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// URL firmada para descargar el Excel original de la liquidación
// ---------------------------------------------------------------------------

export async function getLiqLomaFileUrlAction(
  liqId: string,
): Promise<{ url?: string; error?: string }> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: liq } = await (supabase as any)
    .from("compliance_liq_loma")
    .select("archivo_id")
    .eq("id", liqId)
    .single();
  if (!liq?.archivo_id) return { error: "Esta liquidación no tiene archivo asociado" };

  const { data: arch } = await supabase
    .from("documentos_archivos")
    .select("bucket, path")
    .eq("id", liq.archivo_id)
    .single();
  if (!arch) return { error: "Archivo no encontrado" };

  const { data, error } = await supabase.storage
    .from(arch.bucket)
    .createSignedUrl(arch.path, 300);
  if (error || !data) return { error: "No se pudo generar el link" };
  return { url: data.signedUrl };
}

// ---------------------------------------------------------------------------
// Eliminar una liquidación (solo admin). Borra el registro y el archivo.
// Los viajes vinculados quedan con liq_loma_id=null (FK on delete set null).
// ---------------------------------------------------------------------------

export async function deleteLiqLomaAction(
  liqId: string,
): Promise<{ ok?: boolean; error?: string }> {
  await requireArea("viajes", "admin");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: liq } = await sb
    .from("compliance_liq_loma")
    .select("archivo_id, archivo:documentos_archivos(bucket, path)")
    .eq("id", liqId)
    .single();

  const { error } = await sb.from("compliance_liq_loma").delete().eq("id", liqId);
  if (error) return { error: "No se pudo eliminar la liquidación" };

  // Best effort: borrar el archivo físico también
  const arch = Array.isArray(liq?.archivo) ? liq.archivo[0] : liq?.archivo;
  if (arch?.bucket && arch?.path) {
    await supabase.storage.from(arch.bucket).remove([arch.path]);
  }
  if (liq?.archivo_id) {
    await sb.from("documentos_archivos").delete().eq("id", liq.archivo_id);
  }

  revalidatePath("/viajes/liquidaciones");
  return { ok: true };
}
