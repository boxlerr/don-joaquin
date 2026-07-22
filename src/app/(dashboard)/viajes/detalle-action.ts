"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";

// Detalle rico de un viaje, que se trae al expandir la fila (no en el listado,
// para no engordar la query de la tabla). Suma lo que NO está en la fila:
// datos del chofer y del camión, quién y cuándo lo cargó, tipo de carga y vía.

export type ViajeDetalle = {
  chofer: {
    apellido: string | null;
    nombre: string | null;
    telefono: string | null;
    dni: string | null;
    cuil: string | null;
    localidad: string | null;
    estado: string | null;
    rol: string | null;
    fecha_ingreso: string | null;
  } | null;
  camion: {
    patente: string | null;
    marca: string | null;
    modelo: string | null;
    capacidad_tn: number | null;
    km_actual: number | null;
  } | null;
  tipoCarga: string | null;
  rutaVia: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  creadoPor: string | null;
};

export async function getViajeDetalleAction(
  viajeId: string,
): Promise<ViajeDetalle | { error: string }> {
  await requireArea("viajes", "read");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("viajes")
    .select(
      `created_at, updated_at, ruta_via, created_by,
       chofer:choferes(apellido, nombre, telefono, dni, cuil, localidad, estado, rol, fecha_ingreso),
       camion:camiones(patente, marca, modelo, capacidad_tn, km_actual),
       tipo_carga:tipos_carga(nombre)`,
    )
    .eq("id", viajeId)
    .maybeSingle();

  if (error) {
    console.error("Error al traer el detalle del viaje:", error);
    return { error: "No se pudo cargar el detalle del viaje." };
  }
  if (!data) return { error: "Viaje no encontrado." };

  // Nombre de quien lo cargó (created_by es un uuid de usuarios).
  let creadoPor: string | null = null;
  if (data.created_by) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: u } = await (supabase as any)
      .from("usuarios")
      .select("nombre, apellido")
      .eq("id", data.created_by)
      .maybeSingle();
    if (u) creadoPor = [u.apellido, u.nombre].filter(Boolean).join(", ") || null;
  }

  return {
    chofer: data.chofer ?? null,
    camion: data.camion ?? null,
    tipoCarga: data.tipo_carga?.nombre ?? null,
    rutaVia: data.ruta_via ?? null,
    createdAt: data.created_at ?? null,
    updatedAt: data.updated_at ?? null,
    creadoPor,
  };
}
