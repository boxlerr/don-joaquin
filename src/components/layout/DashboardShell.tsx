"use client";

import { useState } from "react";
import { PanelLeft, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="flex h-full bg-[#F8FAFC]">
      <div
        className={`transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 ${
          collapsed ? "w-0" : "w-60"
        }`}
      >
        <Sidebar />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E2E8F0] bg-white">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
            aria-expanded={!collapsed}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
          >
            <PanelLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] hover:border-[#0088D1] hover:text-[#475569] transition-colors text-sm"
          >
            <Search size={14} />
            <span className="hidden sm:inline text-xs">Buscar página...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-white rounded border border-[#E2E8F0]">
              Ctrl K
            </kbd>
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
