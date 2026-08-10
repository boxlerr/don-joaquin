// Filtros del listado de Legajos.
//
// Todo lo que decide QUÉ se ve vive acá y es puro: la barra de filtros sólo
// dibuja y avisa qué se tocó. Así el orden por urgencia, los accesos rápidos y
// el popover de filtros avanzados se pueden probar sin montar media pantalla.

import { getLegajoEstado, type ChoferValidable } from "@/lib/chofer-validation";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type RolReal = "chofer" | "administrativo" | "mantenimiento" | "fletero";
export type RolFilter = "todos" | RolReal;
export type EstadoFilter = "todos" | "activo" | "inactivo" | "baja" | "periodo_prueba";

export type OrdenFilter =
  | "apellido_az"
  | "apellido_za"
  | "antiguedad_asc"
  | "antiguedad_desc"
  | "documentos"
  | "legajo";

/** Accesos rápidos de la fila "Vista rápida". Se acumulan: activarlos angosta. */
export type QuickFilter =
  | "activos"
  | "por_vencer"
  | "vencidos"
  | "sin_documentos"
  | "sin_localidad"
  | "sin_telefono";

export const QUICK_FILTERS: QuickFilter[] = [
  "activos",
  "por_vencer",
  "vencidos",
  "sin_documentos",
  "sin_localidad",
  "sin_telefono",
];

export type CamionFiltro = "todos" | "con" | "sin";
export type AntiguedadFiltro = "todas" | "menos_1" | "1_5" | "5_10" | "mas_10";
export type LegajoFiltro = "todos" | "completo" | "incompleto";

/** Lo que vive dentro del popover de "Filtros avanzados". */
export type FiltrosAvanzados = {
  localidades: string[];
  marcas: string[];
  camion: CamionFiltro;
  antiguedad: AntiguedadFiltro;
  legajo: LegajoFiltro;
};

export const FILTROS_AVANZADOS_VACIOS: FiltrosAvanzados = {
  localidades: [],
  marcas: [],
  camion: "todos",
  antiguedad: "todas",
  legajo: "todos",
};

/**
 * Cómo está la documentación de una persona. La arma la página agrupando la
 * vista de vigencia: acá interesa distinguir "todo al día" de "no hay ni un
 * documento cargado", que sin el total se ven exactamente igual.
 */
export type DocsResumen = {
  total: number;
  vencidos: number;
  porVencer: number;
  alDia: number;
};

export const DOCS_VACIO: DocsResumen = { total: 0, vencidos: 0, porVencer: 0, alDia: 0 };

/** Una persona del listado. Viene de la fila de `choferes` más el camión de hoy. */
export type ChoferListado = ChoferValidable & {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  estado: string;
  rol?: string | null;
  camion_patente?: string | null;
  camion_marca?: string | null;
  camion_modelo?: string | null;
  [key: string]: unknown;
};

/** El estado completo de la barra de filtros. Lo guarda y restaura "Guardado reciente". */
export type EstadoFiltros = {
  rol: RolFilter;
  estado: EstadoFilter;
  orden: OrdenFilter;
  query: string;
  rapidos: QuickFilter[];
  avanzados: FiltrosAvanzados;
};

export const FILTROS_VACIOS: EstadoFiltros = {
  rol: "todos",
  estado: "todos",
  orden: "apellido_az",
  query: "",
  rapidos: [],
  avanzados: FILTROS_AVANZADOS_VACIOS,
};

// ── Etiquetas ────────────────────────────────────────────────────────────────

export const ROL_LABELS: Record<RolFilter, string> = {
  todos: "Todos",
  chofer: "Choferes",
  administrativo: "Administración",
  mantenimiento: "Mantenimiento",
  fletero: "Fleteros",
};

/** Singular, para cuando se nombra a UNA persona (la columna "Área" de la tabla). */
export const ROL_LABEL_SINGULAR: Record<RolReal, string> = {
  chofer: "Chofer",
  administrativo: "Administración",
  mantenimiento: "Mantenimiento",
  fletero: "Fletero",
};

