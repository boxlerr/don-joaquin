/**
 * Un dibujo propio para cada tipo de documento.
 *
 * Las tarjetas de "Por tipo de documento" mostraban el arte del ESTADO, así que
 * las once que están en 0% eran once veces el mismo papelito gris: para saber
 * cuál era la VTV había que leer el título de cada una. Acá cada tipo tiene su
 * objeto —la oblea de la VTV, la chapa de la patente, el casco de la ART— y se
 * encuentra por la forma antes que por el texto.
 *
 * SIGUE LA MISMA GRAMÁTICA que `IlustracionCompliance` (no inventar otra):
 *   · lienzo 48×48 con la placa redondeada (rx 13) en celeste;
 *   · el objeto ocupa el centro, relleno blanco y contorno #0088D1, trazo 1.7,
 *     puntas redondeadas, y los volúmenes secundarios en el celeste medio;
 *   · abajo a la derecha va un SELLO redondo con la marca del nivel —persona,
 *     camión o empresa—. Ese sello es el que separa los documentos que se
 *     llaman casi igual: el seguro de vida del chofer del de la empresa, o el
 *     libre de deuda sindical de cada uno.
 *
 * Son SVG y no imágenes por lo mismo que las otras: pesan poco, se ven nítidas
 * a cualquier tamaño y usan exactamente los colores del sistema.
 */

const FUERTE = "#0088D1";
const SUAVE = "#BAE6FD";
const PLACA = "#E1F5FE";

/** Nivel al que pertenece el documento: define el sello de abajo a la derecha. */
export type NivelArte = "chofer" | "unidad" | "empresa";

