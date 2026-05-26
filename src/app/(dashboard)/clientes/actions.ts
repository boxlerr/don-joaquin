"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logClienteAudit } from "./audit";
import { requireArea } from "@/lib/auth";

const CONDICION_IVA_VALUES = [
  "responsable_inscripto",
  "monotributo",
  "exento",
  "consumidor_final",
  "no_categorizado",
] as const;

const condicionIvaEnum = z.enum(CONDICION_IVA_VALUES);

const clienteSchema = z.object({
  razon_social: z.string().trim().min(1, "La razón social es obligatoria."),
  nombre_comercial: z.string().trim().optional().nullable(),
  cuit: z.string().trim().optional().nullable(),
  condicion_iva: condicionIvaEnum,
  domicilio_fiscal: z.string().trim().optional().nullable(),
  localidad: z.string().trim().optional().nullable(),
  provincia: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Email inválido.").optional().or(z.literal("")),
  telefono: z.string().trim().optional().nullable(),
  es_multinacional: z.boolean().optional(),
  observaciones: z.string().trim().optional().nullable(),
});

export type CreateClienteState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function createClienteAction(
  _prev: CreateClienteState,
  formData: FormData,
): Promise<CreateClienteState> {
  await requireArea("comercial", "write");
  const parsed = clienteSchema.safeParse({
    razon_social: formData.get("razon_social"),
    nombre_comercial: emptyToNull(formData.get("nombre_comercial")),
    cuit: emptyToNull(formData.get("cuit")),
    condicion_iva: formData.get("condicion_iva") ?? "no_categorizado",
    domicilio_fiscal: emptyToNull(formData.get("domicilio_fiscal")),
    localidad: emptyToNull(formData.get("localidad")),
    provincia: emptyToNull(formData.get("provincia")),
    email: emptyToNull(formData.get("email")) ?? "",
    telefono: emptyToNull(formData.get("telefono")),
    es_multinacional: formData.get("es_multinacional") === "on",
    observaciones: emptyToNull(formData.get("observaciones")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado." };
  }

  const insertData = {
    razon_social: parsed.data.razon_social,
    nombre_comercial: parsed.data.nombre_comercial ?? null,
    cuit: parsed.data.cuit ?? null,
    condicion_iva: parsed.data.condicion_iva,
    domicilio_fiscal: parsed.data.domicilio_fiscal ?? null,
    localidad: parsed.data.localidad ?? null,
    provincia: parsed.data.provincia ?? null,
    email: parsed.data.email ? parsed.data.email : null,
    telefono: parsed.data.telefono ?? null,
    es_multinacional: parsed.data.es_multinacional ?? false,
    observaciones: parsed.data.observaciones ?? null,
    estado: "activo" as const,
    created_by: user.id,
  };

  const { data: inserted, error } = await supabase
    .from("clientes")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (inserted?.id) {
    await logClienteAudit(inserted.id, "crear", null, insertData, user.id);
  }

  revalidatePath("/clientes");
  return { ok: true };
}

// ============================================================================
// Baja / alta de cliente (soft delete)
// ============================================================================

export type DeleteClienteState = { ok?: boolean; error?: string } | null;

export async function deleteClienteAction(
  _prev: DeleteClienteState,
  formData: FormData,
): Promise<DeleteClienteState> {
  await requireArea("comercial", "write");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ID de cliente inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("clientes")
    .update({ estado: "inactivo" })
    .eq("id", id);

  if (error) return { error: error.message };

  await logClienteAudit(
    id,
    "cambio_estado",
    { estado: "activo" },
    { estado: "inactivo" },
    user.id,
  );

  revalidatePath("/clientes");
  return { ok: true };
}

export type ReactivateClienteState = { ok?: boolean; error?: string } | null;

export async function reactivateClienteAction(
  _prev: ReactivateClienteState,
  formData: FormData,
): Promise<ReactivateClienteState> {
  await requireArea("comercial", "write");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ID de cliente inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("clientes")
    .update({ estado: "activo" })
    .eq("id", id);

  if (error) return { error: error.message };

  await logClienteAudit(
    id,
    "cambio_estado",
    { estado: "inactivo" },
    { estado: "activo" },
    user.id,
  );

  revalidatePath("/clientes");
  return { ok: true };
}

// ============================================================================
// Importación desde Excel / CSV — flujo en 2 pasos (preview + commit)
// ============================================================================

export type ImportClientesState = {
  ok?: boolean;
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  error?: string;
} | null;

const HEADER_MAP: Record<string, keyof RawRow> = {
  // Razón social
  "razon social": "razon_social",
  razon_social: "razon_social",
  // Nombre comercial (la columna "CLIENTES" del nuevo formato es el nombre corto)
  clientes: "nombre_comercial",
  cliente: "nombre_comercial",
  "nombre comercial": "nombre_comercial",
  nombre_comercial: "nombre_comercial",
  // CUIT
  cuit: "cuit",
  // Condición IVA
  "condicion iva": "condicion_iva",
  "condicion de iva": "condicion_iva",
  condicion_iva: "condicion_iva",
  iva: "condicion_iva",
  // Dirección
  direccion: "domicilio_fiscal",
  "domicilio fiscal": "domicilio_fiscal",
  domicilio_fiscal: "domicilio_fiscal",
  domicilio: "domicilio_fiscal",
  // Resto
  localidad: "localidad",
  provincia: "provincia",
  email: "email",
  telefono: "telefono",
  "es multinacional": "es_multinacional",
  es_multinacional: "es_multinacional",
  multinacional: "es_multinacional",
  observaciones: "observaciones",
  // Contacto principal (mapea a cliente_contactos con es_principal=true)
  "contrato principal": "contacto_principal",
  contrato_principal: "contacto_principal",
  "contacto principal": "contacto_principal",
  contacto_principal: "contacto_principal",
  contacto: "contacto_principal",
};

type RawRow = {
  razon_social?: string;
  nombre_comercial?: string;
  cuit?: string;
  condicion_iva?: string;
  domicilio_fiscal?: string;
  localidad?: string;
  provincia?: string;
  email?: string;
  telefono?: string;
  es_multinacional?: string;
  observaciones?: string;
  contacto_principal?: string;
};

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCondicionIva(v?: string): (typeof CONDICION_IVA_VALUES)[number] {
  const s = (v ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CONDICION_IVA_VALUES as readonly string[]).includes(s)) {
    return s as (typeof CONDICION_IVA_VALUES)[number];
  }
  // Abreviaturas comunes en planillas
  if (s === "ri" || s === "r.i" || s === "r_i") return "responsable_inscripto";
  if (s === "mt" || s === "monotrib") return "monotributo";
  if (s === "ex") return "exento";
  if (s === "cf") return "consumidor_final";
  if (s.includes("responsable")) return "responsable_inscripto";
  if (s.includes("mono")) return "monotributo";
  if (s.includes("exento")) return "exento";
  if (s.includes("final")) return "consumidor_final";
  return "no_categorizado";
}

function normalizeCuit(v?: string): string | undefined {
  if (!v) return undefined;
  const digits = v.replace(/\D/g, "");
  return digits === "" ? undefined : digits;
}

function cell(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

// ---------------------------------------------------------------------------
// Preview: parsea el archivo y devuelve las filas con su estado de validación.
// No inserta nada en la base.
// ---------------------------------------------------------------------------

export type PreviewRowStatus = "ok" | "warning" | "error" | "duplicate";

export type ClientePreviewRow = {
  rowNum: number;
  status: PreviewRowStatus;
  messages: string[];
  data: {
    razon_social: string | null;
    nombre_comercial: string | null;
    cuit: string | null;
    condicion_iva: (typeof CONDICION_IVA_VALUES)[number];
    condicion_iva_raw: string | null;
    domicilio_fiscal: string | null;
    contacto_principal: string | null;
  };
};

export type PreviewClientesState = {
  ok?: boolean;
  error?: string;
  rows?: ClientePreviewRow[];
  summary?: {
    total: number;
    importable: number;
    duplicates: number;
    errors: number;
  };
} | null;

export async function previewClientesAction(
  _prev: PreviewClientesState,
  formData: FormData,
): Promise<PreviewClientesState> {
  await requireArea("comercial", "write");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx o .csv." };
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "El archivo no contiene hojas." };
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { error: "No se pudo leer el archivo. Verificá el formato." };
  }

  if (rows.length === 0) {
    return { error: "El archivo no contiene filas." };
  }

  const parsed: ClientePreviewRow[] = rows.map((raw, i) => {
    const rowNum = i + 2;
    const mapped: RawRow = {};
    for (const [key, value] of Object.entries(raw)) {
      const norm = normalizeKey(key);
      const target = HEADER_MAP[norm];
      if (target) mapped[target] = cell(value);
    }

    const messages: string[] = [];
    const razon = cell(mapped.razon_social) ?? null;
    const cuit = normalizeCuit(mapped.cuit) ?? null;
    const condicionRaw = cell(mapped.condicion_iva) ?? null;
    const condicion = normalizeCondicionIva(mapped.condicion_iva);

    let status: PreviewRowStatus = "ok";
    if (!razon) {
      status = "error";
      messages.push("Falta razón social.");
    }
    if (cuit && cuit.length !== 11) {
      if (status !== "error") status = "warning";
      messages.push(`CUIT con ${cuit.length} dígitos (se esperan 11).`);
    }
    if (condicionRaw && condicion === "no_categorizado") {
      if (status !== "error") status = "warning";
      messages.push(
        `Condición IVA "${condicionRaw}" no reconocida — quedará como no_categorizado.`,
      );
    }

    return {
      rowNum,
      status,
      messages,
      data: {
        razon_social: razon,
        nombre_comercial: cell(mapped.nombre_comercial) ?? null,
        cuit,
        condicion_iva: condicion,
        condicion_iva_raw: condicionRaw,
        domicilio_fiscal: cell(mapped.domicilio_fiscal) ?? null,
        contacto_principal: cell(mapped.contacto_principal) ?? null,
      },
    };
  });

  // Chequeo de duplicados contra la base actual (por CUIT o por razón social exacta)
  const adminSupabase = createAdminClient();
  const cuits = Array.from(
    new Set(parsed.map((r) => r.data.cuit).filter((c): c is string => !!c)),
  );
  const razones = Array.from(
    new Set(parsed.map((r) => r.data.razon_social).filter((c): c is string => !!c)),
  );

  const existingCuits = new Set<string>();
  const existingRazones = new Set<string>();
  if (cuits.length > 0) {
    const { data } = await adminSupabase
      .from("clientes")
      .select("cuit")
      .in("cuit", cuits);
    for (const c of data ?? []) {
      if (c.cuit) existingCuits.add(c.cuit.replace(/\D/g, ""));
    }
  }
  if (razones.length > 0) {
    const { data } = await adminSupabase
      .from("clientes")
      .select("razon_social")
      .in("razon_social", razones);
    for (const c of data ?? []) {
      if (c.razon_social) existingRazones.add(c.razon_social);
    }
  }

  // Duplicados dentro del propio archivo
  const cuitSeen = new Map<string, number>();
  const razonSeen = new Map<string, number>();
  for (const row of parsed) {
    if (row.status === "error") continue;
    const cuit = row.data.cuit;
    const razon = row.data.razon_social;
    if (cuit && existingCuits.has(cuit)) {
      row.status = "duplicate";
      row.messages.push(`Ya existe un cliente con CUIT ${cuit}.`);
      continue;
    }
    if (!cuit && razon && existingRazones.has(razon)) {
      row.status = "duplicate";
      row.messages.push(`Ya existe un cliente con razón social "${razon}".`);
      continue;
    }
    if (cuit) {
      const prev = cuitSeen.get(cuit);
      if (prev) {
        row.status = "duplicate";
        row.messages.push(`CUIT repetido en la fila ${prev}.`);
        continue;
      }
      cuitSeen.set(cuit, row.rowNum);
    } else if (razon) {
      const prev = razonSeen.get(razon);
      if (prev) {
        row.status = "duplicate";
        row.messages.push(`Razón social repetida en la fila ${prev}.`);
        continue;
      }
      razonSeen.set(razon, row.rowNum);
    }
  }

  const summary = {
    total: parsed.length,
    importable: parsed.filter((r) => r.status === "ok" || r.status === "warning").length,
    duplicates: parsed.filter((r) => r.status === "duplicate").length,
    errors: parsed.filter((r) => r.status === "error").length,
  };

  return { ok: true, rows: parsed, summary };
}

