"use server";

import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * Importar la programación de viajes de Loma Negra.
 *
 * Nico recibe este Excel y hoy lo copia a mano en un papel: anota el número de
 * transporte y, cuando le da el viaje a alguien, lo subraya y escribe el nombre
 * del chofer. Acá los viajes entran SIN CHOFER y después él los asigna — que es
 * exactamente el paso que el archivo no trae.
 *
 * Nunca escribe nada sin mostrar antes qué va a crear: primero se pide el
 * preview, se mira, y recién entonces se confirma.
 */

const CLIENTE_LOMA = "LOMA NEGRA CIASA";

/**
 * Cómo leer la columna `Centro` (A111 / A109), que es lo único ambiguo del
 * archivo:
 *
 * - "destino": cada fila dice A DÓNDE va esa etapa, y el origen de una es el
 *   destino de la anterior. Es lo que sugiere el archivo de muestra, donde
 *   `Centro` y `Destinat.mcía.` coinciden.
 * - "origen": el Centro es la planta de DONDE SALE y el destinatario es a dónde
 *   va. Es lo que sugiere la hoja escrita a mano de Nico, donde el mismo (111)
 *   aparece con cuatro destinos distintos.
 *
 * Las dos lecturas no pueden ser ciertas a la vez y equivocarse importa: los
 * viajes entrarían dados vuelta. Así que en vez de adivinar, se elige en la
 * pantalla y el preview muestra el resultado antes de crear nada.
 */
export type LecturaCentro = "destino" | "origen";

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

/** El recorrido de cada etapa según cómo se lea el Centro. */
function resolverRecorrido(
  filas: readonly FilaProgramacion[],
  lectura: LecturaCentro,
): Map<string, { origen: string | null; destino: string | null }> {
  const out = new Map<string, { origen: string | null; destino: string | null }>();

  if (lectura === "origen") {
    // El Centro es la planta de salida; el destinatario, a dónde va.
    for (const f of filas) {
      out.set(f.nroTransporte, { origen: f.centro, destino: f.destino ?? f.poblacion });
    }
    return out;
  }

  // Cada fila es un destino: el origen de una etapa es el destino de la
  // anterior dentro del mismo circuito, y la primera queda sin origen.
  for (const c of agruparEnCircuitos(filas)) {
    c.etapas.forEach((e, i) => {
      out.set(e.nroTransporte, {
        origen: i === 0 ? null : (c.etapas[i - 1]!.destino ?? null),
        destino: e.destino,
      });
    });
  }
  return out;
}

/**
 * Qué se crearía con este archivo. No escribe nada.
 */
export async function previewProgramacionAction(
  base64: string,
  nombreArchivo: string,
  lectura: LecturaCentro = "destino",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existentes, error } = await (supabase as any)
    .from("viajes")
    .select("nro_transporte")
    .in("nro_transporte", filas.map((f) => f.nroTransporte));
  if (error) {
    console.error("[programación] no se pudo chequear los existentes:", error);
    return { error: "No se pudo verificar qué viajes ya estaban cargados." };
  }
  const yaCargados = new Set(
    ((existentes ?? []) as { nro_transporte: string | null }[])
      .map((r) => r.nro_transporte)
      .filter((v): v is string => !!v),
  );

  const recorrido = resolverRecorrido(filas, lectura);

  const viajes: ViajeAImportar[] = filas.map((f) => {
    const r = recorrido.get(f.nroTransporte) ?? { origen: null, destino: null };
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
  lectura: LecturaCentro = "destino",
): Promise<ResultadoImport | { error: string }> {
  const user = await requireSeccion("viajes_listado", "write");

  const preview = await previewProgramacionAction(base64, nombreArchivo, lectura);
  if ("error" in preview) return preview;

  const aCrear = preview.viajes.filter((v) => !v.yaExiste && !v.problema);
  if (aCrear.length === 0) {
    return { creados: 0, omitidos: preview.viajes.length, errores: [] };
  }

  const supabase = createAdminClient();

  const [{ data: cliente }, { data: tipoCarga }] = await Promise.all([
    supabase.from("clientes").select("id").eq("razon_social", CLIENTE_LOMA).maybeSingle(),
    supabase.from("tipos_carga").select("id").eq("nombre", "Carga a Granel").maybeSingle(),
  ]);
  if (!cliente?.id) {
    return { error: `No encontré el cliente "${CLIENTE_LOMA}" para asociar los viajes.` };
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
        creados,
        lectura_centro: lectura,
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
