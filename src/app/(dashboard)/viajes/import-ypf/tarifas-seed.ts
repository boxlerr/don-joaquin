// Siembra de tarifas a partir del DM de YPF.
// ----------------------------------------------------------------------------
// El DM trae el precio unitario por destino (ver parser-ypf). Acá persistimos
// esas tarifas en la tabla `tarifas` (modalidad por_tonelada, por cliente YPF y
// ruta origen→destino) para que el alta de viajes pueda precargar el monto y
// "coincidir con el DM" sin recargar nada a mano.
//
// Respetamos el historial (DATABASE.md): NO pisamos una tarifa con UPDATE; si el
// precio cambió, cerramos la vigente (activa=false + vigencia_hasta) y creamos
// una nueva fila. Re-importar el mismo período no genera duplicados.
//
// Es best-effort: el caller la envuelve en try/catch para que nunca bloquee la
// confirmación del DM.

import type { YpfParseResult } from "./parser-ypf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type SeedTarifasResult = { creadas: number; actualizadas: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normaliza un nombre de punto para matchear sin acentos ni mayúsculas. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getOrCreateYpfCliente(supabase: Admin, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id")
    .or("razon_social.ilike.%ypf%,nombre_comercial.ilike.%ypf%")
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id as string;

  const { data: creado, error } = await supabase
    .from("clientes")
    .insert({
      razon_social: "YPF S.A.",
      nombre_comercial: "YPF",
      condicion_iva: "responsable_inscripto",
      estado: "activo",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !creado) {
    console.error("No se pudo crear el cliente YPF:", error);
    return null;
  }
  return creado.id as string;
}

async function ensurePunto(supabase: Admin, nombre: string): Promise<string | null> {
  const clean = nombre.trim();
  if (!clean) return null;
  const { data } = await supabase.from("puntos_ruta").select("id").ilike("nombre", clean).limit(1);
  if (data && data.length > 0) return data[0].id as string;
  const { data: creado, error } = await supabase
    .from("puntos_ruta")
    .insert({ nombre: clean, estado: "activo" })
    .select("id")
    .single();
  if (error || !creado) {
    console.error(`No se pudo crear el punto "${clean}":`, error);
    return null;
  }
  return creado.id as string;
}

/** Busca (o crea) la ruta origen→destino. Las rutas sembradas van con km 0: el
 *  alta de viajes las excluye del desplegable de circuitos (filtra km > 0) y los
 *  km se autocompletan desde el historial. */
async function ensureRuta(supabase: Admin, origenId: string, destinoId: string): Promise<string | null> {
  const { data } = await supabase
    .from("rutas")
    .select("id")
    .eq("origen_id", origenId)
    .eq("destino_id", destinoId)
    .limit(1);
  if (data && data.length > 0) return data[0].id as string;
  const { data: creado, error } = await supabase
    .from("rutas")
    .insert({ origen_id: origenId, destino_id: destinoId, km_oficiales: 0, estado: "activa" })
    .select("id")
    .single();
  if (error || !creado) {
    console.error("No se pudo crear la ruta para la tarifa YPF:", error);
    return null;
  }
  return creado.id as string;
}

type UpsertResult = "creada" | "actualizada" | "sin_cambio";