// ---------------------------------------------------------------------------
// Commit: recibe las filas validadas (JSON) y las inserta.
// ---------------------------------------------------------------------------

export async function commitClientesImportAction(
  _prev: ImportClientesState,
  formData: FormData,
): Promise<ImportClientesState> {
  await requireArea("comercial", "write");

  const payload = String(formData.get("rows") ?? "");
  if (!payload) return { error: "No hay filas para importar." };

  let rows: ClientePreviewRow[];
  try {
    rows = JSON.parse(payload) as ClientePreviewRow[];
  } catch {
    return { error: "No se pudieron leer las filas a importar." };
  }

  const importables = rows.filter(
    (r) => r.status === "ok" || r.status === "warning",
  );
  if (importables.length === 0) {
    return { error: "No hay filas válidas para importar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (const row of importables) {
    if (!row.data.razon_social) {
      skipped++;
      errors.push({ row: row.rowNum, message: "Falta razón social." });
      continue;
    }

    const insertRow = {
      razon_social: row.data.razon_social,
      nombre_comercial: row.data.nombre_comercial,
      cuit: row.data.cuit,
      condicion_iva: row.data.condicion_iva,
      domicilio_fiscal: row.data.domicilio_fiscal,
      estado: "activo" as const,
      created_by: user.id,
    };

    const { data: inserted, error } = await supabase
      .from("clientes")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      skipped++;
      errors.push({ row: row.rowNum, message: error.message });
      continue;
    }

    imported++;
    if (inserted?.id) {
      await logClienteAudit(inserted.id, "crear", null, insertRow, user.id);

      const contactoNombre = row.data.contacto_principal;
      if (contactoNombre) {
        const { error: cErr } = await supabase.from("cliente_contactos").insert({
          cliente_id: inserted.id,
          nombre: contactoNombre,
          cargo: "comercial",
          es_principal: true,
        });
        if (cErr) {
          errors.push({
            row: row.rowNum,
            message: `Cliente creado pero falló el contacto principal: ${cErr.message}`,
          });
        }
      }
    }
  }

  revalidatePath("/clientes");
  return { ok: true, imported, skipped, errors };
}

