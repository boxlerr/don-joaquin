"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIA_ESTILO } from "@/lib/email-template";
import type { GrupoResumen, ItemResumen, ResumenDiario } from "@/lib/resumen-diario";

/**
 * Pop-up de apertura del día: "esto tenés vencido / esto se viene".
 *
 * Existe porque el toast de la esquina no se veía (chiquito, abajo a la derecha
 * y se cierra solo): el resumen del día tiene que frenar a la persona una vez,
 * en el medio de la pantalla, y recién ahí dejarla trabajar.
 *
 * Aparece UNA vez por día por usuario. La marca va en localStorage con la fecha
 * LOCAL del cliente, no la del servidor: el "día" que importa es el de quien
 * mira la pantalla.
 */

const CLAVE_PREFIX = "dj_resumen_dia_";

const ROJO = "#DC2626";
const MARCA = "#0088D1";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function safeLocal(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Fecha local YYYY-MM-DD. A propósito NO se usa `toISOString()`: eso devuelve
 * UTC y en Argentina (UTC-3) a partir de las 21hs ya adelanta el día, así que el
 * pop-up quedaría marcado como visto para mañana y no aparecería a la mañana.
 */
function hoyLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function yaVistoHoy(userId: string): boolean {
  const ls = safeLocal();
  // Sin storage (modo privado, cookies bloqueadas) preferimos mostrarlo de más
  // antes que no mostrarlo nunca.
  if (!ls) return false;
  try {
    return ls.getItem(CLAVE_PREFIX + userId) === hoyLocal();
  } catch {
    return false;
  }
}

function marcarVistoHoy(userId: string): void {
  const ls = safeLocal();
  if (!ls) return;
  try {
    ls.setItem(CLAVE_PREFIX + userId, hoyLocal());
  } catch {
    /* storage lleno o bloqueado: el peor caso es que se repita el pop-up */
  }
}

function fechaLarga(d: Date): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function saludo(hora: number): string {
  if (hora < 13) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

function primerNombre(nombre: string | null | undefined): string {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return "";
  return limpio.split(/\s+/)[0] ?? "";
}

/**
 * Texto de "cuándo". El rojo se reserva para `dias < 0` — exactamente el mismo
 * criterio con el que el server cuenta los vencidos del encabezado; si "vence
 * hoy" también saliera rojo, el usuario contaría más rojos que los que dice el
 * número de arriba.
 */
function cuando(dias: number | null): { texto: string; vencido: boolean } | null {
  if (dias === null) return null;
  if (dias < 0) {
    const n = Math.abs(dias);
    return { texto: `Vencido hace ${n} ${n === 1 ? "día" : "días"}`, vencido: true };
  }
  if (dias === 0) return { texto: "Vence hoy", vencido: false };
  if (dias === 1) return { texto: "Vence mañana", vencido: false };
  return { texto: `En ${dias} días`, vencido: false };
}

/** Color de la categoría: el mismo que usa el mail, para que el aviso se reconozca igual en los dos lados. */
function colorDe(key: string): string {
  return CATEGORIA_ESTILO[key]?.color ?? CATEGORIA_ESTILO.otros_avisos!.color;
}

export default function ResumenDiarioModal({
  userId,
  nombre,
}: {
  userId: string;
  nombre?: string | null;
}) {
  const router = useRouter();
  const titleId = useId();
  const [data, setData] = useState<ResumenDiario | null>(null);
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const cerrar = useCallback(() => setOpen(false), []);

  // Cada aviso lleva su destino resuelto (`alertaHref`): el pop-up no es sólo un
  // cartel, se entra al documento o al cheque desde la fila misma.
  const ir = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router],
  );

  // Un solo pedido, en el primer render del día. Si ya se mostró hoy no se
  // consulta nada (el badge de la campana ya hace su propio polling).
  useEffect(() => {
    if (!userId || yaVistoHoy(userId)) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/alertas?mode=diario", { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as ResumenDiario | null;
        if (!json || !Array.isArray(json.grupos) || json.total <= 0) return;
        // La marca se escribe recién cuando SÍ hay algo para mostrar: si el día
        // arrancó limpio y a media mañana aparece un vencimiento, la próxima
        // carga lo muestra igual en vez de dar el día por avisado.
        marcarVistoHoy(userId);
        setData(json);
        setOpen(true);
      } catch {
        /* red caída o navegación: no molestamos, se reintenta en la próxima carga */
      }
    })();

    return () => ctrl.abort();
  }, [userId]);

  // Mientras está abierto: fondo quieto, Escape cierra y el foco arranca en la
  // tarjeta. Al cerrar se restaura el scroll previo y el foco de donde salió.
  useEffect(() => {
    if (!open) return;

    const focoPrevio = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cerrar();
        return;
      }
      // Atrapar Tab no alcanza: CommandPalette engancha Ctrl/Cmd+K en el window
      // (ver su useEffect), así que con el pop-up abierto la paleta se abría por
      // DEBAJO (z-50 contra z-[110]) y las dos capas se peleaban el foco.
      // Va en fase de captura porque los dos escuchan en el mismo window y el
      // orden de registro depende de qué componente montó primero.
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    cardRef.current?.focus();

    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener("keydown", onKey, true);
      focoPrevio?.focus?.();
    };
  }, [open, cerrar]);

  // Tab no se escapa de la tarjeta mientras el diálogo es modal.
  const atraparTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !cardRef.current) return;
    const focusables = cardRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const primero = focusables[0]!;
    const ultimo = focusables[focusables.length - 1]!;
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === cardRef.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  if (!open || !data) return null;

  const ahora = new Date();
  const quien = primerNombre(nombre);

  return (
    <div
      onMouseDown={(e) => {
        // Sólo el fondo: un click que arranca adentro (arrastrando texto) no cierra.
        if (e.target === e.currentTarget) cerrar();
      }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={atraparTab}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl outline-none motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="shrink-0 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <Bell size={18} className="mt-0.5 shrink-0" style={{ color: MARCA }} />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
                {quien ? `${saludo(ahora.getHours())}, ${quien}` : saludo(ahora.getHours())}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{fechaLarga(ahora)}</p>
            </div>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums leading-none" style={{ color: MARCA }}>
              {data.total}
            </span>
            <span className="text-sm text-muted-foreground">
              {data.total === 1 ? "aviso pendiente" : "avisos pendientes"}
              {data.vencidos > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums" style={{ color: ROJO }}>
                    {data.vencidos}
                  </span>{" "}
                  {data.vencidos === 1 ? "vencido" : "vencidos"}
                </>
              )}
            </span>
          </div>
        </div>

        {/* El cuerpo es lo único que scrollea: con 200 avisos la tarjeta sigue
            entrando en pantalla y el pie nunca queda fuera de alcance. */}
        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
          {data.grupos.map((grupo) => (
            <GrupoFila key={grupo.key} grupo={grupo} onIr={ir} />
          ))}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="outline" size="lg" className="max-md:text-base" onClick={cerrar}>
            Entendido
          </Button>
          <Button
            variant="brand"
            size="lg"
            className="max-md:text-base"
            onClick={() => {
              router.push("/notificaciones");
              cerrar();
            }}
          >
            Ver todas
          </Button>
        </div>
      </div>
    </div>
  );
}

