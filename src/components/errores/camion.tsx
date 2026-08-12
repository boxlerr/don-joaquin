import type { ReactNode } from "react";

/**
 * El camión de la flota visto de costado, parado sobre la ruta.
 *
 * Lo comparten las dos pantallas de error —la de página no encontrada y la de
 * "se rompió algo"—, que cuentan cosas distintas con el mismo camión: una le
 * agrega el medidor de nafta en cero, la otra el humo y la baliza. Está acá y no
 * copiado en cada una para que mover una rueda no haya que hacerlo dos veces.
 *
 * Se dibuja sobre un lienzo de 560 × 300; el piso está a la altura 236.
 *
 * `cartel` es lo que va escrito en el costado del acoplado, que es lo primero
 * que se lee del dibujo.
 */
export function CuerpoCamion({ cartel }: { cartel?: ReactNode }) {
  return (
    <>
      {/* Piso: la sombra y la línea de la ruta. */}
      <ellipse cx="255" cy="240" rx="220" ry="9" fill="#0F172A" opacity="0.06" />
      <path d="M22 236 H538" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />

      {/* Ruedas (van primero: el chasis y las cajas las tapan hasta el eje). */}
      {[106, 164, 376].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="215" r="21" fill="#334155" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx={cx} cy="215" r="8.5" fill="#94A3B8" />
          <circle cx={cx} cy="215" r="3.5" fill="#E2E8F0" />
        </g>
      ))}

      {/* Chasis */}
      <rect x="52" y="192" width="272" height="11" rx="3" fill="#475569" />
      <rect x="302" y="178" width="22" height="16" rx="3" fill="#475569" />

      {/* Acoplado */}
      <rect x="44" y="70" width="258" height="122" rx="8" fill="#FFFFFF" stroke="#0F172A" strokeWidth="3" />
      <path d="M44 92 H302" stroke="#E2E8F0" strokeWidth="2.5" />
      <path d="M44 180 H302" stroke="#E2E8F0" strokeWidth="2.5" />
      {cartel}

      {/* Escape */}
      <rect x="305" y="88" width="11" height="104" rx="5.5" fill="#94A3B8" stroke="#0F172A" strokeWidth="2.5" />

      {/* Cabina */}
      <path
        d="M318 192 V100 a14 14 0 0 1 14 -14 h84 a14 14 0 0 1 14 14 v92 z"
        fill="#0088D1"
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Ventanilla de la puerta y, pasado el parante, el filo del parabrisas. */}
      <rect x="330" y="100" width="64" height="40" rx="6" fill="#E1F5FE" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M338 134 L360 104" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      <rect x="402" y="100" width="18" height="40" rx="6" fill="#E1F5FE" stroke="#0F172A" strokeWidth="2.5" />
      <rect x="372" y="146" width="14" height="4" rx="2" fill="#0277BD" />
      <rect x="318" y="156" width="112" height="8" fill="#FFB300" />
      {/* Espejo, faro y paragolpes */}
      <path d="M430 108 h8" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
      <rect x="436" y="99" width="8" height="19" rx="3" fill="#334155" stroke="#0F172A" strokeWidth="2" />
      <rect x="412" y="168" width="18" height="13" rx="3" fill="#FFB300" stroke="#0F172A" strokeWidth="2" />
      <rect x="412" y="181" width="26" height="13" rx="3" fill="#334155" stroke="#0F172A" strokeWidth="2" />
    </>
  );
}

/**
 * El medidor del tablero. Es el mismo reloj en las dos pantallas y cambia sólo
 * dónde está la zona roja y hacia dónde apunta la aguja, que es justo lo que
 * distingue "se quedó sin nafta" de "se recalentó".
 *
 * La aguja tiembla (`dj-aguja` en globals.css, con el centro en 494 / 68).
 */
export function Reloj({
  zonaRoja,
  aguja,
  children,
}: {
  /** Tramo pintado de rojo sobre el arco. */
  zonaRoja: string;
  /** La aguja, desde el centro del reloj. */
  aguja: string;
  /** Lo que va abajo del arco: las letras E/F, el termómetro. */
  children: ReactNode;
}) {
  return (
    <g>
      <circle cx="494" cy="68" r="40" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
      <path
        d="M471.5 59.8 A 24 24 0 0 1 516.5 59.8"
        stroke="#E2E8F0"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path d={zonaRoja} stroke="#EF4444" strokeWidth="6" strokeLinecap="round" fill="none" />
      <g className="dj-aguja">
        <path d={aguja} stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <circle cx="494" cy="68" r="4.5" fill="#0F172A" />
      {children}
    </g>
  );
}
