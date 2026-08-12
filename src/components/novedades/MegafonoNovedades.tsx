"use client";

import { useId } from "react";

/**
 * La ilustración de "Novedades del sistema": un megáfono con sus ondas y dos
 * chispas.
 *
 * Mismo criterio que `ChecklistYCampana` (la del resumen del día): SVG dibujado
 * a mano y no una imagen generada — no hay un PNG más que versionar y servir al
 * doble para retina, escala sin pixelarse y los colores salen de la paleta del
 * sistema. Los degradés son los que le dan el volumen.
 *
 * Los ids de los degradés se arman con `useId`: en un SVG los ids son globales
 * del documento, así que dos copias en pantalla con ids fijos se pisan y la
 * segunda hereda los colores de la primera.
 *
 * El megáfono y no una campana: la campana ya es el ícono de los avisos que hay
 * que resolver. Esto es un anuncio — se lee y se sigue trabajando.
 */
export default function MegafonoNovedades({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const cuerpo = `${uid}-cuerpo`;
  const boca = `${uid}-boca`;
  const brillo = `${uid}-brillo`;

  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="Un megáfono anunciando novedades">
      <defs>
        <linearGradient id={cuerpo} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#6C9BF0" />
          <stop offset="100%" stopColor="#3B5BC0" />
        </linearGradient>
        <linearGradient id={boca} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8AD5FB" />
          <stop offset="100%" stopColor="#2E8FD4" />
        </linearGradient>
        <radialGradient id={brillo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Resplandor: despega la ilustración de cualquier fondo. */}
      <circle cx="48" cy="48" r="46" fill={`url(#${brillo})`} />

      <g transform="rotate(-14 48 48)">
        {/* El mango, atrás del cuerpo para que parezca salir de abajo. */}
        <rect x="28" y="56" width="9" height="22" rx="4.5" fill="#2C46A0" transform="rotate(20 32 60)" />

        {/* El cono. El `stroke` del mismo color redondea las esquinas: en un
            path no hay `rx`, y con las puntas vivas el megáfono se veía filoso. */}
        <path
          d="M26 38 L62 24 L62 72 L26 58 Z"
          fill={`url(#${cuerpo})`}
          stroke={`url(#${cuerpo})`}
          strokeWidth="7"
          strokeLinejoin="round"
        />

        {/* La boca: la elipse que abre el cono hacia adelante. */}
        <ellipse cx="62" cy="48" rx="7" ry="26" fill={`url(#${boca})`} />
        <ellipse cx="62.5" cy="48" rx="4" ry="20" fill="#1E3A8A" opacity="0.28" />

        {/* Tapa de atrás: le da espesor al extremo angosto. */}
        <rect x="18" y="40" width="10" height="16" rx="5" fill="#2C46A0" />
      </g>

      {/* Las ondas del sonido. */}
      <g fill="none" stroke="#38BDF8" strokeLinecap="round" opacity="0.9">
        <path d="M74 40 Q79 48 74 56" strokeWidth="3.5" />
        <path d="M82 33 Q90 48 82 63" strokeWidth="3.5" opacity="0.6" />
      </g>

      {/* Dos chispas: es lo que hace que se lea como algo nuevo y no como un aviso. */}
      <path d="M24 22 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4 Z" fill="#FBBF24" />
      <path d="M70 74 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 Z" fill="#FBBF24" opacity="0.75" />
    </svg>
  );
}
