"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("clientes").insert({
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
    estado: "activo",
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
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

  revalidatePath("/clientes");
  return { ok: true };
}

export type ReactivateClienteState = { ok?: boolean; error?: string } | null;

export async function reactivateClienteAction(
  _prev: ReactivateClienteState,
  formData: FormData,
): Promise<ReactivateClienteState> {
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

  revalidatePath("/clientes");
  return { ok: true };
}

// ============================================================================
// Importación desde Excel / CSV
// ============================================================================

export type ImportClientesState = {
  ok?: boolean;
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  error?: string;
} | null;

const HEADER_MAP: Record<string, keyof RawRow> = {
  "razon social": "razon_social",
  razon_social: "razon_social",
  "nombre comercial": "nombre_comercial",
  nombre_comercial: "nombre_comercial",
  cuit: "cuit",
  "condicion iva": "condicion_iva",
  condicion_iva: "condicion_iva",
  "domicilio fiscal": "domicilio_fiscal",
  domicilio_fiscal: "domicilio_fiscal",
  domicilio: "domicilio_fiscal",
  localidad: "localidad",
  provincia: "provincia",
  email: "email",
  telefono: "telefono",
  "es multinacional": "es_multinacional",
  es_multinacional: "es_multinacional",
  multinacional: "es_multinacional",
  observaciones: "observaciones",
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
  if (s.includes("responsable")) return "responsable_inscripto";
  if (s.includes("mono")) return "monotributo";
  if (s.includes("exento")) return "exento";
  if (s.includes("final")) return "consumidor_final";
  return "no_categorizado";
}

function normalizeBool(v?: string): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return ["si", "sí", "true", "1", "x", "yes"].includes(s);
}

function cell(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export async function importClientesAction(
  _prev: ImportClientesState,
  formData: FormData,
): Promise<ImportClientesState> {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // +1 por header, +1 porque Excel arranca en 1

    const mapped: RawRow = {};
    for (const [key, value] of Object.entries(raw)) {
      const norm = normalizeKey(key);
      const target = HEADER_MAP[norm];
      if (target) mapped[target] = cell(value);
    }

    const razon = cell(mapped.razon_social);
    if (!razon) {
      skipped++;
      errors.push({ row: rowNum, message: "Falta razón social." });
      continue;
    }

    const cuit = cell(mapped.cuit);
    const email = cell(mapped.email);
    if (email && !z.string().email().safeParse(email).success) {
      skipped++;
      errors.push({ row: rowNum, message: `Email inválido: ${email}` });
      continue;
    }

    const { error } = await supabase.from("clientes").insert({
      razon_social: razon,
      nombre_comercial: cell(mapped.nombre_comercial) ?? null,
      cuit: cuit ?? null,
      condicion_iva: normalizeCondicionIva(mapped.condicion_iva),
      domicilio_fiscal: cell(mapped.domicilio_fiscal) ?? null,
      localidad: cell(mapped.localidad) ?? null,
      provincia: cell(mapped.provincia) ?? null,
      email: email ?? null,
      telefono: cell(mapped.telefono) ?? null,
      es_multinacional: normalizeBool(mapped.es_multinacional),
      observaciones: cell(mapped.observaciones) ?? null,
      estado: "activo",
      created_by: user.id,
    });

    if (error) {
      skipped++;
      errors.push({ row: rowNum, message: error.message });
    } else {
      imported++;
    }
  }

  revalidatePath("/clientes");
  return { ok: true, imported, skipped, errors };
}
