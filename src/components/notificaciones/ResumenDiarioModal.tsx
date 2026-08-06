"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Bell,
  Cake,
  Calculator,
  ChevronRight,
  FileText,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  TreePalm,
  Truck,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
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
 *
 * FORMA (tablero): la CATEGORÍA es el objeto principal — ícono + número grande +
 * nombre — y el detalle queda reducido a una tira corta al pie. Antes era una
 * tarjeta angosta con ~15 renglones de prosa y la devolución fue literal:
 * "tanto texto me marea". Acá el número y el ícono hacen el trabajo que hacía el
 * texto, y la tarjeta es ancha y baja (hasta 1100px) en vez de alta y angosta.
 */

const CLAVE_PREFIX = "dj_resumen_dia_";

const ROJO = "#DC2626";
const MARCA = "#0088D1";

/** Filas de la tira de detalle. Es letra chica: cuantas menos, mejor se lee el tablero. */
const MAX_URGENTES = 4;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Categoría → ícono de lucide, en un solo lugar.
 *
 * `CATEGORIA_ESTILO` ya trae un `icono`, pero es un EMOJI: existe para el mail,
 * donde no se puede mandar un SVG. En pantalla el emoji lo dibuja cada sistema a
 * su manera (y en Windows la mitad salen en blanco y negro), así que el pop-up
 * usa lucide como todo el resto del sistema. Las claves son las mismas de la
 * matriz de notificaciones, así que una categoría nueva cae sola en el `Bell` de
 * `otros_avisos` en vez de romper nada.
 */
const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  vencimiento_docs: FileText,
  vencimiento_compliance: ShieldCheck,
  impuestos: ReceiptText,
  prestamos_vencimiento: Landmark,
  cheques_vencidos: Banknote,
  rrhh_eventos: Cake,
  ausencias_vacaciones: TreePalm,
  viaticos_sin_rendir: Wallet,
  gastos_pendientes: Calculator,
  cambios_caja: PiggyBank,
  nuevo_viaje: Truck,
  mantenimiento: Wrench,
  otros_avisos: Bell,
};

/**
 * Las dos sombritas de arriba y abajo del cuerpo aparecen SOLAS cuando hay algo
 * fuera de vista (truco de `background-attachment: local` contra `scroll`): con 7
 * categorías no se ven, con 13 avisan que la lista sigue. Cero JS y cero
 * listeners de scroll.
 */
const SOMBRAS_SCROLL: React.CSSProperties = {
  background: [
    "linear-gradient(var(--card) 30%, transparent) top / 100% 16px no-repeat local",
    "linear-gradient(transparent, var(--card) 70%) bottom / 100% 16px no-repeat local",
    "radial-gradient(farthest-side at 50% 0, rgba(15,23,42,.10), transparent) top / 100% 7px no-repeat scroll",
    "radial-gradient(farthest-side at 50% 100%, rgba(15,23,42,.10), transparent) bottom / 100% 7px no-repeat scroll",
  ].join(", "),
};

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
 * Texto de "cuándo", en dos largos: el `texto` completo para la celda de una
 * categoría y el `corto` para la tira, donde la fila ya dice de qué se trata y
 * el renglón compite con el título por el ancho.
 *
 * El rojo se reserva para `dias < 0` — exactamente el mismo criterio con el que
 * el server cuenta los vencidos del encabezado; si "vence hoy" también saliera
 * rojo, el usuario contaría más rojos que los que dice el número de arriba.
 */
function cuando(dias: number | null): { texto: string; corto: string; vencido: boolean } | null {
  if (dias === null) return null;
  if (dias < 0) {
    const n = Math.abs(dias);
    const plural = n === 1 ? "día" : "días";
    return { texto: `Vencido hace ${n} ${plural}`, corto: `hace ${n} ${plural}`, vencido: true };
  }
  if (dias === 0) return { texto: "Vence hoy", corto: "hoy", vencido: false };
  if (dias === 1) return { texto: "Vence mañana", corto: "mañana", vencido: false };
  return { texto: `En ${dias} días`, corto: `en ${dias} días`, vencido: false };
}

