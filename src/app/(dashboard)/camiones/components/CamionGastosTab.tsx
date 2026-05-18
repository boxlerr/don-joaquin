"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Calendar, AlertCircle } from "lucide-react";
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
  efectivo_caja: "Efectivo (caja)",
  efectivo_viatico: "Efectivo (viático)",
  transferencia: "Transferencia",
  tarjeta_empresa: "Tarjeta empresa",
  cuenta_corriente: "Cuenta corriente",
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

export default function CamionGastosTab({ camionId }: { camionId: string }) {
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [resGastos, resForm] = await Promise.all([
      getGastosAction({ camionId, page: 0 }),
      formData ? Promise.resolve(formData) : getGastoFormData(),
    ]);
    if ("data" in resGastos) setGastos(resGastos.data);
    if (!formData) setFormData(resForm as FormData);
    setLoading(false);
  }, [camionId, formData]);

  useEffect(() => {
    void load();
  }, [camionId, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener("gastos:refresh", handler);
    return () => window.removeEventListener("gastos:refresh", handler);
  }, []);

  const total = gastos.reduce((acc, g) => acc + g.monto, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#64748B]">
          {gastos.length > 0 && (
            <>
              <span className="font-semibold text-[#0F172A]">
                $ {formatARS(total)}
              </span>{" "}
              en {gastos.length} gasto{gastos.length === 1 ? "" : "s"}
            </>
          )}
        </div>
        {formData && (
          <AddGastoDialog
            tiposGasto={formData.tiposGasto}
            viajes={formData.viajes}
            camiones={formData.camiones}
            choferes={formData.choferes}
            contextCamionId={camionId}
          >
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Registrar gasto
            </Button>
          </AddGastoDialog>
        )}
      </div>

      {loading && gastos.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#64748B]">
          Cargando gastos...
        </div>
      ) : gastos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
          <Receipt size={40} className="mb-3 opacity-20" />
          <p className="text-sm">Este camión no tiene gastos registrados.</p>
        </div>
      ) : (
        gastos.map((g) => {
          const asignaciones: string[] = [];
          if (g.viaje_codigo) asignaciones.push(`Viaje ${g.viaje_codigo}`);
          if (g.chofer_nombre) asignaciones.push(g.chofer_nombre);

          return (
            <div
              key={g.id}
              className="p-4 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1 shrink-0">
                    <Receipt size={12} className="text-[#0088D1]" />
                    {g.tipo_gasto_nombre ?? "Gasto"}
                  </span>
                  <span className="text-xs text-[#64748B] flex items-center gap-1 shrink-0">
                    <Calendar size={11} />
                    {new Date(g.fecha).toLocaleDateString("es-AR")}
                  </span>
                  {g.numero_comprobante && (
                    <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide truncate">
                      #{g.numero_comprobante}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-[#EF4444] shrink-0">
                  $ {formatARS(g.monto)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#64748B] gap-3">
                <span className="truncate">
                  {g.descripcion ?? g.proveedor ?? "Sin descripción"}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {asignaciones.length > 0 ? (
                    asignaciones.map((a, i) => (
                      <span key={i} className="text-[10px]">
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700">
                      <AlertCircle size={10} />
                      Solo camión
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wide text-[#94A3B8]">
                    {MEDIO_LABEL[g.medio_pago] ?? g.medio_pago}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
