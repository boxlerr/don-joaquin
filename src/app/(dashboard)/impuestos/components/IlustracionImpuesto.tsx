/**
 * Las ilustraciones de Impuestos.
 *
 * Reemplazan a los cuatro íconos de librería de las tarjetas de arriba, que eran
 * un banco, un tilde, un reloj y un triángulo: cuatro dibujos sin nada en común
 * metidos adentro de cuatro círculos de color, y el color del círculo era lo
 * único que los diferenciaba de un vistazo.
 *
 * Acá las cuatro son el MISMO calendario —que es de lo que habla la pantalla— y
 * lo que cambia es el sello de abajo a la derecha: tildado, reloj o admiración.
 * Se leen como una familia y se distinguen igual.
 *
 * Son SVG dibujados acá y no imágenes: pesan ~1 KB, se ven nítidas a cualquier
 * tamaño y usan la paleta del sistema, así que el rojo de "Vencidos" es
 * exactamente el rojo del número de la tarjeta.
 *
 * Siguen la misma regla de dibujo que las de Compliance (ver
 * `IlustracionCompliance`), para que las dos pantallas se sientan del mismo
 * sistema:
 *   · lienzo 48×48 con la placa redondeada de fondo (rx 13) en el tono suave;
 *   · el objeto ocupa el centro con 8px de aire;
 *   · relleno blanco + contorno del color, trazo 1.7 y puntas redondeadas;
 *   · el sello va abajo a la derecha, círculo de r=7.3 en el color fuerte.
 */

export type IlustracionImpuestoNombre = "calendario" | "presentado" | "por-vencer" | "vencido";

type Paleta = {
  /** Fondo de la placa. */
  placa: string;
  /** Color fuerte: contornos y sellos. */
  fuerte: string;
  /** Color suave: la cabecera del calendario y los días. */
  suave: string;
};

const AZUL: Paleta = { placa: "#E1F5FE", fuerte: "#0088D1", suave: "#BAE6FD" };
const VERDE: Paleta = { placa: "#F0FDF4", fuerte: "#22C55E", suave: "#BBF7D0" };
const AMBAR: Paleta = { placa: "#FFFBEB", fuerte: "#F59E0B", suave: "#FDE68A" };
const ROJO: Paleta = { placa: "#FEF2F2", fuerte: "#EF4444", suave: "#FECACA" };

const PALETA: Record<IlustracionImpuestoNombre, Paleta> = {
  calendario: AZUL,
  presentado: VERDE,
  "por-vencer": AMBAR,
  vencido: ROJO,
};

/** Los días del mes. El de abajo a la derecha lo tapa el sello, así que sólo se
 *  dibuja cuando la ilustración no tiene sello. */
function Dias({ p, conSello }: { p: Paleta; conSello: boolean }) {
  return (
    <>
      <rect x="12.5" y="22.5" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      <rect x="18.1" y="22.5" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      <rect x="23.7" y="22.5" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      <rect x="29.3" y="22.5" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      <rect x="12.5" y="28.4" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      <rect x="18.1" y="28.4" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      <rect x="23.7" y="28.4" width="3.8" height="3.8" rx="1.2" fill={p.suave} />
      {!conSello && <rect x="29.3" y="28.4" width="3.8" height="3.8" rx="1.2" fill={p.suave} />}
    </>
  );
}

/** La hoja del calendario con sus dos anillos: la base de las cuatro. */
function Calendario({ p, conSello }: { p: Paleta; conSello: boolean }) {
  return (
    <>
      {/* Cuerpo */}
      <rect
        x="8.5"
        y="13"
        width="31"
        height="26"
        rx="3.5"
        fill="#fff"
        stroke={p.fuerte}
        strokeWidth="1.7"
      />
      {/* Cabecera: la banda de color que hace leer "calendario" y no "cuadro". */}
      <path d="M12 13h24a3.5 3.5 0 0 1 3.5 3.5V19h-31v-2.5A3.5 3.5 0 0 1 12 13Z" fill={p.suave} />
      <path d="M8.5 19h31" stroke={p.fuerte} strokeWidth="1.7" />
      {/* Anillos */}
      <path
        d="M16.5 9.5v5M31.5 9.5v5"
        stroke={p.fuerte}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Dias p={p} conSello={conSello} />
    </>
  );
}

/** El sello de abajo a la derecha: es lo único que cambia entre los estados. */
function Sello({ p, children }: { p: Paleta; children: React.ReactNode }) {
  return (
    <g>
      <circle cx="35" cy="34.5" r="8.6" fill="#fff" />
      <circle cx="35" cy="34.5" r="7.3" fill={p.fuerte} />
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

function Dibujo({ nombre, p }: { nombre: IlustracionImpuestoNombre; p: Paleta }) {
  switch (nombre) {
    case "calendario":
      return (
        <>
          <Calendario p={p} conSello={false} />
          {/* Un día marcado: el calendario es el de los vencimientos, no el de la pared. */}
          <rect x="23.7" y="22.5" width="3.8" height="3.8" rx="1.2" fill={p.fuerte} />
        </>
      );

    case "presentado":
      return (
        <>
          <Calendario p={p} conSello />
          <Sello p={p}>
            <path d="m31.7 34.6 2.4 2.4 4.3-4.9" {...TRAZO_BLANCO} />
          </Sello>
        </>
      );

    case "por-vencer":
      return (
        <>
          <Calendario p={p} conSello />
          <Sello p={p}>
            {/* Las agujas cerca de la hora: falta poco, todavía se llega. */}
            <path d="M35 31.1v3.4l2.4 1.9" {...TRAZO_BLANCO} />
          </Sello>
        </>
      );

    case "vencido":
      return (
        <>
          <Calendario p={p} conSello />
          <Sello p={p}>
            <path d="M35 30.9v4.2" {...TRAZO_BLANCO} />
            <circle cx="35" cy="38.1" r="1.15" fill="#fff" />
          </Sello>
        </>
      );
  }
}

export default function IlustracionImpuesto({
  nombre,
  size = 40,
  className,
}: {
  nombre: IlustracionImpuestoNombre;
  size?: number;
  className?: string;
}) {
  const p = PALETA[nombre];
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
