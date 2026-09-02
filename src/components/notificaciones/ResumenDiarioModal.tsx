"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ChecklistYCampana from "@/components/notificaciones/ChecklistYCampana";
import ListaNovedades from "@/components/novedades/ListaNovedades";
import MegafonoNovedades from "@/components/novedades/MegafonoNovedades";
import { guardarCategoriasResumen } from "@/app/(dashboard)/notificaciones/actions";
import { porUrgencia } from "@/app/(dashboard)/notificaciones/utils";
import { ALERTA_COLUMNAS } from "@/app/(dashboard)/configuracion/notificaciones/constants";
import { AUSENCIAS_COL, RRHH_EVENTOS_COL } from "@/lib/alertas-routing";
import {
  colorCategoria as colorDe,
  destinoDeGrupo,
  ICONO_CATEGORIA,
  NOMBRE_CORTO,
  SUBTITULO_CATEGORIA,
  textoSobre,
  tinte,
} from "@/lib/alertas-ui";
import type { Novedad } from "@/lib/novedades";
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
 * Qué novedades ya se le mostraron a esta persona (ids, por usuario).
 *
 * Es la respuesta a "¿y cuándo haya muchas?": el pop-up no muestra las de los
 * últimos N días —eso repetía diez mañanas seguidas la misma lista— sino las que
 * ESTA persona todavía no vio, y como mucho `MAX_NOVEDADES`. El resto espera su
 * turno mañana y el historial completo vive en /novedades.
 *
 * Se guardan ids y no una fecha porque en un mismo día se sube más de una cosa:
 * con "vi hasta el 11/08", la segunda novedad del 11 no se anunciaba nunca.
 */
const CLAVE_NOVEDADES = "dj_novedades_vistas_";

/** Cuántas se muestran de una. Las que sobran se cuentan y salen mañana. */
const MAX_NOVEDADES = 4;

/** Tope de ids guardados: la lista crece unas pocas por semana, no hace falta más. */
const TOPE_VISTAS = 200;

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

/**
 * Los grupos que se dibujan por PERSONA y no por cantidad: cumpleaños y
 * ausencias. Son los dos casos donde el aviso ES alguien —quién no va a estar, a
 * quién hay que saludar— y un número suelto no dice nada.
 *
 * Las ausencias entraron acá el 27/08/2026, a pedido de Julián: *"falta
 * información en las vacaciones, fechas y tal como en cumpleaños y fotos; tiene
 * que ser así de completo, es incluso más importante"*. Y lo de importante es
 * cierto: un cumpleaños que se pasa es una lástima, un chofer que no viene y
 * nadie lo vio es un viaje sin cubrir.
 */
const GRUPOS_DE_PERSONAS = new Set([RRHH_EVENTOS_COL, AUSENCIAS_COL]);


const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];



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

