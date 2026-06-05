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
  CalendarClock,
  Settings,
  Flame,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import type { AreaCodigo } from "@/lib/auth";

export interface NavChild {
  label: string;
  href: string;
  /** Si se omite, hereda el área del padre. */
  area?: AreaCodigo;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Área que controla la visibilidad. Si se omite, el item es visible siempre. */
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
      { label: "Notificaciones", href: "/notificaciones", icon: Bell },
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
          { label: "Listado", href: "/viajes" },
          { label: "Carga rápida", href: "/viajes/carga-rapida" },
        ],
      },
      { label: "Combustible", href: "/combustible", icon: Fuel, area: "combustible" },
    ],
  },
  {
    group: "FLOTA",
    items: [
      { label: "Camiones", href: "/camiones", icon: Truck, area: "flota" },
      { label: "Mantenimiento", href: "/mantenimiento", icon: Wrench, area: "mantenimiento" },
    ],
  },
  {
    group: "SEGURIDAD",
    items: [
      { label: "Siniestros", href: "/siniestros", icon: AlertTriangle, area: "logistica" },
      { label: "Extintores", href: "/extintores", icon: Flame, area: "flota" },
    ],
  },
  {
    group: "RRHH",
    items: [
      {
        // NOTA: técnicamente Choferes vive en el área "logistica" (la
        // página y todas las server actions hacen requireArea("logistica")).
        // Visualmente lo agrupamos en RRHH como pidió Bárbara, pero el
        // permiso sigue siendo de logística hasta que migremos el módulo
        // completo a "rrhh" (ver tarea en Notion).
        label: "Choferes",
        href: "/choferes",
        icon: Users,
        area: "logistica",
        children: [
          { label: "Legajos", href: "/choferes" },
          { label: "Ranking", href: "/choferes/ranking" },
        ],
      },
      { label: "Entrevistas", href: "/entrevistas", icon: UserSearch, area: "rrhh" },
    ],
  },
  {
    group: "COMERCIAL",
    items: [
      { label: "Clientes", href: "/clientes", icon: Briefcase, area: "comercial" },
      { label: "Tarifas", href: "/tarifas", icon: DollarSign, area: "comercial" },
    ],
  },
  {
    group: "FINANZAS",
    items: [
      { label: "Caja", href: "/caja", icon: Wallet, area: "caja" },
      { label: "Gastos", href: "/gastos", icon: Receipt, area: "finanzas" },
      { label: "Cheques", href: "/cheques", icon: FileText, area: "finanzas" },
    ],
  },
  {
    group: "COMPLIANCE",
    items: [
      { label: "Loma Negra", href: "/compliance/loma-negra", icon: ShieldCheck, area: "compliance" },
      { label: "YPF", href: "/compliance/ypf", icon: ShieldCheck, area: "compliance" },
      { label: "Próximas presentaciones", href: "/compliance/proximas", icon: CalendarClock, area: "compliance" },
      { label: "SICOP", href: "/compliance/organismos/sicop", icon: ShieldCheck, area: "compliance" },
      { label: "Secondi", href: "/compliance/organismos/secondi", icon: ShieldCheck, area: "compliance" },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: UsersRound, area: "sistema" },
      { label: "Auditoría", href: "/auditoria", icon: ShieldAlert, area: "sistema" },
      {
        label: "Configuración",
        href: "/configuracion",
        icon: Settings,
        area: "sistema",
        children: [
          { label: "General", href: "/configuracion" },
          { label: "Negocio", href: "/configuracion/negocio" },
          { label: "Plantillas PDF", href: "/configuracion/plantillas-pdf" },
          { label: "Notificaciones", href: "/configuracion/notificaciones" },
        ],
      },
    ],
  },
];