/** Color de la categoría: el mismo que usa el mail, para que el aviso se reconozca igual en los dos lados. */
function colorDe(key: string): string {
  return CATEGORIA_ESTILO[key]?.color ?? CATEGORIA_ESTILO.otros_avisos!.color;
}

/**
 * El mismo color de la categoría al 10%, para el fondo del ícono. Los colores de
 * `CATEGORIA_ESTILO` son hex de 6 dígitos, así que alcanza con pegarles el alfa;
 * si alguna vez dejan de serlo, devolvemos el color entero antes que un valor
 * inválido que el navegador tira a la basura junto con el resto de la regla.
 */
function tinte(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}1A` : color;
}

/**
 * A dónde lleva la celda de una categoría: al módulo donde viven sus avisos.
 *
 * Se calcula como el primer segmento de ruta COMÚN a los ítems del grupo
 * (`/compliance`, `/prestamos`, `/impuestos`…). Si el grupo mezcla módulos —los
 * documentos son de choferes y también de camiones— no hay uno solo y cae a
 * /notificaciones, que sí los muestra a todos. No se usa `?categoria=` porque esa
 * pantalla filtra con otra taxonomía (documentacion/cheques/personal…) que no es
 * la de la matriz: dos grupos distintos caerían en el mismo filtro.
 *
 * Ojo: los ítems vienen recortados a 3 por el server, así que la ruta común se
 * decide sobre esos 3. El error posible es benigno (entrar al módulo de choferes
 * cuando además había camiones) y del lado seguro está /notificaciones.
 */
function destinoDe(grupo: GrupoResumen): string {
  let comun: string | null = null;
  for (const item of grupo.items) {
    if (!item.href) continue;
    const seg = item.href.split("?")[0]?.split("/").filter(Boolean)[0];
    if (!seg) return "/notificaciones";
    const ruta = `/${seg}`;
    if (comun === null) comun = ruta;
    else if (comun !== ruta) return "/notificaciones";
  }
  return comun ?? "/notificaciones";
}

/**
 * "Manual de Inducción — Grassi Bruno Emmanuel" → sujeto + descripción, en ese
 * orden. Se da vuelta a propósito: la fila trunca por la derecha, así que en
 * 375px lo que se pierde es "Manual de Inducción" y no de quién es. Sin el
 * separador el título va entero y no se toca.
 */
function partirTitulo(titulo: string): { sujeto: string; resto: string | null } {
  const corte = titulo.lastIndexOf(" — ");
  if (corte < 0) return { sujeto: titulo, resto: null };
  return { sujeto: titulo.slice(corte + 3).trim(), resto: titulo.slice(0, corte).trim() };
}

type ItemConCategoria = ItemResumen & { categoria: string };

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

  // Los grupos ya vienen ordenados por el server (primero los que tienen
  // vencidos): partirlos en dos no reordena nada, sólo corta la lista al medio.
  const conVencidos = data.grupos.filter((g) => g.vencidos > 0);
  const porVencer = data.grupos.filter((g) => g.vencidos === 0);

  // La tira de detalle: lo más atrasado primero, mezclando categorías. Se ordena
  // por días porque cada grupo llega ordenado por severidad, y a las 8 de la
  // mañana lo que importa es cuánto hace que está esperando, no de qué color es.
  const urgentes: ItemConCategoria[] = data.grupos
    .flatMap((g) => g.items.map((i) => ({ ...i, categoria: g.key })))
    .sort((a, b) => {
      if (a.diasRestantes === null) return b.diasRestantes === null ? 0 : 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    })
    .slice(0, MAX_URGENTES);

  // "y N más" cuenta lo que NO está a la vista, contra la magnitud que la tira
  // está mostrando: si hay vencidos, los vencidos; si no, el total. Restar sobre
  // el balde equivocado hacía que el pie contradijera al encabezado.
  const vencidosEnTira = urgentes.filter((u) => u.diasRestantes !== null && u.diasRestantes < 0).length;
  const restoVencidos = data.vencidos - vencidosEnTira;
  const restoTotal = data.total - urgentes.length;
  const masTexto =
    restoVencidos > 0
      ? `y ${restoVencidos} vencido${restoVencidos === 1 ? "" : "s"} más`
      : restoTotal > 0
        ? `y ${restoTotal} aviso${restoTotal === 1 ? "" : "s"} más`
        : null;

  const pctVencido = data.total > 0 ? Math.max(2, Math.round((data.vencidos / data.total) * 100)) : 0;

  return (
    <div
      onMouseDown={(e) => {
        // Sólo el fondo: un click que arranca adentro (arrastrando texto) no cierra.
        if (e.target === e.currentTarget) cerrar();
      }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
    >
      {/* Ancha y baja: 1100px de tope. Es lo que pidió el usuario ("más
          horizontal, aprovechar el espacio") y de paso deja ver la pantalla de
          atrás en vez de taparla entera. El alto sale de `dvh`, no de `vh`: en
          iOS `vh` deja el pie abajo de la barra del navegador. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={atraparTab}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[1100px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl outline-none motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="shrink-0 border-b border-border">
          {/* El encabezado ENVUELVE: cuando no entra, los dos números se van a un
              renglón propio a ancho completo y el saludo recupera la línea. Los
              `order-*` son lo que mantiene la X arriba a la derecha en las dos
              formas, sin duplicar markup. */}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:flex-nowrap sm:gap-5 sm:px-5 lg:px-6 lg:py-5">
            <div className="order-1 flex min-w-0 flex-1 items-start gap-3">
              <span
                className="grid size-[34px] shrink-0 place-items-center rounded-md lg:size-9"
                style={{ backgroundColor: tinte(MARCA), color: MARCA }}
                aria-hidden
              >
                <Bell size={18} />
              </span>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:text-[17px] lg:text-lg"
                >
                  {quien ? `${saludo(ahora.getHours())}, ${quien}` : saludo(ahora.getHours())}
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{fechaLarga(ahora)}</p>
              </div>
            </div>

            <div className="order-3 flex basis-full items-start sm:order-2 sm:basis-auto">
              <div className="pr-4 text-left sm:px-4 sm:text-right lg:px-5">
                <span className="block text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[30px] lg:text-[34px]">
                  {data.total}
                </span>
                <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  Pendientes
                </span>
              </div>
              <div className="border-l border-border pl-4 text-left sm:px-4 sm:text-right lg:px-5">
                <span
                  className="block text-[28px] font-semibold leading-none tracking-tight tabular-nums sm:text-[30px] lg:text-[34px]"
                  style={{ color: data.vencidos > 0 ? ROJO : undefined }}
                >
                  {data.vencidos}
                </span>
                <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  Vencidos
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="order-2 -mr-1 -mt-1 flex size-[38px] shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground sm:order-3 sm:size-8"
            >
              <X size={17} />
            </button>
          </div>

          {/* Una sola magnitud —lo vencido— sobre el total del día. NO es una
              barra apilada de siete colores: el color identifica categorías en
              las celdas de abajo y acá sólo hay que ver cuánto de la mañana ya
              está en rojo. Si no hay nada vencido no se dibuja: una pista vacía
              se lee como un widget roto. */}
          {data.vencidos > 0 && (
            <div className="px-4 pb-3.5 sm:px-5 lg:px-6">
              <div
                className="h-1.5 w-full overflow-hidden rounded-[3px] bg-muted"
                role="img"
                aria-label={`${data.vencidos} de ${data.total} avisos están vencidos`}
              >
                <div className="h-full rounded-[3px]" style={{ width: `${pctVencido}%`, backgroundColor: ROJO }} />
              </div>
            </div>
          )}
        </div>

        {/* El cuerpo es lo único que scrollea: con 13 categorías y 200 avisos la
            tarjeta sigue entrando en pantalla y el pie nunca queda fuera de
            alcance. La grilla se reacomoda sola (2 → 3 → 4 columnas). */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 lg:px-6 lg:py-5"
          style={SOMBRAS_SCROLL}
        >
          {conVencidos.length > 0 && (
            <section>
              <Rotulo texto="Vencido" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-2.5">
                {conVencidos.map((grupo) => (
                  <CeldaVencida key={grupo.key} grupo={grupo} onIr={ir} />
                ))}
              </div>
            </section>
          )}

          {porVencer.length > 0 && (
            <section className={conVencidos.length > 0 ? "mt-5" : undefined}>
              <Rotulo texto="Se viene" />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-2.5">
                {porVencer.map((grupo) => (
                  <CeldaProxima key={grupo.key} grupo={grupo} onIr={ir} />
                ))}
              </div>
            </section>
          )}

          {/* La tira NO lleva rótulo propio a propósito: con "Vencido" y "Se
              viene" ya hay dos niveles de jerarquía, que es lo que manda la regla
              de la casa; un tercer título convertía la letra chica en una sección
              más. El punto de color la ata a su categoría de arriba. */}
          {urgentes.length > 0 && (
            <div className="mt-4 rounded-md border border-border bg-muted/40 p-1 lg:grid lg:grid-cols-2 lg:gap-x-5">
              {urgentes.map((item) => (
                <FilaUrgente key={item.id} item={item} onIr={ir} />
              ))}
              {masTexto && (
                <button
                  type="button"
                  onClick={() => ir("/notificaciones")}
                  className="flex min-h-10 w-full items-center justify-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:min-h-9 lg:col-span-2"
                >
                  {masTexto}
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
          {/* En celular el pie son dos botones apilados y este renglón empujaba
              el "Entendido" contra el borde: la aclaración es una cortesía, no
              información del día, así que abajo de 640px no se dibuja. */}
          <span className="hidden text-[11px] text-muted-foreground/80 sm:block">
            Este resumen se muestra una vez por día
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rotulito de sección: texto corto + una regla que se come el resto del ancho. */
function Rotulo({ texto }: { texto: string }) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <span className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80">
        {texto}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

/** Ícono de la categoría sobre su propio color al 10%: es lo que la hace reconocible sin leerla. */
function Tile({ categoria, chico }: { categoria: string; chico?: boolean }) {
  // El ícono se saca del mapa directo (y no de una función que lo devuelva):
  // `react-hooks/static-components` lee un componente que sale de una llamada
  // como uno creado en cada render y lo marca como error.
  const Icono = ICONO_CATEGORIA[categoria] ?? Bell;
  const color = colorDe(categoria);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-md ${chico ? "size-7" : "size-8 lg:size-[34px]"}`}
      style={{ backgroundColor: tinte(color), color }}
      aria-hidden
    >
      <Icono size={chico ? 16 : 18} />
    </span>
  );
}

