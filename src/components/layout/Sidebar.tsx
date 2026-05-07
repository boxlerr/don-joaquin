"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bell,
  MapPin,
  Truck,
  Users,
  Briefcase,
  DollarSign,
  Wallet,
  FileText,
  Shield,
  Settings,
  Moon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
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
      { label: "Choferes", href: "/choferes", icon: Users },
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
      { label: "Cheques", href: "/cheques", icon: FileText },
    ],
  },
  {
    group: "SISTEMA",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: Shield },
      { label: "Configuración", href: "/configuracion", icon: Settings },
    ],
  },
];

const PLACEHOLDER_USER = { name: "JULIANBOXLER", initials: "JB", role: "Admin" };

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-[#0F172A] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0088D1]">
          <Truck size={20} className="text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-sm tracking-wide">SISTEMA</p>
          <p className="text-[#0088D1] font-semibold text-xs tracking-widest">TRANSPORTE</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navigation.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-[#475569] uppercase">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        active
                          ? "bg-[#0088D1] text-white shadow-sm"
                          : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={active ? "text-white" : "text-[#94A3B8]"}
                      />
                      {item.label}
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0088D1] text-white text-xs font-bold shrink-0">
            {PLACEHOLDER_USER.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{PLACEHOLDER_USER.name}</p>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFB300]/20 text-[#FFB300] uppercase tracking-wide">
              {PLACEHOLDER_USER.role}
            </span>
          </div>
          <button
            type="button"
            aria-label="Alternar modo oscuro"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <Moon size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
