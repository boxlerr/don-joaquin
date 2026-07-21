"use server";

// Importar circuitos desde los viajes ya cargados (pedido 21/07): cada par
// origen→destino con viajes en el sistema se sugiere como circuito, con el km
// más repetido entre esos viajes ("su km"). Flujo dry-run: primero se
// previsualiza, recién al confirmar se crean las rutas. Idempotente: los pares
// que ya existen como circuito se marcan y no se vuelven a crear.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const MAX_KM = 100_000;

export type CircuitoSugerido = {
  origenId: string;
  destinoId: string;
  origenLabel: string;
  destinoLabel: string;
  /** Cantidad de viajes cargados con este recorrido. */
  viajes: number;
  /** Km con carga más repetido entre los viajes (0 si ninguno lo trae). */
  km: number;
  /** Rango observado de km con carga (>0), para avisar cuando varía. */
  kmMin: number;
  kmMax: number;
  /** Km vacíos más repetido (tramos de vuelta en vacío traen solo esto). */
  kmVacios: number;
  /** Ya existe una ruta con este origen y destino. */
  yaExiste: boolean;
};

/** La moda de una lista de números (el valor más repetido; empate → el mayor). */
function moda(valores: number[]): number {
  const counts = new Map<number, number>();
  for (const v of valores) counts.set(v, (counts.get(v) ?? 0) + 1);
  let mejor = 0;
  let mejorCount = 0;
  for (const [v, n] of counts) {
    if (n > mejorCount || (n === mejorCount && v > mejor)) {
      mejor = v;
      mejorCount = n;
    }
  }
  return mejor;
}

export async function sugerirCircuitosDesdeViajes(): Promise<CircuitoSugerido[]> {
  await requireSeccion("tarifas", "read");
  const supabase = createAdminClient();

  // Viajes con origen y destino, paginados (PostgREST corta en 1000 filas).
  type ViajeRow = {
    origen_id: string;
    destino_id: string;
    km_con_carga: number | null;
    km_vacios: number | null;
  };
  const viajes: ViajeRow[] = [];
  const PAGE = 1000;
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await supabase
      .from("viajes")
      .select("origen_id, destino_id, km_con_carga, km_vacios")
      .not("origen_id", "is", null)
      .not("destino_id", "is", null)
      .range(desde, desde + PAGE - 1);
    if (error) {
      console.error("Error leyendo viajes para sugerir circuitos:", error);
      return [];
    }
    viajes.push(...((data ?? []) as ViajeRow[]));
    if (!data || data.length < PAGE) break;
  }

  const [{ data: puntos }, { data: rutas }] = await Promise.all([
    supabase.from("puntos_ruta").select("id, nombre, localidad"),
    supabase.from("rutas").select("origen_id, destino_id"),
  ]);
  const puntoLabel = new Map<string, string>();
  for (const p of puntos ?? []) {
    puntoLabel.set(p.id, [p.nombre, p.localidad].filter(Boolean).join(", "));
  }
  const existentes = new Set((rutas ?? []).map((r) => `${r.origen_id}|${r.destino_id}`));

  type Acc = { n: number; kms: number[]; kmsVacios: number[] };
  const pares = new Map<string, Acc>();
  for (const v of viajes) {
    if (v.origen_id === v.destino_id) continue;
    const key = `${v.origen_id}|${v.destino_id}`;
    const acc = pares.get(key) ?? { n: 0, kms: [], kmsVacios: [] };
    acc.n += 1;
    const km = Number(v.km_con_carga ?? 0);
    if (km > 0) acc.kms.push(km);
    acc.kmsVacios.push(Number(v.km_vacios ?? 0));
    pares.set(key, acc);
  }

  const sugeridos: CircuitoSugerido[] = [];
  for (const [key, acc] of pares) {
    const [origenId, destinoId] = key.split("|") as [string, string];
    sugeridos.push({
      origenId,
      destinoId,
      origenLabel: puntoLabel.get(origenId) ?? "—",
      destinoLabel: puntoLabel.get(destinoId) ?? "—",
      viajes: acc.n,
      km: acc.kms.length ? moda(acc.kms) : 0,
      kmMin: acc.kms.length ? Math.min(...acc.kms) : 0,
      kmMax: acc.kms.length ? Math.max(...acc.kms) : 0,
      kmVacios: moda(acc.kmsVacios),
      yaExiste: existentes.has(key),
    });
  }
  sugeridos.sort((a, b) => b.viajes - a.viajes);
  return sugeridos;
}