/**
 * Categoría con algo vencido. El número grande es el de VENCIDOS, no el total:
 * abajo del rótulo "Vencido", un 16 gigante en Préstamos cuando sólo 2 están
 * vencidos es el número equivocado en el lugar donde primero se mira. El total
 * queda de apoyo, en chico. De yapa, los números grandes de esta grilla suman
 * exactamente el "Vencidos" del encabezado.
 */
function CeldaVencida({ grupo, onIr }: { grupo: GrupoResumen; onIr: (href: string) => void }) {
  const color = colorDe(grupo.key);
  return (
    <button
      type="button"
      onClick={() => onIr(destinoDe(grupo))}
      aria-label={`${grupo.nombre}: ${grupo.vencidos} vencidos de ${grupo.total}`}
      className="flex flex-col rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:border-foreground/20 focus-visible:bg-muted/40 focus-visible:outline-none lg:px-3.5 lg:py-3"
    >
      <span className="flex items-center justify-between gap-2">
        <Tile categoria={grupo.key} />
        <span
          className="text-[27px] font-semibold leading-none tracking-tight tabular-nums lg:text-[32px]"
          style={{ color }}
        >
          {grupo.vencidos}
        </span>
      </span>
      <span className="mt-2 text-[12.5px] font-medium leading-snug text-foreground">{grupo.nombre}</span>
      {/* `mt-auto` clava esta línea al piso: si un nombre largo se va a dos
          renglones, los "de N en total" de toda la fila siguen alineados. */}
      <span className="mt-auto pt-1.5 text-[11.5px] tabular-nums text-muted-foreground">
        de {grupo.total} en total
      </span>
    </button>
  );
}