// ============================================================================
// Edición de cliente
// ============================================================================

export type UpdateClienteState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

export async function updateClienteAction(
  _prev: UpdateClienteState,
  formData: FormData,
): Promise<UpdateClienteState> {
  await requireArea("comercial", "write");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ID de cliente inválido." };

  const parsed = clienteSchema.safeParse({
    razon_social: formData.get("razon_social"),
    nombre_comercial: emptyToNull(formData.get("nombre_comercial")),
    cuit: emptyToNull(formData.get("cuit")),
    condicion_iva: formData.get("condicion_iva") ?? "no_categorizado",
    domicilio_fiscal: emptyToNull(formData.get("domicilio_fiscal")),
    localidad: emptyToNull(formData.get("localidad")),
    provincia: emptyToNull(formData.get("provincia")),
    email: emptyToNull(formData.get("email")) ?? "",
    telefono: emptyToNull(formData.get("telefono")),
    es_multinacional: formData.get("es_multinacional") === "on",
    observaciones: emptyToNull(formData.get("observaciones")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: previo } = await supabase
    .from("clientes")
    .select(
      "razon_social, nombre_comercial, cuit, condicion_iva, domicilio_fiscal, localidad, provincia, email, telefono, es_multinacional, observaciones",
    )
    .eq("id", id)
    .single();

  const updateData = {
    razon_social: parsed.data.razon_social,
    nombre_comercial: parsed.data.nombre_comercial ?? null,
    cuit: parsed.data.cuit ?? null,
    condicion_iva: parsed.data.condicion_iva,
    domicilio_fiscal: parsed.data.domicilio_fiscal ?? null,
    localidad: parsed.data.localidad ?? null,
    provincia: parsed.data.provincia ?? null,
    email: parsed.data.email ? parsed.data.email : null,
    telefono: parsed.data.telefono ?? null,
    es_multinacional: parsed.data.es_multinacional ?? false,
    observaciones: parsed.data.observaciones ?? null,
  };

  const { error } = await supabase
    .from("clientes")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };

  await logClienteAudit(id, "actualizar", previo ?? null, updateData, user.id);

  revalidatePath("/clientes");
  return { ok: true };
}

// ============================================================================
// Estado de cuenta / Viajes recientes
// ============================================================================

export type CtaCteMovimiento = {
  id: string;
  fecha: string;
  tipo: string;
  concepto: string | null;
  categoria: string | null;
  monto: number;
  moneda: string;
  observaciones: string | null;
};

export type CuentaResumen = {
  saldo: number;
  totalDebe: number;
  totalHaber: number;
  movimientos: CtaCteMovimiento[];
};

export async function getCuentaClienteAction(cliente_id: string): Promise<CuentaResumen> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cta_cte_movimientos")
    .select("id, fecha, tipo, concepto, categoria, monto, moneda, observaciones")
    .eq("cliente_id", cliente_id)
    .order("fecha", { ascending: false })
    .limit(100);

  const movimientos = (data ?? []) as CtaCteMovimiento[];
  let totalDebe = 0;
  let totalHaber = 0;
  for (const m of movimientos) {
    const monto = Number(m.monto ?? 0);
    if (m.tipo === "debe" || m.tipo === "debito") totalDebe += monto;
    else totalHaber += monto;
  }
  return { saldo: totalDebe - totalHaber, totalDebe, totalHaber, movimientos };
}

