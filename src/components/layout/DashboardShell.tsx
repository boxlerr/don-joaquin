"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PanelLeft, Search } from "lucide-react";
import Sidebar, { type SidebarUser } from "./Sidebar";
import CommandPalette from "./CommandPalette";
import { AuditDrawer } from "@/components/audit-drawer";
import NotificationBell from "./NotificationBell";
import AreaErrorBanner from "@/components/AreaErrorBanner";

export const AUDIT_DRAWER_EVENT = "open-audit-drawer";

export default function DashboardShell({
  children,
  user,
  alertasCount = 0,
}: {
  children: React.ReactNode;
  user: SidebarUser | null;
  alertasCount?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const openAudit = useCallback(() => setAuditOpen(true), []);

  useEffect(() => {
    window.addEventListener(AUDIT_DRAWER_EVENT, openAudit);
    return () => window.removeEventListener(AUDIT_DRAWER_EVENT, openAudit);
  }, [openAudit]);

  return (
    <div className="flex h-full bg-background">
      <div
        className={`transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 ${
          collapsed ? "w-0" : "w-60"
        }`}
      >
        <Sidebar user={user} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
            aria-expanded={!collapsed}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PanelLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-foreground transition-colors text-sm"
          >
            <Search size={14} />
            <span className="hidden sm:inline text-xs">Buscar página...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-card text-foreground rounded border border-border">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto">
            <NotificationBell initialCount={alertasCount} />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
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
}
