"use server";

import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { traerEnLotes } from "@/lib/supabase/traer-todo";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  agruparEnCircuitos,
  detectarFormato,
  parsearFilasExcel,
  type FilaCruda,
  type FilaProgramacion,
} from "./parser";

/**
 * Importar la programación de viajes.
 *
 * Nico recibe este Excel y hoy lo copia a mano en un papel: anota el número de
 * transporte y, cuando le da el viaje a alguien, lo subraya y escribe el nombre
 * del chofer. Acá los viajes entran SIN CHOFER y después él los asigna — que es
 * exactamente el paso que el archivo no trae.
 *
 * Hoy el archivo llega de Loma Negra, pero el formato no tiene nada propio de
 * ellos y no hay forma de saber desde adentro a qué cliente facturar: el
 * "Nombre cliente" del Excel son plantas (FÁBRICA RAMALLO, LOMASER), no la
 * empresa. Así que el cliente se elige al importar, con Loma Negra propuesta por
 * defecto. Adivinarlo dejaría viajes facturados al cliente equivocado.
 *
 * Nunca escribe nada sin mostrar antes qué va a crear: primero se pide el
 * preview, se mira, y recién entonces se confirma.
 */

/** El que manda este archivo hoy: se propone, no se impone. */
const CLIENTE_SUGERIDO = "LOMA NEGRA CIASA";

export type ClienteOpcion = { id: string; label: string };

/** Clientes activos para elegir a quién van los viajes, y cuál se propone. */
export async function getClientesProgramacionAction(): Promise<{
  clientes: ClienteOpcion[];
  sugeridoId: string | null;
}> {
  await requireSeccion("viajes_listado", "write");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razon_social")
    .eq("estado", "activo")
    .order("razon_social", { ascending: true });
  if (error) {
    console.error("[programación] no se pudieron leer los clientes:", error);
    throw new Error("No se pudo cargar la lista de clientes.");
  }
  const clientes = (data ?? []).map((c) => ({ id: c.id, label: c.razon_social }));
  return {
    clientes,
    sugeridoId: clientes.find((c) => c.label === CLIENTE_SUGERIDO)?.id ?? null,
  };
}

/**
 * Origen y destino de cada etapa.
 *
 * El `Centro` (A111 / A109) entra tal cual como origen y el destinatario como
 * destino. No se interpreta: nadie de la oficina puede afirmar hoy si el Centro
 * es la planta de salida o de llegada, y adivinar significaría cargar viajes
 * dados vuelta sin que se note. Entra el código como está y quien recibe el
 * viaje lo corrige — que es el mismo criterio que el resto del sistema: lo que
 * carga una persona no lo pisa un proceso automático.
 *
 * Ojo: esto da de alta dos puntos de ruta con el código de la planta ("A111",
 * "A109") hasta que alguien los reemplace por el lugar de verdad.
 */
function recorridoDe(f: FilaProgramacion): { origen: string | null; destino: string | null } {
  return { origen: f.centro, destino: f.destino ?? f.poblacion };
}

export type ViajeAImportar = {
  nroTransporte: string;
  nroCorto: string;
  ordenFlete: string;
  etapa: number;
  fecha: string | null;
  origen: string | null;
  destino: string | null;
  material: string | null;
  toneladas: number | null;
  /** Ya existe un viaje con ese número de transporte: no se vuelve a crear. */
  yaExiste: boolean;
  /** Por qué no se puede crear (si no se puede). */
  problema: string | null;
};

export type PreviewProgramacion = {
  archivo: string;
  filasLeidas: number;
  columnasIgnoradas: string[];
  viajes: ViajeAImportar[];
  /** Los pares que Nico anota como "circuito", para mostrarlos juntos. */
  circuitos: { ordenFlete: string; nros: string[] }[];
  resumen: { aCrear: number; yaExisten: number; conProblema: number };
};

/** Filas de la primera hoja del Excel. */
async function leerExcel(bytes: Uint8Array): Promise<FilaCruda[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  // El archivo trae una sola hoja ("Data"); si algún día trae más, la primera
  // con contenido es la buena.
  const ws = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
  if (!ws) return [];
  const filas: FilaCruda[] = [];
  ws.eachRow((row) => {
    filas.push((row.values as unknown[]).slice(1) as FilaCruda);
  });
  return filas;
}

