"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";

type EmpresaKey =
  | "empresa_razon_social"
  | "empresa_cuit"
  | "empresa_domicilio"
  | "empresa_email"
  | "empresa_telefono";

const KEY_DESCRIPCION: Record<EmpresaKey, string> = {
  empresa_razon_social: "Razón social de la empresa.",
  empresa_cuit: "CUIT de la empresa.",
  empresa_domicilio: "Domicilio fiscal de la empresa.",
  empresa_email: "Email de contacto principal.",
  empresa_telefono: "Teléfono de contacto principal.",
};

const empresaSchema = z.object({
  razon_social: z
    .string()
    .trim()
    .min(2, "La razón social es obligatoria")
    .max(200, "Máximo 200 caracteres"),
  cuit: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{8}-\d{1}$/, "Formato esperado: XX-XXXXXXXX-X"),
  domicilio: z.string().trim().max(200, "Máximo 200 caracteres"),
  email: z.union([z.literal(""), z.string().email("Email inválido")]),
  telefono: z.string().trim().max(50, "Máximo 50 caracteres"),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;

type Result = { success: true } | { error: string };

export async function updateEmpresaAction(input: unknown): Promise<Result> {
  await requireAdmin();

  const parsed = empresaSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const data = parsed.data;
  const ahora = new Date().toISOString();

  const filas = [
    { clave: "empresa_razon_social", valor: data.razon_social },
    { clave: "empresa_cuit", valor: data.cuit },
    { clave: "empresa_domicilio", valor: data.domicilio },
    { clave: "empresa_email", valor: data.email },
    { clave: "empresa_telefono", valor: data.telefono },
  ] as const;

  const { data: actuales } = await supabase
    .from("parametros_sistema")
    .select("id, clave, valor, categoria")
    .in("clave", filas.map((f) => f.clave));

  const actualMap = new Map((actuales ?? []).map((p) => [p.clave, p]));

  for (const fila of filas) {
    const actual = actualMap.get(fila.clave);

    if (actual) {
      if (actual.valor === fila.valor) continue;

      const { error: updError } = await supabase
        .from("parametros_sistema")
        .update({ valor: fila.valor, updated_by: user.id, updated_at: ahora })
        .eq("id", actual.id);

      if (updError) {
        console.error("Error actualizando", fila.clave, updError);
        return { error: `No se pudo guardar ${fila.clave}` };
      }

      await logAudit({
        client: supabase,
        accion: "actualizar",
        usuarioId: user.id,
        entidadTipo: "parametro_sistema",
        entidadId: actual.id,
        valoresAnteriores: { valor: actual.valor },
        valoresNuevos: { valor: fila.valor },
        metadata: { clave: fila.clave, categoria: actual.categoria, origen: "empresa" },
      });
    } else {
      const { data: inserted, error: insError } = await supabase
        .from("parametros_sistema")
        .insert({
          clave: fila.clave,
          valor: fila.valor,
          tipo_dato: "string",
          categoria: "general",
          editable: true,
          descripcion: KEY_DESCRIPCION[fila.clave],
          updated_by: user.id,
          updated_at: ahora,
        })
        .select("id")
        .single();

      if (insError || !inserted) {
        console.error("Error creando", fila.clave, insError);
        return { error: `No se pudo guardar ${fila.clave}` };
      }

      await logAudit({
        client: supabase,
        accion: "crear",
        usuarioId: user.id,
        entidadTipo: "parametro_sistema",
        entidadId: inserted.id,
        valoresAnteriores: null,
        valoresNuevos: { valor: fila.valor },
        metadata: { clave: fila.clave, categoria: "general", origen: "empresa" },
      });
    }
  }

  revalidatePath("/configuracion/negocio");
  return { success: true };
}
