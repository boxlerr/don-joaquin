"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";

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

  const clases = `group flex min-w-[9rem] max-sm:basis-full flex-1 flex-col justify-center gap-1 px-4 py-3 sm:px-5 sm:py-4 ${
    href ? "transition-colors hover:bg-muted/40" : ""
  }`;

  const contenido = (
    <>
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {Flecha && <Flecha size={11} className={`${TONO[tono]} opacity-70`} />}
        {label}
        {href && (
          // En celular no hay hover: la flechita de "esto navega" se ve siempre.
          <ArrowUpRight
            size={12}
            className="opacity-60 transition-opacity md:opacity-0 md:group-hover:opacity-100"
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

const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "2026-08-11" → "martes 11 de agosto". Se arma con los tres números sueltos y
 * NO con `new Date(iso)`: ese constructor lee el string como UTC y en Argentina
 * devuelve el día anterior.
 */
function fechaLarga(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${DIAS_LARGO[new Date(y, m - 1, d).getDay()]} ${d} de ${MESES_LARGO[m - 1]}`;
}

/** Fecha local de la máquina en "YYYY-MM-DD" (nunca `toISOString`, que es UTC). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const SEGUNDO_MS = 1000;

/** El tic del reloj: una suscripción como cualquier otra fuente externa. */
function suscribirAlSegundo(alCambiar: () => void): () => void {
  const id = setInterval(alCambiar, SEGUNDO_MS);
  return () => clearInterval(id);
}

/**
 * El segundo en curso, como número.
 *
 * Devuelve el MISMO valor durante todo el segundo a propósito: React compara la
 * foto anterior con la nueva usando `Object.is`, y un `new Date()` sería un
 * objeto distinto en cada lectura — lo que dispara el "getSnapshot should be
 * cached" y un render infinito.
 */
function segundoActual(): number {
  return Math.floor(Date.now() / SEGUNDO_MS);
}

/**
 * En el server no hay reloj que sirva: corre en UTC y en otra máquina. El HTML
 * sale sin hora y el navegador la completa apenas hidrata; si se dibujara del
 * lado del server, React encontraría dos horas distintas y tiraría el error de
 * hidratación en la cara del usuario.
 */
function sinReloj(): null {
  return null;
}

/**
 * El día y la hora, arriba de todo en la franja de hoy y andando.
 *
 * Pedido de Julián (11/08/2026): "ver en grande el día actual y la hora que se
 * vaya actualizando". No es adorno — la caja se carga contra el día, y tener el
 * día a la vista mientras se anota un movimiento es lo que evita el clásico de
 * cargar el lunes lo del viernes.
 *
 * Dos detalles que no son obvios:
 *
 *  - La hora sale del navegador y no del server (ver `sinReloj`), así que el
 *    primer dibujo no la tiene: es "--:--:--" por un instante y no un error de
 *    hidratación.
 *  - El DÍA que se muestra es el del SERVIDOR (`fecha`), no el de la máquina:
 *    es el que va a llevar el movimiento cuando se guarde. Si la computadora
 *    marca otro día, se avisa en vez de mostrar dos fechas distintas sin
 *    explicación — que es justo el "más confiable" del pedido.
 */
function RelojHoy({ fecha }: { fecha: string | null }) {
  // El reloj del sistema es un dato de AFUERA de React, así que se lee como
  // tal: `useSyncExternalStore` se encarga solo de suscribir, desuscribir y
  // dibujar el HTML del server sin hora.
  const segundo = useSyncExternalStore<number | null>(suscribirAlSegundo, segundoActual, sinReloj);
  const ahora = segundo === null ? null : new Date(segundo * SEGUNDO_MS);

  const dia = fecha ?? (ahora ? isoLocal(ahora) : null);
  const desfasada = !!fecha && !!ahora && isoLocal(ahora) !== fecha;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 sm:flex-none">
      <div className="min-w-0">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Hoy
        </span>
        <span className="mt-0.5 block truncate text-[15px] font-semibold leading-tight text-foreground first-letter:uppercase sm:text-base">
          {dia ? fechaLarga(dia) : "—"}
        </span>
      </div>

      {/* La hora en cuerpo grande y tabular: es lo que se mira de reojo mientras
          se carga, y con ancho fijo por dígito no baila cada segundo. */}
      <span
        className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[30px]"
        aria-live="off"
      >
        {ahora
          ? ahora.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })
          : "--:--:--"}
      </span>

      {desfasada && (
        <span className="flex items-center gap-1 text-[11px] text-amber-600">
          <AlertTriangle size={12} />
          Tu computadora marca el {fechaCorta(isoLocal(ahora!))}
        </span>
      )}
    </div>
  );
}

/**
 * Franja del día en curso: el reloj y la pregunta del cierre —"¿cómo venimos
 * hoy?"—. No depende del período elegido (arriba se puede estar mirando julio),
 * así que va abajo de todo y en una sola línea.
 */
function FranjaHoy({ hoy, cargando }: { hoy: Hoy | null; cargando: boolean }) {
  const neto = hoy ? hoy.ingresos - hoy.egresos : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-xl border-t border-border bg-muted/20 px-4 py-3 sm:gap-x-6 sm:px-5">
      <RelojHoy fecha={hoy?.fecha ?? null} />

      {/* El divisor separa el reloj de la plata del día: son dos lecturas
          distintas y en una sola tira se leían como una sola frase. */}
      <span className="hidden h-9 w-px shrink-0 bg-border sm:block" aria-hidden />

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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-border bg-muted/20 px-2 py-2 sm:px-3">
          {controles}
          {nota && <div className="px-2 text-xs text-muted-foreground/80">{nota}</div>}
        </div>
      )}

      <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
        {/* Saldo: el dato principal, sobre un tinte de marca apenas perceptible
            para que el bloque tenga peso sin cambiar de color la pantalla. */}
        <div className="relative flex flex-col justify-center gap-2 bg-gradient-to-r from-primary/[0.045] to-transparent px-4 py-5 sm:px-6 sm:py-7 lg:w-[21rem] lg:shrink-0">
          <span className="absolute inset-y-6 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Saldo actual
          </p>
          {/* El saldo baja un escalón en celular: a 2.4rem un monto de 8 cifras
              se salía del ancho de la pantalla. */}
          <Valor
            value={saldo}
            cargando={cargando}
            className="text-[1.75rem] font-semibold leading-none text-foreground sm:text-[2.4rem]"
            placeholder="h-8 w-44 sm:h-9 sm:w-56"
          />
          <p className="text-[11px] text-muted-foreground/80">{saldoSub}</p>
        </div>

        {/* En celular las métricas se apilan (no entran dos de 9rem en 343px):
            los divisores pasan de verticales a horizontales. Y no se fuerza el
            `nowrap`: con cuatro métricas la fila se salía de la pantalla. */}
        <div className="flex flex-1 flex-wrap divide-x-0 divide-y divide-border sm:divide-x sm:divide-y-0">
          {metricas.map((m) => (
            <MetricaItem key={m.label} metrica={m} cargando={cargando} />
          ))}
        </div>
      </div>

      <FranjaHoy hoy={hoy} cargando={cargando} />
    </section>
  );
}
