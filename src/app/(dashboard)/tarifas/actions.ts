"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { Database } from "@/types/database";
import { validarCircuito } from "./validaciones";
import { requireArea } from "@/lib/auth";

type TarifaRow = Database["public"]["Tables"]["tarifas"]["Row"];

export type ClienteOption = { id: string; nombre: string };
export type RutaOption = {
  id: string;
  cliente_id: string | null;
  origen: string;
  destino: string;
  km_oficiales: number;
};

export type TarifaConRelaciones = TarifaRow & {
  cliente_nombre: string;
  ruta_label: string | null;
  ruta_km: number | null;
};

export async function obtenerClientesYRutas(): Promise<{
  clientes: ClienteOption[];
  rutas: RutaOption[];
}> {
  const supabase = await createClient();

  const [clientesRes, rutasRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, razon_social, nombre_comercial, estado")
      .eq("estado", "activo")
      .order("razon_social"),
    supabase
      .from("rutas")
      .select(
        `id, km_oficiales, estado,
         origen:puntos_ruta!rutas_origen_id_fkey (nombre, localidad),
         destino:puntos_ruta!rutas_destino_id_fkey (nombre, localidad)`,
      )
      .eq("estado", "activa")
      .order("created_at"),
  ]);

  const clientes: ClienteOption[] = (clientesRes.data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre_comercial ?? c.razon_social,
  }));

  const rutas: RutaOption[] = (rutasRes.data ?? []).map((r) => {
    const origen = r.origen as { nombre: string; localidad: string | null } | null;
    const destino = r.destino as { nombre: string; localidad: string | null } | null;
    const origenLabel = origen
      ? [origen.nombre, origen.localidad].filter(Boolean).join(", ")
      : "—";
    const destinoLabel = destino
      ? [destino.nombre, destino.localidad].filter(Boolean).join(", ")
      : "—";
    return {
      id: r.id,
      cliente_id: null,
      origen: origenLabel,
      destino: destinoLabel,
      km_oficiales: Number(r.km_oficiales),
    };
  });

  return { clientes, rutas };
}

type ActionResult = { success: true; id?: string } | { error: string };

export type CircuitoConRelaciones = {
  id: string;
  codigo_interno: string | null;
  descripcion: string | null;
  origen_nombre: string;
  destino_nombre: string;
  origen_label: string;
  destino_label: string;
  km_oficiales: number;
  km_vacios: number;
  estado: Database["public"]["Enums"]["ruta_estado"];
};

type PuntoRel = { nombre: string; localidad: string | null } | null;

function puntoLabel(p: PuntoRel): string {
  return p ? [p.nombre, p.localidad].filter(Boolean).join(", ") : "—";
}

export async function obtenerCircuitos(): Promise<CircuitoConRelaciones[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rutas")
    .select(
      `id, codigo_interno, descripcion, km_oficiales, km_vacios, estado,
       origen:puntos_ruta!rutas_origen_id_fkey (nombre, localidad),
       destino:puntos_ruta!rutas_destino_id_fkey (nombre, localidad)`,
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error obteniendo circuitos:", error);
    return [];
  }

  return data.map((row) => {
    const origen = row.origen as PuntoRel;
    const destino = row.destino as PuntoRel;
    return {
      id: row.id,
      codigo_interno: row.codigo_interno,
      descripcion: row.descripcion,
      origen_nombre: origen?.nombre ?? "—",
      destino_nombre: destino?.nombre ?? "—",
      origen_label: puntoLabel(origen),
      destino_label: puntoLabel(destino),
      km_oficiales: Number(row.km_oficiales),
      km_vacios: Number(row.km_vacios),
      estado: row.estado,
    };
  });
}

export type PuntoRutaOption = { id: string; label: string };

/** Puntos de ruta activos, para autocompletar origen/destino en el alta de circuitos. */
export async function obtenerPuntosRuta(): Promise<PuntoRutaOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("puntos_ruta")
    .select("id, nombre")
    .eq("estado", "activo")
    .order("nombre", { ascending: true });
  if (error || !data) return [];
  return data.map((p) => ({ id: p.id, label: p.nombre }));
}

/** Resuelve un punto de ruta por nombre (case-insensitive); lo crea si no existe. */
async function resolverPuntoRuta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string,
): Promise<string | null> {
  const trimmed = nombre.trim();
  if (!trimmed) return null;

  const { data } = await supabase
    .from("puntos_ruta")
    .select("id")
    .ilike("nombre", trimmed)
    .limit(1);
  if (data && data.length > 0) return data[0]!.id;

  const insertRes = await supabase
    .from("puntos_ruta")
    .insert({ nombre: trimmed, estado: "activo" })
    .select("id")
    .single();
  if (insertRes.error || !insertRes.data) {
    console.error("Error creando punto de ruta:", insertRes.error);
    return null;
  }
  return insertRes.data.id;
}

