"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Calendar, AlertCircle, Loader2 } from "lucide-react";
import {
  getGastosAction,
  type GastoRow,
} from "../../gastos/actions";
import AddGastoDialog, {
  type TipoGastoOption,
  type ViajeOption,
  type CamionOption,
  type ChoferOption,
} from "../../gastos/components/AddGastoDialog";

const MEDIO_LABEL: Record<string, string> = {
  efectivo_caja: "Efectivo",
  efectivo_viatico: "Viático",
  transferencia: "Transferencia",
  tarjeta_empresa: "Tarjeta",
  cuenta_corriente: "Cta. cte.",
};

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type GastoFormData = {
  tiposGasto: TipoGastoOption[];
  viajes: ViajeOption[];
  camiones: CamionOption[];
  choferes: ChoferOption[];
};

export default function ViajeGastosPanel({
  viajeId,
  formData,
}: {
  viajeId: string;
  formData: GastoFormData;
}) {
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Los datos del formulario (tipos de gasto, viajes, camiones, choferes) ya
  // vienen resueltos desde la página por props: no se vuelven a pedir al
  // expandir cada fila. Acá solo se cargan los gastos propios del viaje.
  const load = useCallback(async () => {
    setLoading(true);
    const resGastos = await getGastosAction({ viajeId, page: 0 });
    if ("data" in resGastos) {
      setGastos(resGastos.data.slice(0, 5));
      setCount(resGastos.count);
      setTotal(resGastos.data.reduce((acc, g) => acc + g.monto, 0));
    }
    setLoading(false);
  }, [viajeId]);

  useEffect(() => {
    void load();
  }, [viajeId, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener("gastos:refresh", handler);
    return () => window.removeEventListener("gastos:refresh", handler);
  }, []);

  return (
    <div
      className="col-span-3 bg-card p-4 rounded-lg border border-border/80 shadow-2xs"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Receipt size={14} className="text-[#EF4444]" />
          Gastos del viaje
          {count > 0 && (
            <span className="font-mono text-[#EF4444] normal-case tracking-normal">
              · $ {formatARS(total)} en {count}
            </span>
          )}
        </h4>
        {formData && (
          <AddGastoDialog
            tiposGasto={formData.tiposGasto}
            viajes={formData.viajes}
            camiones={formData.camiones}
            choferes={formData.choferes}
            contextViajeId={viajeId}
          >
            <Button variant="brand" size="xs" className="h-7 text-[11px]">
              <Plus size={12} />
              Registrar gasto
            </Button>
          </AddGastoDialog>
        )}
      </div>

      {loading && gastos.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          <Loader2 size={12} className="inline-block animate-spin mr-1" />
          Cargando...
        </div>
      ) : gastos.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground/70">
          Sin gastos cargados para este viaje.
        </div>
      ) : (
        <div className="space-y-1.5">
          {gastos.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded hover:bg-muted/40"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium text-foreground shrink-0">
                  {g.tipo_gasto_nombre ?? "Gasto"}
                </span>
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 shrink-0">
                  <Calendar size={9} />
                  {new Date(g.fecha).toLocaleDateString("es-AR")}
                </span>
                <span className="text-muted-foreground truncate">
                  {g.descripcion ?? g.proveedor ?? ""}
                </span>
                {g.camion_patente && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{g.camion_patente}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {MEDIO_LABEL[g.medio_pago] ?? g.medio_pago}
                </span>
                <span className="font-bold text-[#EF4444]">$ {formatARS(g.monto)}</span>
              </div>
            </div>
          ))}
          {count > 5 && (
            <p className="text-[10px] text-muted-foreground/70 text-center pt-1 flex items-center justify-center gap-1">
              <AlertCircle size={9} />
              Mostrando los 5 más recientes — ver todos en /gastos
            </p>
          )}
        </div>
      )}
    </div>
  );
}
