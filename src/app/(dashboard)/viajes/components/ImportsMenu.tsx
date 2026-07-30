"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Upload, ChevronDown, Route, Factory, Fuel, CalendarClock } from "lucide-react";
import ImportHojaRutaModal from "./ImportHojaRutaModal";
import ImportLomaModal from "./ImportLomaModal";
import ImportYpfModal from "./ImportYpfModal";
import ImportProgramacionModal from "./ImportProgramacionModal";

type ModalKey = "hoja-ruta" | "loma" | "ypf" | "programacion" | null;

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
        <DropdownMenuContent align="end" className="min-w-[280px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Operación interna</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setOpenModal("hoja-ruta")}>
              <Route size={14} />
              Hoja de ruta
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Documentación de clientes</DropdownMenuLabel>
            {/* Los viajes del día que Loma manda por adelantado: entran sin
                chofer y después se asignan. */}
            <DropdownMenuItem onClick={() => setOpenModal("programacion")}>
              <CalendarClock size={14} />
              Programación de viajes — Loma Negra
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenModal("loma")}>
              <Factory size={14} />
              Liquidación de fletes — Loma Negra
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenModal("ypf")}>
              <Fuel size={14} />
              Documento de Medición — YPF
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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
      <ImportProgramacionModal
        open={openModal === "programacion"}
        onOpenChange={handleChange("programacion")}
      />
      <ImportYpfModal
        open={openModal === "ypf"}
        onOpenChange={handleChange("ypf")}
        showTrigger={false}
      />
    </>
  );
}
