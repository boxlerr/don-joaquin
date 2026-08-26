/**
 * Leer un mensaje del taller escrito como se escribe en WhatsApp.
 *
 * Pedido de Bárbara y Julián (24/08/2026). Hoy el herrero reporta cada trabajo
 * en un grupo de WhatsApp y ahí muere. La restricción que manda sobre todo el
 * diseño la puso ella: *"que lo cargue una persona que no tiene un pato en
 * fila… cero habilidades con la compu"*.
 *
 * Por eso la pantalla no pide campos: pide **una foto y un texto**, igual que el
 * grupo. Este archivo es lo que convierte ese texto en datos.
 *
 * **El formato no lo inventamos: es el de ellos.** De las capturas del grupo
 * "Costos insumos":
 *
 *     *Refuerzo en balancín          Emilio Ramos
 *     *AF-112-ON                     Cambio de hoja cortada Eje n 5
 *     Sola y Brusa 3 Ejes            *AE-576-DK
 *     *Albornoz Matías
 *
 * Sin orden fijo, con asteriscos de viñeta, la patente a veces con guiones y a
 * veces sin. Y aparte llevan un correlativo de cubiertas dadas de baja
 * ("27 bajas", "28 bajas") que hoy no existe en el sistema.
 *
 * Lo que se lee se MUESTRA para confirmar, nunca se guarda a ciegas: si el
 * parser se equivoca, quien carga lo ve antes de mandar. Un dato adivinado en
 * silencio es peor que un campo vacío.
 */

import { normalizarTexto } from "@/lib/texto";

export type UnidadTaller = {
  id: string;
  patente: string;
  tipo: "camion" | "acoplado";
};

export type PersonaTaller = {
  id: string;
  nombre: string;
  apellido: string;
};

export type Lectura = {
  /** Lo que se hizo, sin la patente ni el nombre de la persona. */
  descripcion: string;
  unidad: UnidadTaller | null;
  /** Se escribió algo con forma de patente que no está en el sistema. */
  patenteDesconocida: string | null;
  persona: PersonaTaller | null;
  /** El correlativo del grupo: "28 bajas" → 28. */
  bajas: number | null;
};

/**
 * Patentes argentinas, en los dos formatos que conviven:
 *  · Mercosur (desde 2016) — AA 999 AA. Es el de todas las capturas.
 *  · Viejo — AAA 999.
 * Los separadores son libres porque en el grupo aparecen de las dos formas.
 */
const RE_MERCOSUR = /\b([A-Za-z]{2})[\s.-]?(\d{3})[\s.-]?([A-Za-z]{2})\b/g;
const RE_VIEJA = /\b([A-Za-z]{3})[\s.-]?(\d{3})\b/g;

/** Sin espacios, guiones ni puntos, y en mayúsculas: "AE-576-DK" → "AE576DK". */
export function normalizarPatente(txt: string): string {
  return txt.replace(/[\s.-]/g, "").toUpperCase();
}

/** El correlativo de bajas. Cuenta "28 bajas", NO "Baja 2 x línea". */
export function leerBajas(texto: string): number | null {
  const m = /(\d{1,4})\s*bajas?\b/i.exec(texto);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Todas las cadenas con forma de patente que aparecen en el texto. */
export function patentesEn(texto: string): string[] {
  const out: string[] = [];
  for (const re of [RE_MERCOSUR, RE_VIEJA]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) out.push(m[0]);
  }
  return out;
}

/**
 * Las formas en que puede aparecer escrita una persona. Se prueban de la más
 * específica a la menos: "Albornoz Matías" antes que sólo "Albornoz", porque
 * con dos hermanos en la lista el apellido solo no alcanza para elegir.
 */
function variantes(p: PersonaTaller): string[] {
  const n = normalizarTexto(p.nombre).trim();
  const a = normalizarTexto(p.apellido).trim();
  const v: string[] = [];
  if (n && a) v.push(`${a} ${n}`, `${n} ${a}`);
  if (a) v.push(a);
  if (n && !a) v.push(n);
  return v;
}

/**
 * Busca a la persona nombrada en el texto.
 *
 * Un apellido que le corresponde a más de uno NO elige a ninguno: es preferible
 * dejarlo en blanco y que lo completen a mano que atribuirle el trabajo al
 * hermano equivocado.
 */