export type ViajeReciente = {
  id: string;
  codigo: string | null;
  fecha_viaje: string | null;
  estado: string;
  monto_flete: number | null;
  moneda: string | null;
  tonelaje_real: number | null;
  facturado: boolean;
  origen: string | null;
  destino: string | null;
};

export async function getViajesClienteAction(cliente_id: string): Promise<ViajeReciente[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("viajes")
    .select(
      "id, codigo, fecha_viaje, estado, monto_flete, moneda, tonelaje_real, facturado, origen:puntos_ruta!viajes_origen_id_fkey(nombre), destino:puntos_ruta!viajes_destino_id_fkey(nombre)"
    )
    .eq("cliente_id", cliente_id)
    .order("fecha_viaje", { ascending: false, nullsFirst: false })
    .limit(20);

  return (data ?? []).map((v: any) => ({
    id: v.id,
    codigo: v.codigo,
    fecha_viaje: v.fecha_viaje,
    estado: v.estado,
    monto_flete: v.monto_flete,
    moneda: v.moneda,
    tonelaje_real: v.tonelaje_real,
    facturado: v.facturado,
    origen: v.origen?.nombre ?? null,
    destino: v.destino?.nombre ?? null,
  }));
}

// ============================================================================
// Exportación de cuenta corriente
// ============================================================================

