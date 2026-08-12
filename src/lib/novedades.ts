/**
 * Novedades del sistema — lo que cambió, contado para quien usa las pantallas.
 *
 * Pedido de Julián (10/08/2026): que además de los vencimientos, el pop-up de la
 * mañana cuente **qué cambió en el sistema**. Antes el equipo se enteraba de que
 * una pantalla había cambiado cuando la abría y no la reconocía, o no se enteraba
 * nunca — que es lo que pasó con la mitad de los arreglos de diseño de esa semana.
 *
 * Es una lista escrita a mano y a propósito. Los mensajes de commit no sirven para
 * mostrarle a Bárbara —hablan de archivos y de causas, no de lo que ella ve— y
 * leer el historial de git en Vercel no se puede: en el server no está el repo.
 * Así que cada vez que se sube algo que se NOTA, se agrega un renglón acá arriba.
 *
 * Los renglones NO se escriben acá a mano: se escriben una sola vez, en el mensaje
 * del commit, y `scripts/novedades.mjs` los pasa a esta lista.
 *
 *     Novedad: mejora | compliance | Qué se puede hacer ahora | Cómo era antes | /compliance
 *
 * Después, `npm run novedades`. La frase la seguís escribiendo vos (esa parte no
 * se puede automatizar), pero ya no hay que acordarse de abrir este archivo ni de
 * inventar el `id`. Si el cambio no se nota, se declara con `Novedad: ninguna`.
 * `npm run hooks:install` avisa al pushear cuando un cambio visible no anuncia nada
 * — que es lo que pasó con la mitad de los arreglos de la semana del 11/08.
 *
 * Reglas para escribir una novedad (11/08/2026: "explicadas más para todo
 * público"):
 *  - Contala desde la pantalla y en segunda persona: "ya podés subir el papel al
 *    renovar un vencimiento", no "se removió la condición esEdicion".
 *  - Nada de nombres internos: ni tablas, ni componentes, ni "el modal", ni
 *    "el endpoint". Si una palabra no está escrita en la pantalla, no va.
 *  - El título es UNA línea y dice qué se puede hacer ahora. El `detalle` cuenta
 *    cómo era antes o dónde está el botón — es lo que hace que se entienda sin
 *    haber visto el cambio.
 *  - `fecha` es el día que se subió a producción, en ISO.
 *  - `id` es un slug corto y ESTABLE: con él se recuerda a quién ya se le mostró
 *    la novedad. Si se cambia, vuelve a aparecer como nueva para todos.
 *  - `tipo` y `ver` son obligatorios a propósito: obligan a decidir qué es y a
 *    quién le aparece. Ver `NovedadAlcance`.
 */
import { SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";
import { AREA_NOMBRE } from "@/lib/areas-ui";
import type { AreaCodigo, AreaNivel } from "@/lib/permisos-nivel";

/**
 * Qué clase de cambio es. Define el ícono y el rótulo con el que se dibuja:
 *  - `nuevo`: algo que antes no se podía hacer.
 *  - `mejora`: se podía, pero ahora se hace mejor o más rápido.
 *  - `arreglo`: andaba mal y ya no.
 */
export type NovedadTipo = "nuevo" | "mejora" | "arreglo";

/**
 * A quién le aparece la novedad.
 *
 * Es el mismo vocabulario de los permisos: una subsección (`choferes_vacaciones`),
 * un área entera (`compliance`) o `"todos"` cuando el cambio no habla de ninguna
 * pantalla restringida. Anunciarle a alguien una pantalla que no puede abrir es
 * peor que no anunciarle nada: le cuenta que existe y le rebota el click.
 *
 * Los dos catálogos no comparten códigos, así que un solo campo alcanza para los
 * dos (ver `esSeccion`).
 */
export type NovedadAlcance = SeccionCodigo | AreaCodigo | "todos";

export type Novedad = {
  /** Slug corto y estable. Es la memoria de "esta ya la vi". */
  id: string;
  /** Día en que salió a producción (YYYY-MM-DD). */
  fecha: string;
  /** Nuevo, mejora o arreglo: es el ícono con el que se dibuja. */
  tipo: NovedadTipo;
  /** Qué permiso hay que tener para que aparezca. */
  ver: NovedadAlcance;
  /** Qué se puede hacer ahora, en una línea y sin nombres internos. */
  titulo: string;
  /** Cómo era antes o dónde está: lo que hace que se entienda sola. */
  detalle?: string;
  /** A dónde lleva si la tocan. */
  href?: string;
};

/**
 * Ventana del pop-up del día. Es larga a propósito: adentro del pop-up se
 * muestran sólo las que la persona TODAVÍA NO VIO (ver `novedadesNuevasPara` en
 * el modal), así que la ventana no está para evitar repetir sino para que quien
 * estuvo dos semanas de vacaciones no vuelva a un cartel con la historia entera.
 */
export const VENTANA_NOVEDADES_DIAS = 30;

/** Las más nuevas arriba. Al agregar una, va al principio de la lista. */
export const NOVEDADES: Novedad[] = [
  {
    id: "en-novedades-ves-de-que-parte-del-sistema",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "todos",
    titulo: "En Novedades ves de qué parte del sistema habla cada cambio",
    detalle: "Cada renglón lleva su sección con el color del menú, así sabés a dónde ir a mirar.",
    href: "/novedades",
  },
  {
    id: "lo-que-falta-cargar-ahora-tiene-su-boton",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "compliance",
    titulo: "Lo que falta cargar ahora tiene su botón \"Cargar\"",
    detalle: "Antes decía \"Sin cargar\" y había que adivinar dónde tocar. Además el formulario entra en una pantalla y ves el documento que subís antes de guardarlo.",
    href: "/compliance",
  },
  {
    id: "cada-unidad-se-reconoce-por-el-logo-de-su",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "compliance",
    titulo: "Cada unidad se reconoce por el logo de su marca",
    detalle: "En el checklist ves el Scania, el Iveco o el Volvo al lado de la patente, igual que en Camiones. Si le sacás una foto y la subís en Camiones, pasa a mostrarse esa.",
    href: "/compliance",
  },
  {
    id: "en-el-checklist-encontras-al-chofer-o-la",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "compliance",
    titulo: "En el checklist encontrás al chofer o la unidad por su imagen",
    detalle: "Cada chofer aparece con el mismo avatar que en su legajo y cada unidad con su color. Si le cargás la foto en Camiones o en el legajo, se ve la foto.",
    href: "/compliance",
  },
  {
    id: "el-buscador-te-acompana-mientras-bajas-por",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "compliance",
    titulo: "El buscador te acompaña mientras bajás por la lista",
    detalle: "Antes había que volver hasta arriba para cambiar un filtro. Ahora la barra queda fija y al costado tenés los accesos a lo que hay que atender.",
    href: "/compliance",
  },
  {
    id: "ahora-ves-de-un-vistazo-a-quien-le-falta",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "compliance",
    titulo: "Ahora ves de un vistazo a quién le falta cada papel",
    detalle: "Tocá un tipo de documento y se abre con los nombres: primero los vencidos y los que están por vencer. Desde ahí mismo lo cargás.",
    href: "/compliance",
  },
  {
    id: "carga-un-documento-sin-tener-que-buscarlo",
    fecha: "2026-08-12",
    tipo: "mejora",
    ver: "compliance",
    titulo: "Cargá un documento sin tener que buscarlo entre 848",
    detalle: "Tocá \"Agregar documento\" arriba a la derecha, elegí cuál es y de quién, y listo. Si esa persona ya lo tenía cargado se abre para cambiarle la fecha, así no queda repetido.",
    href: "/compliance",
  },
  {
    id: "novedades-pantalla-propia",
    fecha: "2026-08-11",
    tipo: "nuevo",
    ver: "todos",
    titulo: "Las novedades ahora tienen su propia pantalla",
    detalle:
      "Acá abajo te van a aparecer sólo las que todavía no viste. Las de antes no se pierden: quedan todas en Novedades, en el menú de la izquierda.",
    href: "/novedades",
  },
  {
    id: "caja-abre-en-lo-ultimo",
    fecha: "2026-08-11",
    tipo: "arreglo",
    ver: "caja",
    titulo: "La caja abre en lo último que pasó, no en el mes pasado",
    detalle:
      "Si todavía no habías cargado nada este mes, la caja chica se iba sola al mes anterior y el día de hoy no se veía. Ahora abre con los últimos 30 días.",
    href: "/caja",
  },
  {
    id: "compliance-filtros",
    fecha: "2026-08-11",
    tipo: "mejora",
    ver: "compliance",
    titulo: "En Compliance tocás un número y la lista queda filtrada",
    detalle:
      "Tocá “Vencidos” y abajo quedan los vencidos y nada más, igual que en Legajos. Además podés buscar por tipo de documento, por estado o por empresa.",
    href: "/compliance",
  },
  {
    id: "vacaciones-hoy",
    fecha: "2026-08-11",
    tipo: "mejora",
    ver: "choferes_vacaciones",
    titulo: "Ver quién está de vacaciones hoy es un vistazo",
    detalle:
      "Antes había que abrir el panel de filtros para saberlo. Ahora está arriba con el número al lado, y si hoy no falta nadie te lo dice de una.",
    href: "/choferes/vacaciones",
  },
  {
    id: "dia-pedido-dashboard",
    fecha: "2026-08-11",
    tipo: "nuevo",
    ver: "logistica",
    titulo: "Anotá un día pedido sin moverte de la pantalla de inicio",
    detalle:
      "El turno médico, el trámite, el dentista. Se carga en tres campos y te muestra cuántos días lleva pedidos esa persona en el año.",
    href: "/dashboard",
  },
  {
    id: "compliance-sicop-secondi",
    fecha: "2026-08-11",
    tipo: "nuevo",
    ver: "compliance_sicop",
    titulo: "SICOP y Secondi ya se cargan y se editan desde el sistema",
    detalle:
      "Das de alta qué se presenta ante cada organismo, lo editás o lo das de baja, le colgás los comprobantes que haga falta y te bajás el checklist en Excel.",
    href: "/compliance",
  },
  {
    id: "hoja-ruta-otros-meses",
    fecha: "2026-08-11",
    tipo: "mejora",
    ver: "viajes_hoja_ruta",
    titulo: "Al importar la hoja de ruta te avisa si hay viajes de otro mes",
    detalle:
      "La planilla de junio traía 30 viajes de mayo, marzo y febrero. Entran igual con la fecha que tienen, pero ahora, antes de confirmar, te dice cuáles son y en qué mes van a quedar.",
    href: "/viajes/hoja-ruta",
  },
  {
    id: "compliance-adjuntar-al-renovar",
    fecha: "2026-08-10",
    tipo: "arreglo",
    ver: "compliance",
    titulo: "Cuando renovás un vencimiento ya podés subir el papel nuevo",
    detalle:
      "Antes cambiabas la fecha y el archivo había que subirlo por otro lado. Ahora van juntos, y los documentos anteriores quedan guardados igual.",
    href: "/compliance",
  },
  {
    id: "alertas-se-apagan",
    fecha: "2026-08-10",
    tipo: "arreglo",
    ver: "todos",
    titulo: "Las alertas dejan de reclamarte lo que ya resolviste",
    detalle:
      "Actualizás un vencimiento o pagás una cuota y el aviso se apaga solo. Vuelve a aparecer recién cuando se acerque la fecha nueva.",
    href: "/notificaciones",
  },
  {
    id: "vacaciones-tope-semana",
    fecha: "2026-08-06",
    tipo: "mejora",
    ver: "choferes_vacaciones",
    titulo: "Podés ver y cambiar cuánta gente se toma vacaciones por semana",
    href: "/choferes/vacaciones",
  },
  {
    id: "vacaciones-cronograma-inicio",
    fecha: "2026-08-06",
    tipo: "mejora",
    ver: "choferes_vacaciones",
    titulo: "El cronograma de vacaciones muestra qué día arranca cada uno",
    href: "/choferes/vacaciones",
  },
  {
    id: "planilla-avisos-no-son-errores",
    fecha: "2026-08-06",
    tipo: "arreglo",
    ver: "viajes_planilla",
    titulo: "Los avisos de la planilla diaria ya no parecen errores",
    detalle:
      "Los recuadros de color se leían como si algo hubiera fallado, cuando en realidad estaba todo bien.",
    href: "/viajes/planilla-diaria",
  },
  {
    id: "legajos-tarjetas-mas-claras",
    fecha: "2026-08-06",
    tipo: "mejora",
    ver: "choferes",
    titulo: "Legajos: las tarjetas se leen mejor y el mapa ocupa menos",
    href: "/choferes",
  },
];

/**
 * Las novedades de los últimos `dias` días, de la más nueva a la más vieja.
 *
 * Se corta por ventana y no por cantidad para que el pop-up no quede contando
 * novedades de hace un mes en una semana tranquila. `hoyIso` se pasa siempre
 * (nunca `new Date()` acá adentro): en este repo el server corre en UTC y los
 * cortes por fecha propia ya se corrieron un día más de una vez.
 */
/**
 * De qué parte del sistema habla la novedad, para mostrarlo como etiqueta.
 *
 * Sin esto, la lista era una tira de títulos sin contexto: "Ver quién está de
 * vacaciones hoy es un vistazo" no dice DÓNDE mirar, y quien entra a Novedades
 * justamente viene a enterarse de qué pantalla cambió.
 *
 * El color es el del área, el mismo que agrupa el menú de la izquierda: así la
 * etiqueta y el lugar donde hay que ir se reconocen por lo mismo.
 */
export function ambitoDeNovedad(n: Novedad): { nombre: string; area: AreaCodigo | null } {
  if (n.ver === "todos") return { nombre: "Todo el sistema", area: null };
  if (esSeccion(n.ver)) {
    const s = SECCION_BY_CODIGO[n.ver];
    return { nombre: s.nombre, area: s.area };
  }
  const area = n.ver as AreaCodigo;
  return { nombre: AREA_NOMBRE[area] ?? area, area };
}

export function novedadesRecientes(
  hoyIso: string,
  dias = VENTANA_NOVEDADES_DIAS,
  lista = NOVEDADES,
): Novedad[] {
  const [y, m, d] = hoyIso.split("-").map(Number);
  if (!y || !m || !d) return [];
  const desde = new Date(Date.UTC(y, m - 1, d));
  desde.setUTCDate(desde.getUTCDate() - dias);
  const desdeIso = desde.toISOString().split("T")[0]!;

  return lista
    .filter((n) => n.fecha >= desdeIso && n.fecha <= hoyIso)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/**
 * Los permisos de una persona, en la forma mínima que hace falta acá. Es
 * exactamente lo que trae `CurrentUser`: `secciones` y `permisos` (áreas).
 */
export type AccesoNovedades = {
  secciones: Partial<Record<SeccionCodigo, AreaNivel>>;
  areas: Partial<Record<AreaCodigo, AreaNivel>>;
};

/** ¿Ese código es una subsección o un área? Los catálogos no comparten códigos. */
function esSeccion(codigo: string): codigo is SeccionCodigo {
  return codigo in SECCION_BY_CODIGO;
}

/**
 * ¿Esta persona puede ver esta novedad?
 *
 * `"todos"` pasa siempre; el resto pide el permiso de lectura de esa sección o
 * área. Falla CERRADO: un código que no esté en ninguno de los dos catálogos —o
 * un permiso que no llegó— no se muestra. Es la misma decisión que en
 * `alertas-permisos`: una novedad de menos no le arruina el día a nadie;
 * anunciarle Préstamos a quien no puede abrirlo, sí.
 */
export function puedeVerNovedad(n: Novedad, acceso: AccesoNovedades): boolean {
  if (n.ver === "todos") return true;
  const nivel = esSeccion(n.ver) ? acceso.secciones[n.ver] : acceso.areas[n.ver as AreaCodigo];
  return !!nivel && nivel !== "none";
}

/** La lista filtrada por lo que esta persona puede abrir. */
export function novedadesVisibles(lista: Novedad[], acceso: AccesoNovedades): Novedad[] {
  return lista.filter((n) => puedeVerNovedad(n, acceso));
}
