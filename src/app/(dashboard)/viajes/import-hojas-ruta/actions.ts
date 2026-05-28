"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  parseHojaRutaWorkbook,
  type ParsedItem,
  type ParsedSheet,
} from "./parser";

// ============================================================================
// Tipos del preview (los consume la UI; el confirm action los recibe de vuelta)
// ============================================================================

export type ChoferCandidato = {
  id: string;
  nombre: string;
  apellido: string;
  camion: { id: string; patente: string } | null;
};

export type ChoferResolucion =
  | { status: "ok"; chofer_id: string; nombre: string; apellido: string; candidatos: [] }
  | { status: "ambiguous"; candidatos: ChoferCandidato[] }
  | { status: "not_found"; candidatos: [] };

export type CamionResolucion =
  | { status: "ok"; camion_id: string; patente_sistema: string }
  | { status: "missing" }
  | { status: "patente_no_match"; camion_id: string; patente_sistema: string; patente_excel: string };

export type SheetPreview = {
  parsed: ParsedSheet;
  resolucion: {
    chofer: ChoferResolucion;
    camion: CamionResolucion | null; // null si no se pudo resolver chofer
  };
  warnings: string[];
  errors: string[];
};

export type ChoferOption = {
  id: string;
  nombre: string;
  apellido: string;
  camion: { id: string; patente: string } | null;
};

export type CamionOption = { id: string; patente: string; chofer_actual_id: string | null };

export type HojaRutaPreviewState = {
  ok?: boolean;
  archivo?: string;
  sheets?: SheetPreview[];
  skippedSheets?: string[];
  puntosNuevos?: string[];
  patentesPlantilla?: string[]; // patentes que aparecen en >=5 sheets (probable copy-paste)
  choferes?: ChoferOption[]; // para los dropdowns del modal
  camiones?: CamionOption[]; // idem
  summary?: {
    totalSheets: number;
    totalItems: number;
    sheetsOk: number;
    sheetsConWarning: number;
    sheetsConError: number;
  };
  error?: string;
} | null;

// ============================================================================
// Action
// ============================================================================

const PATENTE_PLANTILLA_THRESHOLD = 5; // si aparece en ≥5 sheets, probable plantilla

