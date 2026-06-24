"use client";

import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import RendirViaticoDialog, { type ViaticoPendiente } from "./RendirViaticoDialog";

const ars = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

export default function ViaticosPendientesPanel({
  viaticos,
  canWrite,
}: {
  viaticos: ViaticoPendiente[];
  canWrite: boolean;
}) {
  if (!viaticos.length) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10 p-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
        <Receipt size={15} className="text-amber-600" />
        Viáticos pendientes de rendición
        <span className="text-xs font-normal text-muted-foreground">({viaticos.length})</span>
      </h3>

      <ul className="space-y-1.5">
        {viaticos.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 text-xs bg-card rounded-lg border border-border/70 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground/90 truncate">{v.chofer}</p>
              <p className="text-muted-foreground">
                {new Date(v.fecha_entrega).toLocaleDateString("es-AR")}
                {v.observaciones ? ` · ${v.observaciones}` : ""}
              </p>
            </div>
            <span className="shrink-0 font-semibold text-foreground">{ars(v.monto_entregado)}</span>
            {canWrite && (
              <RendirViaticoDialog viatico={v}>
                <Button size="xs" variant="outline" className="shrink-0">
                  Rendir
                </Button>
              </RendirViaticoDialog>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
