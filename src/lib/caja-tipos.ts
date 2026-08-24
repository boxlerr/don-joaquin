/**
 * Los tipos de la caja: cómo se llaman, cómo se escriben libres y a qué pantalla
 * llevan.
 *
 * Vive acá —sin `server-only`— porque los mismos rótulos los necesitan las tres
 * puntas: los diálogos de alta, la tabla de movimientos y el correo que se manda
 * por cada movimiento. Antes había tres copias de `CATEGORIA_LABEL` y ya no
 * decían todas lo mismo (en la tabla "Rendición / vuelto", en el alta "Rendición
 * / Vuelto", en el filtro otra).
 *
 * Las dos ideas nuevas (24/08/2026, pedido de Julián):
 *
 *  1. La categoría se puede ESCRIBIR. El enum de la base es corto y obligaba a
 *     elegir "Otro" para todo lo que no estaba previsto. Ahora lo que se escribe
 *     se guarda tal cual en `categoria_libre` y es lo que se muestra; el enum
 *     queda en 'otro' y sigue siendo lo que agrupa.
 *  2. Cada movimiento LLEVA A ALGÚN LADO. Un egreso de "Cubiertas" tiene que
 *     poder abrir Mantenimiento, un cobro tiene que abrir el cliente. Eso lo
 *     resuelve `destinoDeMovimiento`, que devuelve además qué permiso hace falta
 *     para entrar: el link se dibuja sólo si el que mira puede abrirlo, porque
 *     ofrecer un atajo que rebota es peor que no ofrecerlo.
 */

import type { AreaCodigo } from "@/lib/permisos-nivel";
import type { SeccionCodigo } from "@/lib/secciones";
import { normalizarTexto } from "@/lib/texto";

/** Los valores del enum `caja_categoria` de la base. */
export type CajaCategoria =
  | "cobro_cliente"
  | "pago_proveedor"
  | "entrega_viatico"
  | "rendicion_vuelto"
  | "gasto_operativo"
  | "pago_chofer"
  | "transferencia_interna"
  | "ajuste"
  | "otro";

/** Ingreso o egreso: define qué categorías se sugieren al cargar. */
export type CajaFlujo = "ingreso" | "egreso";

/** Cómo se llama cada categoría en la pantalla. Una sola vez, para todos. */
export const CATEGORIA_LABEL: Record<CajaCategoria, string> = {
  cobro_cliente: "Cobro a cliente",
  pago_proveedor: "Pago a proveedor",
  entrega_viatico: "Entrega de viático",
  rendicion_vuelto: "Rendición / vuelto",
  gasto_operativo: "Gasto operativo",
  pago_chofer: "Pago a chofer",
  transferencia_interna: "Transferencia interna",
  ajuste: "Ajuste",
  otro: "Otro",
};

/**
 * Las que se sugieren al cargar. `ajuste` cambia de nombre según el lado
 * (positivo o negativo) y por eso no sale del mapa de arriba.
 */
export const CATEGORIAS_POR_FLUJO: Record<
  CajaFlujo,
  { id: CajaCategoria; label: string }[]
> = {
  ingreso: [
    { id: "cobro_cliente", label: "Cobro a cliente" },
    { id: "rendicion_vuelto", label: "Rendición / vuelto" },
    { id: "transferencia_interna", label: "Transferencia interna" },
    { id: "ajuste", label: "Ajuste positivo" },
  ],
  egreso: [
    { id: "gasto_operativo", label: "Gasto operativo" },
    { id: "pago_proveedor", label: "Pago a proveedor" },
    { id: "pago_chofer", label: "Pago a chofer" },
    { id: "entrega_viatico", label: "Entrega de viático" },
    { id: "transferencia_interna", label: "Transferencia interna" },
    { id: "ajuste", label: "Ajuste negativo" },
  ],
};

/**
 * Cómo se llama en la pantalla la categoría de un tipo de gasto.
 *
 * En la base son `operativo_viaje`, `mantenimiento`… y el desplegable los
 * mostraba tal cual, en mayúsculas: "OPERATIVO_VIAJE - Alimentación". Eso es el
 * nombre de un valor de enum, no algo que alguien diga.
 */
export const CATEGORIA_GASTO_LABEL: Record<string, string> = {
  operativo_viaje: "Viaje",
  mantenimiento: "Mantenimiento",
  administrativo: "Administrativo",
  otro: "Otro",
};

