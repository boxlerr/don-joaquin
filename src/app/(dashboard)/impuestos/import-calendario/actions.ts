"use server";

import { revalidatePath } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, hasSeccion, requireArea, type CurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseCalendarioSecondi } from "@/domain/impuestos/calendario-secondi";
import {
  COLUMNA_IMPUESTOS_PERSONALES,
  avisaA,
  codigoContribuyente,
  esReservado,
} from "@/domain/impuestos/entidades";
import { clasificarFilas } from "@/domain/impuestos/import-calendario";
import type {
  FilaConfirmar,
  FilaPreview,
  PreviewCalendario,
  ResultadoImport,
} from "./tipos";

// ============================================================================
// Importador del calendario de vencimientos del estudio contable (Secondi).
// ----------------------------------------------------------------------------
// Pedido de Nicolás (02/09/2026): "este pdf estaría bueno se pueda subir en la
// parte de impuestos y se agenden los vencimientos y nos salgan alertas".
//
// El PDF es de una carilla: razón social, CUIT y una tabla de impuesto +
// vencimiento. Hasta hoy eso se copiaba a mano, fila por fila, en el alta de
// /impuestos. Este importador hace lo mismo que hace el del DM de YPF: analiza,
// MUESTRA lo que entendió para que se corrija, y recién ahí escribe.
//
// Dos reglas que no se negocian:
//  · El CUIT decide de QUIÉN es el calendario, y de ahí sale a quién le llega el
//    aviso. Un PDF de un CUIT que no está dado de alta no se importa a ciegas.
//  · Reimportar el mismo PDF no puede duplicar nada. La clave es (entidad,
//    nombre, fecha) y encima hay un índice único en la base por si acaso.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any -- impuesto_vencimientos e impuesto_entidades aún fuera de database.ts */

const BUCKET = "documentos-impuestos";
/** Un calendario del estudio pesa ~110 KB; 5 MB es holgado y corta un mal upload. */
const MAX_BYTES = 5 * 1024 * 1024;

type EntidadRow = { codigo: string; nombre: string; cuit: string; columna_alerta: string };

/**
 * El calendario de una persona física no lo puede cargar cualquiera con acceso a
 * Finanzas: el permiso viaja con el dato. Devuelve el motivo o `null` si puede.
 */
function motivoSinPermiso(user: CurrentUser, entidad: EntidadRow | null): string | null {
  if (!entidad || !esReservado(entidad.columna_alerta)) return null;
  if (hasSeccion(user, "impuestos_personales", "write")) return null;
  return `El calendario de ${entidad.nombre} es de acceso reservado. Pedile a un administrador la sección «Impuestos personales» desde /usuarios.`;
}

/** Mes anterior al vencimiento: el período que se está declarando. */
function periodoDeVencimiento(fechaIso: string): string {
  const [y, m] = fechaIso.split("-").map(Number);
  const mes = m! - 1;
  return mes === 0 ? `${y! - 1}-12` : `${y}-${String(mes).padStart(2, "0")}`;
}

/** El mes que más se repite entre los vencimientos del PDF. */
function periodoSugerido(fechas: string[]): string {
  const cuenta = new Map<string, number>();
  for (const f of fechas) {
    const p = periodoDeVencimiento(f);
    cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }
  let mejor = "";
  let max = 0;
  for (const [p, n] of cuenta) if (n > max) [mejor, max] = [p, n];
  return mejor;
}

async function textoDelPdf(file: File): Promise<{ texto: string; bytes: Uint8Array } | { error: string }> {
  if (file.size === 0) return { error: "El archivo está vacío." };
  if (file.size > MAX_BYTES) return { error: "El archivo pesa más de 5 MB: ¿es el calendario del estudio?" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const pdf = await getDocumentProxy(bytes);
    // `mergePages: false` a propósito: con `true`, unpdf pega todos los
    // renglones en una línea separados por espacios y la tabla del calendario
    // deja de ser una tabla. El parser igual sabe partirla, pero la fuente buena
    // es ésta.
    const { text } = await extractText(pdf, { mergePages: false });
    return { texto: Array.isArray(text) ? text.join("\n") : text, bytes };
  } catch {
    return { error: "No se pudo abrir el PDF. Puede estar dañado o protegido con contraseña." };
  }
}

