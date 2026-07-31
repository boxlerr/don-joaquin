// Avatar de persona: la foto si existe y, si no, la silueta del área.
//
// Antes acá iban las iniciales. Con 77 legajos en pantalla, dos letras al lado
// del nombre no agregaban nada —el nombre ya está escrito— y encima se
// confundían entre sí ("JC", "JH", "JK"). La silueta dice de un vistazo de qué
// área es la persona; el color, que sale del nombre, la distingue de sus
// compañeros de la misma área.
//
// Las tres siluetas las dibujó Julián (chofer con gorra, oficina con anteojos y
// camisa, taller con las llaves en el bolsillo). Están en `public/avatares/` como
// PNG de transparencia pura: no tienen color propio, sólo la forma. Se pintan por
// CSS con `mask-image`, así una misma imagen sirve para los diez colores de la
// paleta y no hay que generar un archivo por combinación.

/** Roles tal como vienen de `choferes.rol`. */
export type RolPersona = "chofer" | "administrativo" | "mantenimiento" | "fletero";

interface Props {
  /** Nombre en formato "Apellido, Nombre" o "Nombre Apellido". Define el color. */
  name: string;
  /** Lado del avatar en px. */
  size?: number;
  /** URL de la foto de perfil. Si hay foto, gana la foto. */
  src?: string | null;
  /**
   * Área de la persona. Si no se pasa, va la silueta de oficina: es lo razonable
   * para usuarios del sistema (quien cargó un viaje, por ejemplo), que no tienen
   * área de flota.
   */
  rol?: RolPersona | string | null;
  /** Texto del tooltip. Por defecto, el nombre. */
  title?: string;
  className?: string;
}

// Paleta sobria (no neón) — se elige de forma determinística según el nombre.
const PALETTE = [
  "#0088D1", // azul marca
  "#0277BD",
  "#7C3AED", // violeta
  "#4F46E5", // índigo
  "#059669", // esmeralda
  "#0D9488", // teal
  "#D97706", // ámbar
  "#DC2626", // rojo
  "#DB2777", // rosa
  "#475569", // slate
];

/**
 * Identidad de la persona, sin importar cómo escribió el nombre cada pantalla.
 *
 * El color salía de hashear el string tal cual llegaba, y cada pantalla lo arma
 * distinto: Vacaciones manda "Miguel Angel Pittana" y el listado de viajes
 * "Pittana, Miguel Angel". Mismo chofer, dos hashes, dos colores — el avatar
 * parecía de otra persona según dónde se lo mirara.
 *
 * Así que la clave se canoniza: sin acentos, sin puntuación, en minúsculas y con
 * las palabras ordenadas. Cualquier orden del mismo nombre cae en el mismo
 * color, que es lo único que hace que el avatar sea DE la persona y no de la
 * pantalla.
 */
export function claveIdentidad(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** El color de una persona. Estable en todo el sistema. */
export function colorDePersona(nombre: string): string {
  return PALETTE[hashNombre(claveIdentidad(nombre)) % PALETTE.length]!;
}

/** Hash simple y estable (djb2) para elegir el color por nombre. */
function hashNombre(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Acepta tanto el `rol` de la base ("chofer", "mantenimiento"…) como el nombre
 * del área que usa Vacaciones ("Chofer", "Taller", "Oficina"), para no obligar a
 * cada pantalla a traducir antes de dibujar. Los fleteros manejan, así que van
 * con la misma silueta que los choferes.
 */
function archivoDe(rol?: string | null): "chofer" | "taller" | "oficina" {
  const r = (rol ?? "").toLowerCase();
  if (r === "chofer" || r === "fletero") return "chofer";
  if (r === "mantenimiento" || r === "taller") return "taller";
  return "oficina";
}

/** Estilos de la máscara. El color va como fondo y el PNG recorta la forma. */
function estiloSilueta(rol: string | null | undefined, color: string): React.CSSProperties {
  const url = `url(/avatares/${archivoDe(rol)}.png)`;
  return {
    backgroundColor: color,
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center bottom",
    maskPosition: "center bottom",
  };
}

export function SiluetaPersona({ rol, className = "" }: { rol?: string | null; className?: string }) {
  // Para los lugares que YA tienen su propio círculo (el legajo y la tarjeta de
  // chofer, que además dejan subir la foto encima): ahí sólo hace falta el
  // dibujo, no otro círculo con su borde. El color lo hereda del contenedor.
  return <span className={`block h-full w-full ${className}`} style={estiloSilueta(rol, "currentColor")} />;
}

export default function AvatarPersona({
  name,
  size = 36,
  src,
  rol,
  title,
  className = "",
}: Props) {
  const color = colorDePersona(name);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-end justify-center overflow-hidden rounded-full shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}1F`, // ~12% de opacidad
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
      title={title ?? name}
    >
      {/* Bien grande dentro del círculo: la silueta es el dato, no un adorno. */}
      <span className="block h-[94%] w-[94%]" style={estiloSilueta(rol, color)} />
    </span>
  );
}