/**
 * Qué se crearía con este archivo. No escribe nada.
 */
export async function previewProgramacionAction(
  base64: string,
  nombreArchivo: string,
): Promise<PreviewProgramacion | { error: string }> {
  await requireSeccion("viajes_listado", "write");

  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  const formato = detectarFormato(bytes, nombreArchivo);
  if (formato === "pdf") {
    return {
      error:
        "Esto es un PDF. La programación de Loma llega en Excel (.xlsx) — subí ese archivo.",
    };
  }
  if (formato !== "excel") {
    return { error: "No reconozco el archivo. Tiene que ser el Excel de la programación." };
  }

  let filasCrudas: FilaCruda[];
  try {
    filasCrudas = await leerExcel(bytes);
  } catch (e) {
    console.error("[programación] no se pudo abrir el Excel:", e);
    return { error: "No se pudo abrir el Excel. ¿Está completo el archivo?" };
  }

  const { filas, columnasNoReconocidas } = parsearFilasExcel(filasCrudas);
  if (filas.length === 0) {
    return {
      error:
        "El archivo no tiene filas con número de transporte. Fijate que sea la programación de viajes y no otra planilla.",
    };
  }

  const supabase = createAdminClient();
  // Este chequeo decide qué se inserta: si devuelve de menos, los viajes que no
  // vuelven se toman por nuevos y se cargan duplicados. Por eso va en lotes y
  // paginado, no en una sola consulta que el REST corta en 1000.
  let existentes: { nro_transporte: string | null }[];
  try {
    existentes = await traerEnLotes(
      filas.map((f) => f.nroTransporte),
      (lote, from, to) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("viajes")
          .select("nro_transporte")
          .in("nro_transporte", lote)
          .order("codigo", { ascending: true })
          .range(from, to),
      { etiqueta: "viajes ya cargados" },
    );
  } catch (e) {
    console.error("[programación] no se pudo chequear los existentes:", e);
    return { error: "No se pudo verificar qué viajes ya estaban cargados." };
  }
  const yaCargados = new Set(
    ((existentes ?? []) as { nro_transporte: string | null }[])
      .map((r) => r.nro_transporte)
      .filter((v): v is string => !!v),
  );

  const viajes: ViajeAImportar[] = filas.map((f) => {
    const r = recorridoDe(f);
    const yaExiste = yaCargados.has(f.nroTransporte);
    // Sin fecha no se puede crear: fecha_viaje es obligatoria.
    const problema = !f.fecha ? "no tiene fecha de entrega" : null;
    return {
      nroTransporte: f.nroTransporte,
      nroCorto: f.nroCorto,
      ordenFlete: f.ordenFlete,
      etapa: f.etapa,
      fecha: f.fecha,
      origen: r.origen,
      destino: r.destino,
      material: f.material,
      toneladas: f.toneladas,
      yaExiste,
      problema,
    };
  });

  return {
    archivo: nombreArchivo,
    filasLeidas: filas.length,
    columnasIgnoradas: columnasNoReconocidas,
    viajes,
    circuitos: agruparEnCircuitos(filas).map((c) => ({
      ordenFlete: c.ordenFlete,
      nros: c.etapas.map((e) => e.nroCorto),
    })),
    resumen: {
      aCrear: viajes.filter((v) => !v.yaExiste && !v.problema).length,
      yaExisten: viajes.filter((v) => v.yaExiste).length,
      conProblema: viajes.filter((v) => !v.yaExiste && v.problema).length,
    },
  };
}

/**
 * `count` códigos de viaje seguidos (`V-AAAA-NNNNN`).
 *
 * La columna `codigo` es NOT NULL y la base no la genera: sin esto el importador
 * fallaba en todas las filas. Misma numeración que el alta manual, así que los
 * viajes importados quedan en la misma serie que los cargados a mano.
 */
async function generarCodigos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  count: number,
): Promise<string[]> {
  const prefijo = `V-${new Date().getFullYear()}-`;
  const { data, error } = await supabase
    .from("viajes")
    .select("codigo")
    .like("codigo", `${prefijo}%`)
    .order("codigo", { ascending: false })
    .limit(1);
  if (error) throw error;

  let proximo = 1;
  const ultimo = (data ?? [])[0]?.codigo as string | undefined;
  if (ultimo) {
    const n = parseInt(ultimo.slice(prefijo.length), 10);
    if (Number.isFinite(n)) proximo = n + 1;
  }
  return Array.from({ length: count }, (_, i) => `${prefijo}${String(proximo + i).padStart(5, "0")}`);
}