// ---------------------------------------------------------------------------
// Paso 1 — analizar y mostrar
// ---------------------------------------------------------------------------

export async function previewCalendarioAction(formData: FormData): Promise<PreviewCalendario> {
  const user = await requireArea("finanzas", "write");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Falta el archivo." };

  const leido = await textoDelPdf(file);
  if ("error" in leido) return { error: leido.error };

  const calendario = parseCalendarioSecondi(leido.texto);
  const advertencias = [...calendario.advertencias];

  const supabase = createAdminClient();

  // El CUIT es la llave: con eso solo el importador ya sabe de quién es el PDF y
  // a quién le va a avisar, sin preguntar nada.
  let entidad: EntidadRow | null = null;
  if (calendario.cuit) {
    const { data } = await (supabase as any)
      .from("impuesto_entidades")
      .select("codigo, nombre, cuit, columna_alerta")
      .eq("cuit", calendario.cuit)
      .maybeSingle();
    entidad = (data as EntidadRow | null) ?? null;
  }

  const sinPermiso = motivoSinPermiso(user, entidad);
  if (sinPermiso) return { error: sinPermiso };

  if (calendario.filas.length === 0) {
    return {
      ok: true,
      entidad: null,
      entidadNueva: null,
      periodoSugerido: "",
      filas: [],
      advertencias,
    };
  }

  // Lo que ya está cargado de esa entidad, para no volver a agendarlo. Se acota
  // a los nombres del PDF: la tabla crece ~15 filas por mes por contribuyente.
  const nombres = [...new Set(calendario.filas.map((f) => f.nombre))];
  const yaCargados: {
    id: string; nombre: string; fecha_vencimiento: string; organismo: string | null; presentado: boolean;
  }[] = entidad
    ? (
        (
          await (supabase as any)
            .from("impuesto_vencimientos")
            .select("id, nombre, fecha_vencimiento, organismo, presentado")
            .eq("entidad_codigo", entidad.codigo)
            .in("nombre", nombres)
            .order("fecha_vencimiento", { ascending: false })
        ).data ?? []
      )
    : [];

  const filas: FilaPreview[] = clasificarFilas(calendario.filas, yaCargados).map((f, idx) => ({
    idx,
    nombre: f.nombre,
    fechaVencimiento: f.fechaVencimiento,
    organismo: f.organismo,
    estado: f.estado,
    existente: f.existente
      ? {
          id: f.existente.id,
          fechaVencimiento: f.existente.fecha_vencimiento,
          presentado: Boolean(f.existente.presentado),
        }
      : null,
  }));

  if (!entidad && calendario.cuit) {
    advertencias.push(
      `El CUIT ${calendario.cuit} no está dado de alta. Revisá el nombre y elegí a quién le tienen que llegar los avisos antes de confirmar.`,
    );
  }

  return {
    ok: true,
    entidad: entidad
      ? {
          codigo: entidad.codigo,
          nombre: entidad.nombre,
          cuit: entidad.cuit,
          columnaAlerta: entidad.columna_alerta,
          avisaA: avisaA(entidad.columna_alerta),
        }
      : null,
    entidadNueva: entidad
      ? null
      : { razonSocial: calendario.razonSocial, cuit: calendario.cuit },
    periodoSugerido: periodoSugerido(calendario.filas.map((f) => f.fechaVencimiento)),
    filas,
    advertencias,
  };
}

// ---------------------------------------------------------------------------
// Paso 2 — confirmar
// ---------------------------------------------------------------------------

