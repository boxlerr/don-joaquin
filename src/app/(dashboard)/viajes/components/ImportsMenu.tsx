"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  ChevronDown,
  FileSpreadsheet,
  Truck,
  FileText,
} from "lucide-react";
import ImportHojasRutaModal from "./ImportHojasRutaModal";
import ImportHojaRutaModal from "./ImportHojaRutaModal";
import ImportLomaModal from "./ImportLomaModal";
import ImportYpfModal from "./ImportYpfModal";

type ModalKey = "hojas-ruta" | "hoja-ruta" | "loma" | "ypf" | null;

export default function ImportsMenu() {
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  const handleChange = (key: Exclude<ModalKey, null>) => (v: boolean) => {
    setOpenModal(v ? key : null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <Upload size={14} />
              Importar
              <ChevronDown size={14} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[240px]">
          <DropdownMenuItem onClick={() => setOpenModal("hojas-ruta")}>
            <Upload size={14} />
            Hoja de ruta (multi-hoja)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenModal("hoja-ruta")}>
            <FileSpreadsheet size={14} />
            HOJA DE RUTA
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenModal("loma")}>
            <Truck size={14} />
            Liquidación Loma
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenModal("ypf")}>
            <FileText size={14} />
            PDF de YPF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportHojasRutaModal
        open={openModal === "hojas-ruta"}
        onOpenChange={handleChange("hojas-ruta")}
        showTrigger={false}
      />
      <ImportHojaRutaModal
        open={openModal === "hoja-ruta"}
        onOpenChange={handleChange("hoja-ruta")}
        showTrigger={false}
      />
      <ImportLomaModal
        open={openModal === "loma"}
        onOpenChange={handleChange("loma")}
        showTrigger={false}
      />
      <ImportYpfModal
        open={openModal === "ypf"}
        onOpenChange={handleChange("ypf")}
        showTrigger={false}
      />
    </>
  );
}
