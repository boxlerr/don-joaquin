import { Container } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Acoplado } from "../types";

export default function AcopladoRow({ acoplado }: { acoplado: Acoplado }) {
  const datosCompletos = !!acoplado.marca;

  return (
    <TableRow className="hover:bg-muted/40 transition-all border-b border-[#F1F5F9] last:border-0 group">
      <TableCell className="py-4 pl-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 border border-border">
            <Container size={18} className="text-muted-foreground" />
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
        <StatusBadge
          label={acoplado.estado}
          tone={acoplado.estado === "activo" ? "success" : "neutral"}
        />
      </TableCell>
    </TableRow>
  );
}
