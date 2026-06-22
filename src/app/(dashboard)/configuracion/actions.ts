"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { Database } from "@/types/database";
import { getValidacion, validarRestricciones } from "./validaciones";
import { requireArea } from "@/lib/auth";

type TipoDato = Database["public"]["Enums"]["parametro_tipo_dato"];

type Result = { success: true } | { error: string };

function validarValor(valor: string, tipo: TipoDato): { ok: true; valor: string } | { ok: false; error: string } {
  const trimmed = valor.trim();

  switch (tipo) {
    case "number": {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return { ok: false, error: "Debe ser un número válido" };
      return { ok: true, valor: String(num) };
    }
    case "boolean": {
      if (trimmed !== "true" && trimmed !== "false") {
        return { ok: false, error: "Debe ser true o false" };
      }
      return { ok: true, valor: trimmed };
    }
    case "json": {
      try {
        JSON.parse(trimmed);
        return { ok: true, valor: trimmed };
      } catch {
        return { ok: false, error: "JSON inválido" };
      }
    }
    case "string":
    default: {
      if (trimmed.length > 500) return { ok: false, error: "Máximo 500 caracteres" };
      return { ok: true, valor: trimmed };
    }
  }
}

export async function actualizarParametro(id: string, valor: string): Promise<Result> {
  await requireArea("sistema", "write");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: actual, error: fetchError } = await supabase
    .from("parametros_sistema")
    .select("id, clave, valor, tipo_dato, editable, categoria")
    .eq("id", id)
    .single();

  if (fetchError || !actual) return { error: "Parámetro no encontrado" };
  if (!actual.editable) return { error: "Este parámetro es de solo lectura" };

  const validacion = validarValor(valor, actual.tipo_dato);
  if (!validacion.ok) return { error: validacion.error };

  const restricciones = getValidacion(actual.clave, actual.tipo_dato);
  const restriccionResult = validarRestricciones(
    validacion.valor,
    actual.tipo_dato,
    restricciones,
  );
  if (!restriccionResult.ok) return { error: restriccionResult.error };

  if (validacion.valor === actual.valor) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("parametros_sistema")
    .update({
      valor: validacion.valor,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error actualizando parámetro:", updateError);
    return { error: "No se pudo guardar el cambio" };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    usuarioId: user.id,
    entidadTipo: "parametro_sistema",
    entidadId: id,
    valoresAnteriores: { valor: actual.valor },
    valoresNuevos: { valor: validacion.valor },
    metadata: {
      clave: actual.clave,
      categoria: actual.categoria,
      tipo_dato: actual.tipo_dato,
    },
  });

  revalidatePath("/configuracion");
  revalidatePath("/tarifas");
  return { success: true };
}

export type BulkResult = {
  guardados: number;
  errores: { clave: string; error: string }[];
};

export async function actualizarParametrosBulk(
  cambios: { id: string; valor: string }[],
): Promise<BulkResult | { error: string }> {
  await requireArea("sistema", "write");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  if (cambios.length === 0) return { guardados: 0, errores: [] };

  const ids = cambios.map((c) => c.id);
  const { data: actuales, error: fetchError } = await supabase
    .from("parametros_sistema")
    .select("id, clave, valor, tipo_dato, editable, categoria")
    .in("id", ids);

  if (fetchError || !actuales) return { error: "No se pudieron obtener los parámetros" };

  const actualMap = new Map(actuales.map((p) => [p.id, p]));
  const ahora = new Date().toISOString();
  let guardados = 0;
  const errores: { clave: string; error: string }[] = [];

  for (const cambio of cambios) {
    const actual = actualMap.get(cambio.id);
    if (!actual) {
      errores.push({ clave: cambio.id, error: "Parámetro no encontrado" });
      continue;
    }
    if (!actual.editable) {
      errores.push({ clave: actual.clave, error: "Solo lectura" });
      continue;
    }

    const validacion = validarValor(cambio.valor, actual.tipo_dato);
    if (!validacion.ok) {
      errores.push({ clave: actual.clave, error: validacion.error });
      continue;
    }

    const restricciones = getValidacion(actual.clave, actual.tipo_dato);
    const restriccionResult = validarRestricciones(validacion.valor, actual.tipo_dato, restricciones);
    if (!restriccionResult.ok) {
      errores.push({ clave: actual.clave, error: restriccionResult.error });
      continue;
    }

    if (validacion.valor === actual.valor) continue;

    const { error: updateError } = await supabase
      .from("parametros_sistema")
      .update({ valor: validacion.valor, updated_by: user.id, updated_at: ahora })
      .eq("id", cambio.id);

    if (updateError) {
      errores.push({ clave: actual.clave, error: "No se pudo guardar" });
      continue;
    }

    await logAudit({
      client: supabase,
      accion: "actualizar",
      usuarioId: user.id,
      entidadTipo: "parametro_sistema",
      entidadId: cambio.id,
      valoresAnteriores: { valor: actual.valor },
      valoresNuevos: { valor: validacion.valor },
      metadata: {
        clave: actual.clave,
        categoria: actual.categoria,
        tipo_dato: actual.tipo_dato,
        bulk: true,
      },
    });

    guardados++;
  }

  revalidatePath("/configuracion");
  revalidatePath("/tarifas");
  return { guardados, errores };
}

