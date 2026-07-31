"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/**
 * Barra de saldo de la caja: un solo bloque en lugar de las tarjetas sueltas.
 * Arriba los controles del período, abajo el saldo —que es a lo que se entra a
 * mirar— y a la derecha el resto de las cifras, separadas por divisores finos.
 *
 * No agrega información: son los mismos números que había en las cards.
 */

type Tono = "neutro" | "ingreso" | "egreso";

export type Metrica = {
  label: string;
  /** `null` = el dato no existe para este período (se muestra "—"). */
  value: number | null;
  /** Los montos llevan signo y centavos atenuados; las cantidades, no. */
  formato?: "moneda" | "cantidad";
  sub?: string;
  tono?: Tono;
  /** Si se pasa, la métrica navega (por ejemplo, facturación → /viajes). */
  href?: string;
};

const TONO: Record<Tono, string> = {
  neutro: "text-foreground",
  ingreso: "text-emerald-600",
  egreso: "text-rose-600",
};

const FLECHA: Partial<Record<Tono, typeof ArrowUpRight>> = {
  ingreso: ArrowUpRight,
  egreso: ArrowDownRight,
};

function Placeholder({ className }: { className: string }) {
  return <span className={`inline-block animate-pulse rounded bg-muted ${className}`} />;
}

/**
 * Monto en pesos con los centavos en cuerpo menor: el ojo va al número entero,
 * que es lo que se compara de un vistazo, sin perder la precisión exacta.
 */
function Monto({ valor }: { valor: number }) {
  const [entero, centavos] = Math.abs(valor)
    .toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(",");
  return (
    <>
      {valor < 0 && <span className="mr-0.5">−</span>}
      <span className="mr-1 text-[0.62em] font-medium opacity-55">$</span>
      {entero}
      <span className="ml-px text-[0.6em] opacity-50">,{centavos}</span>
    </>
  );
}

function Valor({
  value,
  formato = "moneda",
  cargando,
  className,
  placeholder,
}: {
  value: number | null;
  formato?: Metrica["formato"];
  cargando: boolean;
  className: string;
  /** Alto y ancho de la barra que ocupa el lugar del número mientras carga. */
  placeholder: string;
}) {
  if (cargando) return <Placeholder className={placeholder} />;
  return (
    <p className={`tabular-nums tracking-tight ${className}`}>
      {value === null ? (
        <span className="text-muted-foreground/50">—</span>
      ) : formato === "cantidad" ? (
        value.toLocaleString("es-AR")
      ) : (
        <Monto valor={value} />
      )}
    </p>
  );
}

function MetricaItem({ metrica, cargando }: { metrica: Metrica; cargando: boolean }) {
  const { label, value, formato, sub, tono = "neutro", href } = metrica;
  const Flecha = FLECHA[tono];

  const clases = `group flex min-w-[9rem] flex-1 flex-col justify-center gap-1 px-5 py-4 ${
    href ? "transition-colors hover:bg-muted/40" : ""
  }`;

  const contenido = (
    <>
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {Flecha && <Flecha size={11} className={`${TONO[tono]} opacity-70`} />}
        {label}
        {href && (
          <ArrowUpRight
            size={12}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </span>
      <Valor
        value={value}
        formato={formato}
        cargando={cargando}
        className={`text-2xl font-semibold ${TONO[tono]}`}
        placeholder="h-6 w-28"
      />
      {sub && <p className="truncate text-[11px] text-muted-foreground/80">{sub}</p>}
    </>
  );

  return href ? (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

/** Lo que va y viene hoy, sin importar qué período se esté mirando arriba. */
export type Hoy = { fecha: string; ingresos: number; egresos: number; movimientos: number };

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Franja del día en curso. Es la pregunta del cierre —"¿cómo venimos hoy?"— y no
 * depende del período elegido, así que va abajo de todo y en una sola línea.
 */
function FranjaHoy({ hoy, cargando }: { hoy: Hoy | null; cargando: boolean }) {
  const neto = hoy ? hoy.ingresos - hoy.egresos : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-b-xl border-t border-border bg-muted/20 px-5 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        Hoy{hoy && ` · ${fechaCorta(hoy.fecha)}`}
      </span>

      {cargando ? (
        <Placeholder className="h-4 w-64" />
      ) : hoy && hoy.movimientos > 0 ? (
        <>
          <span className="text-sm text-muted-foreground">
            Entró{" "}
            <span className="font-semibold tabular-nums text-emerald-600">
              <Monto valor={hoy.ingresos} />
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            Salió{" "}
            <span className="font-semibold tabular-nums text-rose-600">
              <Monto valor={hoy.egresos} />
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            Neto{" "}
            <span
              className={`font-semibold tabular-nums ${
                neto < 0 ? "text-rose-600" : "text-foreground"
              }`}
            >
              <Monto valor={neto} />
            </span>
          </span>
          <span className="text-xs text-muted-foreground/70">
            {hoy.movimientos} {hoy.movimientos === 1 ? "movimiento" : "movimientos"}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground/70">
          Todavía no se cargaron movimientos
        </span>
      )}
    </div>
  );
}

interface Props {
  saldo: number | null;
  /** Qué caja se está mirando: "Caja chica · histórico", etc. */
  saldoSub: string;
  metricas: Metrica[];
  /** Todavía no llegó el resumen del servidor. */
  cargando: boolean;
  /** Controles del período: van en la franja superior del mismo bloque. */
  controles?: ReactNode;
  /** Nota al margen de la franja (por ejemplo, la ventana de la caja chica). */
  nota?: ReactNode;
  /** Totales del día en curso, para la franja de abajo. */
  hoy?: Hoy | null;
}

export default function ResumenCaja({
  saldo,
  saldoSub,
  metricas,
  cargando,
  controles,
  nota,
  hoy = null,
}: Props) {
  // Ojo: nada de `overflow-hidden` acá. El calendario del período vive dentro de
  // este bloque y se posiciona con `absolute`, así que recortar el contenedor lo
  // cortaba por la mitad. Las esquinas se redondean franja por franja.
  return (
    <section className="mb-5 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {(controles || nota) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-border bg-muted/20 px-3 py-2">
          {controles}
          {nota && <div className="px-2 text-xs text-muted-foreground/80">{nota}</div>}
        </div>
      )}

      <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
        {/* Saldo: el dato principal, sobre un tinte de marca apenas perceptible
            para que el bloque tenga peso sin cambiar de color la pantalla. */}
        <div className="relative flex flex-col justify-center gap-2 bg-gradient-to-r from-primary/[0.045] to-transparent px-6 py-7 lg:w-[21rem] lg:shrink-0">
          <span className="absolute inset-y-6 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Saldo actual
          </p>
          <Valor
            value={saldo}
            cargando={cargando}
            className="text-[2.4rem] font-semibold leading-none text-foreground"
            placeholder="h-9 w-56"
          />
          <p className="text-[11px] text-muted-foreground/80">{saldoSub}</p>
        </div>

        <div className="flex flex-1 flex-wrap divide-x divide-border sm:flex-nowrap">
          {metricas.map((m) => (
            <MetricaItem key={m.label} metrica={m} cargando={cargando} />
          ))}
        </div>
      </div>

      <FranjaHoy hoy={hoy} cargando={cargando} />
    </section>
  );
}