/** Alta de un contribuyente nuevo desde la vista previa. Idempotente por CUIT. */
async function asegurarEntidad(
  supabase: any,
  user: CurrentUser,
  input: { nombre: string; cuit: string; columnaAlerta: string },
): Promise<{ entidad: EntidadRow } | { error: string }> {
  const { data: existente } = await supabase
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta")
    .eq("cuit", input.cuit)
    .maybeSingle();
  if (existente) return { entidad: existente as EntidadRow };

  // Los códigos ya tomados: sin esto, un contribuyente nuevo cuyo nombre da el
  // mismo slug que uno cargado moría con un error de clave repetida que en la
  // vista previa se veía como "No se pudo dar de alta el contribuyente".
  const { data: todos } = await supabase.from("impuesto_entidades").select("codigo");
  const codigo = codigoContribuyente(
    input.nombre,
    input.cuit,
    ((todos ?? []) as { codigo: string }[]).map((e) => e.codigo),
  );

  const { data, error } = await supabase
    .from("impuesto_entidades")
    .insert({
      codigo,
      nombre: input.nombre,
      cuit: input.cuit,
      columna_alerta: input.columnaAlerta,
      orden: 100,
    })
    .select("codigo, nombre, cuit, columna_alerta")
    .single();
  if (error || !data) return { error: "No se pudo dar de alta el contribuyente." };

  await logAudit({
    accion: "crear",
    entidadTipo: "impuesto_entidad",
    entidadId: codigo,
    usuarioId: user.id,
    valoresNuevos: { nombre: input.nombre, cuit: input.cuit, columna_alerta: input.columnaAlerta },
  });
  return { entidad: data as EntidadRow };
}

/**
 * Archiva el PDF junto a los vencimientos que salieron de él.
 *
 * Se sube UNA vez y se vincula a todas las filas del lote: así el original se
 * abre desde cualquiera de ellas sin ocupar el Storage nueve veces. Best-effort
 * a propósito — si el archivo falla, las fechas ya quedaron agendadas y eso es
 * lo que se vino a hacer.
 */
