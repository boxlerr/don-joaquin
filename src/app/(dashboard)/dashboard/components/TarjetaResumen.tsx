import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

/**
 * Ficha del bloque de cierre del dashboard. Antes esa zona tenía tres diseños
 * distintos conviviendo (tarjetas con silueta SVG, tarjetas de alerta y
 * contadores chicos), cada una con su alto, y quedaban huecos en blanco cuando
 * una fila no emparejaba. Ahora es una sola pieza con dos tamaños.
 *
 * Las grandes llevan foto de verdad: ocupa la mitad derecha de la tarjeta y se
 * disuelve hacia la izquierda, donde va el texto. La primera versión la ponía
 * de fondo al 16% de opacidad y no se veía nada — quedaba una tarjeta blanca
 * con una mancha. Las chicas no llevan foto (a ese tamaño es ruido): llevan un
 * lavado del color de su tono y el ícono agrandado de marca de agua.
 */

export type TonoTarjeta = "brand" | "violeta" | "verde" | "rojo" | "ambar" | "gris";

const TONOS: Record<TonoTarjeta, { de: string; a: string; texto: string; suave: string }> = {
  brand: { de: "#0088D1", a: "#004A99", texto: "text-[#0088D1]", suave: "#0088D1" },
  violeta: { de: "#8B5CF6", a: "#6D28D9", texto: "text-[#7C3AED]", suave: "#8B5CF6" },
  verde: { de: "#10B981", a: "#059669", texto: "text-[#059669]", suave: "#10B981" },
  rojo: { de: "#F43F5E", a: "#BE123C", texto: "text-[#E11D48]", suave: "#F43F5E" },
  ambar: { de: "#FFB300", a: "#D97706", texto: "text-[#D97706]", suave: "#F59E0B" },
  gris: { de: "#94A3B8", a: "#475569", texto: "text-[#475569]", suave: "#94A3B8" },
};

interface Props {
  icon: LucideIcon;
  titulo: string;
  /** Renglón explicativo. Solo en tamaño "grande". */
  descripcion?: string;
  valor: string;
  /** Palabra que acompaña al número ("unidades", "legajos"). */
  unidad?: string;
  href: string;
  tono?: TonoTarjeta;
  tamano?: "grande" | "chica";
  /** Chips bajo el número (el desglose del personal). */
  chips?: { label: string; value: number | string }[];
  /** Foto de la mitad derecha. Solo tiene sentido en tamaño "grande". */
  imagen?: string;
  /** Encuadre de la foto, si el motivo no está centrado. */
  imagenPos?: string;
  /** Tiñe el borde con el color del tono: hay algo que atender acá. */
  destacada?: boolean;
}

export default function TarjetaResumen({
  icon: Icon,
  titulo,
  descripcion,
  valor,
  unidad,
  href,
  tono = "brand",
  tamano = "grande",
  chips,
  imagen,
  imagenPos = "center",
  destacada = false,
}: Props) {
  const t = TONOS[tono];
  const grande = tamano === "grande";
  const conFoto = Boolean(imagen) && grande;

  if (!grande) {
    return (
      <a
        href={href}
        className="group relative flex items-center gap-3 overflow-hidden rounded-[12px] border border-border bg-card p-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_22px_-14px_rgba(0,74,153,0.4)] sm:p-4"
      >
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 160% at 100% 0%, ${t.suave}1F 0%, ${t.suave}0A 42%, rgba(255,255,255,0) 72%)`,
          }}
          aria-hidden
        />
        <Icon
          aria-hidden
          // Al medio y no contra la derecha: ahí es donde la tarjeta está vacía.
          // Pegada al borde le quedaba justo atrás del número y lo ensuciaba.
          className="pointer-events-none absolute -bottom-3 left-[46%] transition-transform duration-500 group-hover:scale-110"
          size={56}
          strokeWidth={1.2}
          style={{ color: t.suave, opacity: 0.1 }}
        />

        <span
          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.55)] transition-transform duration-300 group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${t.de} 0%, ${t.a} 100%)` }}
        >
          <Icon size={17} strokeWidth={2.4} />
        </span>

        <span className="relative min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase leading-tight tracking-wider text-muted-foreground">
            {titulo}
          </span>
        </span>

        <span className={`relative shrink-0 text-[22px] font-black leading-none tracking-tight tabular-nums ${t.texto}`}>
          {valor}
        </span>
        <ChevronRight
          size={15}
          className="relative shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-[12px] border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(0,74,153,0.45)]"
      style={{
        borderColor: destacada ? `${t.suave}66` : undefined,
        backgroundColor: !conFoto && destacada ? `${t.suave}0D` : undefined,
      }}
    >
      {conFoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorativa y fija: no hay nada que optimizar */}
          <img
            src={imagen}
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-[68%] object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ objectPosition: imagenPos }}
          />
          {/* La foto se disuelve hacia la izquierda: del lado del texto la
              tarjeta sigue siendo blanca y el contraste no se negocia. */}
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 42%, rgba(255,255,255,0.93) 56%, rgba(255,255,255,0.55) 74%, rgba(255,255,255,0.08) 100%)",
            }}
            aria-hidden
          />
        </>
      ) : (
        <>
          {/* Sin foto: un lavado del color del tono en la esquina y el ícono
              agrandado de marca de agua. Nada de blanco pelado. */}
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120% 150% at 100% 0%, ${t.suave}1F 0%, ${t.suave}0A 42%, rgba(255,255,255,0) 72%)`,
            }}
            aria-hidden
          />
          <Icon
            aria-hidden
            className="pointer-events-none absolute -bottom-3 -right-2 transition-transform duration-500 group-hover:scale-110"
            size={96}
            strokeWidth={1.2}
            style={{ color: t.suave, opacity: 0.1 }}
          />
        </>
      )}

      <div className="relative flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.55)] transition-transform duration-300 group-hover:scale-105 sm:size-11"
            style={{ background: `linear-gradient(135deg, ${t.de} 0%, ${t.a} 100%)` }}
          >
            <Icon size={19} strokeWidth={2.4} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight text-foreground">{titulo}</p>
            {descripcion && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
            )}
          </div>

          <ChevronRight
            size={15}
            className="mt-0.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </div>

        <div className="mt-auto">
          <p className="flex items-baseline gap-1.5">
            <span className={`text-[30px] font-black leading-none tracking-tight ${t.texto}`}>
              {valor}
            </span>
            {unidad && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
                {unidad}
              </span>
            )}
          </p>

          {chips && chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-sm"
                >
                  <span className="font-black tabular-nums">{c.value}</span>
                  <span className="uppercase tracking-wider text-muted-foreground">{c.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
