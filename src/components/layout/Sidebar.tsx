"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Moon,
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
    <aside className="flex flex-col w-60 h-screen bg-white shrink-0 border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center px-4 h-[84px] border-b border-slate-200 overflow-hidden">
        <Image
          src="/logo-horizontal.png"
          alt="Don Joaquín Transporte"
          width={480}
          height={173}
          priority
          className="w-full h-auto object-contain object-left"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="mb-4">
            <p className="px-3 mb-1 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
              {group.group}
            </p>
            <ul className="space-y-px">
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
                    <NavLink
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={isActive(item.href)}
                    />
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-slate-200">
        <div className="flex items-center gap-3 px-2 py-1.5">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={`${user.nombre} ${user.apellido ?? ""}`.trim()}
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-[#29ABE2]/20"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#29ABE2] to-[#1B3F8C] text-white text-xs font-bold shrink-0 ring-2 ring-[#29ABE2]/20">
              {user ? getInitials(user) : "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 text-sm font-semibold truncate leading-tight">
              {user ? `${user.nombre}${user.apellido ? ` ${user.apellido}` : ""}` : "Invitado"}
            </p>
            {user?.rol && (
              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFC107]/15 text-[#B8860B] uppercase tracking-wider">
                {user.rol}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Alternar modo oscuro"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-[#1B3F8C] hover:bg-slate-100 transition-colors"
            >
              <Moon size={14} />
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-100 transition-colors"
              >
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.08);
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(15, 23, 42, 0.18);
        }
      `}</style>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
        active
          ? "bg-[#29ABE2]/10 text-[#1B3F8C]"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#1B3F8C]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#29ABE2] transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <Icon
        size={17}
        className={`shrink-0 transition-colors duration-150 ${
          active ? "text-[#29ABE2]" : "text-slate-500 group-hover:text-[#29ABE2]"
        }`}
      />
      <span className={`truncate ${active ? "font-semibold" : ""}`}>{label}</span>
    </Link>
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

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
          sectionActive
            ? "bg-[#29ABE2]/10 text-[#1B3F8C]"
            : "text-slate-600 hover:bg-slate-100 hover:text-[#1B3F8C]"
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#29ABE2] transition-opacity duration-150 ${
            sectionActive ? "opacity-100" : "opacity-0"
          }`}
        />
        <Icon
          size={17}
          className={`shrink-0 transition-colors duration-150 ${
            sectionActive ? "text-[#29ABE2]" : "text-slate-500 group-hover:text-[#29ABE2]"
          }`}
        />
        <span className={`flex-1 text-left truncate ${sectionActive ? "font-semibold" : ""}`}>{item.label}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            sectionActive ? "text-[#1B3F8C]/70" : "text-slate-400"
          }`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <ul className="mt-0.5 ml-[18px] pl-3 border-l border-slate-200 space-y-px py-0.5">
            {item.children!.map((child) => {
              const active = isChildActive(child);
              const ChildIcon = CHILD_ICONS[child.label];
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    prefetch
                    className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors duration-150 ${
                      active
                        ? "text-[#1B3F8C] bg-[#29ABE2]/10"
                        : "text-slate-500 hover:text-[#1B3F8C] hover:bg-slate-100"
                    }`}
                  >
                    {ChildIcon && (
                      <ChildIcon
                        size={13}
                        className={`shrink-0 transition-colors duration-150 ${
                          active ? "text-[#29ABE2]" : "text-slate-400"
                        }`}
                      />
                    )}
                    <span className="truncate">{child.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}