export async function previewHojaRutaImportAction(
  formData: FormData,
): Promise<HojaRutaPreviewState> {
  await requireArea("logistica", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx." };
  }

  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = parseHojaRutaWorkbook(buf);
  } catch (e) {
    console.error("Error parseando Excel de hojas de ruta:", e);
    return { error: "No se pudo leer el archivo." };
  }

  const supabase = createAdminClient();

  const [{ data: choferesRaw }, { data: camionesRaw }, { data: puntosRaw }] =
    await Promise.all([
      supabase
        .from("choferes")
        .select("id, nombre, apellido, estado")
        .eq("estado", "activo"),
      supabase.from("camiones").select("id, patente, chofer_actual_id"),
      supabase.from("puntos_ruta").select("nombre"),
    ]);

  const choferes = (choferesRaw ?? []) as ChoferRow[];
  const camiones = (camionesRaw ?? []) as CamionRow[];
  const puntos = (puntosRaw ?? []) as { nombre: string }[];

  // Index: chofer_id → camion asignado (puede ser null)
  const camionPorChofer = new Map<string, { id: string; patente: string }>();
  for (const c of camiones) {
    if (c.chofer_actual_id) {
      camionPorChofer.set(c.chofer_actual_id, { id: c.id, patente: c.patente });
    }
  }

  // Conteo de patentes Excel para detectar las copiadas-pegadas como plantilla.
  const patenteCount = new Map<string, number>();
  for (const sheet of parsed.sheets) {
    for (const p of sheet.patentesExcel) {
      patenteCount.set(p, (patenteCount.get(p) ?? 0) + 1);
    }
  }
  const patentesPlantilla = [...patenteCount.entries()]
    .filter(([, n]) => n >= PATENTE_PLANTILLA_THRESHOLD)
    .map(([p]) => p);

  // Conjunto de puntos_ruta existentes (case-insensitive) para detectar nuevos.
  const puntosExistentes = new Set(
    puntos.map((p) => normName(p.nombre)),
  );
  const puntosNuevosSet = new Set<string>();

  const sheetPreviews: SheetPreview[] = parsed.sheets.map((sheet) => {
    const warnings: string[] = [...sheet.warnings];
    const errors: string[] = [...sheet.errors];

    // Items → puntos potencialmente nuevos
    for (const item of sheet.items) {
      if (!puntosExistentes.has(normName(item.sale_de))) puntosNuevosSet.add(item.sale_de);
      if (!puntosExistentes.has(normName(item.llega_a))) puntosNuevosSet.add(item.llega_a);
    }

    // Resolver chofer
    const choferRes = resolveChofer(sheet.apellido, choferes, camionPorChofer);
    if (choferRes.status === "not_found") {
      errors.push(`No se encontró un chofer con apellido "${sheet.apellido}".`);
    } else if (choferRes.status === "ambiguous") {
      warnings.push(
        `Hay ${choferRes.candidatos.length} choferes que coinciden con "${sheet.apellido}". Elegí cuál en el preview.`,
      );
    }

    // Resolver camión solo si el chofer está resuelto
    let camionRes: CamionResolucion | null = null;
    if (choferRes.status === "ok") {
      const camion = camionPorChofer.get(choferRes.chofer_id);
      if (!camion) {
        camionRes = { status: "missing" };
        warnings.push(
          `El chofer ${choferRes.nombre} ${choferRes.apellido} no tiene camión asignado. Asignalo en /choferes o en el preview.`,
        );
      } else {
        // Comparar contra patentes detectadas en el Excel (informativo)
        const patentesReales = sheet.patentesExcel.filter(
          (p) => !patentesPlantilla.includes(p),
        );
        const match = patentesReales.length === 0 ||
          patentesReales.some((p) => p === camion.patente);
        if (match) {
          camionRes = { status: "ok", camion_id: camion.id, patente_sistema: camion.patente };
        } else {
          camionRes = {
            status: "patente_no_match",
            camion_id: camion.id,
            patente_sistema: camion.patente,
            patente_excel: patentesReales[0],
          };
          warnings.push(
            `Excel dice "${patentesReales[0]}" pero el sistema dice "${camion.patente}". Confirmá si cambió de camión.`,
          );
        }
      }
    }

    // Period check: si el período va más allá de 60 días, warning
    if (sheet.periodoDesde && sheet.periodoHasta) {
      const ds = new Date(sheet.periodoDesde);
      const dh = new Date(sheet.periodoHasta);
      const days = Math.round((dh.getTime() - ds.getTime()) / 86_400_000);
      if (days > 60) {
        warnings.push(
          `Período inusualmente largo: ${days} días (${sheet.periodoDesde} → ${sheet.periodoHasta}). Revisá si hay una fecha mal cargada.`,
        );
      }
    }

    return { parsed: sheet, resolucion: { chofer: choferRes, camion: camionRes }, warnings, errors };
  });

  const sheetsConError = sheetPreviews.filter((s) => s.errors.length > 0).length;
  const sheetsConWarning = sheetPreviews.filter(
    (s) => s.warnings.length > 0 && s.errors.length === 0,
  ).length;
  const sheetsOk = sheetPreviews.length - sheetsConError - sheetsConWarning;
  const totalItems = sheetPreviews.reduce((acc, s) => acc + s.parsed.items.length, 0);

  // Listados completos para los dropdowns del modal (resolver ambiguous/missing)
  const choferesOpts: ChoferOption[] = choferes
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      camion: camionPorChofer.get(c.id) ?? null,
    }))
    .sort((a, b) => a.apellido.localeCompare(b.apellido));
  const camionesOpts: CamionOption[] = camiones
    .map((c) => ({ id: c.id, patente: c.patente, chofer_actual_id: c.chofer_actual_id }))
    .sort((a, b) => a.patente.localeCompare(b.patente));

  return {
    ok: true,
    archivo: file.name,
    sheets: sheetPreviews,
    skippedSheets: parsed.skippedSheets,
    puntosNuevos: [...puntosNuevosSet].sort(),
    patentesPlantilla,
    choferes: choferesOpts,
    camiones: camionesOpts,
    summary: {
      totalSheets: sheetPreviews.length,
      totalItems,
      sheetsOk,
      sheetsConWarning,
      sheetsConError,
    },
  };
}

// ============================================================================
// Helpers internos
// ============================================================================

type ChoferRow = { id: string; nombre: string; apellido: string; estado: string };
type CamionRow = { id: string; patente: string; chofer_actual_id: string | null };

