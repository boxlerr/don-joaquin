// Avatar de perfil reutilizable: muestra la foto si existe, y si no las iniciales
// del nombre con un color estable derivado del propio nombre (así cada persona
// tiene siempre el mismo color). Pensado para choferes/usuarios; hoy no hay fotos
// cargadas, pero deja el lugar listo para cuando se suban (`src`).

interface Props {
  /** Nombre en formato "Apellido, Nombre" o "Nombre Apellido". */
  name: string;
  /** Lado del avatar en px. */
  size?: number;
  /** URL de la foto de perfil (opcional; si no hay, se muestran las iniciales). */
  src?: string | null;
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

/** Iniciales: primera letra del apellido + primera del nombre. Soporta
 *  "Apellido, Nombre" (formato del sistema) y "Nombre Apellido". */
function inicialesDe(name: string): string {
  const limpio = name.trim();
  if (!limpio) return "?";
  if (limpio.includes(",")) {
    const [ape, nom] = limpio.split(",");
    const a = ape.trim()[0] ?? "";
    const n = nom.trim()[0] ?? "";
    return (a + n).toUpperCase() || "?";
  }
  const partes = limpio.split(/\s+/).filter(Boolean);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || a.toUpperCase() || "?";
}

/** Hash simple y estable (djb2) para elegir el color por nombre. */
function hashNombre(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

export default function InitialsAvatar({ name, size = 36, src, className = "" }: Props) {
  const color = PALETTE[hashNombre(name) % PALETTE.length];

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
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundColor: `${color}1F`, // ~12% de opacidad
        color,
        // ring-color vía box-shadow inset para no depender de una clase con var
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
      title={name}
    >
      {inicialesDe(name)}
    </span>
  );
}
