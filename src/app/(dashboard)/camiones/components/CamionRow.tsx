"use client";

import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import CamionDetailSheet from "./CamionDetailSheet";

export default function CamionRow({ camion }: { camion: any }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow 
        key={camion.id} 
        className="cursor-pointer hover:bg-[#F8FAFC] transition-colors"
        onClick={() => setOpen(true)}
      >
        <TableCell className="font-mono font-medium">{camion.patente}</TableCell>
        <TableCell>
          {camion.marca} {camion.modelo}
        </TableCell>
        <TableCell>{camion.ano ?? "—"}</TableCell>
        <TableCell>{Number(camion.capacidad_tn).toFixed(1)} TN</TableCell>
        <TableCell className="text-[#475569]">{camion.tipo_camion ?? "—"}</TableCell>
        <TableCell>
          <StatusBadge
            label={camion.estado}
            tone={
              camion.estado === "activo"
                ? "success"
                : camion.estado === "en_mantenimiento"
                  ? "warning"
                  : "neutral"
            }
          />
        </TableCell>
      </TableRow>

      <CamionDetailSheet 
        camion={camion} 
        open={open} 
        onOpenChange={setOpen} 
      />
    </>
  );
}
