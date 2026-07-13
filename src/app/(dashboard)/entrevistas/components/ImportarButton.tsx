"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import ImportEntrevistasDialog from "./ImportEntrevistasDialog";

export default function ImportarButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="size-4" /> Importar Excel
      </Button>
      <ImportEntrevistasDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