function GrupoFila({ grupo, onIr }: { grupo: GrupoResumen; onIr: (href: string) => void }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: colorDe(grupo.key) }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{grupo.nombre}</span>
        {grupo.vencidos > 0 && (
          <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: ROJO }}>
            {grupo.vencidos} vencido{grupo.vencidos === 1 ? "" : "s"}
          </span>
        )}
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{grupo.total}</span>
      </div>

      {/* El recorte lo hace el server (por eso se dibuja `items` entero): si acá
          se recortara de nuevo, `restantes` diría menos de los que faltan. */}
      <ul className="mt-1.5 space-y-0.5 pl-4 max-md:space-y-1">
        {grupo.items.map((item) => (
          <ItemFila key={item.id} item={item} onIr={onIr} />
        ))}
        {grupo.restantes > 0 && (
          <li className="px-1.5 text-xs text-muted-foreground max-md:px-2 max-md:py-1">
            y {grupo.restantes} más
          </li>
        )}
      </ul>
    </div>
  );
}

function ItemFila({ item, onIr }: { item: ItemResumen; onIr: (href: string) => void }) {
  const c = cuando(item.diasRestantes);
  const href = item.href;

  const contenido = (
    <>
      <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">{item.titulo}</span>
      {c && (
        <span
          className={`shrink-0 tabular-nums ${c.vencido ? "font-medium" : "text-muted-foreground"}`}
          style={c.vencido ? { color: ROJO } : undefined}
        >
          {c.texto}
        </span>
      )}
    </>
  );

  // Sin destino resuelto la fila es sólo texto: un botón que no lleva a ningún
  // lado se toca igual y no pasa nada. Igual lleva el mismo alto que la clicable
  // para que la lista no quede con escalones.
  if (!href) {
    return (
      <li className="flex items-baseline justify-between gap-3 px-1.5 py-1 text-xs max-md:px-2 max-md:py-2.5">
        {contenido}
      </li>
    );
  }

  // Los `max-md:` dejan la fila en 36px de alto en celular (el mínimo que fija
  // button.tsx, el mismo h-9 que la X de esta tarjeta): con `py-1` medía 24px y
  // a 375px se erraba el toque o se abría el aviso de al lado. En desktop sigue
  // compacta. El alto extra no desborda nada: lo único que crece es el cuerpo,
  // que ya scrollea solo.
  return (
    <li>
      <button
        type="button"
        onClick={() => onIr(href)}
        className="flex w-full items-baseline justify-between gap-3 rounded px-1.5 py-1 text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none max-md:px-2 max-md:py-2.5"
      >
        {contenido}
      </button>
    </li>
  );
}
