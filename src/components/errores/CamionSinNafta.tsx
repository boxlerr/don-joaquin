import { CuerpoCamion, Reloj } from "./camion";

/**
 * El dibujo de la pantalla de "página no encontrada": un camión de la flota
 * parado en la banquina con el tanque en cero.
 *
 * Es un SVG a mano y no una imagen para que se vea nítido en cualquier pantalla,
 * pese lo mismo que un párrafo de texto y use los colores de la marca (el celeste
 * del sistema, el amarillo de la franja) en vez de un stock genérico.
 *
 * El "404" va escrito en el costado del acoplado, como la cartelería de una
 * unidad: el número es el dato, y así el dibujo lo cuenta sin repetirlo en un
 * cartel aparte.
 *
 * Las animaciones (la aguja temblando en la reserva y el humito del escape) están
 * en globals.css y se apagan solas si el sistema operativo pide menos movimiento.
 */
export default function CamionSinNafta({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Un camión detenido al costado de la ruta con el medidor de nafta en cero"
    >
      {/* El humito del escape: el último tosido antes de quedarse. */}
      <g className="dj-humo">
        <circle cx="310" cy="76" r="5" fill="#CBD5E1" opacity="0.75" />
        <circle cx="317" cy="60" r="7" fill="#CBD5E1" opacity="0.5" />
        <circle cx="327" cy="42" r="9" fill="#CBD5E1" opacity="0.28" />
      </g>

      <CuerpoCamion
        cartel={
          <text
            x="173"
            y="158"
            textAnchor="middle"
            fontFamily="inherit"
            fontSize="60"
            fontWeight="800"
            letterSpacing="3"
            fill="#0088D1"
          >
            404
          </text>
        }
      />

      {/* El bidón vacío, al lado del camión. */}
      <g>
        <rect x="458" y="204" width="30" height="32" rx="5" fill="#EF4444" stroke="#0F172A" strokeWidth="2.5" />
        <rect x="477" y="195" width="9" height="10" rx="2" fill="#334155" stroke="#0F172A" strokeWidth="2" />
        <path d="M463 203 q6 -9 13 -4" stroke="#0F172A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M465 212 l16 16 M481 212 l-16 16" stroke="#B91C1C" strokeWidth="2.5" opacity="0.5" strokeLinecap="round" />
      </g>

      {/* El medidor de nafta: la aguja clavada en la reserva. */}
      <Reloj zonaRoja="M471.5 59.8 A 24 24 0 0 1 478.6 49.6" aguja="M494 68 L476 59.6">
        <text x="471" y="86" textAnchor="middle" fontFamily="inherit" fontSize="12" fontWeight="700" fill="#EF4444">
          E
        </text>
        <text x="517" y="86" textAnchor="middle" fontFamily="inherit" fontSize="12" fontWeight="700" fill="#94A3B8">
          F
        </text>
      </Reloj>
    </svg>
  );
}
