"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Phone, Star, Trash2, Building } from "lucide-react";
import {
  getSucursalesAction,
  deleteSucursalAction,
  type Sucursal,
} from "./sub-resources-actions";
import AddSucursalDialog from "./add-sucursal-dialog";

export default function SucursalPrincipalCard({
  clienteId,
  totalSucursales,
}: {
  clienteId: string;
  totalSucursales: number;
}) {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Sucursal | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    getSucursalesAction(clienteId).then((items) => {
      if (cancel) return;
      const p = items.find((s) => s.es_principal) ?? items[0] ?? null;
      setPrincipal(p);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [clienteId, tick]);

  const onAdded = () => {
    setTick((t) => t + 1);
    router.refresh();
  };

  const handleDelete = () => {
    if (!principal) return;
    if (!confirm(`¿Eliminar la sucursal "${principal.nombre}"?`)) return;
    startTransition(async () => {
      await deleteSucursalAction(principal.id);
      setTick((t) => t + 1);
      router.refresh();
    });
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-[8px] p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin text-primary" />
        Cargando sucursal...
      </div>
    );
  }

  if (!principal) {
    return (
      <div className="bg-card border border-dashed border-border rounded-[8px] p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building size={14} className="text-muted-foreground/70" />
          <span>No hay sucursal operativa cargada.</span>
        </div>
        <AddSucursalDialog
          clienteId={clienteId}
          onAdded={onAdded}
          triggerLabel="Agregar sucursal"
          triggerVariant="outline"
          triggerSize="xs"
          defaultPrincipal
        />
      </div>
    );
  }

  const direccion = [principal.domicilio, principal.localidad, principal.provincia, principal.pais]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-card border border-border rounded-[8px] p-3 group">
      <div className="flex items-start gap-3">
        <span className="size-9 rounded-md bg-[#E1F5FE] text-primary flex items-center justify-center shrink-0">
          <Building size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
              Sucursal operativa
            </span>
            {principal.es_principal && totalSucursales > 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-[#FFF8E1] text-[#92400E] border border-[#FDE68A] rounded-full px-2 py-0.5">
                <Star size={9} fill="#F59E0B" stroke="#F59E0B" />
                Principal
              </span>
            )}
            {totalSucursales > 1 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                +{totalSucursales - 1} más · ver tab
              </span>
            )}
          </div>
          <div className="text-foreground text-sm font-semibold mt-0.5">{principal.nombre}</div>
          {direccion && (
            <div className="flex items-start gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin size={11} className="text-primary mt-0.5 shrink-0" />
              <span>{direccion}</span>
            </div>
          )}
          {principal.telefono && (
            <a
              href={`tel:${principal.telefono}`}
              className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary"
            >
              <Phone size={11} />
              {principal.telefono}
            </a>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AddSucursalDialog
            clienteId={clienteId}
            onAdded={onAdded}
            triggerLabel="Agregar otra"
            triggerVariant="ghost"
            triggerSize="xs"
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-600 disabled:opacity-30"
            title="Eliminar sucursal"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