async function archivarPdf(
  supabase: any,
  bytes: Uint8Array,
  nombreOriginal: string,
  impuestoIds: string[],
  userId: string,
): Promise<boolean> {
  if (impuestoIds.length === 0) return false;
  try {
    const path = `impuestos/calendarios/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return false;

    const { data: archivo, error: archErr } = await supabase
      .from("documentos_archivos")
      .insert({
        bucket: BUCKET,
        nombre_original: nombreOriginal,
        path,
        tamano_bytes: bytes.byteLength,
        mime_type: "application/pdf",
        subido_por: userId,
      })
      .select("id")
      .single();
    if (archErr || !archivo) return false;

    const { error: linkErr } = await supabase
      .from("impuesto_archivos")
      .insert(impuestoIds.map((id) => ({ impuesto_id: id, archivo_id: archivo.id, created_by: userId })));
    return !linkErr;
  } catch {
    return false;
  }
}

export async function confirmarCalendarioAction(formData: FormData): Promise<ResultadoImport> {
  const user = await requireArea("finanzas", "write");
  const supabase = createAdminClient();

  const file = formData.get("file");
  const periodo = String(formData.get("periodo") ?? "").trim() || null;
  let filas: FilaConfirmar[];
  try {
    filas = JSON.parse(String(formData.get("filas") ?? "[]"));
  } catch {
    return { error: "No se entendieron las filas a importar." };
  }

  // La entidad viene elegida de la vista previa: o una ya existente, o el alta
  // que el usuario acaba de completar.
  const codigoElegido = String(formData.get("entidadCodigo") ?? "").trim();
  let entidad: EntidadRow | null = null;

  if (codigoElegido) {
    const { data } = await (supabase as any)
      .from("impuesto_entidades")
      .select("codigo, nombre, cuit, columna_alerta")
      .eq("codigo", codigoElegido)
      .maybeSingle();
    entidad = (data as EntidadRow | null) ?? null;
    if (!entidad) return { error: "No se encontró el contribuyente elegido." };
  } else {
    const nombre = String(formData.get("entidadNombre") ?? "").trim();
    const cuit = String(formData.get("entidadCuit") ?? "").trim();
    const columnaAlerta = String(formData.get("entidadColumna") ?? "").trim() || COLUMNA_IMPUESTOS_PERSONALES;
    if (!nombre) return { error: "Falta el nombre del contribuyente." };
    if (!/^\d{2}-\d{8}-\d$/.test(cuit)) return { error: "El CUIT tiene que ser 20-12345678-9." };
    const alta = await asegurarEntidad(supabase, user, { nombre, cuit, columnaAlerta });
    if ("error" in alta) return { error: alta.error };
    entidad = alta.entidad;
  }

  const sinPermiso = motivoSinPermiso(user, entidad);
  if (sinPermiso) return { error: sinPermiso };

  const aAplicar = filas.filter((f) => f.aplicar && f.nombre?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.fechaVencimiento));
  if (aAplicar.length === 0) return { error: "No hay ninguna fila tildada para importar." };

  // Se relee lo que hay AHORA (y no lo que decía la vista previa) para que dos
  // personas subiendo el mismo PDF al mismo tiempo no dupliquen nada.
  const { data: existentes } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("id, nombre, fecha_vencimiento")
    .eq("entidad_codigo", entidad.codigo)
    .in("nombre", [...new Set(aAplicar.map((f) => f.nombre.trim()))]);

  const yaCargados = (existentes ?? []) as { id: string; nombre: string; fecha_vencimiento: string }[];

  let creados = 0;
  let actualizados = 0;
  let salteados = 0;
  const idsDelLote: string[] = [];

  for (const fila of aAplicar) {
    const nombre = fila.nombre.trim();
    const organismo = fila.organismo?.trim() || null;
    const mismos = yaCargados.filter((c) => c.nombre === nombre);

    if (mismos.some((c) => c.fecha_vencimiento === fila.fechaVencimiento)) {
      salteados++;
      const yaEsta = mismos.find((c) => c.fecha_vencimiento === fila.fechaVencimiento)!;
      idsDelLote.push(yaEsta.id);
      continue;
    }

    const mismoMes = mismos.find(
      (c) => c.fecha_vencimiento.slice(0, 7) === fila.fechaVencimiento.slice(0, 7),
    );

    if (mismoMes) {
      const { error } = await (supabase as any)
        .from("impuesto_vencimientos")
        .update({ fecha_vencimiento: fila.fechaVencimiento, updated_at: new Date().toISOString() })
        .eq("id", mismoMes.id);
      if (error) continue;
      actualizados++;
      idsDelLote.push(mismoMes.id);
      await logAudit({
        accion: "actualizar",
        entidadTipo: "impuesto_vencimiento",
        entidadId: mismoMes.id,
        usuarioId: user.id,
        valoresAnteriores: { fecha_vencimiento: mismoMes.fecha_vencimiento },
        valoresNuevos: { fecha_vencimiento: fila.fechaVencimiento },
        metadata: { origen: "import_calendario", entidad: entidad.codigo, nombre },
      });
      continue;
    }

    const { data: creado, error } = await (supabase as any)
      .from("impuesto_vencimientos")
      .insert({
        nombre,
        organismo,
        periodo,
        fecha_vencimiento: fila.fechaVencimiento,
        entidad_codigo: entidad.codigo,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !creado) continue;
    creados++;
    idsDelLote.push(creado.id);
    await logAudit({
      accion: "crear",
      entidadTipo: "impuesto_vencimiento",
      entidadId: creado.id,
      usuarioId: user.id,
      valoresNuevos: {
        nombre,
        organismo,
        periodo,
        fecha_vencimiento: fila.fechaVencimiento,
        entidad_codigo: entidad.codigo,
      },
      metadata: { origen: "import_calendario" },
    });
  }

  let pdfArchivado = false;
  if (file instanceof File && file.size > 0 && file.size <= MAX_BYTES) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfArchivado = await archivarPdf(supabase, bytes, file.name, idsDelLote, user.id);
  }

  revalidatePath("/impuestos");
  return { ok: true, creados, actualizados, salteados, pdfArchivado };
}

/** Los contribuyentes que esta persona puede elegir en la vista previa. */
export async function getEntidadesImpuestoAction(): Promise<
  { codigo: string; nombre: string; cuit: string; columnaAlerta: string; avisaA: string }[]
> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = createAdminClient();
  const { data } = await (supabase as any)
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta")
    .order("orden", { ascending: true });

  return ((data ?? []) as EntidadRow[])
    .filter((e) => !motivoSinPermiso(user, e))
    .map((e) => ({
      codigo: e.codigo,
      nombre: e.nombre,
      cuit: e.cuit,
      columnaAlerta: e.columna_alerta,
      avisaA: avisaA(e.columna_alerta),
    }));
}
