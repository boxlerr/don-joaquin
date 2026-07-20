import {
  LayoutDashboard,
  Bell,
  MapPin,
  Truck,
  Users,
  UsersRound,
  AlertTriangle,
  Wrench,
  Briefcase,
  DollarSign,
  Wallet,
  FileText,
  Fuel,
  Receipt,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Flame,
  UserSearch,
  BarChart3,
  Landmark,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { AreaCodigo } from "@/lib/auth";
import type { SeccionCodigo } from "@/lib/secciones";

export interface NavChild {
  label: string;
  href: string;
  /** Subsección que controla la visibilidad. Tiene prioridad sobre `area`. */
  seccion?: SeccionCodigo;
  /** Si se omite (y no hay `seccion`), hereda el área del padre. */
  area?: AreaCodigo;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Subsección que controla la visibilidad. Tiene prioridad sobre `area`. */
  seccion?: SeccionCodigo;
  /** Área que controla la visibilidad. Si se omite (y no hay `seccion`), siempre visible. */
  area?: AreaCodigo;
  children?: NavChild[];
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      // Dashboard con facturación — confidencial, solo quien tenga la sección.
      { label: "Dashboard completo", href: "/dashboard/completo", icon: TrendingUp, seccion: "dashboard_completo" },
      // Métricas históricas (planillas del padre) — confidencial, solo admins.
      { label: "Métricas", href: "/metricas", icon: BarChart3, seccion: "metricas" },
      { label: "Notificaciones", href: "/notificaciones", icon: Bell },
      { label: "Reportes", href: "/reportes", icon: BarChart3, seccion: "reportes" },
    ],
  },
  {
    group: "LOGÍSTICA",
    items: [
      {
        label: "Viajes",
        href: "/viajes",
        icon: MapPin,
        area: "viajes",
        children: [
          { label: "Listado", href: "/viajes", seccion: "viajes_listado" },
          { label: "Hoja de ruta", href: "/viajes/hoja-ruta", seccion: "viajes_hoja_ruta" },
          { label: "Carga rápida", href: "/viajes/carga-rapida", seccion: "viajes_carga_rapida" },
          { label: "Planilla diaria", href: "/viajes/planilla-diaria", seccion: "viajes_planilla" },
          { label: "DM y liquidaciones", href: "/viajes/liquidaciones", seccion: "viajes_liquidaciones" },
        ],
      },
      { label: "Combustible", href: "/combustible", icon: Fuel, area: "combustible" },
    ],
  },
  {
    group: "FLOTA",
    items: [
      { label: "Camiones", href: "/camiones", icon: Truck, seccion: "camiones" },
      {
        label: "Mantenimiento",
        href: "/mantenimiento",
        icon: Wrench,
        area: "mantenimiento",
        children: [
          { label: "Servicios", href: "/mantenimiento", seccion: "mantenimiento_servicios" },
          { label: "Costos rep. y rep.", href: "/mantenimiento/costos", seccion: "mantenimiento_costos" },
        ],
      },
    ],
  },
  {
    group: "SEGURIDAD",
    items: [
      { label: "Siniestros", href: "/siniestros", icon: AlertTriangle, seccion: "siniestros" },
      { label: "Extintores", href: "/extintores", icon: Flame, seccion: "extintores" },
    ],
  },
  {
    group: "RRHH",
    items: [
      {
        label: "Personal",
        href: "/choferes",
        icon: Users,
        area: "logistica",
        children: [
          { label: "Legajos", href: "/choferes", seccion: "choferes" },
          { label: "Ranking", href: "/choferes/ranking", seccion: "choferes_ranking" },
          { label: "Rotación", href: "/choferes/rotacion", seccion: "choferes_rotacion" },
          { label: "Vacaciones", href: "/choferes/vacaciones", seccion: "choferes_vacaciones" },
          { label: "Sueldos", href: "/choferes/sueldos", seccion: "sueldos" },
        ],
      },
      { label: "Entrevistas", href: "/entrevistas", icon: UserSearch, area: "rrhh" },
    ],
  },
  {
    group: "COMERCIAL",
    items: [
      { label: "Clientes", href: "/clientes", icon: Briefcase, seccion: "clientes" },
      { label: "Tarifas", href: "/tarifas", icon: DollarSign, seccion: "tarifas" },
    ],
  },
  {
    group: "FINANZAS",
    items: [
      { label: "Caja", href: "/caja", icon: Wallet, area: "caja" },
      { label: "Gastos", href: "/gastos", icon: Receipt, seccion: "gastos" },
      { label: "Cheques", href: "/cheques", icon: FileText, seccion: "cheques" },
      { label: "Impuestos", href: "/impuestos", icon: Landmark, seccion: "impuestos" },
      // Cuotas de préstamos bancarios — confidencial (solo dirección).
      { label: "Préstamos", href: "/prestamos", icon: PiggyBank, seccion: "prestamos" },
    ],
  },
  {
    group: "COMPLIANCE",
    items: [
      { label: "Compliance", href: "/compliance", icon: ShieldCheck, area: "compliance" },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: UsersRound, seccion: "usuarios" },
      { label: "Auditoría", href: "/auditoria", icon: ShieldAlert, seccion: "auditoria" },
      {
        label: "Configuración",
        href: "/configuracion",
        icon: Settings,
        area: "sistema",
        children: [
          { label: "General", href: "/configuracion", seccion: "configuracion" },
          { label: "Notificaciones", href: "/configuracion/notificaciones", seccion: "configuracion" },
        ],
      },
    ],
  },
];
