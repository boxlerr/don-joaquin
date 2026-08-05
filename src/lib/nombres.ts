/**
 * Formato parejo para nombres de personas.
 *
 * En la misma lista conviven "CEPEDA, TOMAS ARIEL" y "Acosta, Pablo Maximo" según
 * cómo lo haya tipeado quien cargó el legajo (o de qué Excel vino). Normalizamos a
 * inicial mayúscula + resto en minúscula para que la planilla diaria, el ranking y
 * los exports se lean como una sola lista.
 *
 * Sólo cambia la CAJA de las letras: nunca saca acentos ni reescribe el nombre. Un
 * apellido mal escrito sigue mal escrito a propósito — eso se corrige en el legajo,
 * no en silencio acá.
 */

/** Partículas de apellido compuesto: van en minúscula salvo que abran el nombre
 *  ("De Libano" si arranca, pero "Ramos de la Cruz" en el medio). */
const PARTICULAS = new Set([
  "de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos",
  "di", "du", "le", "van", "von", "der", "den",
]);

const SEPARADORES = /([-'’])/;

function capitalizar(token: string): string {
  if (!token) return token;
  // Inicial suelta ("J." o "N"): se deja en mayúscula, no es una palabra.
  if (token.replace(/\./g, "").length === 1) return token.toLocaleUpperCase("es-AR");
  return (
    token.charAt(0).toLocaleUpperCase("es-AR") +
    token.slice(1).toLocaleLowerCase("es-AR")
  );
}

/** "TOMAS ARIEL" → "Tomas Ariel" · "prueba" → "Prueba" · "o'brien" → "O'Brien". */
export function formatNombrePersona(valor: string | null | undefined): string {
  if (!valor) return "";
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio) return "";

  return limpio
    .split(" ")
    .map((palabra, i) => {
      const plano = palabra.toLocaleLowerCase("es-AR");
      if (i > 0 && PARTICULAS.has(plano)) return plano;
      // Compuestos con guion o apóstrofo: cada parte lleva su mayúscula.
      return palabra
        .split(SEPARADORES)
        .map((t) => (SEPARADORES.test(t) ? t : capitalizar(t)))
        .join("");
    })
    .join(" ");
}

/** "Apellido, Nombre" normalizado — el formato con el que se listan los choferes. */
export function nombreCompletoPersona(
  apellido: string | null | undefined,
  nombre: string | null | undefined,
): string {
  return [formatNombrePersona(apellido), formatNombrePersona(nombre)]
    .filter(Boolean)
    .join(", ");
}

/** Texto comparable para buscar: sin acentos y en minúscula, así "Asteazarán"
 *  aparece tecleando "asteazaran". */
export function normalizarParaBuscar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-AR")
    .trim();
}
