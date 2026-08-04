"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getHistorialProveedorAction, type CostoRepRep } from "./actions";
import { ars, mesLabel, porcentaje, variacion } from "./formato";

/**
 * Panel de un proveedor: cuánto se le facturó mes a mes. Es la pregunta que la
 * tabla mensual no puede responder ("¿SCANIA viene subiendo?") y el motivo por
 * el que cada fila es clickeable.
 */
export default function ProveedorSheet({
  proveedor,
  onClose,
}: {
  proveedor: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(proveedor)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="pr-6 leading-snug">{proveedor}</SheetTitle>
          <SheetDescription>Repuestos y reparaciones facturados, mes a mes</SheetDescription>
        </SheetHeader>
        {/* Con `key` cada proveedor entra con su propia carga en blanco, sin
            arrastrar el historial del anterior ni sincronizar estado a mano. */}
        {proveedor && <Historial key={proveedor} proveedor={proveedor} />}
      </SheetContent>
    </Sheet>
  );
}

function Historial({ proveedor }: { proveedor: string }) {
  const [rows, setRows] = useState<CostoRepRep[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void getHistorialProveedorAction(proveedor).then((r) => {
      if (vivo) setRows(r);
    });
    return () => {
      vivo = false;
    };
  }, [proveedor]);

  const totalFacturado = (rows ?? []).reduce((a, r) => a + Number(r.facturado_total), 0);
  const totalNeto = (rows ?? []).reduce((a, r) => a + Number(r.neto_total), 0);
  const maxAbs = Math.max(1, ...(rows ?? []).map((r) => Math.abs(Number(r.facturado_total))));

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
      {rows === null ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 py-6">
          <Loader2 size={13} className="animate-spin" /> Cargando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Sin costos cargados.</p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-bold text-foreground leading-none">{ars(totalFacturado)}</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Facturado en {rows.length} {rows.length === 1 ? "mes" : "meses"} · neto{" "}
              {ars(totalNeto)} · IVA {ars(totalFacturado - totalNeto)}
            </p>
          </div>

          <div className="space-y-3">
            {/* El historial viene del mes más nuevo al más viejo: el mes con el
                que se compara cada fila es el siguiente de la lista. */}
            {rows.map((r, i) => {
              const facturado = Number(r.facturado_total);
              const previo = rows[i + 1] ? Number(rows[i + 1].facturado_total) : undefined;
              const varPct = variacion(facturado, previo);
              const Icono =
                varPct === null ? Minus : varPct > 0 ? TrendingUp : varPct < 0 ? TrendingDown : Minus;
              const tono =
                varPct === null || Math.abs(varPct) < 0.05
                  ? "text-muted-foreground"
                  : varPct > 0
                    ? "text-[#EF4444]"
                    : "text-[#10B981]";
              return (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-foreground">{mesLabel(r.mes)}</span>
                    <span className="text-sm font-mono font-semibold text-foreground">
                      {ars(facturado)}
                    </span>
                  </div>
                  {/* Una sola magnitud y un solo color: el largo es el facturado
                      del mes contra el mes más alto de ese proveedor. */}
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-[#0088D1]"
                      style={{ width: `${(Math.abs(facturado) / maxAbs) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>
                      Neto {ars(r.neto_total)} · IVA {ars(facturado - Number(r.neto_total))}
                    </span>
                    {varPct !== null && (
                      <span className={`flex items-center gap-1 ${tono}`}>
                        <Icono size={11} />
                        {porcentaje(Math.abs(varPct))} vs {mesLabel(rows[i + 1].mes)}
                      </span>
                    )}
                  </div>
                  {r.observaciones && (
                    <p className="text-[11px] text-muted-foreground italic">{r.observaciones}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
