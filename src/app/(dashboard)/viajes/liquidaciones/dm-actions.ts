"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Tipos para el listado de DMs (Documentos de Medición de YPF)
// ---------------------------------------------------------------------------

export type DmYpfRow = {
  id: string;
  periodo_desde: string; // ISO YYYY-MM-DD
  periodo_hasta: string;
  numero_solpe: string | null;
  numero_pedido: string | null;
  contrato_sap: string | null;
  solicitante: string | null;
  total_certificado_ars: number | null;
  fecha_certificacion: string | null;
  estado: "importado" | "conciliado";
  importado_en: string;
  // Conteo de viajes asociados (cuántas filas de detalle quedaron vinculadas)
  viajes_count: number;
  // Para descargar el PDF firmado de YPF
  archivo_id: string | null;
  archivo_nombre: string | null;
};

// ---------------------------------------------------------------------------
// Listado de DMs ordenado por período (más reciente primero)
// ---------------------------------------------------------------------------

export async function listDmYpfAction(): Promise<DmYpfRow[]> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();

  // Traemos los DMs + el archivo (para mostrar nombre y poder descargar)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dms, error } = await (supabase as any)
    .from("compliance_dm_ypf")
    .select(
      "id, periodo_desde, periodo_hasta, numero_solpe, numero_pedido, contrato_sap, solicitante, total_certificado_ars, fecha_certificacion, estado, importado_en, archivo_id, archivo:documentos_archivos(nombre_original)",
    )
    .order("periodo_desde", { ascending: false });

  if (error || !dms) {
    console.error("Error listando DM YPF:", error);
    return [];
  }

  // Conteo de viajes asociados a cada DM (una sola query agregada)
  const ids: string[] = dms.map((d: { id: string }) => d.id);
  const conteoPorDm = new Map<string, number>();
  if (ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: counts } = await (supabase as any)
      .from("viajes")
      .select("dm_ypf_id")
      .in("dm_ypf_id", ids);
    for (const c of (counts ?? []) as { dm_ypf_id: string }[]) {
      conteoPorDm.set(c.dm_ypf_id, (conteoPorDm.get(c.dm_ypf_id) ?? 0) + 1);
    }
  }

  return dms.map(
    (d: {
      id: string;
      periodo_desde: string;
      periodo_hasta: string;
      numero_solpe: string | null;
      numero_pedido: string | null;
      contrato_sap: string | null;
      solicitante: string | null;
      total_certificado_ars: number | string | null;
      fecha_certificacion: string | null;
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
        numero_solpe: d.numero_solpe,
        numero_pedido: d.numero_pedido,
        contrato_sap: d.contrato_sap,
        solicitante: d.solicitante,
        total_certificado_ars:
          d.total_certificado_ars != null ? Number(d.total_certificado_ars) : null,
        fecha_certificacion: d.fecha_certificacion,
        estado: d.estado,
        importado_en: d.importado_en,
        archivo_id: d.archivo_id,
        archivo_nombre: arch?.nombre_original ?? null,
        viajes_count: conteoPorDm.get(d.id) ?? 0,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// URL firmada para descargar el PDF original del DM
// ---------------------------------------------------------------------------

export async function getDmYpfPdfUrlAction(
  dmId: string,
): Promise<{ url?: string; error?: string }> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dm } = await (supabase as any)
    .from("compliance_dm_ypf")
    .select("archivo_id")
    .eq("id", dmId)
    .single();
  if (!dm?.archivo_id) return { error: "Este DM no tiene PDF asociado" };

  const { data: arch } = await supabase
    .from("documentos_archivos")
    .select("bucket, path")
    .eq("id", dm.archivo_id)
    .single();
  if (!arch) return { error: "Archivo no encontrado" };

  // URL firmada válida por 5 minutos (suficiente para abrir / descargar)
  const { data, error } = await supabase.storage
    .from(arch.bucket)
    .createSignedUrl(arch.path, 300);
  if (error || !data) return { error: "No se pudo generar el link" };
  return { url: data.signedUrl };
}

// ---------------------------------------------------------------------------
// Eliminar un DM (solo admin). Borra el registro y el archivo en storage.
// Los viajes asociados quedan con dm_ypf_id=null (cascade soft).
// ---------------------------------------------------------------------------

export async function deleteDmYpfAction(
  dmId: string,
): Promise<{ ok?: boolean; error?: string }> {
  await requireArea("viajes", "admin");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: dm } = await sb
    .from("compliance_dm_ypf")
    .select("archivo_id, archivo:documentos_archivos(bucket, path)")
    .eq("id", dmId)
    .single();

  // Eliminar el registro DM (las viajes.dm_ypf_id quedan en null por la FK)
  const { error } = await sb.from("compliance_dm_ypf").delete().eq("id", dmId);
  if (error) return { error: "No se pudo eliminar el DM" };

  // Best effort: borrar el archivo físico también
  const arch = Array.isArray(dm?.archivo) ? dm.archivo[0] : dm?.archivo;
  if (arch?.bucket && arch?.path) {
    await supabase.storage.from(arch.bucket).remove([arch.path]);
  }
  if (dm?.archivo_id) {
    await sb.from("documentos_archivos").delete().eq("id", dm.archivo_id);
  }

  revalidatePath("/viajes/liquidaciones");
  return { ok: true };
}
