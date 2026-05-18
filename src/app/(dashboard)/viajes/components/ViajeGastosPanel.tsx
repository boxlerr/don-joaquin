"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Calendar, AlertCircle, Loader2 } from "lucide-react";
import {
  getGastosAction,
  getGastoFormData,
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

type FormData = {
  tiposGasto: TipoGastoOption[];
  viajes: ViajeOption[];
  camiones: CamionOption[];
  choferes: ChoferOption[];
};

export default function ViajeGastosPanel({ viajeId }: { viajeId: string }) {
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [resGastos, resForm] = await Promise.all([
      getGastosAction({ viajeId, page: 0 }),
      formData ? Promise.resolve(formData) : getGastoFormData(),
    ]);
    if ("data" in resGastos) {
      setGastos(resGastos.data.slice(0, 5));
      setCount(resGastos.count);
      setTotal(resGastos.data.reduce((acc, g) => acc + g.monto, 0));
    }
    if (!formData) setFormData(resForm as FormData);
    setLoading(false);
  }, [viajeId, formData]);

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
      className="col-span-3 bg-white p-4 rounded-lg border border-[#E2E8F0]/80 shadow-2xs"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-3">
        <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide flex items-center gap-1.5">
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
        <div className="py-4 text-center text-xs text-[#64748B]">
          <Loader2 size={12} className="inline-block animate-spin mr-1" />
          Cargando...
        </div>
      ) : gastos.length === 0 ? (
        <div className="py-4 text-center text-xs text-[#94A3B8]">
          Sin gastos cargados para este viaje.
        </div>
      ) : (
        <div className="space-y-1.5">
          {gastos.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded hover:bg-[#F8FAFC]"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium text-[#0F172A] shrink-0">
                  {g.tipo_gasto_nombre ?? "Gasto"}
                </span>
                <span className="text-[10px] text-[#94A3B8] flex items-center gap-0.5 shrink-0">
                  <Calendar size={9} />
                  {new Date(g.fecha).toLocaleDateString("es-AR")}
                </span>
                <span className="text-[#64748B] truncate">
                  {g.descripcion ?? g.proveedor ?? ""}
                </span>
                {g.camion_patente && (
                  <span className="text-[10px] text-[#64748B] shrink-0">{g.camion_patente}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wide text-[#94A3B8]">
                  {MEDIO_LABEL[g.medio_pago] ?? g.medio_pago}
                </span>
                <span className="font-bold text-[#EF4444]">$ {formatARS(g.monto)}</span>
              </div>
            </div>
          ))}
          {count > 5 && (
            <p className="text-[10px] text-[#94A3B8] text-center pt-1 flex items-center justify-center gap-1">
              <AlertCircle size={9} />
              Mostrando los 5 más recientes — ver todos en /gastos
            </p>
          )}
        </div>
      )}
    </div>
  );
}
