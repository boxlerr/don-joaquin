"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Bell,
  Cake,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TreePalm,
  Truck,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MetricCard from "@/components/ui/MetricCard";
import ChecklistYCampana from "@/components/notificaciones/ChecklistYCampana";
import { RRHH_EVENTOS_COL } from "@/lib/alertas-routing";
import { CATEGORIA_ESTILO } from "@/lib/email-template";
import { novedadesRecientes } from "@/lib/novedades";
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
 * mira la pantalla. Y se puede volver a abrir a mano desde la campana
 * (`RESUMEN_DIARIO_EVENT`): una vez por día quiere decir que aparece solo una
 * vez, no que se pierda para siempre si alguien lo cerró de apurado.
 *
 * FORMA (tablero): la CATEGORÍA es el objeto principal — ícono + número grande +
 * nombre — y el detalle queda reducido a una tira corta al pie. Antes era una
 * tarjeta angosta con ~15 renglones de prosa y la devolución fue literal:
 * "tanto texto me marea". Acá el número y el ícono hacen el trabajo que hacía el
 * texto, y la tarjeta es ancha y baja (hasta 1100px) en vez de alta y angosta.
 */

const CLAVE_PREFIX = "dj_resumen_dia_";

/**
 * Volver a abrir el pop-up a pedido. Lo dispara el botón de la campana ("Resumen
 * del día"), que es donde la gente lo busca cuando lo cerró sin leer.
 *
 * Va por evento de window y no por contexto, igual que el cajón de auditoría
 * (`AUDIT_DRAWER_EVENT`): el estado del pop-up es asunto suyo, y así el botón no
 * necesita más que saber el nombre del evento.
 */
export const RESUMEN_DIARIO_EVENT = "open-resumen-diario";

const ROJO = "#DC2626";
const MARCA = "#0088D1";
const VERDE = "#22C55E";

/** El azul oscuro del rótulo "Resumen del día": el nombre propio del cartel. */
const AZUL_OSCURO = "#075985";
/**
 * Los avisos de personal en /notificaciones. Es a donde llevan los cumpleaños:
 * el listado de legajos —que es donde caían por la ruta común de los avisos— no
 * habla de fechas, así que el click no mostraba nada de lo que se venía a ver.
 */
const DESTINO_PERSONAL = "/notificaciones?categoria=personal";
/** Los dos extremos de la barra: de lo que falta a lo que ya se pasó. */
const AMBAR = "#F59E0B";
const ROSA = "#F43F5E";

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
 * Nombre corto de cada categoría, sólo para la tarjeta del resumen.
 *
 * Los nombres oficiales (los de la matriz de notificaciones) son frases:
 * "Vencimiento de Documentos", "Compliance Loma Negra / YPF". Adentro de una
 * tarjeta de la grilla caían en tres renglones y empujaban el número para
 * abajo, dejando las cinco tarjetas a cinco alturas distintas. Acá se abrevian a
 * una palabra; el nombre entero sigue estando en el `aria-label` de la tarjeta,
 * y en la matriz y el mail no cambia nada.
 */
const NOMBRE_CORTO: Record<string, string> = {
  vencimiento_docs: "Documentos",
  vencimiento_compliance: "Compliance",
  impuestos: "Impuestos",
  prestamos_vencimiento: "Préstamos",
  cheques_vencidos: "Cheques",
  rrhh_eventos: "Cumpleaños",
  ausencias_vacaciones: "Vacaciones",
  viaticos_sin_rendir: "Viáticos",
  gastos_pendientes: "Gastos",
  cambios_caja: "Caja",
  nuevo_viaje: "Viajes",
  mantenimiento: "Mantenimiento",
  otros_avisos: "Otros avisos",
};

