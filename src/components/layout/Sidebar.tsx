"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  LogOut,
  ChevronDown,
  Sliders,
  Building2,
  Shield,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS, type NavItem, type NavChild } from "./nav-items";
import { logoutAction } from "@/app/login/actions";
import type { PermisosArea, AreaCodigo, AreaNivel } from "@/lib/auth";

export type SidebarUser = {
  nombre: string;
  apellido: string | null;
  email: string;
  rol: string | null;
  avatarUrl: string | null;
  permisos: PermisosArea;
};

const NIVEL_RANK: Record<AreaNivel, number> = { none: 0, read: 1, write: 2, admin: 3 };

function canAccessArea(permisos: PermisosArea, area: AreaCodigo | undefined): boolean {
  if (!area) return true;
  return NIVEL_RANK[permisos[area]] >= NIVEL_RANK.read;
}

const CHILD_ICONS: Record<string, LucideIcon> = {
  General: Sliders,
  Negocio: Building2,
  Usuarios: Shield,
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
    <aside className="flex flex-col w-60 h-screen bg-card text-card-foreground shrink-0 border-r border-border">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 h-[84px] border-b border-border overflow-hidden">
        <Image
          src="/logo-horizontal.png"
          alt="Don Joaquín Transporte"
          width={480}
          height={173}
          priority
          className="h-auto object-contain"
          style={{ maxWidth: '90%' }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll">
        {NAV_GROUPS.map((group) => {
          const permisos = user?.permisos;
          const visibleItems = permisos
            ? group.items
                .filter((item) => canAccessArea(permisos, item.area))
                .map((item) =>
                  item.children
                    ? {
                        ...item,
                        children: item.children.filter((c) =>
                          canAccessArea(permisos, c.area ?? item.area),
                        ),
                      }
                    : item,
                )
            : group.items;

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-bold tracking-[0.16em] text-muted-foreground/80 uppercase">
                {group.group}
              </p>
              <ul className="space-y-px">
                {visibleItems.map((item) =>
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
                  ),
                )}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-1.5">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={`${user.nombre} ${user.apellido ?? ""}`.trim()}
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-primary/20"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-brand-900 text-primary-foreground text-xs font-bold shrink-0 ring-2 ring-primary/20">
              {user ? getInitials(user) : "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-sm font-semibold truncate leading-tight">
              {user ? `${user.nombre}${user.apellido ? ` ${user.apellido}` : ""}` : "Invitado"}
            </p>
            {user?.rol && (
              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent/15 text-accent-500 uppercase tracking-wider">
                {user.rol}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
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
          background: color-mix(in oklab, var(--foreground) 12%, transparent);
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: color-mix(in oklab, var(--foreground) 24%, transparent);
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
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <Icon
        size={17}
        className={`shrink-0 transition-colors duration-150 ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
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
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary transition-opacity duration-150 ${
            sectionActive ? "opacity-100" : "opacity-0"
          }`}
        />
        <Icon
          size={17}
          className={`shrink-0 transition-colors duration-150 ${
            sectionActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
          }`}
        />
        <span className={`flex-1 text-left truncate ${sectionActive ? "font-semibold" : ""}`}>{item.label}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            sectionActive ? "text-primary/70" : "text-muted-foreground/70"
          }`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <ul className="mt-0.5 ml-[18px] pl-3 border-l border-border space-y-px py-0.5">
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
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {ChildIcon && (
                      <ChildIcon
                        size={13}
                        className={`shrink-0 transition-colors duration-150 ${
                          active ? "text-primary" : "text-muted-foreground/80"
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
