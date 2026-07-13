"use server";

// Importador del Excel de entrevistas (planilla de Bárbara). Flujo igual al
// de sueldos: preview (parsear + dedup por nombre contra lo cargado) →
// confirmación. Idempotente: los nombres que ya existen NO se duplican.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import { logEntrevistaAudit } from "./audit";
import {
  parseEntrevistasExcel,
  nombreClave,
  type EntrevistaImportFila,
} from "./parser-entrevistas";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type EntrevistasImportPreview =
  | {
      ok: true;
      hoja: string;
      avisos: string[];
      nuevas: EntrevistaImportFila[];
      existentes: { fila: EntrevistaImportFila; nombreExistente: string }[];
    }
  | { ok: false; error: string };

async function leerArchivo(fd: FormData): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Falta el archivo." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "El archivo supera los 8 MB." };
  return { ok: true, buffer: Buffer.from(await file.arrayBuffer()) };
}

async function nombresExistentes(sb: any): Promise<Map<string, string>> {
  const { data } = await sb.from("entrevistas").select("nombre");
  const map = new Map<string, string>();
  for (const r of (data ?? []) as { nombre: string }[]) {
    map.set(nombreClave(r.nombre), r.nombre);
  }
  return map;
}

export async function previewImportEntrevistasAction(fd: FormData): Promise<EntrevistasImportPreview> {
  await requireArea("rrhh", "write");

  const archivo = await leerArchivo(fd);
  if (!archivo.ok) return archivo;

  const parsed = parseEntrevistasExcel(archivo.buffer);
  if (!parsed.ok) return parsed;

  const sb = createAdminClient() as any;
  const existentesMap = await nombresExistentes(sb);

  const nuevas: EntrevistaImportFila[] = [];
  const existentes: { fila: EntrevistaImportFila; nombreExistente: string }[] = [];
  const vistosEnExcel = new Set<string>();

  for (const fila of parsed.filas) {
    const clave = nombreClave(fila.nombre);
    if (vistosEnExcel.has(clave)) continue; // duplicado dentro del mismo Excel
    vistosEnExcel.add(clave);
    const yaExiste = existentesMap.get(clave);
    if (yaExiste) existentes.push({ fila, nombreExistente: yaExiste });
    else nuevas.push(fila);
  }

  return { ok: true, hoja: parsed.hoja, avisos: parsed.avisos, nuevas, existentes };
}

export type EntrevistasImportResult =
  | { ok: true; insertadas: number; salteadas: number }
  | { ok: false; error: string };

export async function confirmImportEntrevistasAction(fd: FormData): Promise<EntrevistasImportResult> {
  const user = await requireArea("rrhh", "write");

  const archivo = await leerArchivo(fd);
  if (!archivo.ok) return archivo;

  const parsed = parseEntrevistasExcel(archivo.buffer);
  if (!parsed.ok) return parsed;

  const sb = createAdminClient() as any;
  // Re-chequear existentes en el confirm (idempotente aunque se importe dos veces).
  const existentesMap = await nombresExistentes(sb);

  const aInsertar: Record<string, unknown>[] = [];
  const vistos = new Set<string>();
  let salteadas = 0;

  for (const fila of parsed.filas) {
    const clave = nombreClave(fila.nombre);
    if (vistos.has(clave) || existentesMap.has(clave)) {
      salteadas += 1;
      continue;
    }
    vistos.add(clave);
    const preocupacional = fila.preocupacional_nota ? "pendiente" : "no_aplica";
    aInsertar.push({
      nombre: fila.nombre,
      fecha_entrevista: fila.fecha,
      edad: fila.edad,
      localidad: fila.localidad,
      telefono: fila.telefono,
      observaciones: fila.observaciones,
      preocupacional_nota: fila.preocupacional_nota,
      aprobado: fila.aprobado,
      entro: fila.entro,
      se_mantuvo: fila.se_mantuvo,
      preocupacional,
      resultado: "pendiente",
      etapa: fila.fecha ? "entrevista" : "nuevo",
    });
  }

  if (!aInsertar.length) {
    return { ok: true, insertadas: 0, salteadas };
  }

  const { data: insertadas, error } = await sb
    .from("entrevistas")
    .insert(aInsertar)
    .select("id, nombre");

  if (error) {
    console.error("Error al importar entrevistas:", error);
    return { ok: false, error: "No se pudieron insertar los candidatos." };
  }

  for (const ins of (insertadas ?? []) as { id: string; nombre: string }[]) {
    await logEntrevistaAudit(ins.id, "crear", null, { nombre: ins.nombre, origen: "import_excel" }, user.id);
  }

  revalidatePath("/entrevistas");
  return { ok: true, insertadas: (insertadas ?? []).length, salteadas };
}
