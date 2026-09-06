/**
 * A quién le llega el aviso de un vencimiento impositivo.
 *
 * Las alertas de impuestos se guardan como `tipo: "otro"` y sólo se distinguen
 * por `entidad_tipo` (ver lib/alertas-routing.ts). El prefijo de ese campo es lo
 * único que separa "esto lo espera todo el equipo administrativo" de "esto lo
 * ven tres personas", así que se calcula en un solo lugar y con un test al lado:
 * un contribuyente que caiga en el prefijo equivocado manda los datos fiscales
 * de una persona a la casilla de nueve.
 */

/** Columna de la matriz reservada al calendario de una persona física. */
export const COLUMNA_IMPUESTOS_PERSONALES = "impuestos_personales";

/**
 * Prefijo de `entidad_tipo` para el contribuyente. El umbral se le pega detrás
 * (`impuesto:T5`, `impuesto_personal:vencido`) y `alertaColumnaDe` lo resuelve
 * por prefijo.
 *
 * Falla del lado CERRADO: cualquier columna que no sea la pública `impuestos`
 * —una entidad nueva, un valor viejo, un null— se trata como personal. Un aviso
 * de menos se nota y se arregla; uno de más ya salió.
 */
export function prefijoAlertaImpuesto(columnaAlerta: string | null | undefined): string {
  return columnaAlerta === "impuestos" ? "impuesto:" : "impuesto_personal:";
}

/**
 * Cómo se nombra al contribuyente dentro del texto del aviso.
 *
 * Devuelve vacío para la empresa: "el impuesto IVA de Joaquín Hnos" en un
 * sistema que es de Joaquín Hnos no agrega nada, y esos avisos ya vienen
 * saliendo así desde junio. Para el resto sí, porque la gracia del aviso es
 * justamente saber de quién es la fila.
 */
export function sufijoEntidadEnAviso(
  entidad: { codigo: string; nombre: string } | null | undefined,
): string {
  if (!entidad || entidad.codigo === "joaquin_hnos") return "";
  return ` de ${entidad.nombre}`;
}

// ---------------------------------------------------------------------------
// Alta, edición y baja de contribuyentes
//
// El desplegable de /impuestos era de sólo lectura: los dos contribuyentes los
// creó la migración del 02/09 y el único modo de sumar uno era subir un PDF con
// un CUIT desconocido. Pedido de Julián (03/09): que se puedan crear, editar y
// eliminar desde ahí mismo.
//
// Todo lo que decide algo vive acá y no en la pantalla: quién puede tocar qué,
// cómo se normaliza un CUIT y qué código interno le toca al contribuyente nuevo.
// ---------------------------------------------------------------------------

/** Columna de la matriz del calendario de la empresa: le llega a todo el equipo. */
export const COLUMNA_IMPUESTOS_EMPRESA = "impuestos";

/** Las dos audiencias posibles. No hay una tercera: o es de todos o es reservado. */
export const COLUMNAS_AVISO = [
  { id: COLUMNA_IMPUESTOS_EMPRESA, label: "De la empresa — le llega a todo el equipo" },
  { id: COLUMNA_IMPUESTOS_PERSONALES, label: "Personal — reservado" },
] as const;

/** Son los datos fiscales de una persona, no de la empresa. */
export function esReservado(columnaAlerta: string | null | undefined): boolean {
  return columnaAlerta === COLUMNA_IMPUESTOS_PERSONALES;
}

/** "A quién le llega", dicho en castellano y no en nombre de columna. */
export function avisaA(columnaAlerta: string | null | undefined): string {
  return esReservado(columnaAlerta)
    ? "Sólo a quien tenga «Impuestos personales»"
    : "A todo el equipo con avisos de Impuestos";
}

/**
 * Si hace falta la sección «Impuestos personales» para tocar este contribuyente.
 *
 * Mira las DOS puntas del cambio, y por eso no alcanza con preguntar por el
 * estado actual:
 *  · Personal → empresa destapa el calendario de alguien. Es la peligrosa.
 *  · Empresa → personal apaga un aviso que hoy le llega a nueve personas.
 *  · Tocarle el nombre o el CUIT a uno reservado ya es tocar el dato reservado.
 *
 * `nueva` sin pasar significa "no se cambia la audiencia" (renombrar, borrar).
 */
export function requierePermisoPersonales(
  actual: string | null | undefined,
  nueva?: string | null | undefined,
): boolean {
  return esReservado(actual) || esReservado(nueva ?? actual);
}

/**
 * CUIT a `20-26402739-0` desde cualquier cosa que se tipee o se pegue: con
 * guiones, con puntos, con espacios o los 11 dígitos pelados. `null` si no son
 * exactamente 11 dígitos.
 *
 * Importa más de lo que parece: el CUIT es la llave con la que el importador
 * reconoce de quién es el PDF del estudio. Guardado con otro formato, el mismo
 * contribuyente entra dos veces y el calendario se parte al medio.
 */
export function normalizarCuit(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/**
 * Si el dígito verificador cierra (módulo 11, el de AFIP).
 *
 * NO bloquea el guardado: el CUIT se carga tal cual lo dicta el papel, como
 * todo lo demás. Se usa para avisar en pantalla, porque un dígito mal tipeado
 * no se nota nunca sola — se nota el mes que viene, cuando el PDF del estudio
 * no matchea con nadie y el calendario no se agenda.
 */
export function cuitDigitoOk(cuit: string | null | undefined): boolean {
  const d = (cuit ?? "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) suma += Number(d[i]) * pesos[i]!;
  const resto = suma % 11;
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return dv === Number(d[10]);
}

/**
 * El código interno del contribuyente nuevo (`joaquin_hnos`). Es la clave que
 * queda escrita en cada vencimiento, así que se calcula una sola vez —al dar de
 * alta— y no se edita más: cambiarlo dejaría los vencimientos apuntando a un
 * contribuyente que ya no existe.
 *
 * `ocupados` son los códigos que ya están. Sin esto, "Joaquín Hnos SRL" y
 * "Joaquín Hnos SA" pelean por el mismo código y la segunda alta falla con un
 * error de base que en pantalla no dice nada.
 */
export function codigoContribuyente(
  nombre: string,
  cuit: string,
  ocupados: Iterable<string> = [],
): string {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `cuit_${cuit.replace(/\D/g, "")}`;

  const tomados = new Set(ocupados);
  if (!tomados.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const cand = `${base.slice(0, 40 - String(n).length - 1)}_${n}`;
    if (!tomados.has(cand)) return cand;
  }
  return `cuit_${cuit.replace(/\D/g, "")}`;
}