export type HistorialEvento = {
  id: string;
  created_at: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
};

function extraerValor(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const v = (json as Record<string, unknown>).valor;
  return v == null ? null : String(v);
}

export async function revertirParametro(
  parametroId: string,
  valorAnterior: string,
  eventoId: string,
  eventoFecha: string,
): Promise<Result> {
  await requireArea("sistema", "write");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: actual, error: fetchError } = await supabase
    .from("parametros_sistema")
    .select("id, clave, valor, tipo_dato, editable, categoria")
    .eq("id", parametroId)
    .single();

  if (fetchError || !actual) return { error: "Parámetro no encontrado" };
  if (!actual.editable) return { error: "Este parámetro es de solo lectura" };

  const validacion = validarValor(valorAnterior, actual.tipo_dato);
  if (!validacion.ok) return { error: validacion.error };

  const restricciones = getValidacion(actual.clave, actual.tipo_dato);
  const restriccionResult = validarRestricciones(validacion.valor, actual.tipo_dato, restricciones);
  if (!restriccionResult.ok) return { error: restriccionResult.error };

  if (validacion.valor === actual.valor) return { success: true };

  const { error: updateError } = await supabase
    .from("parametros_sistema")
    .update({
      valor: validacion.valor,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parametroId);

  if (updateError) {
    console.error("Error revirtiendo parámetro:", updateError);
    return { error: "No se pudo revertir el valor" };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    usuarioId: user.id,
    entidadTipo: "parametro_sistema",
    entidadId: parametroId,
    valoresAnteriores: { valor: actual.valor },
    valoresNuevos: { valor: validacion.valor },
    metadata: {
      clave: actual.clave,
      categoria: actual.categoria,
      tipo_dato: actual.tipo_dato,
      revertido_de: eventoFecha,
      evento_origen_id: eventoId,
    },
  });

  revalidatePath("/configuracion");
  revalidatePath("/tarifas");
  return { success: true };
}

export async function getHistorialParametro(parametroId: string): Promise<HistorialEvento[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select(
      `id, created_at, valores_anteriores, valores_nuevos,
       usuarios:usuario_id (nombre, apellido, email)`,
    )
    .eq("entidad_tipo", "parametro_sistema")
    .eq("entidad_id", parametroId)
    .eq("accion", "actualizar")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    console.error("Error obteniendo historial:", error);
    return [];
  }

  return data.map((row) => {
    const usuario = row.usuarios as
      | { nombre: string | null; apellido: string | null; email: string }
      | null;
    const nombreCompleto = usuario
      ? [usuario.nombre, usuario.apellido].filter(Boolean).join(" ").trim() || null
      : null;
    return {
      id: row.id,
      created_at: row.created_at,
      valor_anterior: extraerValor(row.valores_anteriores),
      valor_nuevo: extraerValor(row.valores_nuevos),
      usuario_nombre: nombreCompleto,
      usuario_email: usuario?.email ?? null,
    };
  });
}
