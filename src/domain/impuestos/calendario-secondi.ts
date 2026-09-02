/**
 * El calendario de vencimientos que manda el estudio contable (Secondi).
 *
 * Es un PDF de una carilla, siempre el mismo: título, la razón social, el CUIT,
 * y una tabla de dos columnas —impuesto y vencimiento— con entre 3 y 15 filas.
 * Llega uno por empresa y por mes, y hasta ahora se copiaba a mano fila por fila
 * en /impuestos (26 filas cargadas así entre junio y septiembre de 2026).
 *
 * Dos cosas que parecen obvias y no lo son:
 *
 *  * **El texto del PDF NO viene en el orden en que se lee.** `unpdf` devuelve
 *    los objetos de texto en el orden del archivo, no el visual: en el PDF de
 *    Joaquín Nicolás del 02/09/2026, "CALENDARIO DE VENCIMIENTOS" y la razón
 *    social salen ÚLTIMAS, después del pie con la dirección del estudio. Por eso
 *    acá no se lee "la línea 2" nunca: cada dato se busca por lo que es.
 *  * **Dos empresas comparten los nombres de impuesto.** "IVA" y "Ingresos
 *    Brutos - CM03" están en los dos calendarios, con fechas distintas (el 18 y
 *    el 24 de septiembre de 2026). Sin la razón social y el CUIT, importar el
 *    segundo PDF es pisar o duplicar el primero, así que el parser los devuelve
 *    aunque el pedido sea sólo "las fechas".
 *
 * Función pura sobre el texto ya extraído: el PDF lo abre la server action. Así
 * los casos borde se prueban con un string y no con un archivo binario.
 */

export type FilaCalendario = {
  /** Nombre del impuesto TAL CUAL lo escribió el estudio, sin normalizar. */
  nombre: string;
  /** Vencimiento en ISO (YYYY-MM-DD). */
  fechaVencimiento: string;
};

export type CalendarioSecondi = {
  /** Ej. "JOAQUIN NICOLAS". `null` si el PDF no la trae donde se la espera. */
  razonSocial: string | null;
  /** Normalizado a `20-26402739-0`. `null` si no aparece. */
  cuit: string | null;
  filas: FilaCalendario[];
  /** Lo que se descartó o no se pudo leer. Se muestra en la vista previa. */
  advertencias: string[];
};

const TITULO = "CALENDARIO DE VENCIMIENTOS";

/**
 * Encabezados de la tabla y del documento. Se listan para no confundirlos con la
 * razón social: en el PDF de prueba la línea que sigue al título es la razón
 * social, pero en un calendario de más filas puede caer cualquier otra cosa.
 */
const ENCABEZADOS = [TITULO, "IMPUESTO VENCIMIENTO", "IMPUESTO", "VENCIMIENTO", "CUIT"];