function parseCircuitoForm(formData: FormData) {
  return {
    origen_nombre: formData.get("origen_nombre"),
    destino_nombre: formData.get("destino_nombre"),
    km_oficiales: formData.get("km_oficiales"),
    km_vacios: formData.get("km_vacios"),
    codigo_interno: formData.get("codigo_interno"),
    descripcion: formData.get("descripcion"),
  };
}

export async function crearCircuito(formData: FormData): Promise<ActionResult> {
  const user = await requireArea("comercial", "write");
  const supabase = await createClient();

  const validacion = validarCircuito(parseCircuitoForm(formData));
  if (!validacion.ok) return { error: validacion.error };
  const input = validacion.data;

  const origen_id = await resolverPuntoRuta(supabase, input.origen_nombre);
  const destino_id = await resolverPuntoRuta(supabase, input.destino_nombre);
  if (!origen_id || !destino_id) {
    return { error: "No se pudieron resolver el origen y/o destino" };
  }

  const { data: insertado, error: insertError } = await supabase
    .from("rutas")
    .insert({
      origen_id,
      destino_id,
      km_oficiales: input.km_oficiales,
      km_vacios: input.km_vacios,
      codigo_interno: input.codigo_interno,
      descripcion: input.descripcion,
      estado: "activa",
    })
    .select("id")
    .single();

  if (insertError || !insertado) {
    console.error("Error creando circuito:", insertError);
    return { error: "No se pudo crear el circuito" };
  }

  await logAudit({
    client: supabase,
    accion: "crear",
    usuarioId: user.id,
    entidadTipo: "ruta",
    entidadId: insertado.id,
    valoresAnteriores: null,
    valoresNuevos: { ...input, origen_id, destino_id, estado: "activa" },
  });

  revalidatePath("/tarifas");
  revalidatePath("/viajes");
  return { success: true, id: insertado.id };
}

export async function actualizarCircuito(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireArea("comercial", "write");
  const supabase = await createClient();

  const { data: actual, error: fetchError } = await supabase
    .from("rutas")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !actual) return { error: "Circuito no encontrado" };

  const validacion = validarCircuito(parseCircuitoForm(formData));
  if (!validacion.ok) return { error: validacion.error };
  const input = validacion.data;

  const origen_id = await resolverPuntoRuta(supabase, input.origen_nombre);
  const destino_id = await resolverPuntoRuta(supabase, input.destino_nombre);
  if (!origen_id || !destino_id) {
    return { error: "No se pudieron resolver el origen y/o destino" };
  }

  const { error: updateError } = await supabase
    .from("rutas")
    .update({
      origen_id,
      destino_id,
      km_oficiales: input.km_oficiales,
      km_vacios: input.km_vacios,
      codigo_interno: input.codigo_interno,
      descripcion: input.descripcion,
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error actualizando circuito:", updateError);
    return { error: "No se pudo actualizar el circuito" };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    usuarioId: user.id,
    entidadTipo: "ruta",
    entidadId: id,
    valoresAnteriores: {
      origen_id: actual.origen_id,
      destino_id: actual.destino_id,
      km_oficiales: Number(actual.km_oficiales),
      km_vacios: Number(actual.km_vacios),
      codigo_interno: actual.codigo_interno,
      descripcion: actual.descripcion,
    },
    valoresNuevos: { ...input, origen_id, destino_id },
  });

  revalidatePath("/tarifas");
  revalidatePath("/viajes");
  return { success: true, id };
}

export async function cambiarEstadoCircuito(
  id: string,
  activar: boolean,
): Promise<ActionResult> {
  const user = await requireArea("comercial", "write");
  const supabase = await createClient();

  const nuevoEstado = activar ? "activa" : "inactiva";
  const { data: actual, error: fetchError } = await supabase
    .from("rutas")
    .select("estado")
    .eq("id", id)
    .single();
  if (fetchError || !actual) return { error: "Circuito no encontrado" };
  if (actual.estado === nuevoEstado) return { success: true, id };

  const { error: updateError } = await supabase
    .from("rutas")
    .update({ estado: nuevoEstado })
    .eq("id", id);
  if (updateError) {
    console.error("Error cambiando estado del circuito:", updateError);
    return { error: "No se pudo cambiar el estado" };
  }

  await logAudit({
    client: supabase,
    accion: "cambio_estado",
    usuarioId: user.id,
    entidadTipo: "ruta",
    entidadId: id,
    valoresAnteriores: { estado: actual.estado },
    valoresNuevos: { estado: nuevoEstado },
  });

  revalidatePath("/tarifas");
  revalidatePath("/viajes");
  return { success: true, id };
}
