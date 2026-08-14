/**
 * Plata escrita como se escribe acá: 4.500.000,50.
 *
 * Los campos de importe eran `<input type="number">`, que muestra el número
 * pelado: la cuota de 116 millones se leía `116181206.2`. Para saber si eso es
 * ciento dieciséis millones o once mil millones hay que contar las cifras con el
 * dedo en la pantalla, y el punto de ese número no es un punto de miles sino la
 * coma de los centavos escrita al revés.
 *
 * Además `type="number"` trae dos cosas que molestan: las flechitas que se
 * pueden tocar sin querer, y que la rueda del mouse cambie el valor mientras se
 * scrollea la página.
 *
 * Acá está la parte que no depende de React: leer lo que se tipeó o se pegó, y
 * volver a escribirlo con los puntos donde van.
 */

/**
 * Lee un importe escrito de cualquiera de las formas que aparecen en la
 * práctica y devuelve el número, o `null` si no hay ninguna cifra.
 *
 * Qué tiene que aguantar:
 *   · lo que se pega del Excel:      `$ 116.181.206,20`
 *   · lo que devuelve la base:       `116181206.2`
 *   · lo que se tipea de apuro:      `4500000`
 *   · el punto del teclado numérico: `4500000.5`
 *
 * La regla del separador decimal: manda el ÚLTIMO punto o coma, y sólo si lo
 * que le sigue son 0, 1 o 2 cifras. Con eso `1.234.567` son un millón y pico
 * (tres cifras después del punto = separador de miles) y `116181206.2` son
 * ciento dieciséis millones con veinte centavos.
 *
 * El caso que no se puede resolver —`4.500` querido como "cuatro con medio"— se
 * resuelve como cuatro mil quinientos, que es lo que significa en castellano.
 */
export function parseMonto(texto: string): number | null {
  const partes = separar(texto);
  if (partes === null) return null;
  const n = Number(`${partes.entera || "0"}.${partes.decimal || "0"}`);
  return Number.isFinite(n) ? n : null;
}

/**
 * El importe listo para meter en un campo: miles con punto y, si tiene
 * centavos, los dos decimales completos.
 *
 * Los centavos se muestran enteros o no se muestran: `116.181.206,2` se lee
 * como si faltara una cifra, y `4.500.000,00` es ruido en una pantalla donde
 * casi ningún importe tiene centavos.
 */
export function formatMonto(n: number): string {
  if (!Number.isFinite(n)) return "";
  const decimales = Math.round(Math.abs(n) * 100) % 100 === 0 ? 0 : 2;
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Lo que se dibuja en el campo mientras se escribe.
 *
 * Se diferencia de `formatMonto(parseMonto(x))` en que respeta el estado a
 * medio tipear: la coma recién puesta se queda (`4.500.000,`) y el `0` que se
 * está por completar no desaparece (`4.500.000,0`). Sin eso, apretar la coma no
 * hace nada visible y hay que adivinar si el campo la tomó.
 */
export function formatMientrasEscribe(texto: string): string {
  const partes = separar(texto);
  if (partes === null) return "";
  const entera = agruparMiles(partes.entera);
  if (partes.decimal === null) return entera;
  return `${entera},${partes.decimal}`;
}

/**
 * Parte un texto en cifras enteras y decimales.
 *
 * `decimal` en `null` es "no se escribió ningún separador"; en `""` es "se
 * escribió la coma pero todavía no los centavos" — la diferencia es la que
 * mantiene viva la coma recién tipeada.
 */
function separar(texto: string): { entera: string; decimal: string | null } | null {
  // Fuera el signo pesos, los espacios (incluido el duro que pega el Excel) y
  // cualquier otra cosa que no sea cifra ni separador.
  const limpio = texto.replace(/[^\d.,]/g, "");
  if (limpio === "") return null;

  const corte = Math.max(limpio.lastIndexOf(","), limpio.lastIndexOf("."));
  const cola = corte === -1 ? "" : limpio.slice(corte + 1).replace(/\D/g, "");
  // La coma escrita una sola vez es siempre la de los centavos —acá nadie separa
  // miles con coma—; el punto, en cambio, sólo cuando lo que sigue son una o dos
  // cifras: tres es el separador de miles de toda la vida.
  const comaUnica = limpio[corte] === "," && limpio.indexOf(",") === corte;
  const esDecimal = corte !== -1 && (comaUnica || cola.length <= 2);

  const entera = (esDecimal ? limpio.slice(0, corte) : limpio).replace(/\D/g, "");
  if (!esDecimal) return { entera, decimal: null };
  return { entera, decimal: cola.slice(0, 2) };
}

/** `116181206` → `116.181.206`. Sin `toLocaleString`: la cadena puede ser larga. */
function agruparMiles(cifras: string): string {
  const sinCeros = cifras.replace(/^0+(?=\d)/, "");
  return sinCeros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