export type ImportarCircuitosResult =
  | { ok: true; creados: number; omitidos: number }
  | { error: string };

export async function importarCircuitosDesdeViajes(
  seleccion: {
    origenId: string;
    destinoId: string;
    km: number;
    kmVacios: number;
    viajes: number;
  }[],
): Promise<ImportarCircuitosResult> {
  const user = await requireSeccion("tarifas", "write");
  const supabase = createAdminClient();

  if (!seleccion.length) return { error: "No hay circuitos seleccionados." };
  if (seleccion.length > 1000) return { error: "Demasiados circuitos en una sola importación." };

  // Idempotencia: releer los pares existentes al momento de confirmar.
  const { data: rutas, error: rutasError } = await supabase
    .from("rutas")
    .select("origen_id, destino_id");
  if (rutasError) {
    console.error("Error leyendo rutas existentes:", rutasError);
    return { error: "No se pudieron verificar los circuitos existentes." };
  }
  const existentes = new Set((rutas ?? []).map((r) => `${r.origen_id}|${r.destino_id}`));

  const vistos = new Set<string>();
  const filas: {
    origen_id: string;
    destino_id: string;
    km_oficiales: number;
    km_vacios: number;
    descripcion: string;
    estado: "activa";
  }[] = [];
  let omitidos = 0;
  for (const s of seleccion) {
    const key = `${s.origenId}|${s.destinoId}`;
    if (!s.origenId || !s.destinoId || s.origenId === s.destinoId) continue;
    if (existentes.has(key) || vistos.has(key)) {
      omitidos += 1;
      continue;
    }
    const km = Math.round(Number(s.km));
    const kmVacios = Math.round(Number(s.kmVacios));
    if (!Number.isFinite(km) || km < 0 || km > MAX_KM) continue;
    if (!Number.isFinite(kmVacios) || kmVacios < 0 || kmVacios > MAX_KM) continue;
    vistos.add(key);
    filas.push({
      origen_id: s.origenId,
      destino_id: s.destinoId,
      km_oficiales: km,
      km_vacios: kmVacios,
      descripcion: `Importado de viajes (${s.viajes} viaje${s.viajes === 1 ? "" : "s"})`,
      estado: "activa",
    });
  }

  if (!filas.length) {
    return omitidos
      ? { ok: true, creados: 0, omitidos }
      : { error: "No quedó ningún circuito válido para crear." };
  }

  const { data: insertados, error: insertError } = await supabase
    .from("rutas")
    .insert(filas)
    .select("id");
  if (insertError || !insertados) {
    console.error("Error importando circuitos:", insertError);
    return { error: "No se pudieron crear los circuitos." };
  }

  await logAudit({
    client: supabase,
    accion: "importar",
    usuarioId: user.id,
    entidadTipo: "ruta",
    entidadId: null,
    valoresNuevos: {
      // Acotado: con cientos de pares alcanza el resumen de los primeros.
      circuitos: filas.slice(0, 100).map(
        (f) => `${f.origen_id} → ${f.destino_id} (${f.km_oficiales} km / ${f.km_vacios} vacíos)`,
      ),
    },
    metadata: { origen: "viajes", creados: insertados.length, omitidos },
  });

  revalidatePath("/tarifas");
  revalidatePath("/viajes");
  return { ok: true, creados: insertados.length, omitidos };
}