/** `20264027390`, `20-26402739-0` y `20 26402739 0` son el mismo CUIT. */
function normalizarCuit(digitos: string): string {
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

/**
 * dd/mm/aaaa → ISO, validando que la fecha EXISTA.
 *
 * `new Date(2026, 12, 32)` no falla: se corre a enero del año siguiente. Un
 * "31/09/2026" mal tipeado por el estudio entraría como 1 de octubre y el aviso
 * saldría un día tarde sin que nadie lo note, así que se compara contra lo que
 * se pidió y si no coincide se descarta.
 */
export function fechaArgentinaAIso(texto: string): string | null {
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(anio, mes - 1, d);
  if (dt.getFullYear() !== anio || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function esEncabezado(linea: string): boolean {
  const l = linea.toUpperCase();
  return ENCABEZADOS.some((e) => l === e);
}

/**
 * Saca del nombre del impuesto lo que en realidad es encabezado del documento.
 *
 * Hace falta cuando el PDF viene sin renglones: ahí la primera fila llega como
 * "CUIT 20-26402739-0 IMPUESTO VENCIMIENTO Ingresos Brutos - CM03", y descartar
 * la línea entera por empezar con "CUIT" se comía justo el primer vencimiento.
 * Se saca sólo del PRINCIPIO y sólo si queda algo detrás.
 */
function limpiarNombre(nombre: string): string {
  let n = nombre.trim();
  const prefijos = [/^CUIT\s+\d{2}[-\s.]?\d{8}[-\s.]?\d\s*/i, ...ENCABEZADOS
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((e) => new RegExp(`^${e}\\s+`, "i"))];
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const re of prefijos) {
      const sig = n.replace(re, "").trim();
      if (sig !== n && sig !== "") {
        n = sig;
        cambio = true;
      }
    }
  }
  return n;
}

export function parseCalendarioSecondi(texto: string): CalendarioSecondi {
  const advertencias: string[] = [];
  // Cortar DESPUÉS de cada fecha, además de por los saltos de línea. El mismo
  // `unpdf` devuelve el mismo PDF de dos formas según cómo se lo llame: con
  // `mergePages: false` respeta los renglones, y con `true` los pega todos en
  // una sola línea separados por espacios. Sin este corte, esa segunda forma
  // devuelve cero filas y el importador dice "¿es el calendario del estudio?"
  // sobre el archivo correcto (pasó el 02/09/2026, contra el PDF de Nicolás).
  const lineas = texto
    .replace(/(\d{1,2}\/\d{1,2}\/\d{4})\s+/g, "$1\n")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lineas.length === 0) {
    return {
      razonSocial: null,
      cuit: null,
      filas: [],
      advertencias: [
        "El PDF no tiene texto: puede ser un escaneo o una foto. Pedile al estudio el archivo original, o cargá las fechas a mano.",
      ],
    };
  }

  // --- CUIT ---------------------------------------------------------------
  let cuit: string | null = null;
  let lineaCuit = -1;
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i]!.match(/\b(\d{2})[-\s.]?(\d{8})[-\s.]?(\d)\b/);
    if (m) {
      cuit = normalizarCuit(`${m[1]}${m[2]}${m[3]}`);
      lineaCuit = i;
      break;
    }
  }

  // --- Razón social -------------------------------------------------------
  // Primero la línea que sigue al título; si ahí no hay nada usable (porque el
  // título quedó último, que es lo que pasa hoy), la de arriba del CUIT.
  let razonSocial: string | null = null;
  // Cuando el título y el nombre quedaron pegados en la misma línea (ver el
  // corte de arriba), la razón social es lo que sigue al título.
  const pegada = texto.match(new RegExp(`${TITULO}\\s+(.+?)\\s*$`, "i"));
  if (pegada?.[1]) razonSocial = pegada[1].replace(/\s+/g, " ").trim();

  if (!razonSocial) {
    const iTitulo = lineas.findIndex((l) => l.toUpperCase().includes(TITULO));
    const candidatas = [iTitulo >= 0 ? iTitulo + 1 : -1, lineaCuit - 1];
    for (const i of candidatas) {
      const l = i >= 0 ? lineas[i] : undefined;
      if (!l || esEncabezado(l) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(l)) continue;
      if (/^\d/.test(l)) continue; // dirección o teléfono del pie
      razonSocial = l;
      break;
    }
  }
  if (!razonSocial) {
    advertencias.push("No se pudo leer la razón social del PDF: elegila o escribila a mano.");
  }

  // --- Filas --------------------------------------------------------------
  // Una fila es cualquier línea que TERMINE en una fecha: lo de adelante es el
  // nombre del impuesto. Se busca así y no por posición porque los nombres traen
  // espacios, guiones y sus propias fechas ("SICORE pago 2da. Q 05-2026"), y
  // porque el pie del estudio —dirección, teléfono, mail— no termina en fecha y
  // se descarta solo.
  const filas: FilaCalendario[] = [];
  for (const linea of lineas) {
    if (esEncabezado(linea)) continue;
    const m = linea.match(/^(.*?)\s+(\d{1,2}\/\d{1,2}\/\d{4})$/);
    if (!m) continue;

    const nombre = limpiarNombre(m[1]!);
    const iso = fechaArgentinaAIso(m[2]!);
    if (!nombre) {
      advertencias.push(`Se descartó una fila sin nombre de impuesto: "${linea}".`);
      continue;
    }
    if (!iso) {
      advertencias.push(`"${nombre}": la fecha ${m[2]} no existe en el calendario. Cargala a mano.`);
      continue;
    }
    filas.push({ nombre, fechaVencimiento: iso });
  }

  if (filas.length === 0) {
    advertencias.push(
      "No se encontró ninguna fila con formato «impuesto + fecha». ¿Es el calendario del estudio?",
    );
  }

  return { razonSocial, cuit, filas, advertencias };
}
