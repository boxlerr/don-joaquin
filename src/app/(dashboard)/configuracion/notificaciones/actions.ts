"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { enviarResumenPrueba } from "@/lib/notificaciones";
import { normalizarColumnas, seccionDeColumna } from "@/lib/alertas-routing";
import { getUsuariosConSeccion } from "@/lib/permisos-usuarios";
import { SECCION_BY_CODIGO } from "@/lib/secciones";
import {
  ALERTA_COLUMNAS,
  CATEGORIAS,
  CANALES,
  DESTINATARIOS_CLAVE,
  MATRIZ_CLAVE,
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

    await logAudit({
      client: supabase,
      accion: "actualizar",
      usuarioId: user.id,
      entidadTipo: "parametro_sistema",
      entidadId: actual.id,
      valoresAnteriores: { valor: actual.valor },
      valoresNuevos: { valor },
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

  await logAudit({
    client: supabase,
    accion: "crear",
    usuarioId: user.id,
    entidadTipo: "parametro_sistema",
    entidadId: inserted.id,
    valoresAnteriores: null,
    valoresNuevos: { valor },
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
  alerta: z.enum(CATEGORIAS.map((a) => a.key) as [string, ...string[]]),
  activo: z.boolean(),
});

export async function toggleAlertaAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = alertaToggleSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const alerta = CATEGORIAS.find((a) => a.key === parsed.data.alerta);
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

// --- Matriz granular: qué tipos de alerta recibe cada usuario ---

const COLUMNAS_VALIDAS = new Set(ALERTA_COLUMNAS.map((c) => c.key));

const matrizSchema = z.object({
  usuarioId: z.string().uuid(),
  alertaKey: z.string(),
  activo: z.boolean(),
});

async function leerMatriz(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", MATRIZ_CLAVE)
    .maybeSingle();
  if (!data?.valor) return {};
  try {
    const parsed = JSON.parse(data.valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setUsuarioAlertaPrefAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = matrizSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };
  if (!COLUMNAS_VALIDAS.has(parsed.data.alertaKey)) return { error: "Tipo de alerta desconocido" };

  // Una preferencia no puede otorgar un permiso. La pantalla ya dibuja estas
  // columnas con candado, pero la acción es la que manda: sin este corte alcanzaba
  // con un POST a mano para hacerse mandar por mail las cuotas del banco.
  // Destildar siempre se puede — sacar un aviso nunca puede quedar bloqueado.
  const seccion = seccionDeColumna(parsed.data.alertaKey);
  if (parsed.data.activo && seccion) {
    const conAcceso = await getUsuariosConSeccion(seccion, "read");
    if (!conAcceso.has(parsed.data.usuarioId)) {
      return {
        error: `Sin acceso a ${SECCION_BY_CODIGO[seccion].nombre}: primero hay que otorgarle la sección en Usuarios y permisos.`,
      };
    }
  }

  const matriz = await leerMatriz();
  // Normalizar ANTES de tocar: quien tenía "Otros avisos" y todavía no vio las
  // categorías que salieron de ahí (impuestos, mantenimiento, efemérides,
  // ausencias) las tiene tildadas en pantalla. Sin esto, el primer clic guardaría
  // sólo lo viejo y le apagaría en silencio cuatro categorías que sí recibía.
  const cur = new Set(normalizarColumnas(matriz[parsed.data.usuarioId] ?? []));
  if (parsed.data.activo) cur.add(parsed.data.alertaKey);
  else cur.delete(parsed.data.alertaKey);
  matriz[parsed.data.usuarioId] = [...cur];

  const res = await upsertParametro(MATRIZ_CLAVE, JSON.stringify(matriz), {
    tipo_dato: "json",
    categoria: "notificaciones",
    descripcion: "Matriz por usuario: qué tipos de alerta recibe cada uno.",
  });

  if ("error" in res) return { error: res.error };
  revalidatePath("/configuracion/notificaciones");
  return { success: true };
}

/**
 * Envío de PRUEBA: manda el resumen de alertas SOLO al correo del admin que aprieta
 * el botón (se deriva de la sesión, nunca del cliente). No toca la base ni la lista
 * de destinatarios, así probar es inofensivo.
 */
export async function enviarPruebaNotificacionAction(): Promise<
  Result & { email?: string; total?: number }
> {
  const user = await requireAdmin();

  const res = await enviarResumenPrueba(user);
  if (res.enviado) {
    return { success: true, email: user.email, total: res.total };
  }

  const mensajePorMotivo: Record<string, string> = {
    smtp_no_configurado: "El correo (SMTP) no está configurado.",
    error_envio: res.error ? `No se pudo enviar: ${res.error}` : "No se pudo enviar el correo.",
  };
  return { error: mensajePorMotivo[res.motivo] ?? "No se pudo enviar el correo." };
}
