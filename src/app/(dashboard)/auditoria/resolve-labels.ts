import { createAdminClient } from "@/lib/supabase/admin";
import { formatFecha } from "@/lib/utils";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type ResolvedLabel = { label: string | null; detalle: string | null };
type Labels = Record<string, ResolvedLabel>;
type Ids = Set<string> | undefined;

// Nombres legibles del enum legacy `mantenimiento_tipo` (registros viejos sin
// tipo_servicio_id del catálogo nuevo).
const MANTENIMIENTO_TIPO_LEGACY: Record<string, string> = {
  service_preventivo: "Service preventivo",
  reparacion: "Reparación",
  cambio_aceite: "Cambio de aceite",
  cubiertas: "Cubiertas",
  otro: "Otro",
};

/** Devuelve el primer elemento si es un embed array de Supabase, o el objeto. */
function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function fmtMonto(monto: number | null | undefined, moneda?: string | null): string | null {
  if (monto == null) return null;
  const n = Number(monto);
  if (!Number.isFinite(n)) return null;
  const prefijo = moneda && moneda !== "ARS" ? `${moneda} ` : "$";
  return `${prefijo}${n.toLocaleString("es-AR")}`;
}

/**
 * Resuelve el nombre legible (label) y un detalle de cada recurso afectado,
 * a partir de los IDs agrupados por entidad_tipo. Una query por entidad.
 */
export async function resolverEntidadLabels(
  supabase: SupabaseAdmin,
  idsPorTipo: Record<string, Set<string>>,
): Promise<Labels> {
  const labels: Labels = {};
  await Promise.all([
    resolverChoferes(supabase, idsPorTipo.chofer, labels),
    resolverCamiones(supabase, idsPorTipo.camion, labels),
    resolverClientes(supabase, idsPorTipo.cliente, labels),
    resolverViajes(supabase, idsPorTipo.viaje, labels),
    resolverMantenimientos(supabase, idsPorTipo.mantenimiento, labels),
    resolverRoturas(supabase, idsPorTipo.rotura_goma, labels),
    resolverCheques(supabase, idsPorTipo.cheque, labels),
    resolverCaja(supabase, idsPorTipo.caja, labels),
    resolverTarifas(supabase, idsPorTipo.tarifa, labels),
    resolverRutas(supabase, idsPorTipo.ruta, labels),
    resolverEntrevistas(supabase, idsPorTipo.entrevista, labels),
    resolverUsuarios(supabase, idsPorTipo.usuarios, labels, "usuarios"),
    resolverUsuarios(supabase, idsPorTipo.usuario_areas, labels, "usuario_areas"),
    resolverUsuarios(supabase, idsPorTipo.usuario_secciones, labels, "usuario_secciones"),
    resolverParametros(supabase, idsPorTipo.parametro_sistema, labels),
    resolverImpuestos(supabase, idsPorTipo.impuesto, labels),
    resolverInsumos(supabase, idsPorTipo.insumo_catalogo, labels),
    resolverPrestamos(supabase, idsPorTipo.prestamo, labels),
    resolverPrestamoCuotas(supabase, idsPorTipo.prestamo_cuota, labels),
    resolverConfigNotif(supabase, idsPorTipo.configuracion_notificaciones, labels),
    resolverSiniestros(supabase, idsPorTipo.siniestro, labels),
    resolverGastos(supabase, idsPorTipo.gasto, labels),
    resolverRotacionBajas(supabase, idsPorTipo.rotacion_baja, labels),
    resolverVacacionesAnio(supabase, idsPorTipo.chofer_vacaciones_anio, labels),
    resolverAusencias(supabase, idsPorTipo.chofer_ausencia, labels),
  ]);
  return labels;
}

/**
 * Saldo de vacaciones de un año. El `entidad_id` tiene la forma
 * `${chofer_id}:${anio}`, así que hay que partirlo para poder resolver la
 * persona. Sin esto todo el rastro de vacaciones —el que deja el trigger nuevo y
 * el de las server actions— sale en pantalla con el "recurso afectado" vacío, y
 * una trazabilidad ilegible es lo mismo que no tenerla.
 */
async function resolverVacacionesAnio(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const partes = Array.from(ids).map((id) => {
    const [choferId, anio] = id.split(":");
    return { id, choferId: choferId ?? "", anio: anio ?? "" };
  });
  const choferIds = [...new Set(partes.map((p) => p.choferId).filter(Boolean))];
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido")
    .in("id", choferIds);
  const porId = new Map((data ?? []).map((c) => [c.id, `${c.apellido}, ${c.nombre}`]));
  for (const p of partes) {
    labels[`chofer_vacaciones_anio:${p.id}`] = {
      label: porId.get(p.choferId) ?? null,
      detalle: p.anio ? `Vacaciones ${p.anio}` : null,
    };
  }
}