export const ROLES: RolFilter[] = ["todos", "chofer", "administrativo", "mantenimiento", "fletero"];

export const ORDEN_LABEL: Record<OrdenFilter, string> = {
  apellido_az: "Apellido (A–Z)",
  apellido_za: "Apellido (Z–A)",
  antiguedad_asc: "Antigüedad (más antiguo primero)",
  antiguedad_desc: "Antigüedad (más reciente primero)",
  documentos: "Documentación (más urgente primero)",
  legajo: "Legajo (incompletos primero)",
};

export const ORDENES: OrdenFilter[] = [
  "apellido_az",
  "apellido_za",
  "antiguedad_asc",
  "antiguedad_desc",
  "documentos",
  "legajo",
];

export const ESTADO_LABEL: Record<EstadoFilter, string> = {
  todos: "Todos los estados",
  activo: "Activo",
  inactivo: "Inactivo",
  periodo_prueba: "En período de prueba",
  baja: "Egresado",
};

export const ESTADOS: EstadoFilter[] = ["todos", "activo", "inactivo", "periodo_prueba", "baja"];

export const ANTIGUEDAD_LABEL: Record<AntiguedadFiltro, string> = {
  todas: "Cualquiera",
  menos_1: "Menos de 1 año",
  "1_5": "De 1 a 5 años",
  "5_10": "De 5 a 10 años",
  mas_10: "Más de 10 años",
};

export const CAMION_LABEL: Record<CamionFiltro, string> = {
  todos: "Indistinto",
  con: "Con camión asignado",
  sin: "Sin camión asignado",
};

export const LEGAJO_LABEL: Record<LegajoFiltro, string> = {
  todos: "Indistinto",
  completo: "Completo",
  incompleto: "Incompleto",
};

// ── Utilidades de datos ──────────────────────────────────────────────────────

export const rolDe = (c: { rol?: unknown }): RolReal => {
  const r = typeof c.rol === "string" ? c.rol : "chofer";
  return r === "administrativo" || r === "mantenimiento" || r === "fletero" ? r : "chofer";
};

const PRUEBA_MESES = 6;

export function enPeriodoPrueba(fechaIngreso?: string | null): boolean {
  if (!fechaIngreso) return false;
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return false;
  const fin = new Date(ingreso);
  fin.setMonth(fin.getMonth() + PRUEBA_MESES);
  return Date.now() < fin.getTime();
}

/** Timestamp de ingreso, o null si falta/inválido (van al final en orden por antigüedad). */
export function tsIngreso(c: { fecha_ingreso?: string | null }): number | null {
  if (!c.fecha_ingreso) return null;
  const t = new Date(c.fecha_ingreso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Años cumplidos desde el ingreso, o null si no hay fecha. */
export function aniosEnLaEmpresa(fechaIngreso?: string | null, hoy = new Date()): number | null {
  const t = tsIngreso({ fecha_ingreso: fechaIngreso });
  if (t == null) return null;
  const ingreso = new Date(t);
  let anios = hoy.getFullYear() - ingreso.getFullYear();
  const m = hoy.getMonth() - ingreso.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < ingreso.getDate())) anios -= 1;
  return Math.max(0, anios);
}

const vacio = (v: unknown) => v == null || String(v).trim() === "";

/** Una opción de filtro con cuánta gente cae en ella. */
export type Opcion = { valor: string; label: string; n: number };

/**
 * Las opciones de un filtro salen de lo que hay cargado, nunca de una lista
 * nuestra: así no se ofrece filtrar por una localidad en la que no vive nadie.
 * Van con el conteo al lado porque "Azul 13" ya dice si vale la pena tocarlo.
 */