/** Ids de novedades ya mostradas. Sin storage devuelve vacío: se muestran de más. */
function novedadesVistas(userId: string): string[] {
  const ls = safeLocal();
  if (!ls) return [];
  try {
    const crudo = ls.getItem(CLAVE_NOVEDADES + userId);
    const arr: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Marca como vistas SOLO las que se dibujaron.
 *
 * Si se marcaran todas las que llegaron, un usuario que vuelve de vacaciones con
 * doce novedades nuevas vería cuatro y perdería ocho para siempre. Así las que
 * no entraron hoy son las primeras de mañana.
 */
function marcarNovedadesVistas(userId: string, ids: string[]): void {
  const ls = safeLocal();
  if (!ls || ids.length === 0) return;
  try {
    const todas = [...new Set([...novedadesVistas(userId), ...ids])];
    ls.setItem(CLAVE_NOVEDADES + userId, JSON.stringify(todas.slice(-TOPE_VISTAS)));
  } catch {
    /* el peor caso es volver a mostrar una novedad */
  }
}

/**
 * Las que esta persona todavía no vio. Exportada para el test: es la regla que
 * decide si el pop-up aparece en un día sin vencimientos.
 */
export function novedadesNuevas(items: Novedad[], vistas: string[]): Novedad[] {
  const yaVistas = new Set(vistas);
  return items.filter((n) => !yaVistas.has(n.id));
}

/**
 * El resumen tal como lo eligió ver esta persona.
 *
 * El filtro se aplica ACÁ y no en el server a propósito: tildar una categoría
 * tiene que verse en el momento, sin volver a pedir nada, y las categorías
 * apagadas hacen falta enteras para poder listarlas en el panel y prenderlas de
 * nuevo. Lo que el server no manda nunca es lo que la persona no puede ver: eso
 * es un permiso y se filtra antes (ver `visiblePara`).
 *
 * Los dos números del encabezado se recalculan sobre lo que queda: si dicen 85 y
 * abajo se ven 40, el que está mal es el cartel.
 */
export function aplicarOcultas(data: ResumenDiario, ocultas: Iterable<string>): ResumenDiario {
  const fuera = new Set(ocultas);
  if (fuera.size === 0) return data;
  const grupos = data.grupos.filter((g) => !fuera.has(g.key));
  return {
    ...data,
    grupos,
    total: grupos.reduce((n, g) => n + g.total, 0),
    vencidos: grupos.reduce((n, g) => n + g.vencidos, 0),
  };
}

/** Nombre de cada categoría para el panel, incluso si hoy no tiene ningún aviso. */
const NOMBRE_CATEGORIA = new Map(ALERTA_COLUMNAS.map((c) => [c.key, c.nombre]));

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

/**
 * El mismo color de la categoría al 10%, para el fondo del ícono. Los colores de
 * `CATEGORIA_ESTILO` son hex de 6 dígitos, así que alcanza con pegarles el alfa;
 * si alguna vez dejan de serlo, devolvemos el color entero antes que un valor
 * inválido que el navegador tira a la basura junto con el resto de la regla.
 */

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
  // Qué categorías eligió NO ver esta persona, y si el panel para cambiarlas
  // está abierto. Se guardan solas al tildar (autoguardado, como todo el resto).
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [, guardar] = useTransition();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cuerpoRef = useRef<HTMLDivElement | null>(null);
  const pedidoRef = useRef<AbortController | null>(null);

  // Lo que se dibuja: el resumen sin las categorías apagadas. `data` queda
  // entero para el panel, que tiene que poder ofrecer las que están apagadas.
  const vista = useMemo(() => (data ? aplicarOcultas(data, ocultas) : null), [data, ocultas]);

  // Ojo: la cuenta va FUERA del `set…`. Un updater tiene que ser puro —React lo
  // corre dos veces en desarrollo— y meter acá adentro el guardado o el scroll
  // los dispara de más.
  const alternarCategoria = useCallback(
    (key: string) => {
      const siguiente = ocultas.includes(key)
        ? ocultas.filter((k) => k !== key)
        : [...ocultas, key];
      setOcultas(siguiente);
      // Se guarda en segundo plano: si el guardado falla, lo peor que pasa es que
      // mañana vuelva a aparecer la categoría. Cortar el tilde por eso sería peor
      // que el problema.
      guardar(async () => {
        try {
          await guardarCategoriasResumen(siguiente);
        } catch {
          /* sin red: queda elegido para esta sesión */
        }
      });
    },
    [ocultas, guardar],
  );

  const alternarPanel = useCallback(() => {
    // El panel se dibuja arriba de todo: si el cuerpo está scrolleado, abrirlo
    // sin subir sería abrir algo que no se ve.
    if (!eligiendo && cuerpoRef.current) cuerpoRef.current.scrollTop = 0;
    setEligiendo(!eligiendo);
  }, [eligiendo]);

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
        if (!json || !Array.isArray(json.grupos)) return;
        // Un día sin vencimientos pero con cambios en el sistema TAMBIÉN abre el
        // pop-up: es el único lugar donde se anuncian, y si no aparece nadie se
        // entera. Sin nada pendiente y sin nada nuevo, no se molesta.
        const hayNovedades =
          novedadesNuevas(json.novedades ?? [], novedadesVistas(userId)).length > 0;
        // Sobre lo que esta persona eligió ver: si apagó todo lo que hoy tiene
        // avisos, el pop-up no la frena — que es exactamente lo que pidió.
        if (aplicarOcultas(json, json.ocultas ?? []).total <= 0 && !hayNovedades) return;
        // La marca se escribe recién cuando SÍ hay algo para mostrar: si el día
        // arrancó limpio y a media mañana aparece un vencimiento, la próxima
        // carga lo muestra igual en vez de dar el día por avisado.
        marcarVistoHoy(userId);
        setData(json);
        setOcultas(json.ocultas ?? []);
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
          setOcultas(json.ocultas ?? []);
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

  return (
    <div
      onMouseDown={(e) => {
        // Sólo el fondo: un click que arranca adentro (arrastrando texto) no cierra.
        if (e.target === e.currentTarget) cerrar();
      }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
    >
      {/* Ancha y baja: 1200px de tope. Es lo que pidió el usuario ("más
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
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[1200px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl outline-none motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
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
            {/* Las tres magnitudes del día. La tercera —lo que todavía está a
                tiempo— entró con el rediseño del 27/08: sin ella, "87 pendientes
                y 20 vencidos" dejaba al lector restando de memoria para saber
                cuánto de eso era urgente. Reemplazó a la barra de progreso, que
                decía lo mismo ocupando un renglón entero. */}
            {vista && (
              <div className="order-3 flex basis-full items-start divide-x divide-border sm:order-2 sm:basis-auto sm:self-center">
                <div className="pr-4 text-left sm:px-4 sm:text-right">
                  <span className="block text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[30px]">
                    {vista.total}
                  </span>
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                    Pendientes
                  </span>
                </div>
                <div className="px-4 text-left sm:text-right">
                  <span
                    className="block text-[26px] font-semibold leading-none tracking-tight tabular-nums sm:text-[30px]"
                    style={{ color: vista.vencidos > 0 ? ROJO : undefined }}
                  >
                    {vista.vencidos}
                  </span>
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                    Vencidos
                  </span>
                </div>
                <div className="px-4 text-left sm:text-right">
                  <span className="block text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[30px]">
                    {vista.total - vista.vencidos}
                  </span>
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                    A tiempo
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

          <div className="pb-3" />
        </div>

        {/* El cuerpo es lo único que scrollea: con 13 categorías y 200 avisos la
            tarjeta sigue entrando en pantalla y el pie nunca queda fuera de
            alcance. La grilla se reacomoda sola (2 → 3 → 4 columnas). */}
        <div
          ref={cuerpoRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 lg:px-6 lg:py-5"
          style={SOMBRAS_SCROLL}
        >
          {/* Elegir qué ver. Va arriba de todo y sólo cuando se pide: es una
              preferencia, no parte del día. */}
          {data && eligiendo && (
            <PanelCategorias
              data={data}
              ocultas={ocultas}
              onAlternar={alternarCategoria}
              onCerrar={() => setEligiendo(false)}
            />
          )}
          {vista ? (
            vista.total > 0 ? (
              <Tablero data={vista} onIr={ir} />
            ) : (
              <TodoEnOrden apagadas={ocultas.length > 0} />
            )
          ) : error ? (
            <NoCargo />
          ) : (
            <Cargando />
          )}

          {/* Qué cambió en el sistema. Va al final y solo si hay algo: en una
              semana sin cambios no ocupa lugar, y nunca compite con los
              vencimientos, que son lo que el pop-up viene a decir. */}
          {data && <Novedades items={data.novedades ?? []} userId={userId} onIr={ir} />}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
          {/* En celular el pie son dos botones apilados y este renglón empujaba
              el "Entendido" contra el borde: la aclaración es una cortesía, no
              información del día, así que abajo de 640px no se dibuja. */}
          <div className="flex items-center gap-3">
            {/* Con forma de botón y no de link chiquito: así como estaba —texto
                gris al pie— nadie lo encontraba (Julián, 27/08/2026). `outline`
                ya se marca solo cuando el panel está abierto (aria-expanded). */}
            <Button
              variant="outline"
              size="sm"
              onClick={alternarPanel}
              aria-expanded={eligiendo}
              className="max-md:text-sm"
            >
              <SlidersHorizontal />
              {eligiendo ? "Listo" : "Elegir qué ver"}
            </Button>
            <span className="hidden text-[11px] text-muted-foreground/80 lg:block">
              Este resumen se muestra una vez por día
            </span>
          </div>
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

  return (
    <>
      {conVencidos.length > 0 && (
        <section>
          {/* El rótulo del bloque, con la ilustración que antes encabezaba una
              tira al pie. Es una franja BAJA a propósito: el cartel tiene que
              entrar en una pantalla —"veo 2 nomás por pantalla" (Julián,
              27/08/2026)— y cada píxel que se lleva el adorno es una tarjeta
              menos a la vista. */}
          <div
            className="mb-2.5 flex items-center gap-2.5 overflow-hidden rounded-lg px-3 py-2"
            style={{ background: `linear-gradient(135deg, #16233F, #0E1A33)` }}
          >
            <ChecklistYCampana className="size-9 shrink-0" />
            <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white">
              Poné todo al día
              <span className="ml-2 font-normal text-white/55">Lo que hace más que espera.</span>
            </p>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/80">
              {data.vencidos} vencidos
            </span>
          </div>

          {/* `auto-fit` y no tres columnas fijas: con cuatro categorías, la
              cuarta caía sola a un renglón nuevo y dejaba dos huecos blancos del
              alto de una tarjeta. Así las que haya se reparten el ancho. */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(17rem,1fr))]">
            {conVencidos.map((grupo) => (
              <TarjetaCategoria key={grupo.key} grupo={grupo} onIr={onIr} />
            ))}
          </div>
        </section>
      )}

      {porVencer.length > 0 && (
        <section className={conVencidos.length > 0 ? "mt-4" : undefined}>
          <Rotulo texto="Se viene" icono={CalendarDays} color={AZUL_OSCURO} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(17rem,1fr))]">
            {porVencer.map((grupo) => (
              <TarjetaCategoria key={grupo.key} grupo={grupo} onIr={onIr} />
            ))}
          </div>
        </section>
      )}
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
function TodoEnOrden({ apagadas }: { apagadas?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-[#ECFDF5]" aria-hidden>
        <CheckCircle2 size={24} style={{ color: VERDE }} />
      </span>
      <p className="mb-1 text-sm font-medium text-foreground">Todo en orden</p>
      <p className="text-sm text-muted-foreground/70">
        {/* Con categorías apagadas, "no hay nada" sería mentira: no hay nada DE
            LO QUE ESTA PERSONA ELIGIÓ VER, y hay que decirlo o el día que apague
            de más va a creer que el sistema se quedó mudo. */}
        {apagadas
          ? "No hay avisos pendientes de lo que elegiste ver"
          : "No hay vencimientos ni avisos pendientes"}
      </p>
    </div>
  );
}

/**
 * Elegir qué categorías aparecen en este cartel.
 *
 * Pedido de Nico (27/08/2026): a él no le sirven los avisos de documentación, a
 * Anabela no le sirven los de cheques ni los de préstamos. No es un permiso —los
 * dos tienen el mismo rol y pueden ver todo—, así que lo elige cada uno.
 *
 * Se listan las categorías que HOY tienen avisos más las que esta persona tenga
 * apagadas: sin esas últimas, apagar una categoría que después se queda sin
 * avisos era un viaje de ida — no quedaba dónde volver a prenderla.
 *
 * Lo que se apaga sale del pop-up y de sus números, nada más: el aviso sigue
 * existiendo, en /notificaciones y en el mail. Por eso lo dice al pie.
 */
function PanelCategorias({
  data,
  ocultas,
  onAlternar,
  onCerrar,
}: {
  data: ResumenDiario;
  ocultas: string[];
  onAlternar: (key: string) => void;
  onCerrar: () => void;
}) {
  const apagadas = new Set(ocultas);
  const totalPorKey = new Map(data.grupos.map((g) => [g.key, g.total]));
  const keys = [...new Set([...data.grupos.map((g) => g.key), ...ocultas])];
  // Mismo orden que la lista de categorías del sistema, para que no baile entre
  // una mañana y la otra según qué haya vencido.
  const orden = new Map(ALERTA_COLUMNAS.map((c, i) => [c.key, i]));
  keys.sort((a, b) => (orden.get(a) ?? 99) - (orden.get(b) ?? 99));

  return (
    <section className="mb-5 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight text-foreground">
            Qué querés ver en tu resumen
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Lo que destildes deja de aparecer acá. Los avisos siguen estando en Notificaciones.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cerrar"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => {
          const total = totalPorKey.get(key) ?? 0;
          const nombre = NOMBRE_CATEGORIA.get(key) ?? "Otros avisos";
          return (
            <label
              key={key}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:border-foreground/20 sm:min-h-10"
            >
              <input
                type="checkbox"
                checked={!apagadas.has(key)}
                onChange={() => onAlternar(key)}
                className="size-4 shrink-0 cursor-pointer accent-[#0088D1] max-md:size-5"
              />
              <Tile categoria={key} chico />
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-snug text-foreground">
                {nombre}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                {total > 0 ? total : "—"}
              </span>
            </label>
          );
        })}
      </div>
    </section>
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
 * "Novedades del sistema": lo que cambió y esta persona todavía no vio.
 *
 * Pedido de Julián (10/08/2026). Hasta ahora, que una pantalla cambiara no se
 * anunciaba en ningún lado: el equipo se enteraba al abrirla y no reconocerla.
 *
 * Tres decisiones, todas de la vuelta del 11/08:
 *
 *  1. No muestra "las de los últimos 10 días" sino las que NO VIO. Con la
 *     ventana, la misma lista aparecía diez mañanas seguidas y se volvía parte
 *     del fondo; con esto, si no hubo cambios la sección directamente no está.
 *  2. Corta en `MAX_NOVEDADES`. La pregunta era si paginar: adentro del pop-up
 *     no —cuatro y "y N más"—, porque el cartel viene a hablar de vencimientos y
 *     una lista larga lo convierte en otra cosa. Las que sobran salen mañana y
 *     el historial entero está en /novedades.
 *  3. Llega filtrada por permisos desde el server (`getResumenDiario`): a nadie
 *     se le anuncia una pantalla que no puede abrir.
 *
 * Va abajo de todo a propósito — el pop-up existe para los vencimientos del día;
 * esto es contexto, no una tarea. Los colores son los del tipo de cambio (nuevo
 * / mejora / arreglo), que es información, no decoración.
 */
function Novedades({
  items,
  userId,
  onIr,
}: {
  items: Novedad[];
  userId: string;
  onIr: (href: string) => void;
}) {
  // Se congela en el primer render a propósito: marcar como vistas es un efecto
  // que cambia el storage, y si la lista se recalculara con cada render se
  // vaciaría en el acto, delante de la persona que la está leyendo.
  const [nuevas] = useState(() => novedadesNuevas(items, novedadesVistas(userId)));
  // Ya vistas todas, igual se muestra LA ÚLTIMA. Antes el bloque se reducía a un
  // link y el cartel quedaba sin nada que contar — "las novedades se fueron,
  // alguna tiene que estar" (Julián, 27/08/2026). La de siempre no molesta:
  // ocupa un renglón y es la única parte del cartel que no pide nada.
  const visibles = nuevas.length > 0 ? nuevas.slice(0, MAX_NOVEDADES) : items.slice(0, 1);
  const restantes = nuevas.length > 0 ? nuevas.length - visibles.length : 0;

  useEffect(() => {
    // Sólo se marcan las NUEVAS: la que se repite por cortesía cuando no hay
    // ninguna no tiene nada que marcar (ya estaba vista).
    marcarNovedadesVistas(
      userId,
      nuevas.slice(0, MAX_NOVEDADES).map((n) => n.id),
    );
    // Una sola vez por apertura: `visibles` sale de un estado congelado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Sin una sola novedad cargada no hay bloque: es lo único que puede faltar.
  if (visibles.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* La ilustración es lo que separa esta sección de las tarjetas de
              arriba: abajo del todo, el cartel deja de dar tareas y pasa a
              contar algo. */}
          <MegafonoNovedades className="size-9 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[13px] font-semibold tracking-tight text-foreground">
              Novedades del sistema
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {nuevas.length === 0
                ? "Lo último que cambió"
                : nuevas.length === 1
                  ? "Hay 1 cambio nuevo"
                  : `Hay ${nuevas.length} cambios nuevos`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onIr("/novedades")}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Ver todas
          <ChevronRight size={13} />
        </button>
      </div>

      <ListaNovedades items={visibles} onIr={onIr} />

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => onIr("/novedades")}
          className="mt-1.5 flex min-h-9 w-full items-center justify-center gap-1 rounded-lg text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {restantes === 1 ? "y 1 novedad más" : `y ${restantes} novedades más`}
          <ChevronRight size={13} />
        </button>
      )}
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

/**
 * El ícono de la categoría, sobre su color PLENO.
 *
 * Era el color al 10% y con siete tarjetas juntas todos los cuadraditos se
 * lavaban al mismo gris pálido: *"en los iconos necesito más color, se confunde,
 * todo queda muy confuso"* (Julián, 27/08/2026). Con el fondo saturado y el
 * glifo en blanco, la categoría se reconoce sin leer el título.
 */
function Tile({ categoria, chico }: { categoria: string; chico?: boolean }) {
  // El ícono se saca del mapa directo (y no de una función que lo devuelva):
  // `react-hooks/static-components` lee un componente que sale de una llamada
  // como uno creado en cada render y lo marca como error.
  const Icono = ICONO_CATEGORIA[categoria] ?? Bell;
  const color = colorDe(categoria);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${chico ? "size-9" : "size-10 lg:size-11"}`}
      style={{ backgroundColor: color, color: textoSobre(color) }}
      aria-hidden
    >
      <Icono size={chico ? 17 : 19} />
    </span>
  );
}

/**
 * Una categoría: qué es, cuántos hay y cuáles son los tres primeros.
 *
 * Tarjeta y no banda de ancho completo. La banda mostraba lo mismo ocupando el
 * triple: *"son demasiado grandes para la poca información que muestran, queda
 * mucho espacio en blanco, veo 2 nomás por pantalla"* (Julián, 27/08/2026, con
 * un mockup al lado). Así entran seis categorías sin scrollear.
 *
 * Las tres partes son las tres preguntas que hay que contestar de un vistazo:
 * el encabezado dice QUÉ es y CUÁNTOS hay, la lista CUÁLES son, y el pie es la
 * puerta a la pantalla que los muestra a todos, ya filtrada.
 */
function TarjetaCategoria({ grupo, onIr }: { grupo: GrupoResumen; onIr: (href: string) => void }) {
  const color = colorDe(grupo.key);
  const personas = GRUPOS_DE_PERSONAS.has(grupo.key);
  const items = [...grupo.items].sort(porUrgencia);
  // El número grande es lo vencido cuando hay algo vencido —es lo que hay que
  // mirar— y el total cuando no hay nada atrasado.
  const hayVencidos = grupo.vencidos > 0;
  const numero = hayVencidos ? grupo.vencidos : grupo.total;
  // Lo que sobra, contado sobre la misma magnitud que el número grande.
  const restantes = hayVencidos ? (grupo.restantesVencidos ?? 0) : grupo.restantes;
  const etiqueta = hayVencidos ? "vencidos" : personas ? "próximos" : "en total";
  // Los cumpleaños viven en los avisos de personal; el resto, en su sección.
  const destino = grupo.key === RRHH_EVENTOS_COL ? DESTINO_PERSONAL : destinoDeGrupo(grupo);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => onIr(destino)}
        aria-label={`${grupo.nombre}: ${grupo.vencidos} vencidos de ${grupo.total}`}
        className="flex items-start gap-2.5 px-3 pb-2 pt-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <Tile categoria={grupo.key} chico />
        <span className="min-w-0 flex-1">
          {/* El nombre corto: "Vencimiento de Documentos" no entra en una
              tarjeta de 230px y se cortaba en "Vencimiento de Doc…". El entero
              queda en el nombre accesible, y el subtítulo de abajo explica mejor
              que el nombre largo. */}
          <span className="block truncate text-[13px] font-semibold leading-snug text-foreground">
            {NOMBRE_CORTO[grupo.key] ?? grupo.nombre}
          </span>
          <span className="block truncate text-[11px] leading-snug text-muted-foreground">
            {SUBTITULO_CATEGORIA[grupo.key] ?? "Avisos"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className="block text-[22px] font-semibold leading-none tabular-nums"
            style={{ color }}
          >
            {numero}
          </span>
          <span className="mt-1 block text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
            {etiqueta}
          </span>
        </span>
      </button>

      <div className="flex-1 border-t border-border/60 px-1.5 py-1">
        {items.map((item) =>
          personas ? (
            <FilaPersona key={item.id} item={item} color={color} onIr={onIr} />
          ) : (
            <FilaAviso key={item.id} item={item} color={color} onIr={onIr} />
          ),
        )}
        {/* Cuenta lo MISMO que el número de arriba: si el título dice "4
            vencidos", acá abajo no pueden aparecer "11 más" que no son vencidos.
            Cuando lo que sobra no está vencido, el pie ya lleva al total. */}
        {restantes > 0 && (
          <p className="px-2 pb-0.5 pt-0.5 text-right text-[10.5px] text-muted-foreground">
            {hayVencidos
              ? `y ${restantes} vencido${restantes === 1 ? "" : "s"} más`
              : `y ${restantes} más`}
          </p>
        )}
      </div>

      {/* El pie dice a dónde va y con qué recorte: es el mismo número de arriba.
          Antes decía "Ver detalles" y llevaba a la lista entera — de ahí el "le
          hago click y no me filtra cuáles son". */}
      <button
        type="button"
        onClick={() => onIr(destino)}
        className="border-t border-border/60 px-3 py-2 text-center text-[11.5px] font-medium transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
        style={{ color }}
      >
        {hayVencidos ? `Ver los ${grupo.vencidos} vencidos` : `Ver los ${grupo.total}`} →
      </button>
    </div>
  );
}

/**
 * Un aviso: de quién es, qué es y cuándo.
 *
 * El "qué" (`resto`) es la mitad del título que quedaba escondida: sin ella la
 * tarjeta de cheques decía "$3.000.000 · hace 43 d" y no había forma de saber si
 * eso había que depositarlo, cobrarlo o pagarlo.
 */
function FilaAviso({
  item,
  color,
  onIr,
}: {
  item: ItemResumen;
  color: string;
  onIr: (href: string) => void;
}) {
  const { sujeto, resto } = partirTitulo(item.titulo);
  const c = cuando(item.diasRestantes);
  const dias = item.diasRestantes ?? 0;

  // Lo que todavía está en fecha se dibuja como la tarjeta de cumpleaños, que es
  // la que se lee bien: renglón propio, con el día concreto y en color.
  //
  // Antes iba a la derecha, en gris de 10.5px y sin fecha —"hoy" incluido—, al
  // lado de un "hace 82 d" en rojo. Toda la mitad de abajo del pop-up ("Se
  // viene") se leía como relleno: cinco cuotas que vencen HOY en el mismo gris
  // que un aviso de la semana que viene. *"¿podemos hacer más llamativos los
  // renglones de las cosas que están en fecha?"* (Julián, 01/09/2026).
  //
  // Los vencidos no se tocan: el "hace N d" en rojo a la derecha ya funciona, y
  // llevarlos abajo les sacaría el número grande que es lo que se busca al abrir.
  const enFecha = c !== null && !c.vencido;
  // Igual que en la fila de personas: el color pleno de la categoría para lo que
  // pasa hoy o mañana. Más lejos, negro sobre el gris del subtítulo — que ya es
  // un salto contra el gris de antes.
  const inminente = enFecha && dias <= 1;
  const cuandoTexto = enFecha ? [c!.texto, fechaCorta(item.fecha)].filter(Boolean).join(" · ") : null;

  const contenido = (
    <>
      <span
        className="mt-[7px] size-[6px] shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium leading-snug text-foreground">
            {sujeto}
          </span>
          {c?.vencido && (
            <span className="shrink-0 whitespace-nowrap text-[10.5px] leading-snug tabular-nums text-muted-foreground">
              hace{" "}
              <b className="font-semibold" style={{ color: ROJO }}>
                {Math.abs(item.diasRestantes ?? 0)}
              </b>{" "}
              d
            </span>
          )}
        </span>
        {resto && (
          <span className="block truncate text-left text-[10.5px] leading-snug text-muted-foreground">
            {resto}
          </span>
        )}
        {cuandoTexto && (
          <span
            className="block truncate text-left text-[10.5px] font-semibold leading-snug tabular-nums text-foreground"
            style={{ color: inminente ? color : undefined }}
          >
            {cuandoTexto}
          </span>
        )}
      </span>
    </>
  );

  const clases = "flex w-full items-start gap-2 rounded px-2 py-1.5";
  if (!item.href) return <div className={clases}>{contenido}</div>;

  const href = item.href;
  return (
    <button
      type="button"
      onClick={() => onIr(href)}
      className={`${clases} text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none`}
    >
      {contenido}
    </button>
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
      <AvatarPersona name={sujeto} rol={item.rol} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium leading-snug text-foreground">{sujeto}</span>
        {resto && <span className="block truncate text-[10.5px] leading-snug text-muted-foreground">{resto}</span>}
        {cuandoTexto && (
          <span
            className="block truncate text-[10.5px] leading-snug tabular-nums"
            style={{ color: inminente ? color : undefined }}
          >
            {cuandoTexto}
          </span>
        )}
      </span>
    </>
  );

  const clases = "flex w-full items-center gap-2 rounded px-2 py-1.5";

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