/**
 * Categoría sin nada vencido: mismo lenguaje, la mitad del peso. Es el segundo
 * nivel de jerarquía y no hay un tercero.
 */
function CeldaProxima({ grupo, onIr }: { grupo: GrupoResumen; onIr: (href: string) => void }) {
  const color = colorDe(grupo.key);
  // El "cuándo" se calcula sobre los ítems que llegaron (3 como mucho), así que
  // se enuncia como el estado del grupo y no como "la próxima": si el server
  // recortó uno más cercano, la frase seguiría siendo cierta.
  const dias = grupo.items.reduce<number | null>((min, i) => {
    if (i.diasRestantes === null) return min;
    return min === null || i.diasRestantes < min ? i.diasRestantes : min;
  }, null);
  const c = cuando(dias);

  return (
    <button
      type="button"
      onClick={() => onIr(destinoDe(grupo))}
      aria-label={`${grupo.nombre}: ${grupo.total} avisos`}
      className="flex min-h-[54px] items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-card focus-visible:border-foreground/20 focus-visible:bg-card focus-visible:outline-none"
    >
      <Tile categoria={grupo.key} chico />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-snug text-foreground">{grupo.nombre}</span>
        {c && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{c.texto}</span>}
      </span>
      <span className="shrink-0 text-[19px] font-semibold leading-none tabular-nums" style={{ color }}>
        {grupo.total}
      </span>
    </button>
  );
}

