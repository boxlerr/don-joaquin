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
  ShieldCheck,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS, type NavItem, type NavChild } from "./nav-items";
import { logoutAction } from "@/app/login/actions";
import type { PermisosArea, AreaCodigo, AreaNivel } from "@/lib/auth";
import type { SeccionCodigo } from "@/lib/secciones";
import { GRUPO_COLOR } from "@/lib/areas-ui";

// Color distintivo por sección del sidebar (dot + rótulo), para diferenciarlas
// de un vistazo (idea de Bárbara). Vive en `lib/areas-ui` porque lo usa también
// la etiqueta de las novedades: el mismo color acá y allá es lo que dice a qué
// parte del menú hay que ir.
const GROUP_ACCENT: Record<string, string> = GRUPO_COLOR;

export type SidebarUser = {
  nombre: string;
  apellido: string | null;
  email: string;
  rol: string | null;
  avatarUrl: string | null;
  permisos: PermisosArea;
  secciones: Record<SeccionCodigo, AreaNivel>;
};

const NIVEL_RANK: Record<AreaNivel, number> = { none: 0, read: 1, write: 2, admin: 3 };

/** Visibilidad de un nodo de nav: la subsección manda sobre el área. */
function canAccessNode(
  user: SidebarUser,
  node: { seccion?: SeccionCodigo; area?: AreaCodigo },
): boolean {
  if (node.seccion) return NIVEL_RANK[user.secciones[node.seccion]] >= NIVEL_RANK.read;
  if (node.area) return NIVEL_RANK[user.permisos[node.area]] >= NIVEL_RANK.read;
  return true;
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

/** En el riel de íconos el nombre y el rol solo existen como tooltip del avatar. */
function userTooltip(user: SidebarUser): string {
  const nombre = `${user.nombre}${user.apellido ? ` ${user.apellido}` : ""}`;
  return user.rol ? `${nombre} — ${user.rol}` : nombre;
}

export default function Sidebar({
  user,
  collapsed = false,
}: {
  user: SidebarUser | null;
  /** true → riel de íconos (56px): se navega igual, con tooltips. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isChildActive = (child: NavChild) => pathname === child.href;

  const hasActiveChild = (item: NavItem) =>
    !!item.children?.some((c) => isChildActive(c));

  return (
    // `h-full` y no `h-screen`: en el celular `100vh` incluye la barra del
    // navegador, así que el bloque del usuario (logout) quedaba abajo del borde
    // visible y no se podía tocar. El alto lo define el contenedor.
    <aside className={`flex flex-col h-full bg-card text-card-foreground shrink-0 border-r border-border ${collapsed ? "w-14" : "w-60"}`}>
      {/* Logo */}
      <div className={`flex items-center justify-center border-b border-border overflow-hidden ${collapsed ? "h-14 px-1.5" : "px-4 h-[84px]"}`}>
        {collapsed ? (
          <Image
            src="/logo.png"
            alt="Don Joaquín Transporte"
            width={408}
            height={275}
            priority
            className="h-9 w-auto object-contain"
            title="Don Joaquín Transporte"
          />
        ) : (
          <Image
            src="/logo-horizontal.png"
            alt="Don Joaquín Transporte"
            width={480}
            height={173}
            priority
            className="h-auto object-contain"
            style={{ maxWidth: '90%' }}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 overflow-y-auto sidebar-scroll ${collapsed ? "px-1.5" : "px-3"}`}>
        {NAV_GROUPS.map((group) => {
          const visibleItems: NavItem[] = user
            ? group.items
                .map((item) => {
                  if (!item.children) {
                    return canAccessNode(user, item) ? item : null;
                  }
                  const children = item.children.filter((c) =>
                    canAccessNode(user, { seccion: c.seccion, area: c.area ?? item.area }),
                  );
                  // El padre se ve si al menos una subsección hija es accesible.
                  return children.length > 0 ? { ...item, children } : null;
                })
                .filter((item): item is NavItem => item !== null)
            : group.items;

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="mb-4">
              {collapsed ? (
                // Riel: el rótulo del grupo se reduce a su punto de color.
                <p className="mb-1 flex justify-center" title={group.group}>
                  <span className="size-1.5 rounded-full" style={{ background: GROUP_ACCENT[group.group] ?? "#64748B" }} />
                </p>
              ) : (
                <p
                  className="px-3 mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] uppercase"
                  style={{ color: GROUP_ACCENT[group.group] ?? "#64748B" }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: GROUP_ACCENT[group.group] ?? "#64748B" }} />
                  {group.group}
                </p>
              )}
              <ul className="space-y-px">
                {visibleItems.map((item) =>
                  item.children && item.children.length > 0 && !collapsed ? (
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
                        active={isActive(item.href) || (collapsed && hasActiveChild(item))}
                        collapsed={collapsed}
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
      <div className={`${collapsed ? "px-1.5" : "px-3"} py-3 border-t border-border`}>
        {/* `items-start`: el rol largo ("Representante de Combustible") ocupa dos
            renglones, así que el avatar y el logout se alinean con el nombre y no
            quedan flotando en el medio del bloque. */}
        <div className={collapsed ? "flex flex-col items-center gap-2 py-1" : "flex items-start gap-2.5 px-1.5 py-1.5"}>
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={`${user.nombre} ${user.apellido ?? ""}`.trim()}
              title={collapsed && user ? userTooltip(user) : undefined}
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-primary/20"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              title={collapsed && user ? userTooltip(user) : undefined}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-brand-900 text-primary-foreground text-xs font-bold shrink-0 ring-2 ring-primary/20"
            >
              {user ? getInitials(user) : "?"}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p
                className="text-foreground text-sm font-semibold truncate leading-tight"
                title={user ? `${user.nombre}${user.apellido ? ` ${user.apellido}` : ""}` : undefined}
              >
                {user ? `${user.nombre}${user.apellido ? ` ${user.apellido}` : ""}` : "Invitado"}
              </p>
              {user?.rol && (
                // Sin pastilla: el rol entero se lee aunque envuelva. El color va
                // en el ícono, no en un fondo.
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <ShieldCheck size={12} className="mt-[1px] shrink-0 text-primary" />
                  <span className="min-w-0">{user.rol}</span>
                </p>
              )}
            </div>
          )}
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex items-center justify-center w-7 h-7 rounded-md text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </form>
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
  collapsed = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  /** true → solo el ícono, centrado, con el nombre como tooltip. */
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150 ${
        collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
      } ${
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
      {!collapsed && <span className={`truncate ${active ? "font-semibold" : ""}`}>{label}</span>}
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
          size={15}
          strokeWidth={2.5}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${
            sectionActive ? "text-primary" : "text-primary/70"
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