export function opcionesDe<T>(
  items: T[],
  valor: (item: T) => string | null | undefined,
): Opcion[] {
  const conteo = new Map<string, number>();
  for (const it of items) {
    const v = valor(it);
    if (vacio(v)) continue;
    const k = String(v).trim();
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return Array.from(conteo.entries())
    .map(([valor, n]) => ({ valor, label: valor, n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
}

// ── Filtros ──────────────────────────────────────────────────────────────────

/**
 * Cuántos filtros avanzados están puestos. Es el número del globito del botón:
 * cuenta grupos, no valores, porque el usuario piensa "tengo dos filtros", no
 * "tengo cinco localidades".
 */
export function contarAvanzados(f: FiltrosAvanzados): number {
  let n = 0;
  if (f.localidades.length > 0) n++;
  if (f.marcas.length > 0) n++;
  if (f.camion !== "todos") n++;
  if (f.antiguedad !== "todas") n++;
  if (f.legajo !== "todos") n++;
  return n;
}

export function pasaAvanzados(c: ChoferListado, f: FiltrosAvanzados): boolean {
  if (f.localidades.length > 0) {
    const loc = (c.localidad ?? "").trim();
    if (!f.localidades.includes(loc)) return false;
  }
  if (f.marcas.length > 0) {
    const marca = (c.camion_marca ?? "").trim();
    if (!f.marcas.includes(marca)) return false;
  }
  if (f.camion === "con" && vacio(c.camion_patente)) return false;
  if (f.camion === "sin" && !vacio(c.camion_patente)) return false;

  if (f.antiguedad !== "todas") {
    const anios = aniosEnLaEmpresa(c.fecha_ingreso);
    // Sin fecha de ingreso no se puede saber la antigüedad: al filtrar por un
    // tramo, quien no la tiene cargada queda afuera (no se le inventa un tramo).
    if (anios == null) return false;
    if (f.antiguedad === "menos_1" && anios >= 1) return false;
    if (f.antiguedad === "1_5" && (anios < 1 || anios >= 5)) return false;
    if (f.antiguedad === "5_10" && (anios < 5 || anios >= 10)) return false;
    if (f.antiguedad === "mas_10" && anios < 10) return false;
  }

  if (f.legajo !== "todos") {
    const completo = getLegajoEstado(c).completo;
    if (f.legajo === "completo" && !completo) return false;
    if (f.legajo === "incompleto" && completo) return false;
  }

  return true;
}

/**
 * Si una persona pasa UN acceso rápido. Varios activos se acumulan (todos tienen
 * que dar).
 *
 * Los egresados quedan afuera de TODOS: son pendientes de carga ("le falta el
 * teléfono", "tiene un documento vencido") y a alguien que ya se fue no se le
 * reclama nada. Además el número del chip tiene que coincidir con lo que se ve, y
 * los egresados viven en una sección aparte que arranca colapsada.
 */
export function pasaRapido(c: ChoferListado, q: QuickFilter, docs: DocsResumen): boolean {
  if (c.estado === "baja") return false;
  switch (q) {
    case "activos":
      return c.estado === "activo";
    case "vencidos":
      return docs.vencidos > 0;
    case "por_vencer":
      return docs.porVencer > 0;
    case "sin_documentos":
      return docs.total === 0;
    case "sin_localidad":
      return vacio(c.localidad);
    case "sin_telefono":
      return vacio(c.telefono);
  }
}

export function pasaEstado(c: ChoferListado, estado: EstadoFilter): boolean {
  if (estado === "todos") return true;
  if (estado === "periodo_prueba") {
    return c.estado !== "baja" && enPeriodoPrueba(c.fecha_ingreso);
  }
  return c.estado === estado;
}

// ── Orden ────────────────────────────────────────────────────────────────────

/**
 * Cuánto reclama atención la documentación de alguien.
 *
 * Son bandas, no una suma: un solo vencido tiene que ganarle a cualquier
 * cantidad de "por vencer", y no tener NINGÚN documento cargado va arriba de
 * quien está al día pero abajo de un vencimiento real. Sumando sin bandas,
 * "1 por vencer" y "sin ningún documento" empataban.
 */
export function urgenciaDocs(docs: DocsResumen): number {
  if (docs.total === 0) return 1; // sin nada cargado
  if (docs.vencidos > 0) return 1_000_000 + docs.vencidos * 1000 + docs.porVencer;
  if (docs.porVencer > 0) return 1_000 + docs.porVencer;
  return 0; // todo al día
}

/**
 * Lo que falta cargar. Los bloqueantes (los que impiden asignar a la persona)
 * pesan diez veces más que los recomendados.
 */
export function urgenciaLegajo(c: ChoferListado): number {
  const e = getLegajoEstado(c);
  return e.faltantes.length * 10 + e.faltantesRecomendados.length;
}

export function ordenar(
  lista: ChoferListado[],
  orden: OrdenFilter,
  docsDe: (id: string) => DocsResumen,
): ChoferListado[] {
  const cmpApellido = (a: ChoferListado, b: ChoferListado) =>
    `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es", {
      sensitivity: "base",
    });

  const arr = [...lista];
  arr.sort((a, b) => {
    if (orden === "apellido_az") return cmpApellido(a, b);
    if (orden === "apellido_za") return -cmpApellido(a, b);
    if (orden === "documentos")
      return urgenciaDocs(docsDe(b.id)) - urgenciaDocs(docsDe(a.id)) || cmpApellido(a, b);
    if (orden === "legajo") return urgenciaLegajo(b) - urgenciaLegajo(a) || cmpApellido(a, b);
    const ta = tsIngreso(a);
    const tb = tsIngreso(b);
    if (ta == null && tb == null) return cmpApellido(a, b);
    if (ta == null) return 1; // sin fecha → al final
    if (tb == null) return -1;
    return (orden === "antiguedad_asc" ? ta - tb : tb - ta) || cmpApellido(a, b);
  });
  return arr;
}

/** Cuántas cosas están angostando la lista. El orden no "filtra", así que no cuenta. */
export function contarFiltros(f: EstadoFiltros): number {
  let n = contarAvanzados(f.avanzados) + f.rapidos.length;
  if (f.rol !== "todos") n++;
  if (f.estado !== "todos") n++;
  if (f.query.trim() !== "") n++;
  return n;
}

/** Si hay algo puesto además del orden. */
export function hayFiltros(f: EstadoFiltros): boolean {
  return contarFiltros(f) > 0;
}

/**
 * Normaliza lo que vuelve de `localStorage`. Una búsqueda guardada con la forma
 * de una versión anterior (sin `avanzados`, sin `rapidos`) reventaba la pantalla
 * entera: el estado entra al render y `f.rapidos.length` tira TypeError. Como no
 * hay número de versión en la clave, la única defensa es no confiar en la forma.
 */
export function normalizarFiltros(raw: unknown): EstadoFiltros {
  const f = (raw ?? {}) as Partial<EstadoFiltros>;
  const a = (f.avanzados ?? {}) as Partial<FiltrosAvanzados>;
  const unoDe = <T extends string>(v: unknown, opciones: readonly T[], porDefecto: T): T =>
    typeof v === "string" && (opciones as readonly string[]).includes(v) ? (v as T) : porDefecto;
  const listaDeTextos = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    rol: unoDe(f.rol, ROLES, "todos"),
    estado: unoDe(f.estado, ESTADOS, "todos"),
    orden: unoDe(f.orden, ORDENES, "apellido_az"),
    query: typeof f.query === "string" ? f.query : "",
    rapidos: listaDeTextos(f.rapidos).filter((q): q is QuickFilter =>
      (QUICK_FILTERS as readonly string[]).includes(q),
    ),
    avanzados: {
      localidades: listaDeTextos(a.localidades),
      marcas: listaDeTextos(a.marcas),
      camion: unoDe(a.camion, ["todos", "con", "sin"] as const, "todos"),
      antiguedad: unoDe(a.antiguedad, ["todas", "menos_1", "1_5", "5_10", "mas_10"] as const, "todas"),
      legajo: unoDe(a.legajo, ["todos", "completo", "incompleto"] as const, "todos"),
    },
  };
}
