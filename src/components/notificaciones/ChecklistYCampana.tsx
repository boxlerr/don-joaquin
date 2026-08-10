"use client";

import { useId } from "react";

/**
 * La ilustración del bloque de accesos del resumen del día: una tabla con su
 * checklist y una campana al lado.
 *
 * Es un SVG dibujado a mano y no una imagen generada. Tres razones, en orden de
 * peso: no hay un PNG más que versionar y servir al doble para retina; escala
 * sin pixelarse a cualquier tamaño; y los colores salen de la paleta del sistema
 * en vez de los que haya elegido un generador. Los degradés son los que le dan
 * el volumen — el mismo truco que usan las ilustraciones "3D" de producto.
 *
 * Los ids de los degradés se arman con `useId`: en un SVG los ids son globales
 * del documento, así que dos copias en pantalla con ids fijos se pisan y la
 * segunda hereda los colores de la primera.
 */
export default function ChecklistYCampana({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const papel = `${uid}-papel`;
  const tabla = `${uid}-tabla`;
  const campana = `${uid}-campana`;
  const brillo = `${uid}-brillo`;

  return (
    <svg
      viewBox="0 0 132 124"
      className={className}
      role="img"
      aria-label="Una planilla con su checklist y una campana de avisos"
    >
      <defs>
        <linearGradient id={papel} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#D9E7F7" />
        </linearGradient>
        <linearGradient id={tabla} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#6C9BF0" />
          <stop offset="100%" stopColor="#3B5BC0" />
        </linearGradient>
        <linearGradient id={campana} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8AD5FB" />
          <stop offset="100%" stopColor="#2E8FD4" />
        </linearGradient>
        <radialGradient id={brillo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Resplandor de atrás: despega la ilustración del fondo oscuro. */}
      <circle cx="62" cy="60" r="58" fill={`url(#${brillo})`} />

      {/* Sombra de apoyo. */}
      <ellipse cx="60" cy="112" rx="38" ry="6" fill="#000000" opacity="0.22" />

      {/* La tabla, con un canto más oscuro abajo para darle espesor. */}
      <rect x="20" y="20" width="70" height="86" rx="12" fill="#2C46A0" />
      <rect x="20" y="16" width="70" height="86" rx="12" fill={`url(#${tabla})`} />

      {/* La hoja. */}
      <rect x="27" y="26" width="56" height="70" rx="7" fill={`url(#${papel})`} />

      {/* La pinza de arriba. */}
      <rect x="45" y="8" width="20" height="14" rx="5" fill="#93B4F7" />
      <rect x="42" y="12" width="26" height="11" rx="5.5" fill="#5C86E8" />

      {/* Los tres renglones tildados. El tercero va a medio hacer: la planilla
          está en curso, que es de lo que habla el cartel. */}
      {[
        { y: 40, ancho: 26, hecho: true },
        { y: 55, ancho: 22, hecho: true },
        { y: 70, ancho: 28, hecho: false },
      ].map((fila) => (
        <g key={fila.y}>
          <rect
            x="34"
            y={fila.y}
            width="11"
            height="11"
            rx="3.5"
            fill={fila.hecho ? "#3B82F6" : "#FFFFFF"}
            stroke={fila.hecho ? "none" : "#B6CCE8"}
            strokeWidth="1.6"
          />
          {fila.hecho && (
            <path
              d={`M36.8 ${fila.y + 5.6} l2.4 2.5 4.2 -4.6`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <rect
            x="50"
            y={fila.y + 3}
            width={fila.ancho}
            height="5"
            rx="2.5"
            fill={fila.hecho ? "#C9DCF3" : "#E2ECF8"}
          />
        </g>
      ))}

      {/* La campana, flotando sobre la esquina. */}
      <g transform="translate(78 54)">
        <circle cx="21" cy="21" r="23" fill="#12203F" opacity="0.55" />
        <path
          d="M21 5c-6.6 0-12 5.4-12 12v6.5c0 2.6-1 4.6-2.8 6.2-1 .9-.4 2.6 1 2.6h27.6c1.4 0 2-1.7 1-2.6C33.9 28.1 33 26.1 33 23.5V17c0-6.6-5.4-12-12-12z"
          fill={`url(#${campana})`}
        />
        <path
          d="M16.5 34.5h9c0 2.5-2 4.5-4.5 4.5s-4.5-2-4.5-4.5z"
          fill="#2E8FD4"
        />
        <circle cx="21" cy="4" r="3" fill="#BFE7FD" />
        {/* El puntito de "hay algo nuevo". */}
        <circle cx="33" cy="9" r="6" fill="#F43F5E" stroke="#12203F" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
