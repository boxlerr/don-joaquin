"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { descargarExport } from "@/lib/download-export";
import { FileSpreadsheet, ChevronDown, Loader2, Package, Wrench, CircleDot, BarChart3, DollarSign, Layers } from "lucide-react";

const VISTAS: { only: string; label: string; icon: typeof Package }[] = [
  { only: "insumos", label: "Insumos", icon: Package },
  { only: "servicios", label: "Servicios", icon: Wrench },
  { only: "roturas", label: "Roturas", icon: CircleDot },
  { only: "reportes", label: "Reportes por unidad", icon: BarChart3 },
  { only: "costo", label: "Costo por chofer", icon: DollarSign },
];

export default function ExportMenu({ onToast }: { onToast: (msg: string, tone?: "success" | "info" | "error") => void }) {
  const [busy, setBusy] = useState(false);

  const bajar = async (only?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const url = only ? `/mantenimiento/export?only=${only}` : "/mantenimiento/export";
      await descargarExport(url, `mantenimiento_${only ?? "completo"}.xlsx`);
      onToast(only ? "Excel descargado" : "Excel completo descargado");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "No se pudo generar el Excel.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin text-[#10B981]" /> : <FileSpreadsheet size={14} className="text-[#10B981]" />}
            Exportar
            <ChevronDown size={13} className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuItem onClick={() => bajar()} className="font-medium">
          <Layers size={14} className="text-primary" /> Todo junto (Excel completo)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Una sola vista</DropdownMenuLabel>
        {VISTAS.map((v) => {
          const Icon = v.icon;
          return (
            <DropdownMenuItem key={v.only} onClick={() => bajar(v.only)}>
              <Icon size={14} className="text-muted-foreground" /> {v.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