/**
 * La letra chica del tablero: quién, qué y cuánto hace.
 *
 * `min-h-10` deja la fila en 40px en celular (arriba del piso táctil); en
 * escritorio baja a 34 y entran cuatro sin estirar la tarjeta. Sin destino
 * resuelto igual se dibuja como fila muerta, con el mismo alto, para que la tira
 * no quede con escalones.
 */
function FilaUrgente({ item, onIr }: { item: ItemConCategoria; onIr: (href: string) => void }) {
  const c = cuando(item.diasRestantes);
  const { sujeto, resto } = partirTitulo(item.titulo);

  const contenido = (
    <>
      <span
        className="size-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: colorDe(item.categoria) }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-left text-xs leading-snug text-muted-foreground">
        <b className="font-semibold text-foreground">{sujeto}</b>
        {resto && ` · ${resto}`}
      </span>
      {c && (
        <span
          className={`shrink-0 whitespace-nowrap text-[11.5px] tabular-nums ${c.vencido ? "font-medium" : "text-muted-foreground"}`}
          style={c.vencido ? { color: ROJO } : undefined}
        >
          {c.corto}
        </span>
      )}
    </>
  );

  const clases = "flex min-h-10 w-full items-center gap-2.5 rounded px-2 py-1.5 sm:min-h-[34px]";

  if (!item.href) {
    return <div className={clases}>{contenido}</div>;
  }

  const href = item.href;
  return (
    <button
      type="button"
      onClick={() => onIr(href)}
      className={`${clases} text-left transition-colors hover:bg-card focus-visible:bg-card focus-visible:outline-none`}
    >
      {contenido}
    </button>
  );
}
