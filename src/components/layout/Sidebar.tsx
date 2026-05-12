"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Moon,
  Truck,
  LogOut,
  ChevronDown,
  Sliders,
  Building2,
  Shield,
  FileText,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS, type NavItem, type NavChild } from "./nav-items";
import { logoutAction } from "@/app/login/actions";

export type SidebarUser = {
  nombre: string;
  apellido: string | null;
  email: string;
  rol: string | null;
  avatarUrl: string | null;
};

const CHILD_ICONS: Record<string, LucideIcon> = {
  General: Sliders,
  Negocio: Building2,
  Usuarios: Shield,
  "Plantillas PDF": FileText,
  Notificaciones: Bell,
};

function getInitials(user: SidebarUser): string {
  const first = user.nombre?.[0] ?? "";
  const last = user.apellido?.[0] ?? "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || user.email[0]?.toUpperCase() || "?";
}

export default function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isChildActive = (child: NavChild) => pathname === child.href;

  const hasActiveChild = (item: NavItem) =>
    !!item.children?.some((c) => isChildActive(c));

  return (
    <aside className="flex flex-col w-60 h-screen bg-[#0F172A] shrink-0">
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
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-[#475569] uppercase">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) =>
                item.children && item.children.length > 0 ? (
                  <CollapsibleItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    isChildActive={isChildActive}
                    hasActiveChild={hasActiveChild}
                  />
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive(item.href)
                          ? "bg-[#0088D1] text-white shadow-sm"
                          : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <item.icon
                        size={18}
                        className={isActive(item.href) ? "text-white" : "text-[#94A3B8]"}
                      />
                      {item.label}
                      {isActive(item.href) && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
                      )}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={`${user.nombre} ${user.apellido ?? ""}`.trim()}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0088D1] text-white text-xs font-bold shrink-0">
              {user ? getInitials(user) : "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {user ? `${user.nombre}${user.apellido ? ` ${user.apellido}` : ""}` : "Invitado"}
            </p>
            {user?.rol && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFB300]/20 text-[#FFB300] uppercase tracking-wide">
                {user.rol}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Alternar modo oscuro"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors"
            >
              <Moon size={14} />
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-white/10 transition-colors"
              >
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CollapsibleItem({
  item,
  pathname,
  isChildActive,
  hasActiveChild,
}: {
  item: NavItem;
  pathname: string;
  isChildActive: (child: NavChild) => boolean;
  hasActiveChild: (item: NavItem) => boolean;
}) {
  const activeChild = hasActiveChild(item);
  const sectionActive =
    activeChild || pathname === item.href || pathname.startsWith(item.href + "/");
  const [open, setOpen] = useState(sectionActive);
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          sectionActive
            ? "bg-[#0088D1] text-white shadow-sm"
            : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon size={18} className={sectionActive ? "text-white" : "text-[#94A3B8]"} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            sectionActive ? "text-white" : "text-[#94A3B8]"
          }`}
        />
      </button>

      {open && (
        <ul className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
          {item.children!.map((child) => {
            const active = isChildActive(child);
            const ChildIcon = CHILD_ICONS[child.label];
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all duration-150 ${
                    active
                      ? "text-[#EF4444]"
                      : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {ChildIcon && (
                    <ChildIcon
                      size={14}
                      className={active ? "text-[#EF4444]" : "text-[#94A3B8]"}
                    />
                  )}
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
