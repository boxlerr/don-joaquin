"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Menu, PanelLeft, Search, Sunrise, X } from "lucide-react";
import Sidebar, { type SidebarUser } from "./Sidebar";
import CommandPalette from "./CommandPalette";
import { AuditDrawer } from "@/components/audit-drawer";
import NotificationBell from "./NotificationBell";
import AreaErrorBanner from "@/components/AreaErrorBanner";
import NotificacionesProvider from "@/components/notificaciones/NotificacionesProvider";
import NotifToaster from "@/components/notificaciones/NotifToaster";
import ResumenDiarioModal, { RESUMEN_DIARIO_EVENT } from "@/components/notificaciones/ResumenDiarioModal";
import { UsuarioActualProvider } from "./UsuarioActualProvider";
import LimpiezaBorradores from "@/components/borradores/LimpiezaBorradores";

export const AUDIT_DRAWER_EVENT = "open-audit-drawer";

export default function DashboardShell({
  children,
  user,
  alertasCount = 0,
  userId = null,
}: {
  children: React.ReactNode;
  user: SidebarUser | null;
  alertasCount?: number;
  userId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  // En celular el sidebar NO ocupa lugar: se abre como cajón por encima del
  // contenido. Antes se comía 60 de los 375px de ancho y no había forma de
  // sacarlo, que es la mitad de por qué el sistema era inusable desde el celu.
  const [navOpen, setNavOpen] = useState(false);

  const openAudit = useCallback(() => setAuditOpen(true), []);

  useEffect(() => {
    window.addEventListener(AUDIT_DRAWER_EVENT, openAudit);
    return () => window.removeEventListener(AUDIT_DRAWER_EVENT, openAudit);
  }, [openAudit]);

  // Con el cajón abierto, el fondo no scrollea (si no, el dedo mueve la página
  // de atrás en vez del menú) y Escape lo cierra.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  const shell = (
    <div className="flex h-full bg-background">
      {/* Desktop: riel/panel fijo que empuja al contenido. Colapsado = riel de
          íconos (no desaparece): se sigue navegando y cada uno muestra su
          nombre al pasar el mouse. */}
      <div
        className={`hidden lg:block transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        <Sidebar user={user} collapsed={collapsed} />
      </div>

      {/* Celular/tablet: cajón por encima del contenido, con fondo oscuro. */}
      <div
        onClick={() => setNavOpen(false)}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        aria-hidden={!navOpen}
        // Tocar un link cierra el cajón: si no, tapa la página a la que se acaba
        // de entrar. Va acá por delegación y no en un efecto sobre el pathname
        // porque así también cierra cuando el link apunta a la página actual (no
        // hay navegación, y el cajón quedaba abierto). Los grupos que despliegan
        // submenús son <button>, no <a>, así que expandirlos no lo cierra.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setNavOpen(false);
        }}
        // `invisible` cuando está cerrado, no sólo corrido: con el cajón fuera
        // de pantalla los links seguían siendo enfocables con Tab, así que el
        // foco se iba a un menú que no se ve. `visibility` saca del orden de
        // tabulación; el `transition-[transform,visibility]` mantiene el
        // deslizado.
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw] shadow-xl transition-[transform,visibility] duration-300 ease-out ${
          navOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Cerrar menú"
          className="absolute top-3 right-3 z-10 flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
        <Sidebar user={user} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-border bg-card">
          {/* Celular: abre el cajón. Desktop: colapsa/expande el panel. */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={navOpen}
            className="lg:hidden flex items-center justify-center size-10 -ml-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
            aria-expanded={!collapsed}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PanelLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buscar página"
            className="flex items-center gap-2 px-2.5 sm:px-3 h-10 sm:h-auto sm:py-1.5 rounded-lg border border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-foreground transition-colors text-sm"
          >
            <Search size={16} className="shrink-0" />
            <span className="hidden sm:inline text-xs">Buscar página...</span>
            <kbd className="hidden lg:flex items-center gap-0.5 ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-card text-foreground rounded border border-border">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            {/* Vuelve a abrir el resumen del día. Va suelto en la barra, al lado
                de la campana: es su propio botón y no una opción escondida
                adentro del panel de notificaciones. Sólo con sesión, que es
                cuando está montado el modal que escucha el evento. */}
            {userId && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(RESUMEN_DIARIO_EVENT))}
                title="Resumen del día"
                aria-label="Abrir el resumen del día"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <Sunrise size={18} />
              </button>
            )}
            <NotificationBell initialCount={alertasCount} />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Suspense fallback={null}>
            <AreaErrorBanner />
          </Suspense>
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
      />

      <AuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  );

  // El provider es la ÚNICA fuente de polling; la campana y el toaster lo consumen.
  // Sin usuario (no debería pasar: el layout redirige a /login) la campana degrada
  // a un ícono estático.
  //
  // El de usuario envuelve a los dos casos: los borradores de lo que se está
  // tipeando se guardan por usuario, y eso tiene que valer en toda la pantalla.
  if (!userId) {
    return <UsuarioActualProvider userId={null}>{shell}</UsuarioActualProvider>;
  }

  return (
    <UsuarioActualProvider userId={userId}>
      <NotificacionesProvider userId={userId} initialCount={alertasCount}>
        {shell}
        <NotifToaster />
        {/* Resumen del día: aparece una vez por jornada, en el medio de la pantalla.
            Reemplaza al toast de bootstrap que se perdía abajo a la derecha. */}
        <ResumenDiarioModal userId={userId} nombre={user?.nombre} />
        <LimpiezaBorradores />
      </NotificacionesProvider>
    </UsuarioActualProvider>
  );
}
