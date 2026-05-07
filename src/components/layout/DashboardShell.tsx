"use client";

import { useState } from "react";
import { PanelLeft } from "lucide-react";
import Sidebar from "./Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
