"use server";

// Importador del Excel de sueldos (formato de bloques por mes de Bárbara).
// Flujo igual al importador de Loma: preview (parsear + matchear nombres) →
// confirmación con las asignaciones que el usuario ajustó a mano.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  parseSueldosExcel,
  matchNombresContraRoster,
  type SueldosParseResult,
} from "./parser-sueldos";

// Tablas de sueldos admin: acceso con `as any` (no están en database.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type RosterOption = {
  id: string;
  nombre: string; // "Apellido, Nombre"
  rol: string;
};

export type MatchPreview = {
  nombreExcel: string;
  /** Asignación automática (solo admin/taller con match claro). */
  choferId: string | null;
  /** Sugerencia que requiere confirmación manual (ej. matchea un chofer). */
  sugeridoId: string | null;
  auto: boolean;
};

export type SueldosImportPreview =
  | {
      ok: true;
      bloques: { mes: string; facturacion: number | null; filas: number }[];
      matches: MatchPreview[];
      roster: RosterOption[];
      warnings: string[];
    }
  | { ok?: false; error: string };

async function parseFile(formData: FormData): Promise<
  | { parsed: SueldosParseResult }
  | { error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Falta el archivo." };
  if (file.size > MAX_FILE_BYTES) return { error: "El archivo es demasiado grande (máx. 8 MB)." };
  try {
    const parsed = parseSueldosExcel(new Uint8Array(await file.arrayBuffer()));
    if (!parsed.bloques.length) {
      return {
        error:
          "No se encontraron bloques de meses en el Excel. Se espera el formato de la planilla de sueldos (fecha + FACTURACION + tabla con SUELDO / COMISION / COMBUSTIBLE / PLUS YPF / SABADOS).",
      };
    }
    return { parsed };
  } catch (err) {
    console.error("Error al parsear Excel de sueldos:", err);
    return { error: "No se pudo leer el Excel." };
  }
}

async function getRoster(): Promise<RosterOption[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, rol")
    .eq("estado", "activo")
    .order("apellido");
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    nombre: `${c.apellido ?? ""}${c.apellido ? ", " : ""}${c.nombre}`,
    rol: c.rol,
  }));
}

export async function previewImportSueldosAction(
  formData: FormData,
): Promise<SueldosImportPreview> {
  await requireSeccion("sueldos_admin", "write");

  const res = await parseFile(formData);
  if ("error" in res) return { error: res.error };
  const { parsed } = res;

  const supabase = createAdminClient();
  const { data: rosterRaw } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, rol")
    .eq("estado", "activo");
  const matches = matchNombresContraRoster(
    parsed.nombres,
    ((rosterRaw ?? []) as any[]).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      rol: c.rol,
    })),
  );

  return {
    ok: true,
    bloques: parsed.bloques.map((b) => ({
      mes: b.mes,
      facturacion: b.facturacion,
      filas: b.filas.length,
    })),
    matches: matches.map((m) => ({
      nombreExcel: m.nombreExcel,
      choferId: m.choferId,
      sugeridoId: m.sugeridoId,
      auto: m.auto,
    })),
    roster: await getRoster(),
    warnings: parsed.warnings,
  };
}

export type SueldosImportResult =
  | {
      ok: true;
      aumentos: number;
      variables: number;
      meses: number;
      omitidos: string[]; // nombres del Excel que quedaron sin cargar
    }
  | { ok?: false; error: string };

