"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Trash2, Star, MapPin, Phone, Building } from "lucide-react";
import {
  getSucursalesAction,
  deleteSucursalAction,
  type Sucursal,
} from "./sub-resources-actions";
import AddSucursalDialog from "./add-sucursal-dialog";

export default function SucursalesTab({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    getSucursalesAction(clienteId).then((d) => {
      if (!cancel) {
        setItems(d);
        setLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [clienteId, tick]);

  const refresh = () => setTick((t) => t + 1);

  const handleDelete = (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la sucursal "${nombre}"?`)) return;
    startTransition(async () => {
      await deleteSucursalAction(id);
      refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
          {items.length} sucursal{items.length === 1 ? "" : "es"}
        </p>
        <AddSucursalDialog clienteId={clienteId} onAdded={refresh} />
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground bg-card border border-dashed border-border rounded-[8px]">
          Aún no hay sucursales cargadas.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((s) => {
            const direccion = [s.domicilio, s.localidad, s.provincia, s.pais]
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={s.id}
                className="bg-card border border-border rounded-[8px] p-3 flex items-start gap-3 group"
              >
                <span className="size-9 rounded-md bg-[#E1F5FE] text-primary flex items-center justify-center shrink-0">
                  <Building size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-semibold text-sm">{s.nombre}</span>
                    {s.es_principal && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-[#FFF8E1] text-[#92400E] border border-[#FDE68A] rounded-full px-2 py-0.5">
                        <Star size={9} fill="#F59E0B" stroke="#F59E0B" />
                        Principal
                      </span>
                    )}
                  </div>
                  {direccion && (
                    <div className="flex items-start gap-1 mt-1 text-xs text-muted-foreground">
                      <MapPin size={11} className="text-primary mt-0.5 shrink-0" />
                      <span>{direccion}</span>
                    </div>
                  )}
                  {s.telefono && (
                    <a
                      href={`tel:${s.telefono}`}
                      className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Phone size={11} />
                      {s.telefono}
                    </a>
                  )}
                  {s.observaciones && (
                    <p className="text-xs text-muted-foreground italic mt-1">{s.observaciones}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id, s.nombre)}
                  disabled={pending}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-600 disabled:opacity-30"
                  title="Eliminar sucursal"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

