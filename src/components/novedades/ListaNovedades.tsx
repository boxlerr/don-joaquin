"use client";

import Link from "next/link";
import { ChevronRight, Sparkles, Wand2, Wrench, type LucideIcon } from "lucide-react";
import type { Novedad, NovedadTipo } from "@/lib/novedades";

/**
 * La lista de novedades del sistema, en un solo lugar.
 *
 * La usan los dos lados: el pop-up del día (`ResumenDiarioModal`, apretada, con
 * las que la persona todavía no vio) y la pantalla /novedades (el historial
 * completo). Una sola definición para que una novedad se reconozca igual en los
 * dos lugares — que es todo el punto de que tengan ícono y color.
 *
 * Por qué íconos y no emojis, que fue lo primero que se pidió: en pantalla el
 * emoji lo dibuja cada sistema operativo a su manera y en Windows la mitad salen
 * en blanco y negro, justo donde se usa el sistema. Los emojis quedan para el
 * mail, que es donde no se puede mandar un SVG (ver `CATEGORIA_ESTILO`). El
 * ícono sobre su color al 10% es el mismo lenguaje que ya usan las tarjetas del
 * resumen del día.
 */

type Estilo = { label: string; icono: LucideIcon; color: string };

/**
 * Qué es cada cambio, en una palabra. El color es lo que hace que se distingan
 * de un vistazo: verde lo que antes no existía, azul lo que se hizo más fácil,
 * ámbar lo que estaba mal y se arregló.
 */
export const TIPO_ESTILO: Record<NovedadTipo, Estilo> = {
  nuevo: { label: "Nuevo", icono: Sparkles, color: "#059669" },
  mejora: { label: "Mejora", icono: Wand2, color: "#0088D1" },
  arreglo: { label: "Arreglo", icono: Wrench, color: "#D97706" },
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "2026-08-11" → "mar 11/8". La fecha se arma con los tres números sueltos y no
 * con `new Date(iso)`: ese constructor lee el string como UTC y en Argentina
 * devuelve el día anterior.
 */
export function fechaCortaISO(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${DIAS[new Date(y, m - 1, d).getDay()]} ${d}/${m}`;
}

/** "2026-08-11" → "martes 11 de agosto". Para los cortes de la pantalla larga. */
export function fechaLargaISO(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dia = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][
    new Date(y, m - 1, d).getDay()
  ];
  return `${dia} ${d} de ${MESES[m - 1]}`;
}

/** El mismo color al 10%, para el fondo del ícono. */
function tinte(color: string): string {
  return `${color}1A`;
}

/**
 * Una novedad: el ícono de qué clase de cambio es, qué se puede hacer ahora y —
 * en letra chica— cómo era antes.
 *
 * `onIr` existe para el pop-up: adentro del modal el click tiene que navegar Y
 * cerrar el cartel, así que no puede ser un `<Link>` suelto. Sin `onIr` (la
 * pantalla /novedades) es un enlace común, con su menú contextual y su
 * "abrir en pestaña nueva".
 */
export function NovedadFila({
  novedad: n,
  onIr,
  amplia = false,
}: {
  novedad: Novedad;
  onIr?: (href: string) => void;
  /** La pantalla /novedades tiene lugar de sobra; el pop-up no. */
  amplia?: boolean;
}) {
  const estilo = TIPO_ESTILO[n.tipo];
  const Icono = estilo.icono;

  const contenido = (
    <>
      <span
        className={`grid shrink-0 place-items-center rounded-xl ${amplia ? "size-11" : "size-9"}`}
        style={{ backgroundColor: tinte(estilo.color), color: estilo.color }}
        aria-hidden
      >
        <Icono size={amplia ? 20 : 17} />
      </span>

      <span className="min-w-0 flex-1">
        {/* El rótulo y la fecha van ARRIBA del título: es la línea que dice de
            qué se trata antes de leer nada, y abajo el título queda pegado a su
            detalle en vez de separado por letra chica. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: estilo.color }}
          >
            {estilo.label}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {fechaCortaISO(n.fecha)}
          </span>
        </span>
        <span
          className={`mt-0.5 block font-semibold leading-snug text-foreground ${
            amplia ? "text-[15px]" : "text-[13.5px]"
          }`}
        >
          {n.titulo}
        </span>
        {n.detalle && (
          <span
            className={`mt-1 block leading-relaxed text-muted-foreground ${
              amplia ? "text-[13px]" : "text-[12px]"
            }`}
          >
            {n.detalle}
          </span>
        )}
      </span>

      {n.href && (
        <ChevronRight
          size={15}
          className="mt-0.5 shrink-0 self-center text-muted-foreground/40 transition-colors group-hover:text-primary"
          aria-hidden
        />
      )}
    </>
  );

  const clases = `group flex w-full gap-3 text-left ${amplia ? "px-4 py-4" : "px-3 py-3"}`;

  if (!n.href) return <div className={clases}>{contenido}</div>;

  const href = n.href;
  if (onIr) {
    return (
      <button type="button" onClick={() => onIr(href)} className={`${clases} transition-colors hover:bg-muted/50`}>
        {contenido}
      </button>
    );
  }
  return (
    <Link href={href} className={`${clases} transition-colors hover:bg-muted/50`}>
      {contenido}
    </Link>
  );
}

/** El panel: las novedades una abajo de la otra, con separadores finos. */
export default function ListaNovedades({
  items,
  onIr,
  amplia = false,
}: {
  items: Novedad[];
  onIr?: (href: string) => void;
  amplia?: boolean;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
      {items.map((n) => (
        <li key={n.id}>
          <NovedadFila novedad={n} onIr={onIr} amplia={amplia} />
        </li>
      ))}
    </ul>
  );
}
