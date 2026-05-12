"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  ALERTAS,
  CANALES,
  DESTINATARIOS_CLAVE,
  alertaClave,
  type CanalKey,
} from "./constants";

type Result = { success: true } | { error: string };

function getCanal(key: string) {
  return CANALES.find((c) => c.key === key);
}

async function upsertParametro(
  clave: string,
  valor: string,
  meta: {
    tipo_dato: "string" | "boolean" | "json";
    categoria: string;
    descripcion: string;
  },
): Promise<{ id: string; previo: string | null } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: actual } = await supabase
    .from("parametros_sistema")
    .select("id, valor")
    .eq("clave", clave)
    .maybeSingle();

  const ahora = new Date().toISOString();

  if (actual) {
    if (actual.valor === valor) return { id: actual.id, previo: actual.valor };
    const { error } = await supabase
      .from("parametros_sistema")
      .update({ valor, updated_by: user.id, updated_at: ahora })
      .eq("id", actual.id);
    if (error) return { error: "No se pudo guardar" };

    await supabase.from("audit_log").insert({
      accion: "actualizar",
      usuario_id: user.id,
      entidad_tipo: "parametro_sistema",
      entidad_id: actual.id,
      valores_anteriores: { valor: actual.valor },
      valores_nuevos: { valor },
      metadata: { clave, origen: "notificaciones" },
    });
    return { id: actual.id, previo: actual.valor };
  }

  const { data: inserted, error: insError } = await supabase
    .from("parametros_sistema")
    .insert({
      clave,
      valor,
      tipo_dato: meta.tipo_dato,
      categoria: meta.categoria,
      editable: true,
      descripcion: meta.descripcion,
      updated_by: user.id,
      updated_at: ahora,
    })
    .select("id")
    .single();

  if (insError || !inserted) return { error: "No se pudo crear el parámetro" };

  await supabase.from("audit_log").insert({
    accion: "crear",
    usuario_id: user.id,
    entidad_tipo: "parametro_sistema",
    entidad_id: inserted.id,
    valores_anteriores: null,
    valores_nuevos: { valor },
    metadata: { clave, origen: "notificaciones" },
  });

  return { id: inserted.id, previo: null };
}

const canalToggleSchema = z.object({
  canal: z.enum(CANALES.map((c) => c.key) as [CanalKey, ...CanalKey[]]),
  activo: z.boolean(),
});

export async function toggleCanalAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = canalToggleSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const canal = getCanal(parsed.data.canal);
  if (!canal) return { error: "Canal desconocido" };

  const res = await upsertParametro(canal.activoClave, parsed.data.activo ? "true" : "false", {
    tipo_dato: "boolean",
    categoria: "notificaciones",
    descripcion: `Habilita el envío de notificaciones por ${canal.nombre}.`,
  });

  if ("error" in res) return { error: res.error };
  revalidatePath("/configuracion/notificaciones");
  return { success: true };
}

const canalConfigSchema = z.object({
  canal: z.enum(CANALES.map((c) => c.key) as [CanalKey, ...CanalKey[]]),
  campos: z.record(z.string(), z.string()),
});

export async function updateCanalConfigAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = canalConfigSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const canal = getCanal(parsed.data.canal);
  if (!canal) return { error: "Canal desconocido" };

  for (const campo of canal.configCampos) {
    const valorBruto = parsed.data.campos[campo.clave];
    if (valorBruto === undefined) continue;
    const valor = valorBruto.trim();
    if (valor.length > 500) return { error: `${campo.label}: máximo 500 caracteres` };

    if (campo.type === "email" && valor !== "") {
      const emailOk = z.string().email().safeParse(valor).success;
      if (!emailOk) return { error: `${campo.label}: email inválido` };
    }
    if (campo.type === "url" && valor !== "") {
      const urlOk = z.string().url().safeParse(valor).success;
      if (!urlOk) return { error: `${campo.label}: URL inválida` };
    }

    const res = await upsertParametro(campo.clave, valor, {
      tipo_dato: "string",
      categoria: "notificaciones",
      descripcion: `${campo.label} (${canal.nombre})`,
    });
    if ("error" in res) return { error: res.error };
  }

  revalidatePath("/configuracion/notificaciones");
  return { success: true };
}

const alertaToggleSchema = z.object({
  alerta: z.enum(ALERTAS.map((a) => a.key) as [string, ...string[]]),
  activo: z.boolean(),
});

export async function toggleAlertaAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = alertaToggleSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const alerta = ALERTAS.find((a) => a.key === parsed.data.alerta);
  if (!alerta) return { error: "Alerta desconocida" };

  const res = await upsertParametro(
    alertaClave(parsed.data.alerta),
    parsed.data.activo ? "true" : "false",
    {
      tipo_dato: "boolean",
      categoria: "notificaciones",
      descripcion: `Alerta activa: ${alerta.nombre}`,
    },
  );

  if ("error" in res) return { error: res.error };
  revalidatePath("/configuracion/notificaciones");
  return { success: true };
}

const destinatarioSchema = z.object({
  usuarioId: z.string().uuid(),
  activo: z.boolean(),
});

async function leerDestinatarios(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", DESTINATARIOS_CLAVE)
    .maybeSingle();
  if (!data?.valor) return [];
  try {
    const parsed = JSON.parse(data.valor);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export async function toggleDestinatarioAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = destinatarioSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const supabase = await createClient();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", parsed.data.usuarioId)
    .maybeSingle();
  if (!usuario) return { error: "Usuario no encontrado" };

  const actuales = await leerDestinatarios();
  let nuevos: string[];
  if (parsed.data.activo) {
    if (actuales.includes(parsed.data.usuarioId)) return { success: true };
    nuevos = [...actuales, parsed.data.usuarioId];
  } else {
    nuevos = actuales.filter((id) => id !== parsed.data.usuarioId);
  }

  const res = await upsertParametro(DESTINATARIOS_CLAVE, JSON.stringify(nuevos), {
    tipo_dato: "json",
    categoria: "notificaciones",
    descripcion: "IDs de usuarios que reciben notificaciones automáticas.",
  });

  if ("error" in res) return { error: res.error };
  revalidatePath("/configuracion/notificaciones");
  return { success: true };
}
