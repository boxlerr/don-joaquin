"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import MantenimientoTutorial from "./MantenimientoTutorial";

export default function HelpTutorialButton({ canWrite = false }: { canWrite?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <HelpCircle size={14} /> ¿Cómo funciona?
      </Button>
      {open && <MantenimientoTutorial canWrite={canWrite} onClose={() => setOpen(false)} />}
    </>
  );
}