async function upsertTarifa(
  supabase: Admin,
  userId: string,
  clienteId: string,
  rutaId: string,
  precio: number,
  vigenciaDesde: string,
  observaciones: string,
): Promise<UpsertResult> {
  const { data: existentes } = await supabase
    .from("tarifas")
    .select("id, valor, vigencia_desde")
    .eq("cliente_id", clienteId)
    .eq("ruta_id", rutaId)
    .eq("modalidad", "por_tonelada")
    .eq("activa", true)
    .order("vigencia_desde", { ascending: false })
    .limit(1);

  const actual = existentes?.[0] as { id: string; valor: number; vigencia_desde: string } | undefined;

  // Mismo precio: nada que hacer (re-import del mismo DM).
  if (actual && Math.abs(Number(actual.valor) - precio) < 0.005) return "sin_cambio";

  // Ya hay una tarifa vigente igual o más nueva: no la pisamos con un DM viejo.
  if (actual && actual.vigencia_desde >= vigenciaDesde) {
    // Salvo que sea exactamente el mismo período: corrección del valor in situ.
    if (actual.vigencia_desde === vigenciaDesde) {
      await supabase.from("tarifas").update({ valor: precio, observaciones }).eq("id", actual.id);
      await logTarifa(supabase, userId, actual.id, "actualizar", { valor: Number(actual.valor) }, { valor: precio });
      return "actualizada";
    }
    return "sin_cambio";
  }

  // El precio cambió respecto de la vigente anterior: cerrarla (historial) y crear
  // una nueva fila a partir de la fecha del DM.
  if (actual) {
    await supabase
      .from("tarifas")
      .update({ activa: false, vigencia_hasta: vigenciaDesde })
      .eq("id", actual.id);
  }

  const { data: nueva, error } = await supabase
    .from("tarifas")
    .insert({
      cliente_id: clienteId,
      ruta_id: rutaId,
      modalidad: "por_tonelada",
      valor: precio,
      moneda: "ARS",
      vigencia_desde: vigenciaDesde,
      activa: true,
      observaciones,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !nueva) {
    console.error("No se pudo crear la tarifa YPF:", error);
    return "sin_cambio";
  }

  await logTarifa(
    supabase,
    userId,
    nueva.id as string,
    actual ? "actualizar" : "crear",
    actual ? { valor: Number(actual.valor) } : null,
    { cliente_id: clienteId, ruta_id: rutaId, modalidad: "por_tonelada", valor: precio, vigencia_desde: vigenciaDesde },
  );
  return actual ? "actualizada" : "creada";
}

async function logTarifa(
  supabase: Admin,
  userId: string,
  tarifaId: string,
  accion: string,
  anteriores: Record<string, unknown> | null,
  nuevos: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      usuario_id: userId,
      accion,
      entidad_tipo: "tarifa",
      entidad_id: tarifaId,
      valores_anteriores: anteriores,
      valores_nuevos: { ...nuevos, origen: "siembra_dm_ypf" },
    });
  } catch (e) {
    console.error("No se pudo auditar la tarifa sembrada:", e);
  }
}

/** Persiste las tarifas parseadas del DM de YPF en la tabla `tarifas`. */
export async function seedTarifasFromYpf(
  supabase: Admin,
  userId: string,
  parsed: YpfParseResult,
): Promise<SeedTarifasResult> {
  const result: SeedTarifasResult = { creadas: 0, actualizadas: 0 };
  if (!parsed.tarifas || parsed.tarifas.length === 0) return result;

  const clienteId = await getOrCreateYpfCliente(supabase, userId);
  if (!clienteId) return result;

  const vigenciaDesde = parsed.quincenaDesde ?? new Date().toISOString().slice(0, 10);
  const periodo =
    parsed.quincenaDesde && parsed.quincenaHasta
      ? ` (${parsed.quincenaDesde} a ${parsed.quincenaHasta})`
      : "";
  const observaciones = `Sembrada del DM de YPF${periodo}`;

  // Dedup por destino normalizado dentro del propio DM (el parser ya deduplica,
  // pero por las dudas no creamos la misma ruta dos veces).
  const vistos = new Set<string>();
  for (const t of parsed.tarifas) {
    const precio = round2(Number(t.precioUnitario));
    if (!(precio > 0)) continue;
    const key = `${norm(t.origen)}→${norm(t.destino)}`;
    if (vistos.has(key)) continue;
    vistos.add(key);

    const origenId = await ensurePunto(supabase, t.origen);
    const destinoId = await ensurePunto(supabase, t.destino);
    if (!origenId || !destinoId) continue;
    const rutaId = await ensureRuta(supabase, origenId, destinoId);
    if (!rutaId) continue;

    const res = await upsertTarifa(supabase, userId, clienteId, rutaId, precio, vigenciaDesde, observaciones);
    if (res === "creada") result.creadas++;
    else if (res === "actualizada") result.actualizadas++;
  }

  return result;
}