/** Punto de ruta por nombre, creándolo si no existía. */
async function getOrCreatePunto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  nombre: string | null,
): Promise<string | null> {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return null;
  const { data } = await supabase.from("puntos_ruta").select("id").ilike("nombre", limpio).limit(1);
  if (data && data.length > 0) return data[0].id as string;
  const ins = await supabase
    .from("puntos_ruta")
    .insert({ nombre: limpio, estado: "activo", es_frontera: false, es_puerto: false })
    .select("id")
    .single();
  return ins.error ? null : (ins.data.id as string);
}

export type ResultadoImport = {
  creados: number;
  omitidos: number;
  errores: string[];
};

/**
 * Crea los viajes. Entran SIN CHOFER: aparecen en el listado filtrando "le
 * falta el chofer" y en el resumen por destino como "sin asignar", que es donde
 * Nico les pone quién va.
 */
export async function importarProgramacionAction(
  base64: string,
  nombreArchivo: string,
  clienteId: string,
): Promise<ResultadoImport | { error: string }> {
  const user = await requireSeccion("viajes_listado", "write");

  const preview = await previewProgramacionAction(base64, nombreArchivo);
  if ("error" in preview) return preview;

  const aCrear = preview.viajes.filter((v) => !v.yaExiste && !v.problema);
  if (aCrear.length === 0) {
    return { creados: 0, omitidos: preview.viajes.length, errores: [] };
  }

  const supabase = createAdminClient();

  const [{ data: cliente }, { data: tipoCarga }] = await Promise.all([
    supabase.from("clientes").select("id, razon_social").eq("id", clienteId).maybeSingle(),
    supabase.from("tipos_carga").select("id").eq("nombre", "Carga a Granel").maybeSingle(),
  ]);
  if (!cliente?.id) {
    return { error: "Elegí a qué cliente van estos viajes antes de crearlos." };
  }
  if (!tipoCarga?.id) {
    return { error: 'No encontré el tipo de carga "Carga a Granel".' };
  }

  // Los puntos se resuelven una vez por nombre: el archivo repite los mismos.
  const nombres = new Set<string>();
  for (const v of aCrear) {
    if (v.origen) nombres.add(v.origen);
    if (v.destino) nombres.add(v.destino);
  }
  const puntoPorNombre = new Map<string, string | null>();
  for (const n of nombres) puntoPorNombre.set(n, await getOrCreatePunto(supabase, n));

  const codigos = await generarCodigos(supabase, aCrear.length);

  const errores: string[] = [];
  let creados = 0;

  for (const [i, v] of aCrear.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("viajes").insert({
      codigo: codigos[i],
      fecha_viaje: v.fecha,
      cliente_id: cliente.id,
      tipo_carga_id: tipoCarga.id,
      chofer_id: null, // lo asigna Nico después: es el paso que el archivo no trae
      camion_id: null,
      origen_id: v.origen ? puntoPorNombre.get(v.origen) : null,
      destino_id: v.destino ? puntoPorNombre.get(v.destino) : null,
      material: v.material,
      tonelaje_real: v.toneladas,
      km_con_carga: 0,
      km_vacios: 0,
      nro_transporte: v.nroTransporte,
      estado: "pendiente",
      observaciones: `Programación Loma · transporte ${v.nroCorto}${v.ordenFlete ? ` · orden ${v.ordenFlete}` : ""} · etapa ${v.etapa}`,
      created_by: user.id,
    });
    if (error) {
      errores.push(`${v.nroCorto}: ${error.message}`);
      continue;
    }
    creados++;
  }

  if (creados > 0) {
    await logAudit({
      client: supabase,
      usuarioId: user.id,
      accion: "crear",
      entidadTipo: "viaje",
      entidadId: null,
      valoresNuevos: {
        archivo: nombreArchivo,
        cliente: cliente.razon_social,
        creados,
        transportes: aCrear.slice(0, 50).map((v) => v.nroCorto),
      },
      metadata: { origen: "import_programacion" },
    });
  }

  revalidatePath("/viajes");
  revalidatePath("/viajes/resumen");
  return {
    creados,
    omitidos: preview.viajes.length - creados,
    errores,
  };
}