export async function confirmImportSueldosAction(
  formData: FormData,
): Promise<SueldosImportResult> {
  const user = await requireSeccion("sueldos_admin", "write");

  const res = await parseFile(formData);
  if ("error" in res) return { error: res.error };
  const { parsed } = res;

  // Asignaciones finales del preview: nombre del Excel → chofer_id ('' = no cargar).
  let asignaciones: Record<string, string>;
  try {
    asignaciones = JSON.parse(String(formData.get("asignaciones") ?? "{}"));
  } catch {
    return { error: "Asignaciones inválidas." };
  }

  const supabase = createAdminClient();
  const { data: validos } = await supabase.from("choferes").select("id");
  const idsValidos = new Set(((validos ?? []) as any[]).map((c) => c.id));
  for (const [nombre, id] of Object.entries(asignaciones)) {
    if (id && !idsValidos.has(id)) return { error: `Asignación inválida para "${nombre}".` };
  }

  type AumentoRow = {
    chofer_id: string;
    vigente_desde: string;
    sueldo_base: number;
    observaciones: string;
    created_by: string;
  };
  type MesRow = {
    chofer_id: string;
    mes: string;
    comision_logistica: number;
    combustible: number;
    plus_ypf: number;
    sabados: number;
    aguinaldo: number;
    created_by: string;
  };
  // Mapas por clave de conflicto: si dos filas del mismo mes resuelven al mismo
  // legajo (nombre repetido en el Excel, o dos apodos asignados a la misma
  // persona), gana la última — un batch con la clave duplicada haría fallar el
  // upsert entero en Postgres ("cannot affect row a second time").
  const aumentosMap = new Map<string, AumentoRow>();
  const variablesMap = new Map<string, MesRow>();
  const facturaciones: { mes: string; facturacion_manual: number; observaciones: string; updated_by: string }[] = [];
  const omitidos = new Set<string>();

  for (const b of parsed.bloques) {
    if (b.facturacion != null && b.facturacion > 0) {
      facturaciones.push({
        mes: b.mes,
        facturacion_manual: b.facturacion,
        observaciones: "Importado del Excel de sueldos",
        updated_by: user.id,
      });
    }
    for (const f of b.filas) {
      const choferId = asignaciones[f.nombre];
      if (!choferId) {
        omitidos.add(f.nombre);
        continue;
      }
      if (f.sueldoBase != null && f.sueldoBase > 0) {
        aumentosMap.set(`${choferId}|${b.mes}`, {
          chofer_id: choferId,
          vigente_desde: b.mes,
          sueldo_base: f.sueldoBase,
          observaciones: "Importado de Excel",
          created_by: user.id,
        });
      }
      // Las variables se upsertean SIEMPRE (aunque vengan todas en cero) para
      // que re-importar un mes corregido pueda pisar valores viejos con 0.
      variablesMap.set(`${choferId}|${b.mes}`, {
        chofer_id: choferId,
        mes: b.mes,
        comision_logistica: f.comision,
        combustible: f.combustible,
        plus_ypf: f.plusYpf,
        sabados: f.sabados,
        aguinaldo: f.aguinaldo,
        created_by: user.id,
      });
    }
  }
  const aumentos = Array.from(aumentosMap.values());
  const variables = Array.from(variablesMap.values());

  // Upserts idempotentes en tandas (los re-imports pisan con el valor nuevo).
  const CHUNK = 400;
  for (let i = 0; i < aumentos.length; i += CHUNK) {
    const { error } = await (supabase as any)
      .from("sueldos_admin_aumentos")
      .upsert(aumentos.slice(i, i + CHUNK), { onConflict: "chofer_id,vigente_desde" });
    if (error) {
      console.error("Error al importar aumentos:", error);
      return { error: "No se pudieron guardar los sueldos base." };
    }
  }
  for (let i = 0; i < variables.length; i += CHUNK) {
    const { error } = await (supabase as any)
      .from("sueldos_admin_mes")
      .upsert(variables.slice(i, i + CHUNK), { onConflict: "chofer_id,mes" });
    if (error) {
      console.error("Error al importar variables del mes:", error);
      return { error: "No se pudieron guardar las variables del mes." };
    }
  }
  if (facturaciones.length) {
    const { error } = await (supabase as any)
      .from("sueldos_admin_meses")
      .upsert(facturaciones, { onConflict: "mes" });
    if (error) {
      console.error("Error al importar facturación:", error);
      return { error: "No se pudo guardar la facturación mensual." };
    }
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "sueldos_import",
    entidadId: parsed.bloques[0]?.mes ?? "sueldos",
    valoresNuevos: {
      meses: parsed.bloques.map((b) => b.mes),
      aumentos: aumentos.length,
      variables: variables.length,
      facturaciones: facturaciones.length,
      omitidos: Array.from(omitidos),
    },
    metadata: { origen: "sueldos_admin_import" },
  });

  revalidatePath("/choferes/sueldos");
  return {
    ok: true,
    aumentos: aumentos.length,
    variables: variables.length,
    meses: parsed.bloques.length,
    omitidos: Array.from(omitidos),
  };
}
