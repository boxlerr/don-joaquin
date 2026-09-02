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
 *
 * El contador de días del año se mudó a las acciones del legajo
 * (`getDiasPedidosAnioAction`): el alta rápida y el legajo comparten diálogo, y
 * el dato hace falta en los dos.
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
