"use server";

// Aumentos de tarifa por cliente, gestionados desde /tarifas (pedido 21/07:
// "que se pueda manejar desde tarifas, ver historiales de clientes, agregar un
// aumento ahí, que luego impacte en la métrica"). Misma tabla que alimenta la
// sección "Aumentos: clientes vs sueldos" de /metricas (`clientes_aumentos`),
// así lo que se carga acá impacta directo en el dashboard.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// `clientes_aumentos` aún no está tipada en database.ts (igual que en metricas).
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AumentoClienteHist = {
  id: string;
  clienteId: string | null;
  clienteNombre: string;
  vigenteDesde: string; // YYYY-MM-DD
  porcentaje: number;
  observaciones: string | null;
  createdAt: string;
  createdByNombre: string | null;
};

/** Historial completo de aumentos de todos los clientes, con quién lo cargó. */
export async function obtenerAumentosClientes(): Promise<AumentoClienteHist[]> {
  await requireSeccion("tarifas", "read");
  const supabase = createAdminClient();

  const { data, error } = await (supabase as any)
    .from("clientes_aumentos")
    .select("id, cliente_id, cliente_nombre, vigente_desde, porcentaje, observaciones, created_at, created_by")
    .order("vigente_desde", { ascending: true });
  if (error || !data) {
    console.error("Error obteniendo aumentos de clientes:", error);
    return [];
  }

  // Nombre de quien lo cargó (sin depender de un FK embebible).
  const ids = Array.from(new Set((data as any[]).map((r) => r.created_by).filter(Boolean)));
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nombre, apellido, email")
      .in("id", ids as string[]);
    for (const u of usuarios ?? []) {
      const nombre = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
      nombres.set(u.id, nombre || u.email);
    }
  }

  return (data as any[]).map((r) => ({
    id: r.id,
    clienteId: r.cliente_id ?? null,
    clienteNombre: r.cliente_nombre,
    vigenteDesde: String(r.vigente_desde),
    porcentaje: Number(r.porcentaje),
    observaciones: r.observaciones ?? null,
    createdAt: String(r.created_at),
    createdByNombre: r.created_by ? nombres.get(r.created_by) ?? null : null,
  }));
}

export async function crearAumentoClienteTarifasAction(input: {
  clienteId: string | null;
  clienteNombre: string;
  vigenteDesde: string; // YYYY-MM-DD
  porcentaje: number;
  observaciones?: string;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("tarifas", "write");
  const supabase = createAdminClient();

  const nombre = input.clienteNombre.trim();
  if (!nombre) return { error: "Falta el cliente." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vigenteDesde)) return { error: "Fecha inválida." };
  if (!Number.isFinite(input.porcentaje) || input.porcentaje <= -100 || input.porcentaje >= 1000) {
    return { error: "El porcentaje no es válido." };
  }

  const { error } = await (supabase as any).from("clientes_aumentos").insert({
    cliente_id: input.clienteId,
    cliente_nombre: nombre,
    vigente_desde: input.vigenteDesde,
    porcentaje: input.porcentaje,
    observaciones: input.observaciones?.trim() || null,
    created_by: user.id,
  });
  if (error) {
    console.error("Error al crear aumento de cliente:", error);
    return { error: "No se pudo guardar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "cliente_aumento",
    entidadId: nombre,
    valoresNuevos: { ...input },
    metadata: { origen: "tarifas" },
  });

  revalidatePath("/tarifas");
  revalidatePath("/metricas");
  return { ok: true };
}

export async function eliminarAumentoClienteTarifasAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("tarifas", "write");
  const supabase = createAdminClient();

  const { data: prev } = await (supabase as any)
    .from("clientes_aumentos")
    .select("cliente_nombre, vigente_desde, porcentaje")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("clientes_aumentos").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar aumento:", error);
    return { error: "No se pudo eliminar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "cliente_aumento",
    entidadId: id,
    valoresAnteriores: prev ?? null,
    metadata: { origen: "tarifas" },
  });

  revalidatePath("/tarifas");
  revalidatePath("/metricas");
  return { ok: true };
}
