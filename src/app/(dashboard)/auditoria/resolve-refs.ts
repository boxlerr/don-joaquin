import { createAdminClient } from "@/lib/supabase/admin";
import type { RefsMap } from "@/lib/audit-catalog";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type RefConfig = { tabla: string; columnas: string; label: (r: Row) => string | null };

// Cómo resolver cada campo *_id que pueda aparecer dentro de un diff de auditoría.
const REF_FIELDS: Record<string, RefConfig> = {
  chofer_id: { tabla: "choferes", columnas: "id, nombre, apellido", label: (r) => `${r.apellido}, ${r.nombre}` },
  camion_id: { tabla: "camiones", columnas: "id, patente", label: (r) => r.patente },
  acoplado_id: { tabla: "acoplados", columnas: "id, patente", label: (r) => r.patente },
  cliente_id: { tabla: "clientes", columnas: "id, razon_social", label: (r) => r.razon_social },
  tipo_servicio_id: { tabla: "tipos_servicio", columnas: "id, nombre", label: (r) => r.nombre },
  tipo_carga_id: { tabla: "tipos_carga", columnas: "id, nombre", label: (r) => r.nombre },
  tipo_documento_id: { tabla: "tipos_documento", columnas: "id, nombre", label: (r) => r.nombre },
  ruta_id: { tabla: "rutas", columnas: "id, codigo_interno, descripcion", label: (r) => r.codigo_interno || r.descripcion },
  origen_id: { tabla: "puntos_ruta", columnas: "id, nombre", label: (r) => r.nombre },
  destino_id: { tabla: "puntos_ruta", columnas: "id, nombre", label: (r) => r.nombre },
  banco_id: { tabla: "bancos", columnas: "id, nombre", label: (r) => r.nombre },
  rol_id: { tabla: "roles", columnas: "id, nombre", label: (r) => r.nombre },
  viaje_id: { tabla: "viajes", columnas: "id, codigo", label: (r) => r.codigo },
  cheque_id: { tabla: "cheques", columnas: "id, numero", label: (r) => (r.numero ? `N° ${r.numero}` : null) },
};

/** Campos que el panel sabe resolver (para no ocultarlos en el diff). */
export const REF_FIELD_KEYS = Object.keys(REF_FIELDS);

type DiffObjs = {
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
};

/**
 * Junta los UUID de campos *_id conocidos que aparecen en los diffs y los
 * resuelve a un nombre legible. Devuelve { campo -> { uuid -> etiqueta } } para
 * que el panel muestre "Grodz, Lucas" en vez del UUID del chofer. Una query por
 * campo, con todos los IDs únicos de la página.
 */
export async function resolverReferencias(
  supabase: SupabaseAdmin,
  entries: DiffObjs[],
): Promise<RefsMap> {
  const idsPorCampo: Record<string, Set<string>> = {};
  for (const e of entries) {
    for (const obj of [e.valores_anteriores, e.valores_nuevos]) {
      if (!obj) continue;
      for (const [campo, valor] of Object.entries(obj)) {
        if (REF_FIELDS[campo] && typeof valor === "string" && valor) {
          (idsPorCampo[campo] ??= new Set()).add(valor);
        }
      }
    }
  }

  const refs: RefsMap = {};
  await Promise.all(
    Object.entries(idsPorCampo).map(async ([campo, ids]) => {
      const cfg = REF_FIELDS[campo];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from(cfg.tabla)
        .select(cfg.columnas)
        .in("id", Array.from(ids));
      const m: Record<string, string> = {};
      for (const r of (data ?? []) as Row[]) {
        const lbl = cfg.label(r);
        if (lbl) m[r.id as string] = lbl;
      }
      refs[campo] = m;
    }),
  );
  return refs;
}