export const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

/** Cómo se llama cada caja en la pantalla (la "grande" es la General). */
export const CAJA_LABEL: Record<string, string> = {
  diaria: "Caja chica",
  grande: "Caja general",
};

/**
 * Qué se guarda cuando alguien escribe la categoría en vez de elegirla.
 *
 * Si lo escrito es una de las de la lista —sin importar acentos ni mayúsculas—
 * se guarda como esa, y no como texto suelto: escribir "cobro a cliente" y
 * elegir "Cobro a cliente" tienen que terminar en la misma fila, si no la caja
 * queda con dos categorías que se leen igual y filtran distinto.
 *
 * Lo que no coincide se guarda TAL CUAL SE ESCRIBIÓ (con su mayúscula y su
 * acento) en `categoria_libre`, con el enum en 'otro'.
 */
export function resolverCategoria(
  texto: string,
  flujo: CajaFlujo,
): { categoria: CajaCategoria; categoriaLibre: string | null } {
  const limpio = texto.trim();
  if (!limpio) return { categoria: "otro", categoriaLibre: null };

  const norm = normalizarTexto(limpio);

  // Primero las que se ofrecen de este lado (el rótulo de `ajuste` cambia según
  // sea positivo o negativo), después el resto del enum.
  const propia = CATEGORIAS_POR_FLUJO[flujo].find((c) => normalizarTexto(c.label) === norm);
  if (propia) return { categoria: propia.id, categoriaLibre: null };

  for (const [id, label] of Object.entries(CATEGORIA_LABEL) as [CajaCategoria, string][]) {
    if (normalizarTexto(label) === norm) return { categoria: id, categoriaLibre: null };
  }
  return { categoria: "otro", categoriaLibre: limpio };
}

/** El texto que se ve en el campo cuando se abre un movimiento ya cargado. */
export function textoCategoria(
  categoria: string,
  categoriaLibre: string | null,
  flujo: CajaFlujo,
): string {
  if (categoriaLibre) return categoriaLibre;
  const propia = CATEGORIAS_POR_FLUJO[flujo].find((c) => c.id === categoria);
  return propia?.label ?? CATEGORIA_LABEL[categoria as CajaCategoria] ?? categoria;
}

/**
 * El movimiento visto de afuera: lo que hace falta para saber cómo se llama y a
 * dónde lleva. Los `*_id` son las columnas de `caja_movimientos`.
 */
export type MovimientoTipoInput = {
  categoria: string;
  /** Lo que dice el movimiento. Se usa para dejar filtrado el destino. */
  concepto?: string | null;
  categoria_libre?: string | null;
  /** Nombre del tipo de gasto vinculado (Combustible, Cubiertas, Multas…). */
  tipo_gasto_nombre?: string | null;
  /** Categoría de ese tipo de gasto: operativo_viaje | mantenimiento | … */
  tipo_gasto_categoria?: string | null;
  viaje_codigo?: string | null;
  chofer_slug?: string | null;
  cliente_id?: string | null;
  viaje_id?: string | null;
  chofer_id?: string | null;
  cheque_id?: string | null;
  mantenimiento_id?: string | null;
  carga_combustible_id?: string | null;
  siniestro_id?: string | null;
  viatico_id?: string | null;
  gasto_id?: string | null;
};

/**
 * Cómo se llama el tipo de un movimiento: lo más específico que haya.
 *
 * Lo escrito a mano le gana al tipo de gasto y los dos le ganan a la categoría
 * del enum: si alguien se tomó el trabajo de escribir "Venta de chatarra", eso
 * es lo que tiene que decir la fila, no "Otro".
 */
export function etiquetaTipo(m: MovimientoTipoInput): string {
  return (
    m.categoria_libre?.trim() ||
    m.tipo_gasto_nombre ||
    CATEGORIA_LABEL[m.categoria as CajaCategoria] ||
    m.categoria
  );
}

/** A dónde lleva un movimiento y qué permiso hace falta para entrar. */
export type DestinoMovimiento = {
  href: string;
  /** Cómo se llama la pantalla de destino ("Mantenimiento", "Clientes"). */
  seccion: string;
  /** Área del destino: de ahí sale el color del punto (el del menú). */
  area: AreaCodigo;
  /** Subsección que hay que tener, si el destino es una. */
  requiereSeccion?: SeccionCodigo;
};

