"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import type { RangoKey } from "./lib";

interface Props {
  rangoActual: RangoKey;
  desdeActual: string;
  hastaActual: string;
}

export default function ExportButton({
  rangoActual,
  desdeActual,
  hastaActual,
}: Props) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const queryString = (() => {
    const p = new URLSearchParams();
    p.set("rango", rangoActual);
    if (rangoActual === "custom") {
      p.set("desde", desdeActual);
      p.set("hasta", hastaActual);
    }
    return p.toString();
  })();

  const excelHref = `/choferes/ranking/export/excel?${queryString}`;
  const pdfHref = `/choferes/ranking/print?${queryString}`;

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Download size={14} />
        Exportar
        <ChevronDown size={12} className="opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-44 bg-card border border-border rounded-lg shadow-md py-1">
          <a
            href={excelHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <FileSpreadsheet size={14} className="text-[#10B981]" />
            Excel (.xlsx)
          </a>
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <FileText size={14} className="text-[#EF4444]" />
            PDF (imprimir)
          </a>
        </div>
      )}
    </div>
  );
}
