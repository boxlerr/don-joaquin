"use client";

// Botón de exportar del header (verde, como en todas las páginas): abre el
// diálogo con checklist de planillas y formato Excel/PDF, juntas o separadas.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import ExportarMetricasDialog from "../ExportarMetricasDialog";

export default function ExportarButton({ mes }: { mes: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="success" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileSpreadsheet size={14} /> Exportar
      </Button>
      <ExportarMetricasDialog open={open} onOpenChange={setOpen} mes={mes} />
    </>
  );
}