function normName(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Estrategia de match en cascada:
//  1. Apellido del sheet == apellido del chofer (exact).
//  2. Tokenizar "APELLIDO NOMBRE" o "NOMBRE APELLIDO" y matchear ambas formas.
//  3. Prefix-match laxo: alguno de los tokens es prefijo del apellido/nombre.
// En cada nivel si hay 1 → ok. Si hay >1 → ambiguous. Si hay 0 → bajar de nivel.
function resolveChofer(
  sheetApellido: string,
  choferes: ChoferRow[],
  camionPorChofer: Map<string, { id: string; patente: string }>,
): ChoferResolucion {
  const sheetNorm = normName(sheetApellido);
  const tokens = sheetNorm.split(/\s+/).filter(Boolean);

  // Nivel 1: apellido exacto.
  const nivel1 = choferes.filter((c) => normName(c.apellido) === sheetNorm);
  if (nivel1.length === 1) return choferOk(nivel1[0]);
  if (nivel1.length > 1) return choferAmbiguous(nivel1, camionPorChofer);

  // Nivel 2a: APELLIDO + (uno o más tokens) == apellido + nombre del chofer.
  if (tokens.length >= 2) {
    const apellido = tokens[0];
    const restoNombre = tokens.slice(1).join(" ");
    const nivel2a = choferes.filter(
      (c) =>
        normName(c.apellido) === apellido &&
        normName(c.nombre).startsWith(restoNombre.split(" ")[0]),
    );
    if (nivel2a.length === 1) return choferOk(nivel2a[0]);
    if (nivel2a.length > 1) return choferAmbiguous(nivel2a, camionPorChofer);

    // Nivel 2b: NOMBRE + APELLIDO invertido.
    const ultimo = tokens[tokens.length - 1];
    const primer = tokens[0];
    const nivel2b = choferes.filter(
      (c) =>
        normName(c.apellido) === ultimo &&
        normName(c.nombre).startsWith(primer),
    );
    if (nivel2b.length === 1) return choferOk(nivel2b[0]);
    if (nivel2b.length > 1) return choferAmbiguous(nivel2b, camionPorChofer);
  }

  // Nivel 3: apellido es prefijo de algún token del chofer, o viceversa.
  const nivel3 = choferes.filter((c) => {
    const apN = normName(c.apellido);
    const noN = normName(c.nombre);
    return (
      apN.startsWith(tokens[0]) ||
      tokens[0].startsWith(apN) ||
      noN.startsWith(tokens[0])
    );
  });
  if (nivel3.length === 1) return choferOk(nivel3[0]);
  if (nivel3.length > 1) return choferAmbiguous(nivel3, camionPorChofer);

  return { status: "not_found", candidatos: [] };
}

function choferOk(c: ChoferRow): ChoferResolucion {
  return { status: "ok", chofer_id: c.id, nombre: c.nombre, apellido: c.apellido, candidatos: [] };
}

function choferAmbiguous(
  rows: ChoferRow[],
  camionPorChofer: Map<string, { id: string; patente: string }>,
): ChoferResolucion {
  const candidatos: ChoferCandidato[] = rows.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    camion: camionPorChofer.get(c.id) ?? null,
  }));
  return { status: "ambiguous", candidatos };
}

// ============================================================================
// CONFIRM — escribe a BDD
// ============================================================================

// Una asignación por sheet. La UI manda esto al confirm action junto con el .xlsx.
//   - chofer_id null: la UI no resolvió → el sheet se saltea.
//   - camion_id null: el chofer no tiene camión asignado → el sheet se saltea.
export type ImportAsignacion = {
  sheetName: string;
  chofer_id: string | null;
  camion_id: string | null;
};

export type ConfirmImportState = {
  ok?: boolean;
  imported?: {
    hojasRuta: number;
    viajes: number;
    puntosCreados: number;
    sheetsOmitidos: number;
  };
  errores?: { sheet: string; message: string }[];
  error?: string;
} | null;

const CLIENTE_SIN_ASIGNAR = "Sin asignar (import)";

