"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import CamionDetailSheet from "./CamionDetailSheet";
import type { Camion } from "../types";
import type { TipoServicio } from "../actions";

export default function CamionRow({
  camion,
  tiposServicio,
}: {
  camion: Camion;
  tiposServicio: TipoServicio[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        key={camion.id}
        className="cursor-pointer hover:bg-muted/40 transition-all border-b border-[#F1F5F9] last:border-0 group"
        onClick={() => setOpen(true)}
      >
        <TableCell className="py-4 pl-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E1F5FE] flex items-center justify-center shrink-0 overflow-hidden border border-[#B3E5FC]">
              {camion.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={camion.foto_url}
                  alt={camion.patente}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Truck size={18} className="text-primary" />
              )}
            </div>
            <span className="font-mono font-medium text-foreground">{camion.patente}</span>
          </div>
        </TableCell>
        <TableCell>
          {camion.marca} {camion.modelo}
        </TableCell>
        <TableCell>{camion.ano ?? "—"}</TableCell>
        <TableCell>{Number(camion.capacidad_tn).toFixed(1)} TN</TableCell>
        <TableCell className="text-muted-foreground">{camion.tipo_camion ?? "—"}</TableCell>
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
        tiposServicio={tiposServicio}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