const LINEA = {
  fill: "none",
  stroke: FUERTE,
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const RELLENO = {
  fill: "#fff",
  stroke: FUERTE,
  strokeWidth: 1.7,
  strokeLinejoin: "round" as const,
};

const TRAZO_BLANCO = {
  fill: "none",
  stroke: "#fff",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** El sello del nivel. Va SIEMPRE en (34,34), como en las otras ilustraciones. */
function SelloNivel({ nivel }: { nivel: NivelArte }) {
  return (
    <g>
      <circle cx="34" cy="34" r="8.6" fill="#fff" />
      <circle cx="34" cy="34" r="7.3" fill={FUERTE} />
      {nivel === "chofer" && (
        <>
          <circle cx="34" cy="31.8" r="2" fill="#fff" />
          <path d="M30.6 37.8c0-2 1.5-3.2 3.4-3.2s3.4 1.2 3.4 3.2" {...TRAZO_BLANCO} />
        </>
      )}
      {nivel === "unidad" && (
        <>
          <path d="M30.2 31.4h4.2v4.2h-4.2z" {...TRAZO_BLANCO} />
          <path d="M34.4 32.8h2.1l1.3 1.4v1.4h-3.4z" {...TRAZO_BLANCO} />
          <circle cx="31.6" cy="36.9" r="1" fill="#fff" />
          <circle cx="36.3" cy="36.9" r="1" fill="#fff" />
        </>
      )}
      {nivel === "empresa" && (
        <>
          <path d="M30.4 37.6V31a.8.8 0 0 1 .8-.8h3.2a.8.8 0 0 1 .8.8v6.6" {...TRAZO_BLANCO} />
          <path d="M35.2 37.6v-3.9h2.4v3.9" {...TRAZO_BLANCO} />
          <path d="M29.8 37.7h8.4" {...TRAZO_BLANCO} />
        </>
      )}
    </g>
  );
}

/** La hoja con la esquina doblada — la base de casi todos los papeles. */
function Hoja({ lineas = 2 }: { lineas?: number }) {
  return (
    <>
      <path d="M13 9h11.5L32 16.5V33a2.5 2.5 0 0 1-2.5 2.5H13A2.5 2.5 0 0 1 10.5 33V11.5A2.5 2.5 0 0 1 13 9Z" {...RELLENO} />
      <path d="M24.5 9v5a2.5 2.5 0 0 0 2.5 2.5h5" {...LINEA} />
      {lineas > 0 && <rect x="14.5" y="20" width="11" height="2" rx="1" fill={SUAVE} />}
      {lineas > 1 && <rect x="14.5" y="24.5" width="7.5" height="2" rx="1" fill={SUAVE} />}
    </>
  );
}

/** Escudo: la forma de "esto está cubierto". */
function Escudo() {
  return <path d="M22 7.5 33.5 11v9.5c0 6.4-4.6 11-11.5 13.2C15.1 31.5 10.5 26.9 10.5 20.5V11z" {...RELLENO} />;
}

/**
 * Moneda con el signo de peso dibujado a mano (dos trazos, no un carácter: en
 * SVG el texto se rompe con las fuentes del sistema). Sin el signo, el círculo
 * se leía como un sello vacío.
 */
function Moneda({ x, y, r = 5 }: { x: number; y: number; r?: number }) {
  const k = r / 5.6;
  return (
    <>
      <circle cx={x} cy={y} r={r} {...RELLENO} />
      <path
        d={`M${x + 2 * k} ${y - 2.6 * k}h-${3.4 * k}a${1.6 * k} ${1.6 * k} 0 0 0 0 ${3.2 * k}h${2 * k}a${1.6 * k} ${1.6 * k} 0 0 1 0 ${3.2 * k}h-${3.4 * k}`}
        fill="none"
        stroke={FUERTE}
        strokeWidth={1.5 * k}
        strokeLinecap="round"
      />
      <path d={`M${x} ${y - 4.6 * k}v${9.2 * k}`} stroke={FUERTE} strokeWidth={1.3 * k} strokeLinecap="round" />
    </>
  );
}

/**
 * El borde ondulado de una oblea troquelada. Es lo que separa a la VTV del disco
 * de ruptura: los dos son un círculo del mismo tamaño, en tarjetas del mismo
 * nivel (así que llevan el mismo sello), y a 34px un círculo liso es igual a
 * otro círculo liso.
 */
function bordeOblea(cx: number, cy: number, r: number, dientes = 18): string {
  const paso = (Math.PI * 2) / dientes;
  let d = "";
  for (let i = 0; i < dientes; i++) {
    const a1 = i * paso;
    const a2 = (i + 1) * paso;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    if (i === 0) d += `M${x1.toFixed(2)} ${y1.toFixed(2)}`;
    d += ` A${(r * 0.36).toFixed(2)} ${(r * 0.36).toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return `${d}Z`;
}

/** El tilde de "esto está cumplido", en el color fuerte. */
function Tilde({ x, y, escala = 1 }: { x: number; y: number; escala?: number }) {
  return (
    <path
      d={`M${x} ${y} l${2.6 * escala} ${2.6 * escala} l${4.8 * escala} ${-5.6 * escala}`}
      fill="none"
      stroke={FUERTE}
      strokeWidth={2.2 * escala}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El dibujo de cada tipo. La clave es el `codigo` de compliance_requisitos.
// ─────────────────────────────────────────────────────────────────────────────

function Dibujo({ codigo }: { codigo: string }) {
  switch (codigo) {
    // ── Chofer ───────────────────────────────────────────────────────────────
    case "CARNET_CONDUCIR":
      // La licencia argentina es una tarjeta plástica horizontal con la foto a
      // la izquierda. Es el objeto, no un papel más.
      return (
        <>
          <rect x="7.5" y="13" width="31" height="21" rx="3" {...RELLENO} />
          <rect x="11" y="17" width="8.5" height="10" rx="1.6" fill={SUAVE} />
          <circle cx="15.25" cy="20.5" r="2" fill="#fff" />
          <path d="M12.1 25.6c0-1.8 1.4-2.9 3.15-2.9s3.15 1.1 3.15 2.9" fill="#fff" />
          <rect x="22.5" y="17.5" width="12.5" height="2" rx="1" fill={SUAVE} />
          <rect x="22.5" y="22" width="9" height="2" rx="1" fill={SUAVE} />
          <rect x="22.5" y="26.5" width="11" height="2" rx="1" fill={SUAVE} />
        </>
      );

    case "EPAP":
      // Apto psicofísico: la tabla del control médico con el latido.
      return (
        <>
          <rect x="9.5" y="10.5" width="24" height="26" rx="3" {...RELLENO} />
          <path d="M17 8h9a1.8 1.8 0 0 1 1.8 1.8v2.4H15.2V9.8A1.8 1.8 0 0 1 17 8Z" fill={SUAVE} stroke={FUERTE} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12.8 24h4l2-4.2 2.6 8 2.2-4.4h6.6" {...LINEA} />
          <rect x="12.8" y="30" width="11" height="2" rx="1" fill={SUAVE} />
        </>
      );

    case "SEGURO_VIDA":
      // Escudo con el corazón: la cobertura de la persona.
      return (
        <>
          <Escudo />
          <path
            d="M22 27.5c-4.6-2.6-6.8-5-6.8-7.6a3.4 3.4 0 0 1 6.8-1.4 3.4 3.4 0 0 1 6.8 1.4c0 2.6-2.2 5-6.8 7.6Z"
            fill={SUAVE}
            stroke={FUERTE}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </>
      );

    case "RECIBO_HABERES":
      // El recibo de sueldo: la hoja y el billete asomando en diagonal. El
      // billete va en celeste y desbordando la hoja — adentro y en blanco se
      // leía como un recuadro más del formulario.
      return (
        <>
          <Hoja lineas={1} />
          <g transform="rotate(-9 21 30)">
            <rect x="9" y="24.5" width="24" height="11.5" rx="2" fill={SUAVE} stroke={FUERTE} strokeWidth="1.7" />
            <circle cx="21" cy="30.2" r="3.4" fill="#fff" stroke={FUERTE} strokeWidth="1.5" />
            <path d="M22.2 28.5h-2a1 1 0 0 0 0 2h1.2a1 1 0 0 1 0 2h-2" fill="none" stroke={FUERTE} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M13 27.5v5.4M29 27.5v5.4" stroke={FUERTE} strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </>
      );

    case "COMP_PAGO_HABERES":
      // El comprobante: el ticket de borde dentado con el tilde de pagado. Se
      // dibuja distinto del recibo A PROPÓSITO — son dos papeles parecidos que
      // hay que poder separar de un vistazo.
      return (
        <>
          <path
            d="M11 10.5h22v25l-2.8-1.9-2.8 1.9-2.8-1.9-2.8 1.9-2.8-1.9-2.8 1.9-2.8-1.9-2.4 1.6z"
            {...RELLENO}
          />
          <rect x="14.5" y="15" width="14" height="2" rx="1" fill={SUAVE} />
          <rect x="14.5" y="19.5" width="9" height="2" rx="1" fill={SUAVE} />
          <Tilde x={15} y={26} escala={1.1} />
        </>
      );

    case "CH_LIBRE_DEUDA_SINDICAL":
    case "LIBRE_DEUDA_SINDICAL":
      // Libre de deuda: la hoja con la moneda y el tilde. Es el mismo documento
      // para el chofer y para la empresa, y los separa el sello del nivel.
      // El candado ABIERTO con el signo de peso: "no debe nada". Antes era otra
      // hoja con un tilde en un círculo, y el set ya tenía seis tildes y cinco
      // hojas — el recurso se volvía más visible que el objeto, y encima el
      // circulito competía con el sello del nivel.
      return (
        <>
          {/* El arco sale del cuerpo y queda levantado a la derecha: así se lee
              "abierto" y no un candado cerrado cualquiera. */}
          <path d="M14 20v-4.5a6.5 6.5 0 0 1 13 0V17" {...LINEA} strokeWidth="2.2" />
          <rect x="7.5" y="19.5" width="21" height="15.5" rx="3" {...RELLENO} />
          <path
            d="M20.4 24.6h-4.6a2.1 2.1 0 0 0 0 4.2h2.6a2.1 2.1 0 0 1 0 4.2h-4.6"
            fill="none"
            stroke={FUERTE}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M18 23v11.5" stroke={FUERTE} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );

    // ── Unidad ───────────────────────────────────────────────────────────────
    case "VTV":
      // La oblea redonda del parabrisas, que es como se ve la VTV en la calle.
      return (
        <>
          <path d="M8 26.5c1.5-8.5 4-13.5 7-15.5h14c3 2 5.5 7 7 15.5z" fill={SUAVE} stroke={FUERTE} strokeWidth="1.7" strokeLinejoin="round" />
          <path d={bordeOblea(22, 21.5, 9)} {...RELLENO} />
          <circle cx="22" cy="21.5" r="6.2" fill="none" stroke={SUAVE} strokeWidth="1.4" />
          <Tilde x={18.6} y={21.4} escala={1.15} />
        </>
      );

    case "SEGURO_UNIDAD":
      // Escudo MACIZO con el camión calado en blanco. La póliza de la flota es
      // otro escudo con camiones: a 34px dos escudos con contorno se leen igual,
      // así que lo que los separa no es el detalle de adentro sino el valor —
      // uno entra oscuro y el otro claro.
      return (
        <>
          <path d="M22 7.5 33.5 11v9.5c0 6.4-4.6 11-11.5 13.2C15.1 31.5 10.5 26.9 10.5 20.5V11z" fill={SUAVE} stroke={FUERTE} strokeWidth="1.7" strokeLinejoin="round" />
          <rect x="13.5" y="15.5" width="10" height="7.5" rx="1.6" fill="#fff" />
          <path d="M24 17.5h3.8l3.2 3V23H24z" fill="#fff" />
          <circle cx="17.5" cy="25.5" r="2.4" fill="#fff" />
          <circle cx="27.5" cy="25.5" r="2.4" fill="#fff" />
          <circle cx="17.5" cy="25.5" r="0.9" fill={FUERTE} />
          <circle cx="27.5" cy="25.5" r="0.9" fill={FUERTE} />
        </>
      );

    case "LIBRE_DEUDA_UNIDAD":
      // La chapa patente con el tilde: las deudas de la unidad son las patentes
      // y los impuestos, y la chapa no se confunde con ningún otro papel.
      return (
        <>
          <rect x="7.5" y="14" width="31" height="17" rx="2.6" {...RELLENO} />
          <rect x="7.5" y="14" width="31" height="4.6" rx="2.6" fill={SUAVE} />
          <circle cx="10.6" cy="16.3" r="0.9" fill="#fff" />
          <circle cx="35.4" cy="16.3" r="0.9" fill="#fff" />
          <rect x="11" y="21.5" width="6" height="6" rx="1.2" fill={SUAVE} />
          <rect x="19" y="21.5" width="6" height="6" rx="1.2" fill={SUAVE} />
          <Tilde x={26.5} y={24.5} escala={1.1} />
        </>
      );

    case "VERIF_ADICIONAL":
      // La lupa sobre el tanque: la revisión extra que pide Loma.
      return (
        <>
          <rect x="8" y="14.5" width="24" height="11" rx="5.5" {...RELLENO} />
          <path d="M13.5 14.5v11M20 14.5v11M26.5 14.5v11" stroke={SUAVE} strokeWidth="1.5" />
          <circle cx="26" cy="26" r="8" fill="#fff" stroke={FUERTE} strokeWidth="1.9" />
          <path d="M31.8 31.8 36 36" stroke={FUERTE} strokeWidth="2.4" strokeLinecap="round" />
          <Tilde x={22.6} y={25.8} escala={0.95} />
        </>
      );

    case "CERT_VALVULAS":
      // La válvula de seguridad del tanque: cuerpo, bridas, el volante grande
      // arriba y el vapor escapando. El volante es lo que la hace reconocible,
      // así que manda el tamaño.
      return (
        <>
          <path d="M11 22h22v6.5a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" {...RELLENO} />
          <path d="M8 23.5h3.5v5.5H8zM32.5 23.5H36v5.5h-3.5z" fill={SUAVE} stroke={FUERTE} strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="18.5" y="15.5" width="7" height="7" rx="1.4" fill={SUAVE} stroke={FUERTE} strokeWidth="1.6" />
          <circle cx="22" cy="12" r="6.2" {...RELLENO} />
          <circle cx="22" cy="12" r="2" fill={SUAVE} />
          <path d="M15.8 12h12.4M22 5.8v12.4M17.6 7.6l8.8 8.8M26.4 7.6l-8.8 8.8" stroke={FUERTE} strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case "CERT_DISCO_RUPTURA":
      // El disco de ruptura: la brida con los bulones y la línea de corte.
      return (
        <>
          <circle cx="21.5" cy="21.5" r="13" {...RELLENO} />
          <circle cx="21.5" cy="21.5" r="8" fill={SUAVE} stroke={FUERTE} strokeWidth="1.5" />
          <circle cx="21.5" cy="10.6" r="1.5" fill={FUERTE} />
          <circle cx="30.9" cy="16" r="1.5" fill={FUERTE} />
          <circle cx="30.9" cy="27" r="1.5" fill={FUERTE} />
          <circle cx="12.1" cy="16" r="1.5" fill={FUERTE} />
          <circle cx="12.1" cy="27" r="1.5" fill={FUERTE} />
          {/* La fisura, que es lo que distingue al disco de ruptura de una
              tapa cualquiera: va en el color fuerte y gruesa. */}
          <path d="M17.5 27l3.2-4.6-2.4-2.6 4.2-4.2" fill="none" stroke={FUERTE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    // ── Empresa ──────────────────────────────────────────────────────────────
    case "EMP_CERT_COBERTURA":
      // El paraguas: cobertura vigente, y se renueva todos los meses.
      return (
        <>
          <path d="M7 22.5c0-8 6.7-13.5 15-13.5s15 5.5 15 13.5z" {...RELLENO} />
          <path d="M7 22.5c2.5 0 3.7-2.6 5-2.6s2.5 2.6 5 2.6 3.7-2.6 5-2.6 2.5 2.6 5 2.6 3.7-2.6 5-2.6 2.5 2.6 5 2.6" fill={SUAVE} stroke={FUERTE} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M22 9v20a3.5 3.5 0 0 1-7 0" {...LINEA} />
        </>
      );

    case "EMP_POLIZA_SEGURO_FLOTA":
      // Escudo con DOS camiones, uno detrás del otro: la póliza cubre la flota,
      // no una unidad. Con tres se leían como rayas apiladas.
      return (
        <>
          <Escudo />
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${i === 0 ? 2.5 : -2.5} ${i * 8.5})`} opacity={i === 0 ? 0.55 : 1}>
              <rect x="12" y="14.5" width="10" height="6" rx="1.5" fill={SUAVE} stroke={FUERTE} strokeWidth="1.5" />
              <path d="M22.5 16h3.4l2.6 2.4v2.1h-6z" fill={SUAVE} stroke={FUERTE} strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="16" cy="21.6" r="1.7" fill="#fff" stroke={FUERTE} strokeWidth="1.4" />
              <circle cx="25.5" cy="21.6" r="1.7" fill="#fff" stroke={FUERTE} strokeWidth="1.4" />
            </g>
          ))}
        </>
      );

    case "EMP_SEGURO_VIDA":
      // Escudo con DOS personas: el seguro obligatorio cubre a todo el personal.
      return (
        <>
          <Escudo />
          <circle cx="17.5" cy="18" r="3.1" fill={SUAVE} stroke={FUERTE} strokeWidth="1.5" />
          <path d="M12.4 27c0-3 2.3-4.8 5.1-4.8s5.1 1.8 5.1 4.8" fill="#fff" stroke={FUERTE} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="26.5" cy="19.5" r="2.7" fill={SUAVE} stroke={FUERTE} strokeWidth="1.5" />
          <path d="M22 27.5c0-2.7 2-4.3 4.5-4.3s4.5 1.6 4.5 4.3" fill="#fff" stroke={FUERTE} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      );

    case "ART":
      // El casco: riesgos del trabajo se lee antes por el casco que por un papel.
      return (
        <>
          <path d="M8.5 28.5c0-8.3 6-15 13.5-15s13.5 6.7 13.5 15z" {...RELLENO} />
          <path d="M17 14.6c0-3.4 1.6-5.6 5-5.6s5 2.2 5 5.6" fill={SUAVE} stroke={FUERTE} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6.5 28.5h31" stroke={FUERTE} strokeWidth="2" strokeLinecap="round" />
          <path d="M19.5 21.5h5M22 19v5" stroke={FUERTE} strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case "F931":
      // La declaración jurada con el sello oficial: es el papel que traba todo
      // si no se presenta.
      return (
        <>
          <Hoja lineas={0} />
          <rect x="14.5" y="20" width="13" height="1.9" rx="0.95" fill={SUAVE} />
          <rect x="14.5" y="24" width="13" height="1.9" rx="0.95" fill={SUAVE} />
          <rect x="14.5" y="28" width="8" height="1.9" rx="0.95" fill={SUAVE} />
          <circle cx="12" cy="14.5" r="4.4" fill="#fff" stroke={FUERTE} strokeWidth="1.6" transform="rotate(-14 12 14.5)" />
          <path d="M9.4 12.2 14.6 16.8M14.6 12.2 9.4 16.8" stroke={SUAVE} strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case "NOMINA_F931":
      // La nómina: la misma declaración pero con la lista de las personas.
      return (
        <>
          <Hoja lineas={0} />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${i * 6.4})`}>
              <circle cx="16" cy="20.5" r="2.2" fill={SUAVE} stroke={FUERTE} strokeWidth="1.3" />
              <rect x="20" y="19.5" width="9.5" height="2" rx="1" fill={SUAVE} />
            </g>
          ))}
        </>
      );

    case "SINDICALES":
      // Los aportes que se depositan todos los meses: la moneda entrando.
      return (
        <>
          <path d="M9 20h26v13a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 9 33z" {...RELLENO} />
          <path d="M9 20h26" stroke={FUERTE} strokeWidth="1.7" strokeLinecap="round" />
          <rect x="17.5" y="25" width="9" height="2.4" rx="1.2" fill={SUAVE} />
          <Moneda x={22} y={11} r={5.4} />
          <path d="M22 16.6v2.4" stroke={FUERTE} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );

    default:
      // Cualquier requisito nuevo entra con la hoja genérica: mejor eso que un
      // hueco. Cuando alguien le dibuje el suyo, se agrega acá arriba.
      return <Hoja lineas={2} />;
  }
}

/** Qué nivel tiene cada tipo, para el sello. Sale de `compliance_requisitos.nivel`. */
export default function ArteTipoDocumento({
  codigo,
  nivel,
  size = 34,
  className,
}: {
  codigo: string;
  nivel: NivelArte;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
      focusable="false"
    >
      <rect width="48" height="48" rx="13" fill={PLACA} />
      <Dibujo codigo={codigo} />
      <SelloNivel nivel={nivel} />
    </svg>
  );
}
