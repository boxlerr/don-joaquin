"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { Database } from "@/types/database";
import { validarTarifa, validarCircuito, type TarifaInput } from "./validaciones";
import { requireArea } from "@/lib/auth";

type TarifaRow = Database["public"]["Tables"]["tarifas"]["Row"];

export type TarifaParams = {
  tarifa_base: number;
  precio_por_kg: number;
  precio_por_km: number;
};

const PARAM_KEYS = ["tarifa_base", "precio_por_kg", "precio_por_km"] as const;
type ParamKey = (typeof PARAM_KEYS)[number];

const DEFAULTS: TarifaParams = {
  tarifa_base: 500,
  precio_por_kg: 0.5,
  precio_por_km: 2,
};

const DESCRIPCIONES: Record<ParamKey, string> = {
  tarifa_base: "Tarifa base aplicada a todo flete",
  precio_por_kg: "Precio por kilogramo de carga",
  precio_por_km: "Precio por kilómetro recorrido",
};

export async function getTarifaParams(): Promise<TarifaParams> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .in("clave", [...PARAM_KEYS]);

  const result = { ...DEFAULTS };
  for (const row of data ?? []) {
    const num = Number(row.valor);
    if (Number.isFinite(num) && PARAM_KEYS.includes(row.clave as ParamKey)) {
      result[row.clave as ParamKey] = num;
    }
  }
  return result;
}

