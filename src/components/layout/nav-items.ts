import {
  LayoutDashboard,
  Bell,
  MapPin,
  Truck,
  Users,
  AlertTriangle,
  Wrench,
  Briefcase,
  DollarSign,
  Wallet,
  FileText,
  Receipt,
  Shield,
  ShieldAlert,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
      { label: "Viajes", href: "/viajes", icon: MapPin },
      { label: "Camiones", href: "/camiones", icon: Truck },
      { label: "Mantenimiento", href: "/mantenimiento", icon: Wrench },
      { label: "Choferes", href: "/choferes", icon: Users },
      { label: "Siniestros", href: "/siniestros", icon: AlertTriangle },
    ],
  },
  {
    group: "COMERCIAL",
    items: [
      { label: "Clientes", href: "/clientes", icon: Briefcase },
      { label: "Tarifas", href: "/tarifas", icon: DollarSign },
    ],
  },
  {
    group: "FINANZAS",
    items: [
      { label: "Caja", href: "/caja", icon: Wallet },
      { label: "Gastos", href: "/gastos", icon: Receipt },
      { label: "Cheques", href: "/cheques", icon: FileText },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      { label: "Auditoría", href: "/auditoria", icon: ShieldAlert },
      {
        label: "Configuración",
        href: "/configuracion",
        icon: Settings,
        children: [
          { label: "General", href: "/configuracion" },
          { label: "Negocio", href: "/configuracion/negocio" },
          { label: "Usuarios", href: "/usuarios" },
          { label: "Plantillas PDF", href: "/configuracion/plantillas-pdf" },
          { label: "Notificaciones", href: "/configuracion/notificaciones" },
        ],
      },
    ],
  },
];
