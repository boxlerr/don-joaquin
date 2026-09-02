// Árbol con la forma del SIDEBAR: grupo de color → páginas → subsecciones.
// Fuente única compartida por el editor de "Secciones confidenciales" y por el
// selector de "Permisos individuales", para que ambos se vean y ordenen igual
// que el menú lateral y no se desincronicen. El orden y los colores espejan el
// sidebar (mismos hex que components/layout/Sidebar.tsx).
//
// NO se deriva de `nav-items` a propósito: este árbol es MÁS fino que el menú.
// Caja es una entrada del sidebar y acá son dos permisos (saldo y caja grande),
// Compliance es una y acá son cuatro, y hay secciones que no tienen entrada
// propia en el menú — "Facturación en el dashboard" destapa importes DENTRO del
// dashboard, no una página. Generarlo automáticamente perdería esa granularidad,
// que es justo lo que se otorga.
//
// Lo que sí está garantizado es que NINGUNA sección quede afuera:
//  · `sidebar-tree.test.ts` falla si una sección del catálogo no está acá.
//  · Y si aun así pasara, el editor la muestra en un bloque "Sin ubicar" en vez
//    de esconderla: una sección que no se puede otorgar es una pantalla que
//    nadie puede abrir. Pasó el 25/08 con Previsión.

import type { SeccionCodigo } from "@/lib/secciones";

export type ArbolHoja = { seccion: SeccionCodigo; label: string };
export type ArbolPagina = { label: string; seccion?: SeccionCodigo; subs?: ArbolHoja[] };
export type ArbolGrupo = { label: string; color: string; paginas: ArbolPagina[] };

export const SIDEBAR_ARBOL: ArbolGrupo[] = [
  {
    label: "Principal",
    color: "#475569",
    paginas: [
      // No es una página aparte: es lo que destapa los importes DENTRO del
      // dashboard (la facturación del período, el $/km y los montos por chofer).
      { label: "Facturación en el dashboard", seccion: "dashboard_completo" },
      { label: "Métricas históricas", seccion: "metricas" },
      { label: "Reportes", seccion: "reportes" },
    ],
  },
  {
    label: "Logística",
    color: "#0088D1",
    paginas: [
      {
        label: "Viajes",
        subs: [
          { seccion: "viajes_listado", label: "Listado y mensual" },
          { seccion: "viajes_hoja_ruta", label: "Hoja de ruta" },
          { seccion: "viajes_carga_rapida", label: "Carga rápida" },
          { seccion: "viajes_planilla", label: "Planilla diaria" },
          { seccion: "viajes_liquidaciones", label: "DM y liquidaciones" },
        ],
      },
    ],
  },
  {
    label: "Flota",
    color: "#6366F1",
    paginas: [
      { label: "Camiones", seccion: "camiones" },
      {
        label: "Mantenimiento",
        subs: [
          { seccion: "mantenimiento_servicios", label: "Servicios" },
          { seccion: "mantenimiento_costos", label: "Costos rep. y rep." },
        ],
      },
    ],
  },
  {
    label: "Seguridad",
    color: "#EF4444",
    paginas: [
      { label: "Siniestros", seccion: "siniestros" },
      { label: "Extintores", seccion: "extintores" },
    ],
  },
  {
    label: "RR.HH.",
    color: "#10B981",
    paginas: [
      {
        label: "Personal",
        subs: [
          { seccion: "choferes", label: "Legajos" },
          { seccion: "choferes_ranking", label: "Ranking" },
          { seccion: "choferes_rotacion", label: "Rotación" },
          { seccion: "choferes_vacaciones", label: "Vacaciones" },
          { seccion: "sueldos", label: "Sueldos" },
        ],
      },
      { label: "Sueldos admin y taller", seccion: "sueldos_admin" },
    ],
  },
  {
    label: "Comercial",
    color: "#A855F7",
    paginas: [
      { label: "Clientes", seccion: "clientes" },
      { label: "Tarifas", seccion: "tarifas" },
    ],
  },
  {
    label: "Finanzas",
    color: "#F59E0B",
    paginas: [
      {
        label: "Caja",
        subs: [
          { seccion: "caja_saldo", label: "Saldo e historial" },
          { seccion: "caja_grande", label: "Caja grande" },
        ],
      },
      { label: "Gastos", seccion: "gastos" },
      { label: "Cheques", seccion: "cheques" },
      {
        label: "Impuestos",
        subs: [
          { seccion: "impuestos", label: "De la empresa" },
          // El calendario de un contribuyente persona física. Se otorga aparte
          // porque son los datos fiscales de alguien, no de Joaquín Hnos.
          { seccion: "impuestos_personales", label: "Personales" },
        ],
      },
      { label: "Préstamos", seccion: "prestamos" },
      { label: "Previsión", seccion: "prevision" },
    ],
  },
  {
    label: "Compliance",
    color: "#06B6D4",
    paginas: [
      {
        label: "Compliance",
        subs: [
          { seccion: "compliance_loma", label: "Loma Negra" },
          { seccion: "compliance_ypf", label: "YPF" },
          { seccion: "compliance_sicop", label: "SICOP" },
          { seccion: "compliance_secondi", label: "Secondi" },
        ],
      },
    ],
  },
  {
    label: "Sistema",
    color: "#64748B",
    paginas: [
      { label: "Usuarios y permisos", seccion: "usuarios" },
      { label: "Auditoría", seccion: "auditoria" },
      { label: "Configuración", seccion: "configuracion" },
    ],
  },
];

/** Todas las secciones que el árbol deja otorgar. */
export function seccionesDelArbol(): Set<SeccionCodigo> {
  const out = new Set<SeccionCodigo>();
  for (const g of SIDEBAR_ARBOL) {
    for (const p of g.paginas) {
      if (p.seccion) out.add(p.seccion);
      for (const s of p.subs ?? []) out.add(s.seccion);
    }
  }
  return out;
}