export async function guardarAjustes(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const rows = PARAM_KEYS.map((clave) => {
    const raw = formData.get(clave);
    const num = Number(raw);
    return {
      clave,
      valor: Number.isFinite(num) && num >= 0 ? String(num) : String(DEFAULTS[clave]),
      categoria: "tarifas",
      tipo_dato: "number" as const,
      descripcion: DESCRIPCIONES[clave],
      editable: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
  });

  await supabase.from("parametros_sistema").upsert(rows, { onConflict: "clave" });

  revalidatePath("/tarifas");
  revalidatePath("/configuracion");
}

// ============================================================
// CRUD DE TARIFAS POR CLIENTE / RUTA
// ============================================================

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

export type TarifaFiltros = {
  busqueda?: string;
  modalidad?: string;
  soloActivas?: boolean;
};

export async function obtenerTarifas(
  filtros: TarifaFiltros = {},
): Promise<TarifaConRelaciones[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tarifas")
    .select(
      `*,
       cliente:cliente_id (razon_social, nombre_comercial),
       ruta:ruta_id (km_oficiales,
         origen:puntos_ruta!rutas_origen_id_fkey (nombre, localidad),
         destino:puntos_ruta!rutas_destino_id_fkey (nombre, localidad))`,
    )
    .order("created_at", { ascending: false });

  if (filtros.soloActivas) query = query.eq("activa", true);

  if (filtros.modalidad && filtros.modalidad !== "todas") {
    query = query.eq("modalidad", filtros.modalidad as Database["public"]["Enums"]["tarifa_modalidad"]);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error obteniendo tarifas:", error);
    return [];
  }

  const busqueda = (filtros.busqueda ?? "").trim().toLowerCase();

  return data
    .map((row) => {
      const cliente = row.cliente as
        | { razon_social: string; nombre_comercial: string | null }
        | null;
      const ruta = row.ruta as
        | {
            km_oficiales: number;
            origen: { nombre: string; localidad: string | null } | null;
            destino: { nombre: string; localidad: string | null } | null;
          }
        | null;

      const clienteNombre =
        cliente?.nombre_comercial ?? cliente?.razon_social ?? "—";

      let rutaLabel: string | null = null;
      let rutaKm: number | null = null;
      if (ruta) {
        const origen = ruta.origen
          ? [ruta.origen.nombre, ruta.origen.localidad].filter(Boolean).join(", ")
          : "—";
        const destino = ruta.destino
          ? [ruta.destino.nombre, ruta.destino.localidad].filter(Boolean).join(", ")
          : "—";
        rutaLabel = `${origen} → ${destino}`;
        rutaKm = Number(ruta.km_oficiales);
      }

      const { cliente: _c, ruta: _r, ...resto } = row as typeof row & {
        cliente?: unknown;
        ruta?: unknown;
      };

      return {
        ...(resto as TarifaRow),
        cliente_nombre: clienteNombre,
        ruta_label: rutaLabel,
        ruta_km: rutaKm,
      };
    })
    .filter((t) => {
      if (!busqueda) return true;
      const hay = [
        t.cliente_nombre,
        t.ruta_label ?? "",
        t.observaciones ?? "",
        t.modalidad,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(busqueda);
    });
}

type ActionResult = { success: true; id?: string } | { error: string };

function parseFormToInput(formData: FormData): Parameters<typeof validarTarifa>[0] {
  return {
    cliente_id: formData.get("cliente_id"),
    ruta_id: formData.get("ruta_id"),
    modalidad: formData.get("modalidad"),
    valor: formData.get("valor"),
    moneda: formData.get("moneda"),
    vigencia_desde: formData.get("vigencia_desde"),
    vigencia_hasta: formData.get("vigencia_hasta"),
    observaciones: formData.get("observaciones"),
  };
}

function inputToValoresJson(input: TarifaInput, activa: boolean) {
  return {
    cliente_id: input.cliente_id,
    ruta_id: input.ruta_id,
    modalidad: input.modalidad,
    valor: input.valor,
    moneda: input.moneda,
    vigencia_desde: input.vigencia_desde,
    vigencia_hasta: input.vigencia_hasta,
    observaciones: input.observaciones,
    activa,
  };
}

export async function crearTarifa(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const validacion = validarTarifa(parseFormToInput(formData));
  if (!validacion.ok) return { error: validacion.error };

  const input = validacion.data;
  const { data: insertado, error: insertError } = await supabase
    .from("tarifas")
    .insert({
      cliente_id: input.cliente_id,
      ruta_id: input.ruta_id,
      modalidad: input.modalidad,
      valor: input.valor,
      moneda: input.moneda,
      vigencia_desde: input.vigencia_desde,
      vigencia_hasta: input.vigencia_hasta,
      observaciones: input.observaciones,
      activa: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !insertado) {
    console.error("Error creando tarifa:", insertError);
    return { error: "No se pudo crear la tarifa" };
  }

  await logAudit({
    client: supabase,
    accion: "crear",
    usuarioId: user.id,
    entidadTipo: "tarifa",
    entidadId: insertado.id,
    valoresAnteriores: null,
    valoresNuevos: inputToValoresJson(input, true),
    metadata: { cliente_id: input.cliente_id, modalidad: input.modalidad },
  });

  revalidatePath("/tarifas");
  return { success: true, id: insertado.id };
}

export async function actualizarTarifa(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: actual, error: fetchError } = await supabase
    .from("tarifas")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !actual) return { error: "Tarifa no encontrada" };

  const validacion = validarTarifa(parseFormToInput(formData));
  if (!validacion.ok) return { error: validacion.error };

  const input = validacion.data;
  const sinCambios =
    actual.cliente_id === input.cliente_id &&
    actual.ruta_id === input.ruta_id &&
    actual.modalidad === input.modalidad &&
    Number(actual.valor) === input.valor &&
    actual.moneda === input.moneda &&
    actual.vigencia_desde === input.vigencia_desde &&
    actual.vigencia_hasta === input.vigencia_hasta &&
    (actual.observaciones ?? null) === input.observaciones;

  if (sinCambios) return { success: true, id };

  const { error: updateError } = await supabase
    .from("tarifas")
    .update({
      cliente_id: input.cliente_id,
      ruta_id: input.ruta_id,
      modalidad: input.modalidad,
      valor: input.valor,
      moneda: input.moneda,
      vigencia_desde: input.vigencia_desde,
      vigencia_hasta: input.vigencia_hasta,
      observaciones: input.observaciones,
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error actualizando tarifa:", updateError);
    return { error: "No se pudo actualizar la tarifa" };
  }

  await logAudit({
    client: supabase,
    accion: "actualizar",
    usuarioId: user.id,
    entidadTipo: "tarifa",
    entidadId: id,
    valoresAnteriores: {
      cliente_id: actual.cliente_id,
      ruta_id: actual.ruta_id,
      modalidad: actual.modalidad,
      valor: Number(actual.valor),
      moneda: actual.moneda,
      vigencia_desde: actual.vigencia_desde,
      vigencia_hasta: actual.vigencia_hasta,
      observaciones: actual.observaciones,
      activa: actual.activa,
    },
    valoresNuevos: inputToValoresJson(input, actual.activa),
    metadata: { cliente_id: input.cliente_id, modalidad: input.modalidad },
  });

  revalidatePath("/tarifas");
  return { success: true, id };
}

export async function cambiarEstadoTarifa(
  id: string,
  activa: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: actual, error: fetchError } = await supabase
    .from("tarifas")
    .select("activa, cliente_id, modalidad")
    .eq("id", id)
    .single();

  if (fetchError || !actual) return { error: "Tarifa no encontrada" };
  if (actual.activa === activa) return { success: true, id };

  const { error: updateError } = await supabase
    .from("tarifas")
    .update({ activa })
    .eq("id", id);

  if (updateError) {
    console.error("Error cambiando estado tarifa:", updateError);
    return { error: "No se pudo cambiar el estado" };
  }

  await logAudit({
    client: supabase,
    accion: "cambio_estado",
    usuarioId: user.id,
    entidadTipo: "tarifa",
    entidadId: id,
    valoresAnteriores: { activa: actual.activa },
    valoresNuevos: { activa },
    metadata: { cliente_id: actual.cliente_id, modalidad: actual.modalidad },
  });

  revalidatePath("/tarifas");
  return { success: true, id };
}

export type TarifaHistorialEvento = {
  id: string;
  created_at: string;
  accion: string;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
};

export async function obtenerHistorialTarifa(
  tarifaId: string,
): Promise<TarifaHistorialEvento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      `id, created_at, accion, valores_anteriores, valores_nuevos,
       usuarios:usuario_id (nombre, apellido, email)`,
    )
    .eq("entidad_tipo", "tarifa")
    .eq("entidad_id", tarifaId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    console.error("Error obteniendo historial tarifa:", error);
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
      accion: row.accion,
      valores_anteriores: row.valores_anteriores as Record<string, unknown> | null,
      valores_nuevos: row.valores_nuevos as Record<string, unknown> | null,
      usuario_nombre: nombreCompleto,
      usuario_email: usuario?.email ?? null,
    };
  });
}

