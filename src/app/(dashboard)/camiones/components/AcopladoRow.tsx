"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "lucide-react";
import { logoDeMarca } from "./MarcaLogo";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import EstadoSwitch from "./EstadoSwitch";
import { updateAcopladoAction } from "../actions";
import type { Acoplado } from "../types";

export default function AcopladoRow({ acoplado, onSelect }: { acoplado: Acoplado; onSelect?: (a: Acoplado) => void }) {
  const datosCompletos = !!acoplado.marca;
  // Los acoplados casi nunca son de estas marcas, pero si lo son se ve igual.
  const logoAcoplado = logoDeMarca(acoplado.marca);
  const router = useRouter();
  const [pendingEstado, setPendingEstado] = useState(false);
  const activo = acoplado.estado === "activo";

  const toggleEstado = async () => {
    setPendingEstado(true);
    try {
      await updateAcopladoAction(acoplado.id, { estado: activo ? "inactivo" : "activo" });
      router.refresh();
    } finally {
      setPendingEstado(false);
    }
  };

  return (
    <TableRow
      onClick={() => onSelect?.(acoplado)}
      className="hover:bg-muted/40 transition-all border-b border-[#F1F5F9] last:border-0 group cursor-pointer"
    >
      <TableCell className="py-4 pl-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 border border-border overflow-hidden">
            {logoAcoplado ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG local
              <img
                src={logoAcoplado}
                alt=""
                className="max-h-[22px] max-w-[31px] object-contain"
                loading="lazy"
              />
            ) : (
              <Container size={18} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono font-medium text-foreground">{acoplado.patente}</span>
            <div className="flex items-center gap-1">
              {!datosCompletos && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wide w-fit">
                  Solo patente
                </span>
              )}
              {acoplado.es_tolva && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-wide w-fit">
                  Tolva
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {datosCompletos ? (
          <span>{acoplado.marca} {acoplado.modelo}</span>
        ) : (
          <span className="text-muted-foreground/50 italic">Sin datos</span>
        )}
      </TableCell>
      <TableCell>{acoplado.ano ?? "—"}</TableCell>
      <TableCell>
        {acoplado.capacidad_tn != null ? `${Number(acoplado.capacidad_tn).toFixed(1)} TN` : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">{acoplado.tipo ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {acoplado.camion_patente ? (
            <span className="font-mono text-xs text-foreground">{acoplado.camion_patente}</span>
          ) : (
            <span className="text-muted-foreground/50 italic text-xs">Sin camión</span>
          )}
          {acoplado.chofer_nombre ? (
            <span className="text-[11px] text-muted-foreground">{acoplado.chofer_nombre}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50 italic">Sin chofer</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <EstadoSwitch activo={activo} pending={pendingEstado} onToggle={toggleEstado} />
          <StatusBadge
            label={acoplado.estado}
            tone={activo ? "success" : "neutral"}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