/** Período de ausencia / vacaciones: quién y de cuándo a cuándo. */
async function resolverAusencias(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("chofer_ausencias")
    .select("id, fecha_inicio, fecha_fin, chofer:choferes(nombre, apellido)")
    .in("id", Array.from(ids));
  type ChoferRef = { nombre: string; apellido: string };
  for (const r of (data ?? []) as {
    id: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    chofer: ChoferRef | ChoferRef[] | null;
  }[]) {
    const c = uno(r.chofer);
    labels[`chofer_ausencia:${r.id}`] = {
      label: c ? `${c.apellido}, ${c.nombre}` : null,
      detalle:
        r.fecha_inicio && r.fecha_fin
          ? `${formatFecha(r.fecha_inicio)} → ${formatFecha(r.fecha_fin)}`
          : null,
    };
  }
}

async function resolverSiniestros(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("siniestros")
    .select("id, tipo_siniestro, compania_seguro, numero_siniestro_seguro, camion:camiones(patente)")
    .in("id", Array.from(ids));
  for (const r of (data ?? []) as {
    id: string; tipo_siniestro: string | null; compania_seguro: string | null; numero_siniestro_seguro: string | null;
    camion: { patente: string } | { patente: string }[] | null;
  }[]) {
    const patente = uno(r.camion)?.patente ?? null;
    labels[`siniestro:${r.id}`] = {
      label: r.compania_seguro || r.tipo_siniestro || "Siniestro",
      detalle: [patente, r.numero_siniestro_seguro].filter(Boolean).join(" · ") || null,
    };
  }
}

async function resolverGastos(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("gastos")
    .select("id, proveedor, descripcion, monto, moneda")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`gasto:${r.id}`] = {
      label: r.proveedor || r.descripcion || "Gasto",
      detalle: fmtMonto(r.monto, r.moneda),
    };
  }
}

async function resolverRotacionBajas(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("rotacion_bajas")
    .select("id, nombre, tipo_baja, anio")
    .in("id", Array.from(ids));
  for (const r of (data ?? []) as { id: string; nombre: string; tipo_baja: string | null; anio: number | null }[]) {
    labels[`rotacion_baja:${r.id}`] = {
      label: r.nombre ?? "Baja",
      detalle: [r.tipo_baja, r.anio].filter(Boolean).join(" · ") || null,
    };
  }
}

async function resolverChoferes(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, dni")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`chofer:${r.id}`] = {
      label: `${r.apellido}, ${r.nombre}`,
      detalle: r.dni ? `DNI ${r.dni}` : null,
    };
  }
}

async function resolverCamiones(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("camiones")
    .select("id, patente, marca, modelo")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    const detalle = [r.marca, r.modelo].filter(Boolean).join(" ").trim();
    labels[`camion:${r.id}`] = { label: r.patente ?? "Camión", detalle: detalle || null };
  }
}

async function resolverClientes(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("clientes")
    .select("id, razon_social, cuit")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`cliente:${r.id}`] = {
      label: r.razon_social ?? "Cliente",
      detalle: r.cuit ? `CUIT ${r.cuit}` : null,
    };
  }
}

async function resolverViajes(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("viajes")
    .select("id, codigo, fecha_viaje")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`viaje:${r.id}`] = {
      label: r.codigo ?? "Viaje",
      detalle: r.fecha_viaje ? formatFecha(r.fecha_viaje) : null,
    };
  }
}

async function resolverMantenimientos(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("mantenimientos")
    .select(
      "id, tipo, camion:camiones(patente, marca, modelo), acoplado:acoplados(patente, marca, modelo), tipo_servicio:tipos_servicio(nombre)",
    )
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    const ts = uno(r.tipo_servicio);
    const unidad = uno(r.camion) ?? uno(r.acoplado);
    const tipoNombre = ts?.nombre ?? MANTENIMIENTO_TIPO_LEGACY[r.tipo] ?? "Mantenimiento";
    const marcaModelo = unidad ? [unidad.marca, unidad.modelo].filter(Boolean).join(" ").trim() : "";
    const detalle = [unidad?.patente, marcaModelo].filter(Boolean).join(" · ");
    labels[`mantenimiento:${r.id}`] = { label: tipoNombre, detalle: detalle || null };
  }
}

async function resolverRoturas(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("roturas_gomas")
    .select("id, tipo, camion:camiones(patente), acoplado:acoplados(patente), chofer:choferes(nombre, apellido)")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    const patente = uno(r.camion)?.patente ?? uno(r.acoplado)?.patente ?? null;
    const chofer = uno(r.chofer);
    const tipo = r.tipo || "Rotura";
    labels[`rotura_goma:${r.id}`] = {
      label: patente ? `${tipo} · ${patente}` : tipo,
      detalle: chofer ? `${chofer.apellido}, ${chofer.nombre}` : null,
    };
  }
}