export function buscarPersona(
  texto: string,
  personas: PersonaTaller[],
): { persona: PersonaTaller | null; texto: string } {
  const norm = normalizarTexto(texto);

  type Cand = { persona: PersonaTaller; forma: string; largo: number };
  const candidatos: Cand[] = [];
  for (const p of personas) {
    for (const forma of variantes(p)) {
      if (forma && norm.includes(forma)) {
        candidatos.push({ persona: p, forma, largo: forma.length });
        break; // la primera variante es la más específica que matcheó
      }
    }
  }
  if (candidatos.length === 0) return { persona: null, texto };

  // Gana la coincidencia más larga: "Albornoz Matías" le gana a "Albornoz".
  candidatos.sort((a, b) => b.largo - a.largo);
  const mejor = candidatos[0]!;
  const empatados = candidatos.filter((c) => c.largo === mejor.largo);
  if (empatados.length > 1 && new Set(empatados.map((c) => c.persona.id)).size > 1) {
    return { persona: null, texto };
  }

  // Se saca el nombre del texto para que no quede repetido en la descripción.
  const limpio = quitarFrase(texto, mejor.forma);
  return { persona: mejor.persona, texto: limpio };
}

/**
 * Quita una frase del texto comparando SIN acentos, pero cortando sobre el
 * original: normalizar y devolver el normalizado le sacaría los acentos a la
 * descripción, y eso lo lee una persona.
 */
function quitarFrase(texto: string, fraseNorm: string): string {
  const norm = normalizarTexto(texto);
  const i = norm.indexOf(fraseNorm);
  if (i < 0) return texto;
  // `normalizarTexto` no cambia la cantidad de caracteres (sólo acentos y
  // mayúsculas), así que los índices sirven sobre el original.
  return (texto.slice(0, i) + " " + texto.slice(i + fraseNorm.length)).trim();
}

/** Limpia viñetas, espacios de más y líneas vacías, y junta en una sola línea. */
export function limpiarDescripcion(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s*\-–—•]+/, "").replace(/[\s*]+$/, "").trim())
    .filter(Boolean)
    .join(". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Lee el mensaje completo.
 *
 * El orden importa: primero la patente y el correlativo (que son inequívocos),
 * después la persona, y lo que sobra es la descripción. Al revés, el nombre de
 * un chofer podría comerse parte de la patente.
 */
export function leerMensaje(
  texto: string,
  unidades: UnidadTaller[],
  personas: PersonaTaller[],
): Lectura {
  let resto = texto ?? "";

  const bajas = leerBajas(resto);

  // ── Patente ───────────────────────────────────────────────────────────────
  const porPatente = new Map<string, UnidadTaller>();
  for (const u of unidades) porPatente.set(normalizarPatente(u.patente), u);

  let unidad: UnidadTaller | null = null;
  let patenteDesconocida: string | null = null;

  for (const cruda of patentesEn(resto)) {
    const norm = normalizarPatente(cruda);
    const encontrada = porPatente.get(norm);
    if (encontrada) {
      unidad = encontrada;
      resto = resto.replace(cruda, " ");
      break;
    }
    // Se recuerda la primera con forma válida que no está en el sistema, para
    // poder avisar "esa patente no la tenemos" en vez de ignorarla en silencio.
    if (!patenteDesconocida) patenteDesconocida = norm;
  }

  if (!unidad && patenteDesconocida) {
    const cruda = patentesEn(resto).find((c) => normalizarPatente(c) === patenteDesconocida);
    if (cruda) resto = resto.replace(cruda, " ");
  }

  // ── Persona ───────────────────────────────────────────────────────────────
  const { persona, texto: sinPersona } = buscarPersona(resto, personas);
  resto = sinPersona;

  // ── Lo que queda ──────────────────────────────────────────────────────────
  // El correlativo se deja escrito en la descripción a propósito: es como lo
  // anotan ellos y sacarlo haría que el mensaje guardado no se parezca al que
  // escribieron.
  const descripcion = limpiarDescripcion(resto);

  return { descripcion, unidad, patenteDesconocida: unidad ? null : patenteDesconocida, persona, bajas };
}
