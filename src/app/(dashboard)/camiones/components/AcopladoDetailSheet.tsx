"use client";

import { useState, useEffect, useCallback } from "react";
import { formatFecha } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Container, CircleDot, Wrench, Calendar, Truck, MapPin } from "lucide-react";
import { getRoturasAcopladoAction, type RoturaCamionRecord } from "../actions";
import type { Acoplado } from "../types";

type ServicioAcoplado = {
  id: string;
  fecha: string;
  nombre: string;
  costo: number | null;
  taller: string | null;
};

type Tab = "info" | "roturas" | "services";

function fmtFecha(iso: string): string {
  return formatFecha(iso);
}

export default function AcopladoDetailSheet({
  acoplado,
  open,
  onOpenChange,
}: {
  acoplado: Acoplado;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("info");
  const [roturas, setRoturas] = useState<RoturaCamionRecord[]>([]);
  const [servicios, setServicios] = useState<ServicioAcoplado[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRoturasAcopladoAction(acoplado.id, 0);
      setRoturas(res.data);
      setServicios(res.servicios);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [acoplado.id]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setTab("info");
      setLoaded(false);
      setRoturas([]);
      setServicios([]);
    }
  }, [acoplado.id, open]);

  const handleTab = (t: Tab) => {
    setTab(t);
    if ((t === "roturas" || t === "services") && !loaded) fetchData();
  };

  const datosCompletos = !!acoplado.marca;

  const tabs: { id: Tab; label: string; icon: typeof Container }[] = [
    { id: "info", label: "Información", icon: Container },
    { id: "roturas", label: "Roturas", icon: CircleDot },
    { id: "services", label: "Services", icon: Wrench },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl flex items-center gap-2">
            <Container size={18} className="text-muted-foreground" />
            <span className="font-mono">{acoplado.patente}</span>
            <StatusBadge label={acoplado.estado} tone={acoplado.estado === "activo" ? "success" : "neutral"} />
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {datosCompletos ? `${acoplado.marca} ${acoplado.modelo ?? ""}`.trim() : "Acoplado / semirremolque"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => handleTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active ? "border-[#0088D1] text-[#0088D1]" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {tab === "info" && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Patente" value={acoplado.patente} mono />
              <Info label="Marca" value={acoplado.marca || "Sin datos"} />
              <Info label="Modelo" value={acoplado.modelo || "—"} />
              <Info label="Año" value={acoplado.ano != null ? String(acoplado.ano) : "—"} />
              <Info label="Capacidad" value={acoplado.capacidad_tn != null ? `${Number(acoplado.capacidad_tn).toFixed(1)} TN` : "—"} />
              <Info label="Tipo" value={acoplado.tipo ?? "—"} />
              <Info label="Tolva" value={acoplado.es_tolva ? "Sí" : "No"} />
              <Info label="Camión asignado" value={acoplado.camion_patente || "Sin camión"} mono={!!acoplado.camion_patente} />
              <Info label="Chofer" value={acoplado.chofer_nombre || "Sin chofer"} />
            </div>
          )}

          {tab === "roturas" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Las roturas se cargan desde el módulo Mantenimiento. Acá ves el historial de este acoplado.
              </p>
              {loading && roturas.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
              ) : roturas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CircleDot size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay roturas registradas.</p>
                </div>
              ) : (
                roturas.map((r) => (
                  <div key={r.id} className="rounded-[8px] border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar size={11} /> {fmtFecha(r.fecha)}
                      </span>
                      <span className="text-sm font-semibold text-[#F59E0B]">
                        {r.cantidad} {r.cantidad === 1 ? "goma" : "gomas"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
                      {r.chofer_nombre && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck size={11} /> {r.chofer_nombre}
                        </span>
                      )}
                      {(r.posicion || r.observaciones) && (
                        <span className="text-xs text-muted-foreground">{r.posicion ?? r.observaciones}</span>
                      )}
                      {r.costo != null && (
                        <span className="text-xs text-muted-foreground ml-auto">${Number(r.costo).toLocaleString("es-AR")}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "services" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Services del acoplado (gomería, cubiertas, frenos del semi). Se cargan desde Mantenimiento.
              </p>
              {loading && servicios.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
              ) : servicios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay services registrados.</p>
                </div>
              ) : (
                servicios.map((s) => (
                  <div key={s.id} className="rounded-[8px] border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar size={11} /> {fmtFecha(s.fecha)}
                      </span>
                      {s.costo != null && (
                        <span className="text-xs text-muted-foreground">${Number(s.costo).toLocaleString("es-AR")}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground font-medium">{s.nombre}</p>
                    {s.taller && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground pt-2 mt-1 border-t border-border">
                        <MapPin size={11} /> {s.taller}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-muted-foreground border-border hover:bg-muted/40">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
