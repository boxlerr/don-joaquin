import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { armarCalendario, generarFeriadosLey, type Calendario, type Feriado } from "@/lib/feriados";

/**
 * Calendario de feriados listo para preguntar. Se lee una sola vez por request
 * (`cache`), porque lo usan varias pantallas a la vez.
 *
 * Si la tabla no responde o le falta un año, se cae al generador de la Ley
 * 27.399: se pierden los puentes turísticos de ese año, pero nunca se devuelve
 * un calendario vacío — que haría creer que todos los días son hábiles, que es
 * el error caro.
 */
export const getCalendario = cache(async (): Promise<Calendario> => {
  const hoy = new Date().getFullYear();
  const desde = hoy - 1;
  const hasta = hoy + 6;

  let filas: Feriado[] = [];
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("feriados")
      .select("fecha, nombre, tipo, es_feriado, cierra_banco")
      .gte("anio", desde)
      .lte("anio", hasta);
    filas = (data ?? []) as Feriado[];
  } catch (e) {
    console.error("No se pudo leer el calendario de feriados:", e);
  }

  // Respaldo: los años que no vinieron de la tabla se calculan.
  const aniosConDatos = new Set(filas.map((f) => Number(f.fecha.slice(0, 4))));
  for (let a = desde; a <= hasta; a++) {
    if (!aniosConDatos.has(a)) filas.push(...generarFeriadosLey(a));
  }

  return armarCalendario(filas);
});

/** Años que todavía no tienen cargados los días no laborables turísticos. */
export async function aniosSinTuristicos(): Promise<number[]> {
  const hoy = new Date().getFullYear();
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("feriados")
      .select("anio")
      .eq("tipo", "turistico")
      .gte("anio", hoy);
    const con = new Set(((data ?? []) as { anio: number }[]).map((r) => r.anio));
    return [hoy, hoy + 1].filter((a) => !con.has(a));
  } catch {
    return [];
  }
}
