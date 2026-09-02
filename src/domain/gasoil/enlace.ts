/**
 * El enlace que anota la vuelta: mandarlo y recibirla.
 *
 * Tres cosas que parecen chicas y no lo son:
 *
 *  * **Armar el link de WhatsApp.** Los teléfonos están cargados a mano, en cinco
 *    formatos distintos, y `wa.me` no perdona: si el número sale mal, el botón
 *    abre un chat con nadie y el chofer nunca recibe el enlace.
 *  * **Encontrarse en una lista de 61.** El chofer se elige a sí mismo, y lo va a
 *    hacer con el camión al lado. Tiene que poder escribir "aste" y encontrarse,
 *    con o sin tilde, empiece por el nombre o por el apellido.
 *  * **No anotar dos veces lo mismo.** El botón se toca dos veces, la página se
 *    recarga, se aprieta "atrás" y se manda de nuevo. Sin un descarte explícito,
 *    cada uno de esos dedos es una vuelta de gasoil de más en el reporte.
 */

// ── WhatsApp ─────────────────────────────────────────────────────────────────

/**
 * El teléfono en el formato que entiende `wa.me`: `549` + área + número.
 *
 * Devuelve `null` cuando el número no alcanza para armar un link. Es a propósito:
 * es mejor no ofrecer el botón de WhatsApp que ofrecer uno que abre un chat
 * vacío y deja al chofer sin enlace sin que nadie se entere.
 *
 * Los cinco formatos que hay hoy cargados (verificado sobre los 61 activos el
 * 02/09/2026): `2281-305209`, `+5492281305209`, `11-40305209`, `2281305209` y
 * `2281 305209`. Todos caen en el mismo lugar.
 */
export function telefonoParaWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (!d) return null;

  // Ya viene con país: se limpia el 9 de más si estaba duplicado y se devuelve.
  if (d.startsWith("54")) {
    d = d.slice(2);
  }
  // El 0 de larga distancia y el 15 de celular no van en el formato internacional.
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("9")) d = d.slice(1);

  // El 15 va DESPUÉS del área, así que sólo se puede sacar sabiendo dónde termina
  // el área. Las áreas argentinas son de 2, 3 o 4 dígitos; con 10 dígitos netos
  // el número ya está completo y no hay 15 que sacar.
  if (d.length > 10) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === "15" && d.length - 2 === 10) {
        d = d.slice(0, largoArea) + d.slice(largoArea + 2);
        break;
      }
    }
  }

  // Un fijo o un celular argentino completo son 10 dígitos (área + abonado).
  // Cualquier otra cosa es un número mal cargado y no se adivina.
  if (d.length !== 10) return null;
  return `549${d}`;
}

/** El mensaje que se manda por WhatsApp. Corto, y el link al final para que se vea. */
export function mensajeParaChofer(url: string): string {
  return [
    "Hola, te paso el enlace para anotar el gasoil de la vuelta.",
    "",
    "Ponés de dónde saliste, a dónde vas y cuántas toneladas cargaste, y te dice cuántos litros podés cargar. Guardalo en el teléfono así lo tenés siempre a mano.",
    "",
    url,
  ].join("\n");
}

/** El link de WhatsApp, o `null` si ese teléfono no sirve para armarlo. */
export function linkWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = telefonoParaWhatsapp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

// ── Encontrarse en la lista ──────────────────────────────────────────────────

/** Sin tildes y en minúscula: "Asteazarán" y "asteazaran" tienen que ser lo mismo. */
export function sinTildes(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Los choferes que coinciden con lo que se escribió.
 *
 * Busca por palabra y no por el string entero: el que escribe "cristian aste"
 * está pensando en el nombre y el apellido, y en la lista figura como
 * "Asteazarán Cristian Antonio". Exigir el orden sería exigir que se acuerde de
 * cómo lo escribimos nosotros.
 */
export function filtrarChoferes<T extends { nombre: string }>(lista: T[], busqueda: string): T[] {
  const partes = sinTildes(busqueda).split(/\s+/).filter(Boolean);
  if (partes.length === 0) return lista;
  return lista.filter((c) => {
    const n = sinTildes(c.nombre);
    return partes.every((p) => n.includes(p));
  });
}

// ── No anotar dos veces lo mismo ─────────────────────────────────────────────

/**
 * Cuántos minutos hacia atrás se considera que una vuelta idéntica es la misma.
 *
 * Diez es un número elegido por lo que pasa de los dos lados. Por abajo: el dedo
 * que toca dos veces y el "atrás" del navegador entran holgados. Por arriba: dos
 * vueltas reales del mismo chofer, mismo tramo y exactamente las mismas
 * toneladas en menos de diez minutos no existen — el camión tarda horas.
 */
export const MINUTOS_REPETIDA = 10;

/**
 * ¿Esta vuelta ya está anotada?
 *
 * Se compara el tramo y las toneladas, no el resultado: si en el medio cambió la
 * tarifa, los litros dan distinto y la fila igual es la misma vuelta.
 */
export function buscarRepetida<
  T extends { created_at: string; origen_id: string; destino_id: string; toneladas: number },
>(
  recientes: T[],
  nueva: { origenId: string; destinoId: string; toneladas: number },
  ahora: Date,
): T | null {
  const limite = ahora.getTime() - MINUTOS_REPETIDA * 60_000;
  return (
    recientes.find(
      (r) =>
        r.origen_id === nueva.origenId &&
        r.destino_id === nueva.destinoId &&
        Math.abs(Number(r.toneladas) - nueva.toneladas) < 0.005 &&
        new Date(r.created_at).getTime() >= limite,
    ) ?? null
  );
}

/**
 * Tope de vueltas por chofer y por día desde el enlace.
 *
 * No es una regla del negocio: es el freno para que una URL pública no pueda
 * llenar la tabla. Un chofer hace dos o tres vueltas en un día bueno; doce deja
 * lugar de sobra y corta cualquier cosa que se salga de la realidad. Si alguna
 * vez hace falta más, la oficina lo carga a mano, que es un camino que existe.
 */
export const TOPE_DIARIO_POR_CHOFER = 12;
