"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// CONTACTOS
// ============================================================================

const CONTACTO_CARGOS = ["comercial", "administrativo", "logistica", "otro"] as const;
export type ContactoCargo = (typeof CONTACTO_CARGOS)[number];

const contactoSchema = z.object({
  cliente_id: z.string().uuid("Cliente inválido."),
  nombre: z.string().trim().min(1, "Nombre obligatorio."),
  cargo: z.enum(CONTACTO_CARGOS),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Email inválido.").optional().or(z.literal("")),
  es_principal: z.boolean().optional(),
  observaciones: z.string().trim().optional().nullable(),
});

export type Contacto = {
  id: string;
  cliente_id: string;
  nombre: string;
  cargo: ContactoCargo;
  telefono: string | null;
  email: string | null;
  es_principal: boolean;
  observaciones: string | null;
};

export async function getContactosAction(cliente_id: string): Promise<Contacto[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cliente_contactos")
    .select("id, cliente_id, nombre, cargo, telefono, email, es_principal, observaciones")
    .eq("cliente_id", cliente_id)
    .order("es_principal", { ascending: false })
    .order("nombre");
  return (data ?? []) as Contacto[];
}

export type ContactoActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function addContactoAction(
  _prev: ContactoActionState,
  formData: FormData
): Promise<ContactoActionState> {
  const parsed = contactoSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    nombre: formData.get("nombre"),
    cargo: formData.get("cargo") ?? "comercial",
    telefono: emptyToNull(formData.get("telefono")),
    email: emptyToNull(formData.get("email")) ?? "",
    es_principal: formData.get("es_principal") === "on",
    observaciones: emptyToNull(formData.get("observaciones")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisá los campos.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // Si se marca principal, desmarcar los demás primero
  if (parsed.data.es_principal) {
    await supabase
      .from("cliente_contactos")
      .update({ es_principal: false })
      .eq("cliente_id", parsed.data.cliente_id);
  }

  const { error } = await supabase.from("cliente_contactos").insert({
    cliente_id: parsed.data.cliente_id,
    nombre: parsed.data.nombre,
    cargo: parsed.data.cargo,
    telefono: parsed.data.telefono ?? null,
    email: parsed.data.email ? parsed.data.email : null,
    es_principal: parsed.data.es_principal ?? false,
    observaciones: parsed.data.observaciones ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

export async function deleteContactoAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_contactos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

// ============================================================================
// SUCURSALES
// ============================================================================

const sucursalSchema = z.object({
  cliente_id: z.string().uuid("Cliente inválido."),
  nombre: z.string().trim().min(1, "Nombre obligatorio."),
  domicilio: z.string().trim().optional().nullable(),
  localidad: z.string().trim().optional().nullable(),
  provincia: z.string().trim().optional().nullable(),
  pais: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
  es_principal: z.boolean().optional(),
});

export type Sucursal = {
  id: string;
  cliente_id: string;
  nombre: string;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  pais: string;
  telefono: string | null;
  observaciones: string | null;
  es_principal: boolean;
  estado: string;
};

export async function getSucursalesAction(cliente_id: string): Promise<Sucursal[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cliente_sucursales")
    .select("id, cliente_id, nombre, domicilio, localidad, provincia, pais, telefono, observaciones, es_principal, estado")
    .eq("cliente_id", cliente_id)
    .order("es_principal", { ascending: false })
    .order("nombre");
  return (data ?? []) as Sucursal[];
}

export async function addSucursalAction(
  _prev: ContactoActionState,
  formData: FormData
): Promise<ContactoActionState> {
  const parsed = sucursalSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    nombre: formData.get("nombre"),
    domicilio: emptyToNull(formData.get("domicilio")),
    localidad: emptyToNull(formData.get("localidad")),
    provincia: emptyToNull(formData.get("provincia")),
    pais: emptyToNull(formData.get("pais")) ?? "Argentina",
    telefono: emptyToNull(formData.get("telefono")),
    observaciones: emptyToNull(formData.get("observaciones")),
    es_principal: formData.get("es_principal") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisá los campos.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  if (parsed.data.es_principal) {
    await supabase
      .from("cliente_sucursales")
      .update({ es_principal: false })
      .eq("cliente_id", parsed.data.cliente_id);
  }

  const { error } = await supabase.from("cliente_sucursales").insert({
    cliente_id: parsed.data.cliente_id,
    nombre: parsed.data.nombre,
    domicilio: parsed.data.domicilio ?? null,
    localidad: parsed.data.localidad ?? null,
    provincia: parsed.data.provincia ?? null,
    pais: parsed.data.pais ?? "Argentina",
    telefono: parsed.data.telefono ?? null,
    observaciones: parsed.data.observaciones ?? null,
    es_principal: parsed.data.es_principal ?? false,
    estado: "activo",
  });

  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

export async function deleteSucursalAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_sucursales").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

// ============================================================================
// REQUISITOS
// ============================================================================

const REQUISITO_TIPOS = [
  "habilitacion_proveedor",
  "documentacion_chofer",
  "documentacion_camion",
  "reporte_periodico",
  "auditoria",
  "otro",
] as const;
const REQUISITO_FRECUENCIAS = ["unica", "mensual", "trimestral", "semestral", "anual"] as const;
const REQUISITO_ESTADOS = ["pendiente", "cumplido", "vencido"] as const;

export type RequisitoTipo = (typeof REQUISITO_TIPOS)[number];
export type RequisitoFrecuencia = (typeof REQUISITO_FRECUENCIAS)[number];
export type RequisitoEstado = (typeof REQUISITO_ESTADOS)[number];

const requisitoSchema = z.object({
  cliente_id: z.string().uuid("Cliente inválido."),
  tipo: z.enum(REQUISITO_TIPOS),
  descripcion: z.string().trim().min(1, "Descripción obligatoria."),
  frecuencia: z.enum(REQUISITO_FRECUENCIAS).optional().nullable(),
  proxima_fecha: z.string().trim().optional().nullable(),
  formato_requerido: z.string().trim().optional().nullable(),
  responsable_interno: z.string().trim().optional().nullable(),
  estado: z.enum(REQUISITO_ESTADOS).optional(),
  observaciones: z.string().trim().optional().nullable(),
});

export type Requisito = {
  id: string;
  cliente_id: string;
  tipo: RequisitoTipo;
  descripcion: string;
  frecuencia: RequisitoFrecuencia | null;
  proxima_fecha: string | null;
  formato_requerido: string | null;
  responsable_interno: string | null;
  estado: RequisitoEstado;
  observaciones: string | null;
};

export async function getRequisitosAction(cliente_id: string): Promise<Requisito[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cliente_requisitos")
    .select("id, cliente_id, tipo, descripcion, frecuencia, proxima_fecha, formato_requerido, responsable_interno, estado, observaciones")
    .eq("cliente_id", cliente_id)
    .order("proxima_fecha", { ascending: true, nullsFirst: false });
  return (data ?? []) as Requisito[];
}

export async function addRequisitoAction(
  _prev: ContactoActionState,
  formData: FormData
): Promise<ContactoActionState> {
  const frecuenciaRaw = emptyToNull(formData.get("frecuencia"));
  const parsed = requisitoSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    tipo: formData.get("tipo") ?? "otro",
    descripcion: formData.get("descripcion"),
    frecuencia: frecuenciaRaw,
    proxima_fecha: emptyToNull(formData.get("proxima_fecha")),
    formato_requerido: emptyToNull(formData.get("formato_requerido")),
    responsable_interno: emptyToNull(formData.get("responsable_interno")),
    estado: formData.get("estado") ?? "pendiente",
    observaciones: emptyToNull(formData.get("observaciones")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisá los campos.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.from("cliente_requisitos").insert({
    cliente_id: parsed.data.cliente_id,
    tipo: parsed.data.tipo,
    descripcion: parsed.data.descripcion,
    frecuencia: parsed.data.frecuencia ?? null,
    proxima_fecha: parsed.data.proxima_fecha ?? null,
    formato_requerido: parsed.data.formato_requerido ?? null,
    responsable_interno: parsed.data.responsable_interno ?? null,
    estado: parsed.data.estado ?? "pendiente",
    observaciones: parsed.data.observaciones ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

export async function deleteRequisitoAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_requisitos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

export async function setRequisitoEstadoAction(
  id: string,
  estado: RequisitoEstado
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("cliente_requisitos").update({ estado }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}
