/**
 * Las placas de las tarjetas de arriba de Préstamos.
 *
 * Antes eran cuatro íconos de librería —un amanecer, un reloj, una alcancía y un
 * triángulo— metidos en cuatro cuadraditos de color: cuatro dibujos sin nada en
 * común, y el color del cuadradito era lo único que los distinguía de un
 * vistazo.
 *
 * Ahora son una familia, la misma regla que ya usan Impuestos y Compliance: el
 * MISMO calendario —que es de lo que habla la pantalla, cuándo cae cada cuota— y
 * lo que cambia es el sello de abajo a la derecha: sol (mañana), reloj (esta
 * semana), admiración (vencidas) o tilde (todo al día). La alcancía es la única
 * distinta a propósito: es la tarjeta destacada, la del mes.
 *
 * Los dibujos se generaron con Higgsfield (Recraft, modo vector) y quedaron
 * como SVG: pesan entre 5 y 16 KB, se ven nítidos a cualquier tamaño y el fondo
 * de cada placa lo normaliza `scripts/normalizar-kpi-svg.mjs` con los tonos de
 * la paleta del sistema —el generador respeta el color de fondo cuando tiene
 * ganas, y dos de los cinco volvieron con fondo blanco—.
 *
 * Van como `<img>` y no en línea: son archivos estáticos, los cachea el
 * navegador y no engordan el HTML de la página.
 */

export type IlustracionPrestamoNombre = "manana" | "semana" | "mes" | "vencidas" | "al-dia";

/** Lo que dibuja cada una, para quien navega con lector de pantalla apagado el
 *  detalle no importa: la tarjeta ya dice el número y el rótulo al lado. */
export default function IlustracionPrestamo({
  nombre,
  size = 40,
  className,
}: {
  nombre: IlustracionPrestamoNombre;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG local: no hay nada que optimizar
    <img
      src={`/prestamos/kpi-${nombre}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 rounded-lg ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
