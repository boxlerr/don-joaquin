// Regla del "próximo período" del Formulario 931.
//
// El F931 (DDJJ de aportes/contribuciones, AFIP) se devenga por mes trabajado y
// se presenta el mes siguiente, con fecha límite alrededor del día 20. La fecha
// exacta de AFIP varía según el CUIT; usamos el día 20 como default editable
// (pedido de Nico: "fecha límite día 20 de cada mes"). Este módulo genera solo el
// período que viene, para no cargarlo a mano cada mes; Nico ajusta la fecha real
// si difiere (ej. el período en curso vence el 13/07, no el 20).

import { logAudit } from "@/lib/audit";

// form931_presentaciones es tabla nueva, aún no está en database.ts → cliente laxo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Devuelve el período (mes devengado) y la fecha límite (día 20) que corresponde
 * tener según la fecha actual: el día 20 de ESTE mes si todavía no pasó; si ya
 * pasó, el día 20 del mes que viene. El período es el mes anterior a esa fecha
 * límite (se trabaja un mes y se presenta el siguiente). Puro y testeable.
 */
export function proximoPeriodoF931(today: Date = new Date()): {
  periodo: string;
  fechaLimite: string;
} {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const day = today.getDate();

  // Fecha límite objetivo (día 20).
  let limYear = y;
  let limMonth = m;
  if (day > 20) {
    limMonth = m + 1;
    if (limMonth > 11) {
      limMonth = 0;
      limYear = y + 1;
    }
  }

  // Período devengado = mes anterior a la fecha límite.
  let pMonth = limMonth - 1;
  let pYear = limYear;
  if (pMonth < 0) {
    pMonth = 11;
    pYear -= 1;
  }

  const mm = (monthIdx0: number) => String(monthIdx0 + 1).padStart(2, "0");
  return {
    periodo: `${pYear}-${mm(pMonth)}`,
    fechaLimite: `${limYear}-${mm(limMonth)}-20`,
  };
}

/**
 * Crea el próximo período del F931 si todavía no existe (idempotente por el
 * `unique (periodo)`). No pisa filas cargadas a mano —ej. el período en curso con
 * su fecha real de AFIP—. `createdBy` = null cuando lo dispara el cron (sin usuario).
 * Best-effort: nunca lanza; loguea y sigue si falla.
 */
export async function ensureProximoForm931(
  supabase: Db,
  createdBy: string | null,
  today: Date = new Date(),
): Promise<{ created: boolean; periodo: string }> {
  const { periodo, fechaLimite } = proximoPeriodoF931(today);

  try {
    const { data: existing } = await supabase
      .from("form931_presentaciones")
      .select("id")
      .eq("periodo", periodo)
      .maybeSingle();
    if (existing?.id) return { created: false, periodo };

    const { data: creado, error } = await supabase
      .from("form931_presentaciones")
      .insert({
        periodo,
        fecha_limite: fechaLimite,
        observaciones:
          "Generado automáticamente. Vencimiento por defecto: día 20 — ajustalo a la fecha real de AFIP si difiere.",
        created_by: createdBy,
      })
      .select("id")
      .single();

    // 23505 = otro proceso lo creó en paralelo → lo tratamos como ya existente.
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("ensureProximoForm931:", error);
      return { created: false, periodo };
    }
    if (error) return { created: false, periodo };

    // Queda asentado en auditoría que el período lo generó el sistema y no una
    // persona: `created_by` guarda a quien abrió la pantalla que lo disparó, así
    // que sin este registro parecía que alguien lo había cargado a mano.
    await logAudit({
      client: supabase,
      usuarioId: null,
      accion: "crear",
      entidadTipo: "form931",
      entidadId: creado?.id ?? null,
      valoresNuevos: { periodo, fecha_limite: fechaLimite },
      metadata: {
        evento: "generado_automaticamente",
        origen: createdBy ? "apertura_de_pantalla" : "cron",
        // Usuario cuya visita disparó la generación (no es quien lo "cargó").
        disparado_por: createdBy,
      },
    });

    return { created: true, periodo };
  } catch (e) {
    console.error("ensureProximoForm931:", e);
    return { created: false, periodo };
  }
}