/**
 * Qué dice la línea de atraso, en una frase. Misma forma que la de Legajos
 * ("+7 en 12 meses"), que es de donde sale la tarjeta.
 *
 * La serie NUNCA baja: está armada sobre los avisos que siguen abiertos, así que
 * lo que se resolvió en el medio no aparece. Por eso el texto dice cuánto CRECIÓ
 * y no habla de tendencia ni de mejora.
 */
function captionAtraso(serie: number[]): string {
  const primero = serie[0] ?? 0;
  const ultimo = serie[serie.length - 1] ?? 0;
  const delta = ultimo - primero;
  if (delta <= 0) return "Sin cambios en 12 semanas";
  return `+${delta} en 12 semanas`;
}

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

/**
 * Cuándo es un EVENTO. Un cumpleaños no "vence": es hoy, es mañana o falta.
 * Ese "Vence mañana" al lado de una torta fue lo que hizo desconfiar del cartel
 * entero.
 */
function cuandoEvento(dias: number | null): string | null {
  if (dias === null) return null;
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

/**
 * "2026-08-11" → "lun 11/8". La fecha se arma con los tres números sueltos y no
 * con `new Date(iso)`: ese constructor lee el string como UTC y en Argentina
 * devuelve el día anterior, así que el cumpleaños salía un día antes.
 */
function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dia = DIAS[new Date(y!, m! - 1, d!).getDay()] ?? "";
  return `${dia.slice(0, 3).toLowerCase()} ${d}/${m}`;
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
  /** Para no ofrecer accesos que le van a rebotar a quien los toque. */
}) {
  const router = useRouter();
  const titleId = useId();
  const [data, setData] = useState<ResumenDiario | null>(null);
  const [open, setOpen] = useState(false);
  // Sólo puede pasar en la apertura a mano: la automática, si falla, no abre nada.
  const [error, setError] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pedidoRef = useRef<AbortController | null>(null);

  const cerrar = useCallback(() => {
    pedidoRef.current?.abort();
    setOpen(false);
  }, []);

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

  // Apertura a mano desde la campana. Tres diferencias con la automática, las
  // tres a propósito:
  //   - abre PRIMERO y pide después: media pantalla en blanco mientras carga es
  //     mejor que un botón que no hace nada por medio segundo;
  //   - abre aunque no haya nada pendiente: cuando el botón lo apretó una
  //     persona, "no hay nada" es una respuesta, no un motivo para no aparecer;
  //   - NO escribe la marca del día: mirar el resumen a mano no tiene por qué
  //     cancelar el pop-up de mañana a la mañana.
  useEffect(() => {
    const abrir = () => {
      pedidoRef.current?.abort();
      const ctrl = new AbortController();
      pedidoRef.current = ctrl;
      setData(null);
      setError(false);
      setOpen(true);

      (async () => {
        try {
          const res = await fetch("/api/alertas?mode=diario", { cache: "no-store", signal: ctrl.signal });
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as ResumenDiario | null;
          if (!json || !Array.isArray(json.grupos)) throw new Error("payload");
          setData(json);
        } catch {
          // El abort es el camino normal al cerrar: no es un error que mostrar.
          if (!ctrl.signal.aborted) setError(true);
        }
      })();
    };

    window.addEventListener(RESUMEN_DIARIO_EVENT, abrir);
    return () => {
      window.removeEventListener(RESUMEN_DIARIO_EVENT, abrir);
      pedidoRef.current?.abort();
    };
  }, []);

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

  if (!open) return null;

  const ahora = new Date();
  const quien = primerNombre(nombre);
  const pctVencido = data && data.total > 0 ? Math.max(2, Math.round((data.vencidos / data.total) * 100)) : 0;

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
        {/* CABECERA: quién saluda, qué día es y las dos magnitudes.
            La cara del usuario a la izquierda —con su campanita— hace que el
            cartel se lea como un saludo y no como una alarma del sistema. */}
        <div className="shrink-0 border-b border-border">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-4 px-4 pt-4 sm:flex-nowrap sm:gap-6 sm:px-6 sm:pt-5 lg:px-7">
            <div className="order-1 flex min-w-0 flex-1 items-center gap-3.5">
              <span className="relative shrink-0" aria-hidden>
                {/* Silueta, no iniciales: es el avatar de todo el sistema. */}
                <AvatarPersona name={nombre || "Usuario"} size={46} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 grid size-[20px] place-items-center rounded-full ring-2 ring-card"
                  style={{ backgroundColor: tinte(MARCA), color: MARCA }}
                >
                  <Bell size={11} />
                </span>
              </span>
              <div className="min-w-0">
                {/* El cartel nunca decía cómo se llamaba: sin esto, "volvé a abrir
                    el resumen del día" no tenía dónde caer. */}
                <span
                  className="block text-[10px] font-bold uppercase tracking-[0.18em] sm:text-[10.5px]"
                  style={{ color: AZUL_OSCURO }}
                >
                  Resumen del día
                </span>
                <h2
                  id={titleId}
                  className="mt-1 truncate text-[21px] font-semibold leading-tight tracking-tight text-foreground sm:text-[25px] lg:text-[28px]"
                >
                  {quien ? `${saludo(ahora.getHours())}, ${quien}` : saludo(ahora.getHours())}{" "}
                  <span aria-hidden>👋</span>
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{fechaLarga(ahora)}</p>
              </div>
            </div>

            {/* Los dos números aparecen recién con los datos: un par de ceros
                mientras carga se lee como "no hay nada" y después salta a 45. */}
            {data && (
              <div className="order-3 flex basis-full items-start sm:order-2 sm:basis-auto sm:self-center">
                <div className="pr-5 text-left sm:px-5 sm:text-right">
                  <span className="block text-[30px] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[34px] lg:text-[38px]">
                    {data.total}
                  </span>
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                    Pendientes
                  </span>
                </div>
                <div className="border-l border-border pl-5 text-left sm:px-5 sm:text-right">
                  <span
                    className="block text-[30px] font-semibold leading-none tracking-tight tabular-nums sm:text-[34px] lg:text-[38px]"
                    style={{ color: data.vencidos > 0 ? ROJO : undefined }}
                  >
                    {data.vencidos}
                  </span>
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                    Vencidos
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="order-2 -mr-1 -mt-1 flex size-[38px] shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground sm:order-3 sm:size-8"
            >
              <X size={17} />
            </button>
          </div>

          {/* Una sola magnitud —lo vencido— sobre el total del día. NO es una
              barra apilada de siete colores: el color identifica categorías en
              las celdas de abajo y acá sólo hay que ver cuánto de la mañana ya
              está en rojo. Si no hay nada vencido no se dibuja: una pista vacía
              se lee como un widget roto. */}
          {data && data.vencidos > 0 && (
            <div className="px-4 pb-4 pt-4 sm:px-6 lg:px-7">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${data.vencidos} de ${data.total} avisos están vencidos`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pctVencido}%`, background: `linear-gradient(90deg, ${AMBAR}, ${ROSA})` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                {data.total} avisos pendientes en total
              </p>
            </div>
          )}
          {data && data.vencidos === 0 && <div className="pb-4" />}
        </div>

        {/* El cuerpo es lo único que scrollea: con 13 categorías y 200 avisos la
            tarjeta sigue entrando en pantalla y el pie nunca queda fuera de
            alcance. La grilla se reacomoda sola (2 → 3 → 4 columnas). */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 lg:px-6 lg:py-5"
          style={SOMBRAS_SCROLL}
        >
          {data ? (
            data.total > 0 ? (
              <Tablero data={data} onIr={ir} />
            ) : (
              <TodoEnOrden />
            )
          ) : error ? (
            <NoCargo />
          ) : (
            <Cargando />
          )}

          {/* Qué cambió en el sistema. Va al final y solo si hay algo: en una
              semana sin cambios no ocupa lugar, y nunca compite con los
              vencimientos, que son lo que el pop-up viene a decir. */}
          {data && <Novedades onIr={ir} />}
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

/**
 * El tablero: las dos grillas de categorías y la tira de letra chica.
 *
 * Vive aparte del modal desde que el pop-up también se abre a mano y puede estar
 * cargando, vacío o roto: adentro, todos estos cálculos tendrían que convivir
 * con un `data` que a veces es null.
 */
function Tablero({
  data,
  onIr,
}: {
  data: ResumenDiario;
  onIr: (href: string) => void;
}) {
  // Los grupos ya vienen ordenados por el server (primero los que tienen
  // vencidos): partirlos en dos no reordena nada, sólo corta la lista al medio.
  const conVencidos = data.grupos.filter((g) => g.vencidos > 0);
  const porVencer = data.grupos.filter((g) => g.vencidos === 0);

  // La tira de detalle: lo más atrasado primero, mezclando categorías. Se ordena
  // por días porque cada grupo llega ordenado por severidad, y a las 8 de la
  // mañana lo que importa es cuánto hace que está esperando, no de qué color es.
  //
  // Los cumpleaños quedan afuera: ya están escritos con nombre y fecha en su
  // propia banda, y en un día sin vencidos —que es cuando ganan la competencia
  // por tener los días más chicos— aparecían de nuevo acá abajo, los mismos tres
  // nombres a diez centímetros de distancia.
  const urgentes: ItemConCategoria[] = data.grupos
    .filter((g) => g.key !== RRHH_EVENTOS_COL)
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

  return (
    <>
      {conVencidos.length > 0 && (
        <section>
          <Rotulo texto="Resumen de vencimientos" icono={Activity} color={ROSA} />
          {/* `auto-fit` en vez de 4 columnas fijas: con 5 categorías vencidas,
              la quinta caía sola a un renglón nuevo y dejaba tres huecos
              blancos del alto de una tarjeta. Así las que haya se reparten el
              ancho y entran en una línea; recién con muchas más vuelve a haber
              un segundo renglón, y también completo. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] lg:gap-2.5">
            {conVencidos.map((grupo) => (
              <CeldaVencida key={grupo.key} grupo={grupo} onIr={onIr} />
            ))}
          </div>
        </section>
      )}

      {porVencer.length > 0 && (
        <section className={conVencidos.length > 0 ? "mt-5" : undefined}>
          <Rotulo texto="Se viene" icono={CalendarDays} color={AZUL_OSCURO} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-2.5">
            {porVencer.map((grupo) =>
              // Los cumpleaños ocupan el renglón entero: son los únicos avisos
              // que se leen por persona y no por cantidad.
              grupo.key === RRHH_EVENTOS_COL ? (
                <PanelPersonas key={grupo.key} grupo={grupo} onIr={onIr} />
              ) : (
                <CeldaProxima key={grupo.key} grupo={grupo} onIr={onIr} />
              ),
            )}
          </div>
        </section>
      )}

      <PiePendientes urgentes={urgentes} masTexto={masTexto} onIr={onIr} />
    </>
  );
}

/**
 * Mientras viaja el pedido, y sólo en la apertura a mano. Son las mismas cuatro
 * celdas de la grilla en gris: la tarjeta ya nace del alto que va a tener y no
 * pega el salto cuando llegan los datos.
 */
function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando el resumen del día">
      <Skeleton className="mb-2 h-2.5 w-16" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>
    </div>
  );
}

/**
 * Día limpio. Sólo se ve abriendo el resumen a mano: el automático directamente
 * no aparece cuando no hay nada. Mismo cartel que /notificaciones cuando no hay
 * alertas, para que "todo en orden" se vea igual en los dos lados.
 */
function TodoEnOrden() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-[#ECFDF5]" aria-hidden>
        <CheckCircle2 size={24} style={{ color: VERDE }} />
      </span>
      <p className="mb-1 text-sm font-medium text-foreground">Todo en orden</p>
      <p className="text-sm text-muted-foreground/70">No hay vencimientos ni avisos pendientes</p>
    </div>
  );
}

/** El pedido no llegó. Reintentar es volver a disparar el mismo evento. */
function NoCargo() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="mb-1 text-sm font-medium text-foreground">No se pudo cargar el resumen</p>
      <p className="text-sm text-muted-foreground/70">Puede ser la conexión.</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => window.dispatchEvent(new Event(RESUMEN_DIARIO_EVENT))}
      >
        Reintentar
      </Button>
    </div>
  );
}

/**
 * "Novedades del sistema": lo que cambió en los últimos días.
 *
 * Pedido de Julián (10/08/2026). Hasta ahora, que una pantalla cambiara no se
 * anunciaba en ningún lado: el equipo se enteraba al abrirla y no reconocerla.
 *
 * Va abajo de todo y en tono menor a propósito — el pop-up existe para los
 * vencimientos del día; esto es contexto, no una tarea. Por eso no lleva número
 * ni color propio: si compitiera con las tarjetas de arriba, se leería como algo
 * que hay que hacer.
 */
function Novedades({ onIr }: { onIr: (href: string) => void }) {
  const items = novedadesRecientes(hoyLocal());
  if (items.length === 0) return null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <Rotulo texto="Novedades del sistema" icono={Sparkles} color="#64748B" />
      <ul className="space-y-2.5">
        {items.map((n, i) => {
          const contenido = (
            <>
              <span className="mt-[3px] shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                {fechaCorta(n.fecha) ?? n.fecha}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-snug text-foreground">{n.titulo}</span>
                {n.detalle && (
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                    {n.detalle}
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li key={`${n.fecha}-${i}`}>
              {n.href ? (
                <button
                  type="button"
                  onClick={() => onIr(n.href!)}
                  className="flex w-full gap-3 rounded-[6px] px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
                >
                  {contenido}
                </button>
              ) : (
                <div className="flex gap-3 px-1 py-0.5">{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Rótulo de sección: un ícono de color y el nombre. Sin la regla gris de antes. */
function Rotulo({ texto, icono: Icono, color }: { texto: string; icono: LucideIcon; color: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icono size={15} style={{ color }} aria-hidden />
      <span className="text-[13px] font-semibold tracking-tight text-foreground">{texto}</span>
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
      className={`grid shrink-0 place-items-center rounded-xl ${chico ? "size-9" : "size-10 lg:size-11"}`}
      style={{ backgroundColor: tinte(color), color }}
      aria-hidden
    >
      <Icono size={chico ? 17 : 19} />
    </span>
  );
}

/**
 * Categoría con algo vencido. Es la MISMA tarjeta de Legajos (`MetricCard`), con
 * el color de la categoría en vez de uno de los cinco tonos: así el resumen del
 * día no inventa un lenguaje visual propio.
 *
 * Antes era una tarjeta a medida con un lavado de color al pie y la línea de
 * atraso apoyada en el borde: se leía como un objeto en relieve, distinto a todo
 * el resto del sistema.
 *
 * El número grande es el de VENCIDOS, no el total: abajo del rótulo "Vencido",
 * un 16 gigante en Préstamos cuando sólo 2 están vencidos es el número
 * equivocado en el lugar donde primero se mira. El total queda de apoyo, en
 * chico. De yapa, los números grandes de esta grilla suman exactamente el
 * "Vencidos" del encabezado.
 */
function CeldaVencida({ grupo, onIr }: { grupo: GrupoResumen; onIr: (href: string) => void }) {
  return (
    <MetricCard
      label={NOMBRE_CORTO[grupo.key] ?? grupo.nombre}
      ariaLabel={`${grupo.nombre}: ${grupo.vencidos} vencidos de ${grupo.total}`}
      value={String(grupo.vencidos)}
      sub={`de ${grupo.total} en total`}
      icon={ICONO_CATEGORIA[grupo.key] ?? Bell}
      color={colorDe(grupo.key)}
      onClick={() => onIr(destinoDe(grupo))}
      trend={grupo.atraso ? { points: grupo.atraso, caption: captionAtraso(grupo.atraso) } : undefined}
    />
  );
}

/**
 * El pie: la ilustración a la izquierda y, a su derecha, lo más atrasado.
 *
 * Antes ese costado eran cuatro botones a los módulos (alertas, legajos, flota,
 * compliance) y el detalle vivía en una tira aparte más arriba. Los botones no
 * agregaban nada —cada renglón ya lleva a su aviso y el pie tiene "Ver todas"— y
 * la tira suelta empujaba el cartel hasta obligar a scrollear. Puestos en el
 * mismo renglón, el espacio se usa una sola vez y el resumen entero entra en
 * pantalla.
 */
function PiePendientes({
  urgentes,
  masTexto,
  onIr,
}: {
  urgentes: ItemConCategoria[];
  masTexto: string | null;
  onIr: (href: string) => void;
}) {
  if (urgentes.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border sm:flex">
      {/* El único bloque oscuro del cartel, y es chico: sostiene la ilustración
          y le da al pie un cierre distinto del resto de las tarjetas. */}
      <div
        className="flex items-center gap-3 px-4 py-4 sm:w-[260px] sm:shrink-0"
        style={{ background: `linear-gradient(135deg, #16233F, #0E1A33)` }}
      >
        <ChecklistYCampana className="h-[86px] w-[86px] shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-white">Poné todo al día</p>
          <p className="mt-1 text-[11.5px] leading-snug text-white/55">
            Lo que hace más que espera.
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 bg-muted/40 p-1.5">
        {urgentes.map((item) => (
          <FilaUrgente key={item.id} item={item} onIr={onIr} />
        ))}
        {masTexto && (
          <button
            type="button"
            onClick={() => onIr("/notificaciones")}
            className="flex min-h-10 w-full items-center justify-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:bg-card focus-visible:outline-none sm:min-h-8"
          >
            {masTexto}
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Cumpleaños y aniversarios, la única categoría que se dibuja por PERSONA.
 *
 * Su celda mentía dos veces: un "4" al lado de la palabra "Efemérides" no dice
 * nada —¿el cumpleaños de quién, y qué día?— y el click caía en el listado de
 * legajos, que no habla de cumpleaños, porque el destino se calcula con la ruta
 * común de los avisos del grupo. Acá cada renglón es alguien: la silueta de su
 * área, el nombre, qué se festeja y la fecha. El renglón lleva a SU legajo y el
 * título, a los avisos de personal.
 */
function PanelPersonas({ grupo, onIr }: { grupo: GrupoResumen; onIr: (href: string) => void }) {
  const color = colorDe(grupo.key);
  const dias = grupo.items.reduce<number | null>((min, i) => {
    if (i.diasRestantes === null) return min;
    return min === null || i.diasRestantes < min ? i.diasRestantes : min;
  }, null);
  const proximo = cuandoEvento(dias);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 sm:col-span-2 sm:flex-row sm:items-stretch lg:col-span-3">
      {/* La chapa de la categoría: el número grande y de qué se trata. */}
      <button
        type="button"
        onClick={() => onIr(DESTINO_PERSONAL)}
        className="flex items-center gap-3 rounded-lg px-3.5 py-3 text-left transition-opacity hover:opacity-90 focus-visible:outline-none sm:w-[210px] sm:shrink-0 sm:flex-col sm:items-start sm:justify-center sm:gap-2"
        style={{ backgroundColor: tinte(color) }}
      >
        <Tile categoria={grupo.key} chico />
        <span className="min-w-0">
          <span className="block text-[26px] font-semibold leading-none tabular-nums" style={{ color }}>
            {grupo.total}
          </span>
          <span className="mt-1 block text-[12.5px] font-medium leading-snug text-foreground">{grupo.nombre}</span>
          {proximo && <span className="mt-0.5 block text-[11px] text-muted-foreground">{proximo}</span>}
        </span>
      </button>

      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2">
        {grupo.items.map((item) => (
          <FilaPersona key={item.id} item={item} color={color} onIr={onIr} />
        ))}
      </div>

      {grupo.restantes > 0 && (
        <button
          type="button"
          onClick={() => onIr(DESTINO_PERSONAL)}
          className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-center transition-opacity hover:opacity-90 focus-visible:outline-none sm:w-[104px] sm:shrink-0 sm:flex-col sm:gap-0.5"
          style={{ backgroundColor: tinte(color) }}
        >
          <span className="text-[21px] font-semibold leading-none tabular-nums" style={{ color }}>
            +{grupo.restantes}
          </span>
          <span className="text-[11px] text-muted-foreground">más</span>
        </button>
      )}
    </div>
  );
}

/**
 * Una persona: silueta, nombre, motivo y día.
 *
 * El "hoy / mañana" va en el color de la categoría cuando falta un día o menos
 * —es lo único que hay que hacer con esto: saludar— y en gris el resto. Nada de
 * rojo: un cumpleaños no es un problema.
 */
function FilaPersona({
  item,
  color,
  onIr,
}: {
  item: ItemResumen;
  color: string;
  onIr: (href: string) => void;
}) {
  const { sujeto, resto } = partirTitulo(item.titulo);
  const cuando = cuandoEvento(item.diasRestantes);
  const fecha = fechaCorta(item.fecha);
  const inminente = item.diasRestantes !== null && item.diasRestantes <= 1;

  const cuandoTexto = [cuando, fecha].filter(Boolean).join(" · ");

  const contenido = (
    <>
      <AvatarPersona name={sujeto} rol={item.rol} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-snug text-foreground">{sujeto}</span>
        {resto && <span className="block truncate text-[11px] leading-snug text-muted-foreground">{resto}</span>}
        {cuandoTexto && (
          <span
            className="block truncate text-[11px] font-medium leading-snug tabular-nums"
            style={{ color: inminente ? color : undefined }}
          >
            {cuandoTexto}
          </span>
        )}
      </span>
    </>
  );

  const clases = "flex min-h-[56px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2";

  if (!item.href) return <div className={clases}>{contenido}</div>;

  const href = item.href;
  return (
    <button
      type="button"
      onClick={() => onIr(href)}
      className={`${clases} text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none`}
    >
      {contenido}
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
      {/* Nombre y tipo de documento en COLUMNAS y no en un mismo texto que
          trunca: pegados con un "·" cada renglón arrancaba el tipo en una
          posición distinta, y para saber qué venció había que leer los cuatro
          enteros. Alineados, el ojo baja derecho por cada columna. */}
      <span className="min-w-0 flex-[3] truncate text-left text-xs font-semibold leading-snug text-foreground">
        {sujeto}
      </span>
      {resto && (
        <span className="hidden min-w-0 flex-[2] truncate text-left text-[11.5px] leading-snug text-muted-foreground sm:block">
          {resto}
        </span>
      )}
      {c && (
        <span
          // Ancho fijo y `text-right`: así los números quedan en una columna y
          // "hace 147 días" no corre de lugar a "hace 8 días" del renglón de al
          // lado. Sólo el número va en rojo — el "hace" no es la alarma.
          className={`w-[5.5rem] shrink-0 whitespace-nowrap text-right text-[11.5px] tabular-nums ${
            c.vencido ? "text-muted-foreground" : "text-muted-foreground"
          }`}
        >
          {c.vencido ? (
            <>
              hace{" "}
              <b className="font-semibold" style={{ color: ROJO }}>
                {Math.abs(item.diasRestantes ?? 0)}
              </b>{" "}
              días
            </>
          ) : (
            c.corto
          )}
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
