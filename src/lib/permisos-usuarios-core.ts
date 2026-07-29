import { NIVEL_RANK, type AreaNivel } from "@/lib/permisos-nivel";

/**
 * Resolución pura del nivel efectivo de UNA subsección para varios usuarios.
 * Espeja las reglas de `getCurrentUser` (auth.ts) sin tocar la base, para poder
 * testearla: admin tiene todo; una sección confidencial está cerrada salvo que
 * se otorgue; una no confidencial hereda el área y el override de rol solo
 * puede restringir; los overrides por usuario solo suman y respetan `vence_en`.
 */
export type ResolverInput = {
  usuarios: { id: string; rol_id: string | null }[];
  /** rol_id → código del rol (para detectar "admin"). */
  rolCodigo: Map<string, string>;
  esConfidencial: boolean;
  /** rol_id → nivel de la subsección (rol_secciones). */
  nivelPorRolSeccion: Map<string, AreaNivel>;
  /** rol_id → nivel del área a la que pertenece la subsección (rol_areas). */
  nivelPorRolArea: Map<string, AreaNivel>;
  /** usuario_id → nivel de área otorgado a mano y vigente (usuario_areas). */
  extraArea: Map<string, AreaNivel>;
  /** usuario_id → nivel de subsección otorgado a mano y vigente (usuario_secciones). */
  extraSeccion: Map<string, AreaNivel>;
};

export function resolverNivelSeccion(input: ResolverInput, usuarioId: string): AreaNivel {
  const usuario = input.usuarios.find((u) => u.id === usuarioId);
  if (!usuario) return "none";

  const codigo = usuario.rol_id ? input.rolCodigo.get(usuario.rol_id) : undefined;
  if (codigo === "admin") return "admin";

  const ov = usuario.rol_id ? input.nivelPorRolSeccion.get(usuario.rol_id) : undefined;
  let nivel: AreaNivel;

  if (input.esConfidencial) {
    // Cerrada salvo que se otorgue explícitamente (puede darse sin el área).
    nivel = ov ?? "none";
  } else {
    // Hereda el área; el override de rol solo puede restringir, nunca superarla.
    let areaLvl = (usuario.rol_id ? input.nivelPorRolArea.get(usuario.rol_id) : undefined) ?? "none";
    const extra = input.extraArea.get(usuario.id);
    if (extra && NIVEL_RANK[extra] > NIVEL_RANK[areaLvl]) areaLvl = extra;
    nivel = ov && NIVEL_RANK[ov] < NIVEL_RANK[areaLvl] ? ov : areaLvl;
  }

  const extraSec = input.extraSeccion.get(usuario.id);
  if (extraSec && NIVEL_RANK[extraSec] > NIVEL_RANK[nivel]) nivel = extraSec;

  return nivel;
}

/** Ids de los usuarios que llegan a `minNivel` en la subsección. */
export function resolverUsuariosConSeccion(input: ResolverInput, minNivel: AreaNivel): Set<string> {
  const ids = new Set<string>();
  for (const u of input.usuarios) {
    if (NIVEL_RANK[resolverNivelSeccion(input, u.id)] >= NIVEL_RANK[minNivel]) ids.add(u.id);
  }
  return ids;
}

/** Descarta los overrides vencidos y arma el mapa usuario_id → nivel. */
export function mapaOverridesVigentes(
  rows: { usuario_id: string; nivel: AreaNivel; vence_en: string | null }[],
  ahoraMs: number,
): Map<string, AreaNivel> {
  const map = new Map<string, AreaNivel>();
  for (const r of rows) {
    if (r.vence_en && new Date(r.vence_en).getTime() <= ahoraMs) continue;
    map.set(r.usuario_id, r.nivel);
  }
  return map;
}
