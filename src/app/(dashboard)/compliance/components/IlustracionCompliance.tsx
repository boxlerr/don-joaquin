/**
 * Las ilustraciones de Compliance.
 *
 * Reemplazan a los íconos de librería, que en esta pantalla se repetían entre
 * sí (tres hojas de papel casi iguales para "vencido", "sin cargar" y "al día")
 * y no se distinguían de un vistazo. Cada estado y cada nivel tiene ahora un
 * dibujo propio: la misma hoja de base, pero con un sello distinto abajo a la
 * derecha, que es lo que cambia el significado.
 *
 * Son SVG dibujados acá y no imágenes: pesan ~1 KB, se ven nítidas en cualquier
 * tamaño (la misma sirve a 32 y a 56 px) y usan la paleta del sistema, así que
 * el verde de "al día" es exactamente el verde de la tarjeta "Al día".
 *
 * Regla de dibujo, para que las nuevas sigan combinando:
 *   · lienzo 48×48 con la placa redondeada de fondo (rx 13) en el tono suave;
 *   · el objeto ocupa el centro con 8px de aire;
 *   · relleno blanco + contorno del color, trazo 1.7 y puntas redondeadas;
 *   · el sello va abajo a la derecha, círculo de r=7.5 en el color fuerte.
 */

export type IlustracionNombre =
  | "vencido"
  | "por-vencer"
  | "sin-cargar"
  | "al-dia"
  | "total"
  | "empresa"
  | "unidad"
  | "chofer"
  | "reloj";

type Paleta = {
  /** Fondo de la placa. */
  placa: string;
  /** Color fuerte: contornos y sellos. */
  fuerte: string;
  /** Color suave: renglones y volúmenes secundarios. */
  suave: string;
};

const AZUL: Paleta = { placa: "#E1F5FE", fuerte: "#0088D1", suave: "#BAE6FD" };
// Los otros dos tonos existen sólo para las tarjetas de alcance, donde los tres
// niveles van uno al lado del otro y conviene que se distingan de un vistazo.
// Verde-azulado y no verde a secas: el verde ya significa "al día" en esta
// pantalla y dos verdes distintos en la misma tarjeta se leen como un estado.
const TEAL: Paleta = { placa: "#ECFDF5", fuerte: "#0F9488", suave: "#99F6E4" };
const VIOLETA: Paleta = { placa: "#F5F3FF", fuerte: "#7C3AED", suave: "#DDD6FE" };
const ROJO: Paleta = { placa: "#FEF2F2", fuerte: "#EF4444", suave: "#FECACA" };
const AMBAR: Paleta = { placa: "#FFFBEB", fuerte: "#F59E0B", suave: "#FDE68A" };
const GRIS: Paleta = { placa: "#F1F5F9", fuerte: "#94A3B8", suave: "#E2E8F0" };
const VERDE: Paleta = { placa: "#F0FDF4", fuerte: "#22C55E", suave: "#BBF7D0" };

const PALETA: Record<IlustracionNombre, Paleta> = {
  vencido: ROJO,
  "por-vencer": AMBAR,
  "sin-cargar": GRIS,
  "al-dia": VERDE,
  total: AZUL,
  empresa: AZUL,
  unidad: AZUL,
  chofer: AZUL,
  reloj: GRIS,
};

/** La hoja con la esquina doblada: la base de los cuatro estados. */
function Hoja({ p, punteada = false }: { p: Paleta; punteada?: boolean }) {
  return (
    <>
      <path
        d="M15 10h11.5L34 17.5V36a2.5 2.5 0 0 1-2.5 2.5h-16.5A2.5 2.5 0 0 1 12.5 36V12.5A2.5 2.5 0 0 1 15 10Z"
        fill="#fff"
        stroke={p.fuerte}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeDasharray={punteada ? "3.2 2.6" : undefined}
      />
      {/* La pestaña del doblez, que es lo que hace leer "hoja" y no "cuadrado". */}
      <path
        d="M26.5 10v5a2.5 2.5 0 0 0 2.5 2.5h5"
        fill="none"
        stroke={p.fuerte}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {!punteada && (
        <>
          <rect x="16.5" y="22" width="11" height="2.1" rx="1.05" fill={p.suave} />
          <rect x="16.5" y="27" width="7.5" height="2.1" rx="1.05" fill={p.suave} />
        </>
      )}
    </>
  );
}

/** El sello de abajo a la derecha: es lo único que cambia entre los estados. */
function Sello({ p, children }: { p: Paleta; children: React.ReactNode }) {
  return (
    <g>
      <circle cx="34" cy="34" r="8.6" fill="#fff" />
      <circle cx="34" cy="34" r="7.3" fill={p.fuerte} />
      {children}
    </g>
  );
}