async function resolverCheques(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("cheques")
    .select("id, numero, importe, librador_nombre")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`cheque:${r.id}`] = {
      label: r.numero ? `N° ${r.numero}` : "Cheque",
      detalle: [r.librador_nombre, fmtMonto(r.importe)].filter(Boolean).join(" · ") || null,
    };
  }
}

async function resolverCaja(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("caja_movimientos")
    .select("id, concepto, monto, tipo, moneda")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`caja:${r.id}`] = {
      label: r.concepto || (r.tipo === "ingreso" ? "Ingreso" : "Egreso"),
      detalle: fmtMonto(r.monto, r.moneda),
    };
  }
}

async function resolverTarifas(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("tarifas")
    .select("id, modalidad, valor, moneda, cliente:clientes(razon_social)")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    const cliente = uno(r.cliente);
    labels[`tarifa:${r.id}`] = {
      label: cliente?.razon_social ?? "Tarifa",
      detalle: [r.modalidad, fmtMonto(r.valor, r.moneda)].filter(Boolean).join(" · ") || null,
    };
  }
}

async function resolverRutas(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("rutas")
    .select("id, codigo_interno, descripcion")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`ruta:${r.id}`] = {
      label: r.codigo_interno || r.descripcion || "Ruta",
      detalle: r.codigo_interno && r.descripcion ? r.descripcion : null,
    };
  }
}

async function resolverEntrevistas(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("entrevistas")
    .select("id, nombre, localidad")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`entrevista:${r.id}`] = { label: r.nombre || "Entrevista", detalle: r.localidad ?? null };
  }
}

async function resolverUsuarios(
  supabase: SupabaseAdmin,
  ids: Ids,
  labels: Labels,
  tipoKey: "usuarios" | "usuario_areas" | "usuario_secciones",
) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, apellido, email")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`${tipoKey}:${r.id}`] = {
      label: r.apellido ? `${r.apellido}, ${r.nombre}` : r.nombre,
      detalle: r.email ?? null,
    };
  }
}

async function resolverImpuestos(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("id, nombre, organismo, periodo")
    .in("id", Array.from(ids));
  for (const r of (data ?? []) as { id: string; nombre: string; organismo: string | null; periodo: string | null }[]) {
    labels[`impuesto:${r.id}`] = {
      label: r.nombre ?? "Impuesto",
      detalle: [r.organismo, r.periodo].filter(Boolean).join(" · ") || null,
    };
  }
}

async function resolverInsumos(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("insumos_catalogo")
    .select("id, nombre, tipo, marca")
    .in("id", Array.from(ids));
  for (const r of (data ?? []) as { id: string; nombre: string; tipo: string | null; marca: string | null }[]) {
    labels[`insumo_catalogo:${r.id}`] = {
      label: r.nombre ?? "Insumo",
      detalle: [r.tipo, r.marca].filter(Boolean).join(" · ") || null,
    };
  }
}

async function resolverPrestamos(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("prestamos")
    .select("id, banco, detalle, referencia")
    .in("id", Array.from(ids));
  for (const r of (data ?? []) as {
    id: string;
    banco: string;
    detalle: string | null;
    referencia: string | null;
  }[]) {
    labels[`prestamo:${r.id}`] = {
      label: r.banco ?? "Préstamo",
      // El monto es lo que mejor distingue dos préstamos del mismo banco; los
      // que no lo tienen cargado se distinguen por la referencia (ej. SUECA).
      detalle: r.detalle ?? r.referencia ?? null,
    };
  }
}

async function resolverPrestamoCuotas(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("prestamo_cuotas")
    .select("id, nro, prestamo:prestamos(banco, detalle, referencia)")
    .in("id", Array.from(ids));
  type PrestamoRef = { banco: string; detalle: string | null; referencia: string | null };
  for (const r of (data ?? []) as {
    id: string;
    nro: number;
    prestamo: PrestamoRef | PrestamoRef[] | null;
  }[]) {
    const p = uno(r.prestamo);
    labels[`prestamo_cuota:${r.id}`] = {
      label: `Cuota ${r.nro}`,
      detalle: p ? [p.banco, p.detalle ?? p.referencia].filter(Boolean).join(" · ") || null : null,
    };
  }
}

async function resolverConfigNotif(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("configuracion_notificaciones")
    .select("id, usuario:usuarios(nombre, apellido)")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    const u = uno(r.usuario);
    labels[`configuracion_notificaciones:${r.id}`] = {
      label: u ? (u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre) : "Notificaciones",
      detalle: null,
    };
  }
}

async function resolverParametros(supabase: SupabaseAdmin, ids: Ids, labels: Labels) {
  if (!ids?.size) return;
  const { data } = await supabase
    .from("parametros_sistema")
    .select("id, clave, categoria")
    .in("id", Array.from(ids));
  for (const r of data ?? []) {
    labels[`parametro_sistema:${r.id}`] = { label: r.clave ?? "Parámetro", detalle: r.categoria ?? null };
  }
}
