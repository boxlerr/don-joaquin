"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";

/**
 * Los "días pedidos": el turno médico, el trámite del carnet, el dentista.
 *
 * Pedido de Bárbara (audio del 10/08): hoy esos días no se registran en ningún
 * lado, y eso rompe dos cosas a la vez —
 *   "Primero, para que quede registrado: che flaco, vos me pediste el mes pasado
 *    cuatro días. Y segundo, de nada sirve que Nico sepa que tiene 5 choferes
 *    menos por vacaciones si yo después le clavo 7 que tienen turnos y no le
 *    aviso. No está anotado, y es un chofer menos igual."
 *
 * No hace falta tabla nueva: `chofer_ausencias` ya distingue vacaciones del
 * resto con `es_vacaciones`. Hoy las 170 ausencias cargadas son todas vacaciones
 * justamente porque no había por dónde cargar las otras.
 */

export type ChoferParaDiaPedido = {
  id: string;
  nombre: string;
  apellido: string;
};

/** Choferes activos, para el selector del alta rápida. */
export async function getChoferesParaDiaPedidoAction(): Promise<ChoferParaDiaPedido[]> {
  await requireSeccion("choferes", "read");
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, estado")
    .eq("estado", "activo")
    .order("apellido");

  return ((data ?? []) as ChoferParaDiaPedido[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
  }));
}

/**
 * Cuántos días pidió un chofer en el año (sin contar vacaciones).
 *
 * Es la mitad "para que quede registrado" del pedido: al cargar el día siguiente,
 * quien lo autoriza ve de una cuántos lleva. El conteo es inclusivo, igual que
 * en vacaciones: del 30/07 al 02/08 son 4 días.
 */
export async function getDiasPedidosAnioAction(
  chofer_id: string,
  anio: number,
): Promise<{ dias: number; veces: number }> {
  await requireSeccion("choferes", "read");
  const supabase = createAdminClient();
  if (!chofer_id) return { dias: 0, veces: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("chofer_ausencias")
    .select("fecha_inicio, fecha_fin")
    .eq("chofer_id", chofer_id)
    .eq("es_vacaciones", false)
    .is("deleted_at", null)
    .neq("estado", "cancelada")
    .gte("fecha_inicio", `${anio}-01-01`)
    .lte("fecha_inicio", `${anio}-12-31`);

  const filas = (data ?? []) as { fecha_inicio: string; fecha_fin: string }[];
  const dias = filas.reduce((acc, f) => {
    const a = new Date(`${f.fecha_inicio}T00:00:00`).getTime();
    const b = new Date(`${f.fecha_fin || f.fecha_inicio}T00:00:00`).getTime();
    return acc + Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  }, 0);

  return { dias, veces: filas.length };
}