export async function exportCuentaCorrienteAction(): Promise<{
  filename: string;
  base64: string;
}> {

  const supabase = createAdminClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, razon_social, cuit, estado")
    .order("razon_social");

  const { data: movs } = await supabase
    .from("cta_cte_movimientos")
    .select("cliente_id, fecha, tipo, concepto, categoria, monto, moneda, observaciones")
    .order("fecha", { ascending: false });

  const movsByCliente = new Map<string, any[]>();
  for (const m of movs ?? []) {
    const arr = movsByCliente.get(m.cliente_id) ?? [];
    arr.push(m);
    movsByCliente.set(m.cliente_id, arr);
  }

  const resumenRows = (clientes ?? []).map((c) => {
    const ms = movsByCliente.get(c.id) ?? [];
    let debe = 0;
    let haber = 0;
    for (const m of ms) {
      const monto = Number(m.monto ?? 0);
      if (m.tipo === "debe" || m.tipo === "debito") debe += monto;
      else haber += monto;
    }
    return {
      Cliente: c.razon_social,
      CUIT: c.cuit ?? "",
      Estado: c.estado,
      Movimientos: ms.length,
      "Total debe": debe,
      "Total haber": haber,
      Saldo: debe - haber,
    };
  });

  const movRows = (movs ?? []).map((m) => {
    const cliente = (clientes ?? []).find((c) => c.id === m.cliente_id);
    return {
      Cliente: cliente?.razon_social ?? "",
      CUIT: cliente?.cuit ?? "",
      Fecha: m.fecha,
      Tipo: m.tipo,
      Concepto: m.concepto ?? "",
      Categoria: m.categoria ?? "",
      Monto: Number(m.monto ?? 0),
      Moneda: m.moneda ?? "",
      Observaciones: m.observaciones ?? "",
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "Resumen");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movRows), "Movimientos");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `cuenta-corriente-${date}.xlsx`,
    base64: buf.toString("base64"),
  };
}