export async function confirmHojaRutaImportAction(
  formData: FormData,
): Promise<ConfirmImportState> {
  const user = await requireArea("logistica", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá el archivo .xlsx para confirmar." };
  }

  const asignacionesRaw = formData.get("asignaciones");
  if (typeof asignacionesRaw !== "string") {
    return { error: "Faltan las asignaciones de choferes/camiones." };
  }

  let asignaciones: ImportAsignacion[];
  try {
    asignaciones = JSON.parse(asignacionesRaw);
    if (!Array.isArray(asignaciones)) throw new Error("formato inválido");
  } catch {
    return { error: "Asignaciones con formato inválido." };
  }
  const porSheet = new Map(asignaciones.map((a) => [a.sheetName, a]));

  // Re-parsear el Excel (más simple que serializar todo el ParseResult al cliente).
  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = parseHojaRutaWorkbook(buf);
  } catch (e) {
    console.error("Error parseando Excel al confirmar:", e);
    return { error: "No se pudo leer el archivo." };
  }

  const supabase = createAdminClient();

  // Pre-cargas comunes a todo el batch ------------------------------------
  const [clienteSinAsignarId, tipoCargaOtrosId, tonelajeCatMap, puntosMap, ultimoCodigoViaje, ultimoCodigoHR] =
    await Promise.all([
      getOrCreateClienteSinAsignar(supabase, user.id),
      getOrCreateTipoCargaOtros(supabase),
      getTonelajeCategoriaMap(supabase),
      preloadPuntosRuta(supabase),
      getLastCodigo(supabase, "viajes", `V-${new Date().getFullYear()}-`),
      getLastCodigo(supabase, "hojas_ruta", `HR-${new Date().getFullYear()}-`),
    ]);

  let codigoViajeSeq = ultimoCodigoViaje;
  let codigoHRSeq = ultimoCodigoHR;
  const errores: { sheet: string; message: string }[] = [];
  let totalHojasRuta = 0;
  let totalViajes = 0;
  let totalPuntosNuevos = 0;
  let sheetsOmitidos = 0;

  for (const sheet of parsed.sheets) {
    const asign = porSheet.get(sheet.sheetName);
    if (!asign || !asign.chofer_id || !asign.camion_id || sheet.items.length === 0) {
      sheetsOmitidos++;
      continue;
    }
    if (!sheet.periodoDesde || !sheet.periodoHasta) {
      sheetsOmitidos++;
      errores.push({ sheet: sheet.sheetName, message: "Sin período válido." });
      continue;
    }

    try {
      // 1) Crear/asegurar puntos_ruta del sheet -----------------------------
      const nombresPuntos = new Set<string>();
      for (const item of sheet.items) {
        nombresPuntos.add(item.sale_de);
        nombresPuntos.add(item.llega_a);
      }
      const nuevosPuntos: { nombre: string }[] = [];
      for (const n of nombresPuntos) {
        if (!puntosMap.has(normName(n))) {
          nuevosPuntos.push({
            nombre: n,
            estado: "activo",
            es_frontera: false,
            es_puerto: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }
      }
      if (nuevosPuntos.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error } = await (supabase as any)
          .from("puntos_ruta")
          .insert(nuevosPuntos)
          .select("id, nombre");
        if (error) throw new Error(`Error creando puntos_ruta: ${error.message}`);
        for (const p of inserted ?? []) {
          puntosMap.set(normName(p.nombre), p.id);
        }
        totalPuntosNuevos += inserted?.length ?? 0;
      }

      // 2) Calcular agregados del sheet -------------------------------------
      const kmConCarga = sheet.items.reduce((s, i) => s + (i.viaje_vacio ? 0 : i.km_recorridos), 0);
      const kmVacios = sheet.items.reduce((s, i) => s + (i.viaje_vacio ? i.km_recorridos : 0) + (i.km_vacios ?? 0), 0);
      const tonelajeTotal = sheet.items.reduce(
        (s, i) => s + (i.tn_com_29 ?? 0) + (i.tn_esc_35 ?? 0) + (i.tn_esc_37_5 ?? 0),
        0,
      );
      const montoTotalChofer = sheet.items.reduce((s, i) => s + (i.monto_chofer ?? 0), 0);

      // 3) Insertar hoja_ruta. Si existe (upsert por chofer+período), update. ---
      codigoHRSeq++;
      const codigoHR = `HR-${new Date().getFullYear()}-${String(codigoHRSeq).padStart(5, "0")}`;
      const hojaRutaPayload = {
        codigo: codigoHR,
        chofer_id: asign.chofer_id,
        camion_id: asign.camion_id,
        periodo_tipo: "personalizado" as const,
        periodo_desde: sheet.periodoDesde,
        periodo_hasta: sheet.periodoHasta,
        km_total: kmConCarga + kmVacios,
        km_con_carga: kmConCarga,
        km_vacios: kmVacios,
        km_computables: kmConCarga,
        km_no_computables: kmVacios,
        tonelaje_total: tonelajeTotal,
        cantidad_viajes: sheet.items.length,
        monto_total_liquidacion: montoTotalChofer,
        archivo_origen: file.name,
        sheet_origen: sheet.sheetName,
        observaciones: sheet.patentesExcel.length
          ? `[IMPORT] Patentes Excel: ${sheet.patentesExcel.join(", ")}`
          : null,
        estado: "borrador" as const,
        created_by: user.id,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: hojaRutaInserted, error: hrErr } = await (supabase as any)
        .from("hojas_ruta")
        .upsert(hojaRutaPayload, { onConflict: "chofer_id,periodo_desde,periodo_hasta" })
        .select("id")
        .single();
      if (hrErr) throw new Error(`Error en hojas_ruta: ${hrErr.message}`);
      const hojaRutaId = hojaRutaInserted.id;
      totalHojasRuta++;

      // 4) Generar viajes en batch (UUIDs pre-generados → reusados en items) -
      const viajesPayload = sheet.items.map((item) => {
        codigoViajeSeq++;
        const codigo = `V-${new Date().getFullYear()}-${String(codigoViajeSeq).padStart(5, "0")}`;
        const origenId = puntosMap.get(normName(item.sale_de))!;
        const destinoId = puntosMap.get(normName(item.llega_a))!;
        const obsExtras: string[] = ["[IMPORT HR]"];
        if (item.material) obsExtras.push(`Material: ${item.material}`);
        if (item.remito_numero) obsExtras.push(`Remito: ${item.remito_numero}`);
        if (item.viaje_vacio) obsExtras.push("Viaje vacío");
        return {
          id: randomUUID(),
          codigo,
          fecha_viaje: item.dia,
          cliente_id: clienteSinAsignarId,
          chofer_id: asign.chofer_id!,
          camion_id: asign.camion_id!,
          tipo_carga_id: tipoCargaOtrosId,
          origen_id: origenId,
          destino_id: destinoId,
          km_con_carga: item.viaje_vacio ? 0 : item.km_recorridos,
          km_vacios: (item.viaje_vacio ? item.km_recorridos : 0) + (item.km_vacios ?? 0),
          tonelaje_real: 0, // el trigger lo sobrescribe con la suma del detalle
          monto_flete: 0,
          moneda: "ARS",
          estado: "cerrado" as const,
          facturado: false,
          observaciones: obsExtras.join(" | "),
          created_by: user.id,
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: viajesInserted, error: viErr } = await (supabase as any)
        .from("viajes")
        .insert(viajesPayload)
        .select("id, codigo");
      if (viErr) throw new Error(`Error en viajes: ${viErr.message}`);
      totalViajes += viajesInserted?.length ?? 0;

      // 5) hoja_ruta_items (con viaje_id) y viaje_tonelaje_detalle ----------
      const itemsPayload: HojaRutaItemInsert[] = [];
      const tonelajeDetallePayload: TonelajeDetalleInsert[] = [];
      for (let i = 0; i < sheet.items.length; i++) {
        const item = sheet.items[i];
        const viaje = viajesPayload[i];
        itemsPayload.push({
          hoja_ruta_id: hojaRutaId,
          viaje_id: viaje.id,
          orden: i + 1,
          dia: item.dia,
          sale_de: item.sale_de,
          llega_a: item.llega_a,
          km_recorridos: item.viaje_vacio ? 0 : item.km_recorridos,
          km_vacios: (item.viaje_vacio ? item.km_recorridos : 0) + (item.km_vacios ?? 0),
          km_no_computable: 0,
          tn_com_29: item.tn_com_29,
          tn_esc_35: item.tn_esc_35,
          tn_esc_37_5: item.tn_esc_37_5,
          remito_numero: item.remito_numero,
          material: item.material,
          monto_chofer: item.monto_chofer,
        });
        if (item.tn_com_29 != null && item.tn_com_29 > 0 && tonelajeCatMap.com_29) {
          tonelajeDetallePayload.push({
            viaje_id: viaje.id,
            categoria_id: tonelajeCatMap.com_29,
            toneladas: item.tn_com_29,
            created_by: user.id,
          });
        }
        if (item.tn_esc_35 != null && item.tn_esc_35 > 0 && tonelajeCatMap.esc_35) {
          tonelajeDetallePayload.push({
            viaje_id: viaje.id,
            categoria_id: tonelajeCatMap.esc_35,
            toneladas: item.tn_esc_35,
            created_by: user.id,
          });
        }
        if (item.tn_esc_37_5 != null && item.tn_esc_37_5 > 0 && tonelajeCatMap.esc_37_5) {
          tonelajeDetallePayload.push({
            viaje_id: viaje.id,
            categoria_id: tonelajeCatMap.esc_37_5,
            toneladas: item.tn_esc_37_5,
            created_by: user.id,
          });
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: itemsErr } = await (supabase as any)
        .from("hoja_ruta_items")
        .insert(itemsPayload);
      if (itemsErr) throw new Error(`Error en hoja_ruta_items: ${itemsErr.message}`);

      if (tonelajeDetallePayload.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: tonErr } = await (supabase as any)
          .from("viaje_tonelaje_detalle")
          .insert(tonelajeDetallePayload);
        if (tonErr) throw new Error(`Error en viaje_tonelaje_detalle: ${tonErr.message}`);
      }

      // 6) Audit log -------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("audit_log").insert({
        usuario_id: user.id,
        accion: "importar_hoja_ruta",
        entidad_tipo: "hoja_ruta",
        entidad_id: hojaRutaId,
        valores_nuevos: {
          codigo: codigoHR,
          sheet: sheet.sheetName,
          archivo: file.name,
          viajes_creados: sheet.items.length,
          tonelaje_total: tonelajeTotal,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      console.error(`Sheet ${sheet.sheetName} falló:`, e);
      errores.push({ sheet: sheet.sheetName, message: msg });
    }
  }

  revalidatePath("/viajes");

  return {
    ok: true,
    imported: {
      hojasRuta: totalHojasRuta,
      viajes: totalViajes,
      puntosCreados: totalPuntosNuevos,
      sheetsOmitidos,
    },
    errores,
  };
}

// ============================================================================
// Helpers del confirm
// ============================================================================

type HojaRutaItemInsert = {
  hoja_ruta_id: string;
  viaje_id: string;
  orden: number;
  dia: string;
  sale_de: string;
  llega_a: string;
  km_recorridos: number;
  km_vacios: number;
  km_no_computable: number;
  tn_com_29: number | null;
  tn_esc_35: number | null;
  tn_esc_37_5: number | null;
  remito_numero: string | null;
  material: string | null;
  monto_chofer: number | null;
};

type TonelajeDetalleInsert = {
  viaje_id: string;
  categoria_id: string;
  toneladas: number;
  created_by: string | null;
};

async function getOrCreateClienteSinAsignar(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("clientes")
    .select("id")
    .eq("razon_social", CLIENTE_SIN_ASIGNAR)
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("clientes")
    .insert({
      razon_social: CLIENTE_SIN_ASIGNAR,
      condicion_iva: "no_categorizado",
      estado: "activo",
      observaciones: "Cliente placeholder para viajes importados desde hojas de ruta. Reasignar manualmente.",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear cliente placeholder: ${error.message}`);
  return inserted.id;
}

async function getOrCreateTipoCargaOtros(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("tipos_carga")
    .select("id")
    .ilike("nombre", "otros")
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("tipos_carga")
    .insert({
      nombre: "Otros",
      descripcion: "Carga general / Otros",
      requiere_documentacion_especial: false,
      estado: "activo",
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear tipo de carga 'Otros': ${error.message}`);
  return inserted.id;
}

async function getTonelajeCategoriaMap(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Record<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("tonelaje_categorias")
    .select("id, codigo");
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.codigo] = row.id;
  }
  return map;
}

async function preloadPuntosRuta(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Map<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("puntos_ruta")
    .select("id, nombre");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(normName(row.nombre), row.id);
  }
  return map;
}

// Busca el último número usado para un prefijo de código (`V-2026-` o `HR-2026-`)
// y devuelve ese número. El llamador hace ++ antes de usar para el siguiente.
async function getLastCodigo(
  supabase: ReturnType<typeof createAdminClient>,
  tabla: "viajes" | "hojas_ruta",
  prefix: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from(tabla)
    .select("codigo")
    .like("codigo", `${prefix}%`)
    .order("codigo", { ascending: false })
    .limit(1);
  if (!data?.length) return 0;
  const tail = data[0].codigo.slice(prefix.length);
  const n = parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}
