import {
  Banknote,
  Bell,
  Building2,
  DollarSign,
  FileSpreadsheet,
  type LucideIcon,
  ShieldCheck,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import type { Database } from "@/types/database";
import { getValidacion, type ValidacionParametro } from "./validaciones";

export type Parametro = Database["public"]["Tables"]["parametros_sistema"]["Row"];

/**
 * Metadatos visuales de cada categoría de parámetros. Cada una tiene un ícono,
 * un título legible, una descripción corta y un color de acento (para el chip
 * del ícono). Los colores van inline (no como clases de Tailwind) para no
 * depender del purge de clases dinámicas.
 */
export type CategoryMeta = {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  color: string;
  bg: string;
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  general: {
    icon: Building2,
    titulo: "Empresa y datos generales",
    descripcion: "Identidad y datos fiscales de la empresa.",
    color: "#0369A1",
    bg: "#E0F2FE",
  },
  tarifas: {
    icon: DollarSign,
    titulo: "Tarifas",
    descripcion: "Precios base que usa el sistema para calcular fletes.",
    color: "#047857",
    bg: "#D1FAE5",
  },
  liquidacion: {
    icon: FileSpreadsheet,
    titulo: "Liquidación",
    descripcion: "Períodos y tarifas por defecto para hojas de ruta.",
    color: "#7C3AED",
    bg: "#EDE9FE",
  },
  sueldos: {
    icon: Banknote,
    titulo: "Sueldos",
    descripcion: "Valores por defecto para la liquidación de sueldos.",
    color: "#0D9488",
    bg: "#CCFBF1",
  },
  notificaciones: {
    icon: Bell,
    titulo: "Notificaciones",
    descripcion: "Umbrales y anticipación de los avisos automáticos.",
    color: "#B45309",
    bg: "#FEF3C7",
  },
  compliance: {
    icon: ShieldCheck,
    titulo: "Compliance",
    descripcion: "Presentaciones a organismos y clientes principales.",
    color: "#0E7490",
    bg: "#CFFAFE",
  },
  seguridad: {
    icon: ShieldAlert,
    titulo: "Seguridad y acceso",
    descripcion: "Horario permitido y cierre de sesión por inactividad.",
    color: "#BE123C",
    bg: "#FFE4E6",
  },
  ranking: {
    icon: Trophy,
    titulo: "Ranking de choferes",
    descripcion: "Fórmula del score de desempeño (pesos y referencias).",
    color: "#4338CA",
    bg: "#E0E7FF",
  },
};

export const CATEGORY_ORDER = [
  "general",
  "tarifas",
  "liquidacion",
  "sueldos",
  "notificaciones",
  "compliance",
  "seguridad",
  "ranking",
];

export function getCategoryMeta(cat: string): CategoryMeta {
  return (
    CATEGORY_META[cat] ?? {
      icon: Building2,
      titulo: cat.charAt(0).toUpperCase() + cat.slice(1),
      descripcion: "Parámetros del sistema.",
      color: "#475569",
      bg: "#F1F5F9",
    }
  );
}

/**
 * Enlace opcional en el encabezado de una categoría hacia el módulo donde se
 * gestiona de forma más completa (ej. Notificaciones tiene su propia pantalla).
 */
export const CATEGORY_LINK: Record<string, { href: string; label: string }> = {
  notificaciones: {
    href: "/configuracion/notificaciones",
    label: "Canales y destinatarios",
  },
  tarifas: { href: "/tarifas", label: "Calculadora de tarifas" },
  ranking: { href: "/choferes/ranking", label: "Editor del score" },
};

/**
 * Claves que se muestran y editan en la ficha "Datos de la empresa" (arriba de
 * la lista), así que se ocultan de la lista de parámetros para no duplicarlas.
 */
export const EMPRESA_CARD_CLAVES = [
  "empresa_razon_social",
  "empresa_cuit",
  "empresa_domicilio",
  "empresa_email",
  "empresa_telefono",
  "moneda_default",
];

/**
 * Parámetros que NO se editan como texto plano acá porque tienen un editor
 * dedicado (JSON estructurado, matrices de usuarios, etc.). Se muestran como
 * fila "avanzada" con un enlace al módulo correspondiente.
 */
export const PARAM_MODULO: Record<string, { href: string; label: string }> = {
  ranking_score_config: {
    href: "/choferes/ranking",
    label: "Editar en Ranking de choferes",
  },
  notificaciones_destinatarios_ids: {
    href: "/configuracion/notificaciones",
    label: "Editar en Notificaciones",
  },
  notificaciones_matriz_por_usuario: {
    href: "/configuracion/notificaciones",
    label: "Editar en Notificaciones",
  },
};

/**
 * Un parámetro es "avanzado" si guarda JSON estructurado o si está mapeado a un
 * editor dedicado. No se edita inline en la lista general.
 */
export function esAvanzado(p: Parametro): boolean {
  return p.tipo_dato === "json" || p.clave in PARAM_MODULO;
}

export function moduloDeParam(p: Parametro): { href: string; label: string } | null {
  return PARAM_MODULO[p.clave] ?? null;
}

/** Un parámetro es editable inline sólo si tiene permiso, es editable y no es avanzado. */
export function esEditableInline(p: Parametro, canWrite: boolean): boolean {
  return canWrite && p.editable && !esAvanzado(p);
}

/**
 * Texto para mostrar el valor de un parámetro de forma amigable:
 * booleanos como Activado/Desactivado, opciones con su etiqueta, montos con
 * separador de miles y prefijo (ej. "$ 1.500"), horas tal cual.
 */
export function displayValor(
  valor: string,
  tipo: string,
  validacion?: ValidacionParametro,
): string {
  if (valor === "" || valor == null) return "—";
  if (tipo === "boolean") return valor === "true" ? "Activado" : "Desactivado";
  if (validacion?.opcionesLabels?.[valor]) return validacion.opcionesLabels[valor]!;
  if (tipo === "number") {
    const n = Number(valor);
    if (Number.isFinite(n)) {
      if (validacion?.prefijo === "$") return `$ ${n.toLocaleString("es-AR")}`;
      if (validacion?.unidad) return `${n.toLocaleString("es-AR")} ${validacion.unidad}`;
    }
  }
  return valor;
}

export function displayValorParam(p: Parametro): string {
  return displayValor(p.valor, p.tipo_dato, getValidacion(p.clave, p.tipo_dato));
}
