"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TarifaParams = {
  tarifa_base: number;
  precio_por_kg: number;
  precio_por_km: number;
};

const PARAM_KEYS = ["tarifa_base", "precio_por_kg", "precio_por_km"] as const;
type ParamKey = (typeof PARAM_KEYS)[number];

const DEFAULTS: TarifaParams = {
  tarifa_base: 500,
  precio_por_kg: 0.5,
  precio_por_km: 2,
};

const DESCRIPCIONES: Record<ParamKey, string> = {
  tarifa_base: "Tarifa base aplicada a todo flete",
  precio_por_kg: "Precio por kilogramo de carga",
  precio_por_km: "Precio por kilómetro recorrido",
};

export async function getTarifaParams(): Promise<TarifaParams> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .in("clave", [...PARAM_KEYS]);

  const result = { ...DEFAULTS };
  for (const row of data ?? []) {
    const num = Number(row.valor);
    if (Number.isFinite(num) && PARAM_KEYS.includes(row.clave as ParamKey)) {
      result[row.clave as ParamKey] = num;
    }
  }
  return result;
}

export async function guardarAjustes(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const rows = PARAM_KEYS.map((clave) => {
    const raw = formData.get(clave);
    const num = Number(raw);
    return {
      clave,
      valor: Number.isFinite(num) && num >= 0 ? String(num) : String(DEFAULTS[clave]),
      categoria: "tarifas",
      tipo_dato: "number" as const,
      descripcion: DESCRIPCIONES[clave],
      editable: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
  });

  await supabase.from("parametros_sistema").upsert(rows, { onConflict: "clave" });

  revalidatePath("/tarifas");
  revalidatePath("/configuracion");
}
