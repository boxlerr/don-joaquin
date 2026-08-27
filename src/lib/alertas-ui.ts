/**
 * Cómo se DIBUJA cada categoría de aviso: ícono, nombre corto, color y a dónde
 * lleva.
 *
 * Vive aparte porque lo comparten el pop-up del día y el dashboard. Cuando cada
 * uno tenía el suyo, el dashboard mostraba cinco categorías inventadas
 * ("documentación, cheques, viajes, personal, sistema") que no eran las de la
 * matriz de notificaciones: Impuestos, Préstamos, Compliance y Mantenimiento
 * caían todas juntas en "Sistema", que es un cajón que no dice nada. Y ninguno
 * de los dos lados podía cambiar de nombre sin que el otro quedara distinto.
 *
 * Las claves son las de `ALERTA_COLUMNAS` (la matriz de /configuracion/
 * notificaciones): si mañana nace una categoría, cae sola en la campana de
 * "otros avisos" en vez de romper nada.
 */
import {
  Banknote,
  Bell,
  Cake,
  Calculator,
  FileText,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  TreePalm,
  Truck,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CATEGORIA_ESTILO } from "@/lib/email-template";

/**
 * Categoría → ícono de lucide.
 *
 * `CATEGORIA_ESTILO` ya trae un `icono`, pero es un EMOJI: existe para el mail,
 * donde no se puede mandar un SVG. En pantalla el emoji lo dibuja cada sistema a
 * su manera (y en Windows la mitad salen en blanco y negro), así que acá va
 * lucide como en todo el resto del sistema.
 */
export const ICONO_CATEGORIA: Record<string, LucideIcon> = {
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

/** El ícono de la categoría, con la campana genérica como red. */
export const iconoDe = (key: string): LucideIcon => ICONO_CATEGORIA[key] ?? Bell;

/**
 * Nombre corto para las tarjetas.
 *
 * "Vencimiento de Documentos" en una tarjeta de 160px se parte en tres
 * renglones y empuja el número; el nombre completo queda en el `aria-label` y en
 * la pantalla de configuración.
 */
export const NOMBRE_CORTO: Record<string, string> = {
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

/** El color de la categoría — el mismo del mail, así el aviso se reconoce igual. */
export function colorCategoria(key: string): string {
  return CATEGORIA_ESTILO[key]?.color ?? CATEGORIA_ESTILO.otros_avisos!.color;
}

/** El mismo color al 10%, para el fondo del ícono. Sólo aplica a hex de 6. */
export function tinte(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}1A` : color;
}

/**
 * Categorías que saben abrir su pantalla YA FILTRADA.
 *
 * Pedido de Julián (27/08/2026): *"si le hago click al resumen de cheques que me
 * lleve a cheques y ya me filtre los cheques, y lo mismo con todos los otros"*.
 * Caer en la lista completa obliga a rearmar a mano el filtro que produjo el
 * número — y a veces ni se sabe cuál era.
 *
 * La regla es una sola: **se entra a lo que dice el número grande**. Si el grupo
 * tiene algo vencido, el número son los vencidos y el destino los muestra a
 * ellos; si no hay nada vencido, el número es el total y el destino abre todo lo
 * que la categoría está avisando.
 *
 * Cada destino usa el filtro que esa pantalla YA tiene, elegido por su propio
 * dueño (las cifras abribles de /cheques, las solapas de /impuestos, las listas
 * de /prestamos): acá no se inventa ninguna vista nueva.
 *
 * Lo que NO está acá cae en el prefijo común de sus avisos (ver abajo).
 * Compliance es el caso pendiente: su checklist todavía no sabe mostrar sólo lo
 * vencido, así que se entra a la pantalla entera.
 */
const DESTINO_FILTRADO: Record<string, (vencidos: number) => string> = {
  // Con algo vencido, el número grande son LOS VENCIDOS: el click tiene que
  // abrir esos y no la lista entera. "No entiendo 3 cheques de 21, le hago click
  // y no me filtra cuáles son" (Julián, 27/08/2026).
  cheques_vencidos: (v) => (v > 0 ? "/cheques?vista=vencidos" : "/cheques?vista=avisos"),
  impuestos: (v) => (v > 0 ? "/impuestos?estado=vencido" : "/impuestos?estado=por_vencer"),
  prestamos_vencimiento: (v) => (v > 0 ? "/prestamos?foco=vencidas" : "/prestamos"),
  // Documentos mezcla camiones y choferes: la única pantalla que los muestra
  // juntos —con su fecha y cuánto falta— es la de avisos.
  vencimiento_docs: () => "/notificaciones?categoria=documentacion",
  rrhh_eventos: () => "/notificaciones?categoria=personal",
};

/**
 * A dónde lleva una categoría entera.
 *
 * Primero el destino filtrado, si esa categoría tiene uno. Si no, la sección
 * común de sus avisos, deducida de los `href` que ya trae cada uno en vez de
 * mantener otra tabla de rutas —una que se desactualiza sola cuando una pantalla
 * se muda—. Y si los avisos apuntan a secciones distintas, no hay "la sección
 * del grupo": el destino honesto es la lista de notificaciones.
 */
export function destinoDeGrupo(grupo: {
  key?: string;
  vencidos?: number;
  items: { href: string | null }[];
}): string {
  const filtrado = grupo.key ? DESTINO_FILTRADO[grupo.key] : undefined;
  if (filtrado) return filtrado(grupo.vencidos ?? 0);

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
 * Qué es cada categoría, en una línea.
 *
 * Va debajo del nombre, en la tarjeta del resumen del día. Existe porque el
 * nombre solo no alcanza: "Cheques 3" no dice si eso hay que cobrarlo, pagarlo o
 * depositarlo — que es textualmente lo que preguntó Julián el 27/08/2026. La
 * frase es del lenguaje de la oficina, no del sistema.
 *
 * Cortas de verdad: la tarjeta mide unos 230px y lo que no entra se trunca con
 * puntos suspensivos, que es peor que no decir nada.
 */
export const SUBTITULO_CATEGORIA: Record<string, string> = {
  vencimiento_docs: "De choferes y camiones",
  vencimiento_compliance: "Papeles de los clientes",
  impuestos: "Vencimientos impositivos",
  prestamos_vencimiento: "Cuotas de los préstamos",
  // De los dos lados: los que nos deben y los nuestros que todavía no se debitan.
  cheques_vencidos: "Por cobrar y por debitarse",
  rrhh_eventos: "Fechas del personal",
  ausencias_vacaciones: "Quién no va a estar",
  viaticos_sin_rendir: "Plata entregada sin rendir",
  gastos_pendientes: "Gastos sin comprobante",
  cambios_caja: "Movimientos de caja",
  nuevo_viaje: "Viajes",
  mantenimiento: "Services e insumos",
  otros_avisos: "Sin categoría propia",
};

/**
 * Blanco o casi-negro, el que se lea sobre ese color.
 *
 * El ícono de la categoría va sobre su color pleno, y la paleta sale del menú
 * (`GRUPO_COLOR`): hoy son todos tonos medios u oscuros y el blanco anda, pero
 * el día que entre uno claro —un amarillo, un lima— un glifo blanco encima
 * desaparece. Se decide con la luminancia relativa (WCAG), no a ojo.
 */
export function textoSobre(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return "#FFFFFF";
  const canal = (i: number) => {
    const v = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luz = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  return luz > 0.45 ? "#1E293B" : "#FFFFFF";
}
