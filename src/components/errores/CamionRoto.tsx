import { CuerpoCamion, Reloj } from "./camion";

/**
 * El dibujo de la pantalla de "algo se rompió": el mismo camión de la flota, pero
 * esta vez parado con la baliza puesta, humo saliendo del escape y el reloj de
 * temperatura arriba de todo.
 *
 * Es el mismo camión a propósito. Las dos pantallas de error son de la misma
 * casa; lo que cambia es qué le pasó a la unidad, no la unidad.
 *
 * A diferencia del 404, acá el acoplado no lleva ningún número: no hay un código
 * para mostrar, y un cartel inventado sólo agregaría ruido a una pantalla que ya
 * apareció en un mal momento.
 */
export default function CamionRoto({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Un camión detenido en la ruta con la baliza puesta, humo en el escape y el reloj de temperatura en rojo"
    >
      {/* El humo: más y más oscuro que el del 404 — acá no se quedó sin nafta. */}
      <g className="dj-humo">
        <circle cx="309" cy="74" r="6" fill="#94A3B8" opacity="0.7" />
        <circle cx="318" cy="56" r="9" fill="#94A3B8" opacity="0.5" />
        <circle cx="330" cy="36" r="12" fill="#94A3B8" opacity="0.3" />
        <circle cx="348" cy="20" r="14" fill="#94A3B8" opacity="0.16" />
      </g>

      <CuerpoCamion
        cartel={
          <text
            x="173"
            y="145"
            textAnchor="middle"
            fontFamily="inherit"
            fontSize="24"
            fontWeight="800"
            letterSpacing="4"
            fill="#CBD5E1"
          >
            DON JOAQUÍN
          </text>
        }
      />

      {/* La baliza, adelante del camión. */}
      <g>
        <rect x="458" y="230" width="32" height="7" rx="3.5" fill="#334155" />
        <path
          d="M474 196 L497 233 H451 Z"
          fill="#EF4444"
          stroke="#0F172A"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M474 211 L486 230 H462 Z" fill="#FFFFFF" />
      </g>

      {/* El reloj de temperatura, con la aguja pasada de rojo. El termómetro va
          abajo de todo para que no se lea como una segunda aguja. */}
      <Reloj zonaRoja="M509.4 49.6 A 24 24 0 0 1 516.5 59.8" aguja="M494 68 L512 59.6">
        <rect x="490" y="84" width="6" height="14" rx="3" fill="#EF4444" />
        <circle cx="493" cy="98" r="5.5" fill="#EF4444" />
        <path d="M500 88 h4 M500 93 h4" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      </Reloj>
    </svg>
  );
}