/**
 * La solapa Gastos, con la lista ya filtrada por el concepto del movimiento.
 *
 * Es el punto del pedido de Julián (24/08): "veo un egreso en la caja y digo
 * qué carajo es; le doy click y voy a la sección donde lo veo más a detalle —
 * ah, fue un repuesto de tal faro, de tal camión". Ese detalle (el tipo, el
 * camión, la descripción larga, el comprobante) vive en la fila de gastos, y el
 * concepto del movimiento es la misma descripción con la que se guardó.
 */
function destinoGastos(concepto?: string | null): DestinoMovimiento {
  const q = concepto?.trim();
  return {
    href: q ? `/caja/gastos?q=${encodeURIComponent(q)}` : "/caja/gastos",
    seccion: "Gastos",
    area: "caja",
    requiereSeccion: "gastos",
  };
}

const DESTINO_CAJA_GENERAL: DestinoMovimiento = {
  href: "/caja?caja=grande",
  seccion: "Caja general",
  area: "caja",
  requiereSeccion: "caja_grande",
};

/**
 * A qué pantalla lleva un movimiento.
 *
 * El orden es de lo más concreto a lo más general: si el movimiento está atado a
 * un viaje, a un chofer o a un cheque, se va a ESA ficha; si no, manda el tipo
 * de gasto (una cubierta es mantenimiento aunque se haya pagado de la caja); y
 * recién al final, la categoría.
 *
 * Devuelve `null` cuando no hay nada mejor que la propia caja: un ajuste o un
 * "Otro" suelto no tienen ficha, y un link que vuelve a la misma pantalla es
 * ruido — peor todavía, enseña que los movimientos "a veces" no hacen nada.
 */
export function destinoDeMovimiento(m: MovimientoTipoInput): DestinoMovimiento | null {
  if (m.viaje_id) {
    return {
      // El listado busca por código; sin código, el listado pelado.
      href: m.viaje_codigo ? `/viajes?q=${encodeURIComponent(m.viaje_codigo)}` : "/viajes",
      seccion: "Viajes",
      area: "viajes",
      requiereSeccion: "viajes_listado",
    };
  }
  if (m.chofer_id && m.chofer_slug) {
    return {
      href: `/choferes/${m.chofer_slug}`,
      seccion: "Legajo del chofer",
      area: "logistica",
      requiereSeccion: "choferes",
    };
  }
  if (m.cliente_id) {
    return { href: "/clientes", seccion: "Clientes", area: "comercial", requiereSeccion: "clientes" };
  }
  if (m.cheque_id) {
    return { href: "/cheques", seccion: "Cheques", area: "finanzas", requiereSeccion: "cheques" };
  }
  if (m.mantenimiento_id) {
    return {
      href: "/mantenimiento",
      seccion: "Mantenimiento",
      area: "mantenimiento",
      requiereSeccion: "mantenimiento_servicios",
    };
  }
  if (m.carga_combustible_id) {
    return { href: "/combustible", seccion: "Combustible", area: "combustible" };
  }
  if (m.siniestro_id) {
    return { href: "/siniestros", seccion: "Siniestros", area: "seguridad", requiereSeccion: "siniestros" };
  }
  if (m.viatico_id) return DESTINO_CAJA_GENERAL;

  // Elegir un tipo de gasto al cargar el egreso deja una fila real en Gastos: el
  // mismo egreso, con su tipo, su camión y su comprobante. Ahí es donde está el
  // detalle, así que ahí lleva — y NO a Mantenimiento o Combustible por el rubro
  // del tipo: esas pantallas listan services y cargas, no gastos, y el atajo
  // terminaría en una lista donde este egreso no aparece.
  if (m.gasto_id || m.tipo_gasto_nombre) return destinoGastos(m.concepto);

  switch (m.categoria) {
    case "cobro_cliente":
      return { href: "/clientes", seccion: "Clientes", area: "comercial", requiereSeccion: "clientes" };
    case "pago_chofer":
      return { href: "/choferes", seccion: "Legajos", area: "logistica", requiereSeccion: "choferes" };
    case "pago_proveedor":
    case "gasto_operativo":
      return destinoGastos(m.concepto);
    case "entrega_viatico":
    case "rendicion_vuelto":
    case "transferencia_interna":
      return DESTINO_CAJA_GENERAL;
    default:
      return null;
  }
}

/** Plata de la caja: siempre con los dos decimales, para poder cuadrarla. */
export function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
