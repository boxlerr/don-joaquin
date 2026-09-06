"use server";

// Importador del Excel "IMPORTES SUELDOS <MES>": qué se le transfirió a cada
// persona y por qué banco salió cada parte.
//
// Hace dos cosas de una, que es justo lo que pidió Bárbara (audio del 03/09):
// deja el mes cargado y, de paso, completa en cada legajo en qué banco cobra esa
// persona — "para no tener que hacer yo uno por uno, legajo por legajo".
//
// Dos reglas que atraviesan todo el archivo:
//   1. Los bancos del legajo se AGREGAN, nunca se borran. Si el legajo dice
//      Santander y el Excel dice Provincia, se cargan los dos y la pantalla lo
//      muestra: puede ser que la persona cambió de banco, o que el Excel de este
//      mes no la incluyó. Elegir por ella sería perder un dato sin avisar.
//   2. Volver a importar el mismo mes lo deja igual, no duplicado: los pagos del
//      mes se borran y se vuelven a escribir.

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canonizarBanco, BANCOS_CONOCIDOS } from "@/lib/bancos";
import {
  parseNominaExcel,
  matchNominaContraRoster,
  type NominaParseResult,
} from "./parser-nomina";
import { armarCargaNomina } from "./nomina-carga";
import type {
  NominaImportPreview,
  NominaImportResult,
  NominaPersonaPreview,
} from "./nomina-tipos";

// Las tablas de nómina no están en database.ts todavía.
/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_FILE_BYTES = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseFile(
  formData: FormData,
): Promise<{ parsed: NominaParseResult; archivo: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Falta el archivo." };
  if (file.size > MAX_FILE_BYTES) return { error: "El archivo es demasiado grande (máx. 8 MB)." };
  try {
    const parsed = parseNominaExcel(new Uint8Array(await file.arrayBuffer()), file.name);
    if (!parsed.nomina.length) {
      return {
        error:
          parsed.warnings[0] ??
          'No se encontró la lista de la nómina. Se espera una hoja con las columnas "Empleado" e "Importe".',
      };
    }
    return { parsed, archivo: file.name };
  } catch (err) {
    console.error("Error al parsear el Excel de la nómina:", err);
    return { error: "No se pudo leer el Excel." };
  }
}

/** "FRANCES" → "Francés", usando las grafías que ya usa el sistema. */
function bancosCanonicos(enUso: string[]): (nombre: string) => string {
  const existentes = [...new Set([...enUso, ...BANCOS_CONOCIDOS])];
  return (nombre: string) => canonizarBanco(nombre, existentes);
}

function esMesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-01$/.test(mes);
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function previewImportNominaAction(
  formData: FormData,
): Promise<NominaImportPreview> {
  await requireSeccion("sueldos_admin", "write");

  const res = await parseFile(formData);
  if ("error" in res) return { error: res.error };
  const { parsed, archivo } = res;

  const supabase = createAdminClient();
  const [rosterRes, bancosRes] = await Promise.all([
    supabase.from("choferes").select("id, nombre, apellido, rol, estado").order("apellido"),
    (supabase as any).from("chofer_bancos").select("chofer_id, banco"),
  ]);

  // El roster incluye a los egresados a propósito: la nómina de julio tiene cinco
  // personas que se fueron en agosto, y ese mes lo cobraron igual.
  const roster = ((rosterRes.data ?? []) as any[]).map((c) => ({
    id: c.id as string,
    nombre: `${c.apellido ?? ""}${c.apellido ? ", " : ""}${c.nombre}`,
    rol: c.rol as string,
    estado: c.estado as string,
  }));

  const bancosPorChofer = new Map<string, string[]>();
  for (const b of (bancosRes.data ?? []) as any[]) {
    const lista = bancosPorChofer.get(b.chofer_id) ?? [];
    lista.push(b.banco);
    bancosPorChofer.set(b.chofer_id, lista);
  }
  const canon = bancosCanonicos([...bancosPorChofer.values()].flat());

  const matches = matchNominaContraRoster(
    parsed.personas,
    ((rosterRes.data ?? []) as any[]).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      rol: c.rol,
      estado: c.estado,
    })),
  );

  // Lo que trae el Excel, por persona.
  const importePorPersona = new Map(parsed.nomina.map((f) => [f.etiqueta, f.importe]));
  const bancosPorPersona = new Map<string, { banco: string; importe: number }[]>();
  const embargoPorPersona = new Map<string, number>();
  for (const b of parsed.bloques) {
    for (const f of b.filas) {
      if (b.esEmbargo) {
        embargoPorPersona.set(f.etiqueta, (embargoPorPersona.get(f.etiqueta) ?? 0) + f.importe);
        continue;
      }
      const lista = bancosPorPersona.get(f.etiqueta) ?? [];
      lista.push({ banco: canon(b.banco ?? ""), importe: f.importe });
      bancosPorPersona.set(f.etiqueta, lista);
    }
  }

  const personas: NominaPersonaPreview[] = matches.map((m) => {
    const bancos = bancosPorPersona.get(m.etiqueta) ?? [];
    const bancosLegajo = m.choferId ? (bancosPorChofer.get(m.choferId) ?? []) : [];
    const norm = (s: string) => canon(s).toLowerCase();
    const enLegajo = new Set(bancosLegajo.map(norm));
    const enExcel = new Set(bancos.map((b) => norm(b.banco)));
    const faltan = bancos.filter((b) => !enLegajo.has(norm(b.banco)));
    const sobran = bancosLegajo.filter((b) => !enExcel.has(norm(b)));

    let estadoBancos: NominaPersonaPreview["estadoBancos"];
    if (!bancosLegajo.length) estadoBancos = bancos.length ? "nuevo" : "igual";
    else if (sobran.length) estadoBancos = "distinto";
    else if (faltan.length) estadoBancos = "suma";
    else estadoBancos = "igual";

    return {
      etiqueta: m.etiqueta,
      persona: m.persona,
      legajo: m.legajo,
      choferId: m.choferId,
      auto: m.auto,
      candidatos: m.candidatos,
      importe: importePorPersona.get(m.etiqueta) ?? null,
      bancos,
      embargo: embargoPorPersona.get(m.etiqueta) ?? 0,
      bancosLegajo,
      estadoBancos,
    };
  });

  // Resumen por banco, con el total que declaraba el Excel al pie de cada bloque.
  const porBanco = new Map<string, { personas: number; total: number; totalExcel: number | null }>();
  for (const b of parsed.bloques) {
    if (b.esEmbargo) continue;
    const nombre = canon(b.banco ?? "");
    const acc = porBanco.get(nombre) ?? { personas: 0, total: 0, totalExcel: null };
    acc.personas += b.filas.length;
    acc.total += b.filas.reduce((s, f) => s + f.importe, 0);
    acc.totalExcel = (acc.totalExcel ?? 0) + (b.totalExcel ?? 0);
    porBanco.set(nombre, acc);
  }

  const asignadas = personas.filter((p) => p.choferId);
  const totalACargar = asignadas.reduce((s, p) => s + (p.importe ?? 0), 0);
  const embargosACargar = asignadas.reduce((s, p) => s + p.embargo, 0);

  // Qué meses ya están cargados, para poder avisar antes de pisar uno. Se traen
  // todos porque el mes se puede cambiar a mano en la pantalla.
  const { data: cargadosRaw } = await (supabase as any)
    .from("sueldos_nomina_pagos")
    .select("mes, importe, concepto");
  const acumulado = new Map<string, { pagos: number; total: number }>();
  for (const f of (cargadosRaw ?? []) as { mes: string; importe: number; concepto: string }[]) {
    const acc = acumulado.get(f.mes) ?? { pagos: 0, total: 0 };
    acc.pagos++;
    if (f.concepto === "sueldo") acc.total += Number(f.importe ?? 0);
    acumulado.set(f.mes, acc);
  }
  const mesesCargados = [...acumulado.entries()]
    .map(([mes, v]) => ({ mes, ...v }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    ok: true,
    archivo,
    mesSugerido: parsed.mesSugerido,
    anio: parsed.anio,
    totales: {
      nominaExcel: parsed.totales.nominaExcel,
      sueldosExcel: parsed.totales.sueldosExcel,
      sueldosMasEmbargosExcel: parsed.totales.sueldosMasEmbargosExcel,
      aCargar: totalACargar,
      embargosACargar,
    },
    bancos: [...porBanco.entries()]
      .map(([banco, v]) => ({ banco, ...v }))
      .sort((a, b) => b.total - a.total),
    personas,
    roster,
    mesesCargados,
    warnings: parsed.warnings,
  };
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

export async function confirmImportNominaAction(
  formData: FormData,
): Promise<NominaImportResult> {
  const user = await requireSeccion("sueldos_admin", "write");

  const res = await parseFile(formData);
  if ("error" in res) return { error: res.error };
  const { parsed, archivo } = res;

  const mes = String(formData.get("mes") ?? "");
  if (!esMesValido(mes)) {
    return { error: "Elegí de qué mes es la nómina antes de cargarla." };
  }
  const completarBancos = String(formData.get("completarBancos") ?? "1") === "1";

  let asignaciones: Record<string, string>;
  try {
    asignaciones = JSON.parse(String(formData.get("asignaciones") ?? "{}"));
  } catch {
    return { error: "Asignaciones inválidas." };
  }

  const supabase = createAdminClient();
  const [validosRes, bancosRes] = await Promise.all([
    supabase.from("choferes").select("id, nombre, apellido"),
    (supabase as any).from("chofer_bancos").select("chofer_id, banco"),
  ]);
  const nombrePorId = new Map(
    ((validosRes.data ?? []) as any[]).map((c) => [c.id as string, `${c.apellido}, ${c.nombre}`]),
  );
  for (const [etiqueta, id] of Object.entries(asignaciones)) {
    if (id && !nombrePorId.has(id)) return { error: `Asignación inválida para "${etiqueta}".` };
  }

  const bancosPorChofer = new Map<string, string[]>();
  for (const b of (bancosRes.data ?? []) as any[]) {
    const lista = bancosPorChofer.get(b.chofer_id) ?? [];
    lista.push(b.banco);
    bancosPorChofer.set(b.chofer_id, lista);
  }
  const canon = bancosCanonicos([...bancosPorChofer.values()].flat());

  // ── Qué hay que escribir ───────────────────────────────────────────────────
  // La decisión vive en `nomina-carga.ts`, que es código puro y con test: acá
  // sólo quedan los permisos, la escritura y la auditoría.
  const carga = armarCargaNomina({
    parsed,
    mes,
    asignaciones,
    bancosPorChofer,
    canon,
    usuarioId: user.id,
    completarBancos,
  });
  const { pagos, omitidos } = carga;

  // ── Escritura ──────────────────────────────────────────────────────────────
  // Primero se borra el mes: reimportar un archivo corregido tiene que dejar el
  // mes como el archivo nuevo, no sumarle filas al viejo.
  const { error: errBorrado } = await (supabase as any)
    .from("sueldos_nomina_pagos")
    .delete()
    .eq("mes", mes);
  if (errBorrado) {
    console.error("Error al limpiar el mes de la nómina:", errBorrado);
    return { error: "No se pudo preparar el mes para la carga." };
  }

  const CHUNK = 400;
  for (let i = 0; i < pagos.length; i += CHUNK) {
    const { error } = await (supabase as any)
      .from("sueldos_nomina_pagos")
      .insert(pagos.slice(i, i + CHUNK));
    if (error) {
      console.error("Error al cargar la nómina:", error);
      return { error: "No se pudieron guardar los importes de la nómina." };
    }
  }

  const totalSueldos = pagos.filter((p) => p.concepto === "sueldo").reduce((s, p) => s + p.importe, 0);
  const totalEmbargos = pagos.filter((p) => p.concepto === "embargo").reduce((s, p) => s + p.importe, 0);

  const { error: errMes } = await (supabase as any).from("sueldos_nomina_meses").upsert(
    {
      mes,
      archivo,
      total_sueldos: parsed.totales.nominaExcel,
      total_embargos: parsed.bloques
        .filter((b) => b.esEmbargo)
        .reduce((s, b) => s + b.filas.reduce((t, f) => t + f.importe, 0), 0),
      observaciones: omitidos.length
        ? `Sin legajo en el sistema: ${omitidos.map((o) => o.etiqueta).join("; ")}`
        : null,
      updated_by: user.id,
    },
    { onConflict: "mes" },
  );
  if (errMes) {
    console.error("Error al registrar el mes de la nómina:", errMes);
    return { error: "Se cargaron los importes pero no se pudo registrar el mes." };
  }

  // ── Bancos del legajo ──────────────────────────────────────────────────────
  // Insert y no upsert: la clave única de `chofer_bancos` es una expresión
  // (`lower(btrim(banco))`) y PostgREST no la puede nombrar en onConflict. Lo
  // que ya estaba cargado se filtró contra lo que se leyó de la base.
  for (let i = 0; i < carga.cuentas.length; i += CHUNK) {
    const { error } = await (supabase as any)
      .from("chofer_bancos")
      .insert(carga.cuentas.slice(i, i + CHUNK));
    if (error) {
      console.error("Error al completar los bancos de los legajos:", error);
      return {
        error: "Se cargaron los importes, pero no se pudieron completar los bancos de los legajos.",
      };
    }
  }
  const bancosAgregados = carga.cuentas.length;
  const bancosSinConfirmar = carga.bancosSinConfirmar.map((b) => ({
    nombre: nombrePorId.get(b.choferId) ?? "—",
    banco: b.banco,
  }));

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "sueldos_nomina",
    entidadId: mes,
    valoresNuevos: {
      archivo,
      mes,
      pagos: pagos.length,
      totalSueldos,
      totalEmbargos,
      bancosAgregados,
      omitidos: omitidos.map((o) => o.etiqueta),
    },
    metadata: { origen: "sueldos_nomina_import" },
  });

  revalidatePath("/choferes/sueldos");
  revalidatePath("/choferes");

  return {
    ok: true,
    mes,
    personas: new Set(pagos.map((p) => p.chofer_id)).size,
    pagos: pagos.filter((p) => p.concepto === "sueldo").length,
    embargos: pagos.filter((p) => p.concepto === "embargo").length,
    total: totalSueldos,
    bancosAgregados,
    omitidos,
    bancosSinConfirmar,
  };
}