const TRAZO_BLANCO = {
  fill: "none",
  stroke: "#fff",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Dibujo({ nombre, p }: { nombre: IlustracionNombre; p: Paleta }) {
  switch (nombre) {
    case "vencido":
      return (
        <>
          <Hoja p={p} />
          <Sello p={p}>
            <path d="M34 30.4v4.2" {...TRAZO_BLANCO} />
            <circle cx="34" cy="37.6" r="1.15" fill="#fff" />
          </Sello>
        </>
      );

    case "por-vencer":
      return (
        <>
          <Hoja p={p} />
          <Sello p={p}>
            <path d="M34 30.6V34l2.4 1.9" {...TRAZO_BLANCO} />
          </Sello>
        </>
      );

    case "al-dia":
      return (
        <>
          <Hoja p={p} />
          <Sello p={p}>
            <path d="m30.7 34.1 2.4 2.4 4.3-4.9" {...TRAZO_BLANCO} />
          </Sello>
        </>
      );

    case "sin-cargar":
      return (
        <>
          {/* Hoja punteada y vacía: todavía no hay papel, es un hueco. */}
          <Hoja p={p} punteada />
          <Sello p={p}>
            {/* Flecha hacia arriba: lo que falta es subirlo. */}
            <path d="M34 37.6v-6.9M31.2 33.3 34 30.5l2.8 2.8" {...TRAZO_BLANCO} />
          </Sello>
        </>
      );

    case "total":
      return (
        // Tres hojas en abanico: el total es "todo el checklist junto".
        <>
          <rect
            x="10.5"
            y="14"
            width="19"
            height="24"
            rx="3"
            fill="#fff"
            stroke={p.suave}
            strokeWidth="1.7"
            transform="rotate(-9 20 26)"
          />
          <rect
            x="14"
            y="12"
            width="19"
            height="24"
            rx="3"
            fill="#fff"
            stroke={p.suave}
            strokeWidth="1.7"
            transform="rotate(-3 23.5 24)"
          />
          <rect
            x="17.5"
            y="10.5"
            width="19"
            height="24"
            rx="3"
            fill="#fff"
            stroke={p.fuerte}
            strokeWidth="1.7"
          />
          <rect x="21" y="16" width="12" height="2.1" rx="1.05" fill={p.suave} />
          <rect x="21" y="21" width="12" height="2.1" rx="1.05" fill={p.suave} />
          <rect x="21" y="26" width="7.5" height="2.1" rx="1.05" fill={p.suave} />
        </>
      );

    case "empresa":
      return (
        // Oficina alta + galpón al lado, apoyados en el piso: la silueta de la
        // base. Sin antena — a 34px se leía como una cara con sombrero.
        <>
          {/* Cuerpo alto */}
          <path
            d="M10.5 15.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V38h-13z"
            fill="#fff"
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <rect x="13.5" y="18" width="3.6" height="3.6" rx="1" fill={p.suave} />
          <rect x="19" y="18" width="3.6" height="3.6" rx="1" fill={p.suave} />
          <rect x="13.5" y="24" width="3.6" height="3.6" rx="1" fill={p.suave} />
          <rect x="19" y="24" width="3.6" height="3.6" rx="1" fill={p.suave} />
          {/* Galpón */}
          <path
            d="M23.5 23.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V38h-14z"
            fill="#fff"
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          {/* Portón */}
          <path
            d="M27.5 38v-6a2.5 2.5 0 0 1 5 0v6"
            fill={p.suave}
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          {/* Piso */}
          <path d="M9 38h30" stroke={p.fuerte} strokeWidth="1.9" strokeLinecap="round" />
        </>
      );

    case "unidad":
      return (
        // Tractor + acoplado de perfil: la silueta que se reconoce en la ruta.
        <>
          <rect
            x="8.5"
            y="17"
            width="16"
            height="14"
            rx="2.6"
            fill="#fff"
            stroke={p.fuerte}
            strokeWidth="1.7"
          />
          <path
            d="M25.5 21h7.2l5.8 5.4V31H25.5z"
            fill="#fff"
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <rect x="27.5" y="23" width="5.5" height="4" rx="1.2" fill={p.suave} />
          <rect x="11.5" y="20.5" width="9.5" height="2.1" rx="1.05" fill={p.suave} />
          <circle cx="16" cy="34" r="4.2" fill="#fff" stroke={p.fuerte} strokeWidth="1.7" />
          <circle cx="16" cy="34" r="1.5" fill={p.fuerte} />
          <circle cx="33" cy="34" r="4.2" fill="#fff" stroke={p.fuerte} strokeWidth="1.7" />
          <circle cx="33" cy="34" r="1.5" fill={p.fuerte} />
        </>
      );

    case "chofer":
      return (
        // Persona con gorra. La gorra va APOYADA arriba de la cabeza y la visera
        // sale hacia afuera: cruzándola por el medio (como estaba) se leía como
        // una carita tachada.
        <>
          <path
            d="M12.5 39c0-6.3 5.2-9.8 11.5-9.8S35.5 32.7 35.5 39"
            fill="#fff"
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="21.5" r="6.6" fill="#fff" stroke={p.fuerte} strokeWidth="1.7" />
          {/* Casquete */}
          <path
            d="M17.6 19.4a6.6 6.6 0 0 1 12.8 0Z"
            fill={p.suave}
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          {/* Visera, para afuera */}
          <path
            d="M30.2 19.4h3.6a1.3 1.3 0 0 1 0 2.6h-4"
            fill={p.suave}
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      );

    case "reloj":
      return (
        // Reloj con la flecha de volver a consultar.
        <>
          <circle cx="24" cy="24" r="12.5" fill="#fff" stroke={p.fuerte} strokeWidth="1.7" />
          <path
            d="M24 16.5V24l5 3.2"
            fill="none"
            stroke={p.fuerte}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="24" r="1.5" fill={p.fuerte} />
        </>
      );
  }
}

/** Tonos alternativos, sólo para las tarjetas de alcance. */
export type TonoIlustracion = "azul" | "teal" | "violeta";

const TONOS: Record<TonoIlustracion, Paleta> = { azul: AZUL, teal: TEAL, violeta: VIOLETA };

export default function IlustracionCompliance({
  nombre,
  size = 40,
  className,
  tono,
}: {
  nombre: IlustracionNombre;
  size?: number;
  className?: string;
  /** Fuerza el color. Sin esto manda la paleta del propio dibujo. */
  tono?: TonoIlustracion;
}) {
  const p = tono ? TONOS[tono] : PALETA[nombre];
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
      focusable="false"
    >
      <rect width="48" height="48" rx="13" fill={p.placa} />
      <Dibujo nombre={nombre} p={p} />
    </svg>
  );
}