export async function buscarTarifaAplicable(
  clienteId: string,
  rutaId: string | null,
): Promise<TarifaConRelaciones | null> {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("tarifas")
    .select(
      `*,
       cliente:cliente_id (razon_social, nombre_comercial),
       ruta:ruta_id (km_oficiales,
         origen:puntos_ruta!rutas_origen_id_fkey (nombre, localidad),
         destino:puntos_ruta!rutas_destino_id_fkey (nombre, localidad))`,
    )
    .eq("cliente_id", clienteId)
    .eq("activa", true)
    .lte("vigencia_desde", hoy)
    .order("vigencia_desde", { ascending: false });

  if (rutaId) {
    query = query.or(`ruta_id.eq.${rutaId},ruta_id.is.null`);
  } else {
    query = query.is("ruta_id", null);
  }

  const { data, error } = await query.limit(20);
  if (error || !data || data.length === 0) return null;

  const vigentes = data.filter(
    (t) => t.vigencia_hasta === null || t.vigencia_hasta >= hoy,
  );
  if (vigentes.length === 0) return null;

  const conRuta = vigentes.find((t) => t.ruta_id === rutaId && rutaId !== null);
  const elegida = conRuta ?? vigentes[0]!;

  const cliente = elegida.cliente as
    | { razon_social: string; nombre_comercial: string | null }
    | null;
  const ruta = elegida.ruta as
    | {
        km_oficiales: number;
        origen: { nombre: string; localidad: string | null } | null;
        destino: { nombre: string; localidad: string | null } | null;
      }
    | null;

  let rutaLabel: string | null = null;
  let rutaKm: number | null = null;
  if (ruta) {
    const origen = ruta.origen
      ? [ruta.origen.nombre, ruta.origen.localidad].filter(Boolean).join(", ")
      : "—";
    const destino = ruta.destino
      ? [ruta.destino.nombre, ruta.destino.localidad].filter(Boolean).join(", ")
      : "—";
    rutaLabel = `${origen} → ${destino}`;
    rutaKm = Number(ruta.km_oficiales);
  }

  const { cliente: _c, ruta: _r, ...resto } = elegida as typeof elegida & {
    cliente?: unknown;
    ruta?: unknown;
  };

  return {
    ...(resto as TarifaRow),
    cliente_nombre: cliente?.nombre_comercial ?? cliente?.razon_social ?? "—",
    ruta_label: rutaLabel,
    ruta_km: rutaKm,
  };
}

// ============================================================
// CRUD DE CIRCUITOS (rutas con km cargados + km vacíos predefinidos)
// ============================================================

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
