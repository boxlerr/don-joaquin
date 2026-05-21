"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  History,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalNuevaTarifa from "./ModalNuevaTarifa";
import TarifaHistorialDrawer from "./TarifaHistorialDrawer";
import {
  cambiarEstadoTarifa,
  obtenerTarifas,
  type ClienteOption,
  type RutaOption,
  type TarifaConRelaciones,
} from "./actions";
import { getModalidadMeta } from "./validaciones";

type Props = {
  tarifasIniciales: TarifaConRelaciones[];
  clientes: ClienteOption[];
  rutas: RutaOption[];
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR");
}

function fmtValor(valor: number, moneda: string): string {
  return `${moneda} ${valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tarifaLabel(t: TarifaConRelaciones): string {
  const ruta = t.ruta_label ?? "Sin ruta específica";
  return `${t.cliente_nombre} · ${ruta}`;
}

export default function TabTarifasPorCliente({
  tarifasIniciales,
  clientes,
  rutas,
}: Props) {
  const [tarifas, setTarifas] = useState(tarifasIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [modalidadFiltro, setModalidadFiltro] = useState<string>("todas");
  const [soloActivas, setSoloActivas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tarifaEditar, setTarifaEditar] = useState<TarifaConRelaciones | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);
  const [historialLabel, setHistorialLabel] = useState("");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tarifas.filter((t) => {
      if (soloActivas && !t.activa) return false;
      if (modalidadFiltro !== "todas" && t.modalidad !== modalidadFiltro) return false;
      if (!q) return true;
      const hay = [
        t.cliente_nombre,
        t.ruta_label ?? "",
        t.observaciones ?? "",
        t.modalidad,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tarifas, busqueda, modalidadFiltro, soloActivas]);

  const agrupadas = useMemo(() => {
    const acc = new Map<string, TarifaConRelaciones[]>();
    for (const t of filtrados) {
      const key = t.cliente_nombre;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(t);
    }
    return Array.from(acc.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);

  async function refresh() {
    const data = await obtenerTarifas();
    setTarifas(data);
  }

  function onSaved() {
    setModalOpen(false);
    setTarifaEditar(null);
    setSavedFlash(tarifaEditar ? "Tarifa actualizada" : "Tarifa creada");
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setSavedFlash(null), 2500);
    startTransition(() => {
      refresh();
    });
  }

  function onToggleActiva(t: TarifaConRelaciones) {
    startTransition(async () => {
      const result = await cambiarEstadoTarifa(t.id, !t.activa);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setTarifas((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, activa: !t.activa } : x)),
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
            />
            <Input
              type="search"
              placeholder="Buscar por cliente, ruta, observaciones…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-9 pl-8 text-sm w-72"
            />
          </div>
          <select
            value={modalidadFiltro}
            onChange={(e) => setModalidadFiltro(e.target.value)}
            className="h-9 text-sm rounded-lg border border-border bg-card px-2.5 outline-none focus-visible:border-[#0088D1]"
          >
            <option value="todas">Todas las modalidades</option>
            <option value="fija">Fija</option>
            <option value="por_tonelada">Por tonelada</option>
            <option value="por_kilo">Por kilo</option>
            <option value="por_km">Por kilómetro</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="rounded"
            />
            Solo activas
          </label>
        </div>

        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-medium">
              <CheckCircle2 size={12} />
              {savedFlash}
            </span>
          )}
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={() => {
              setTarifaEditar(null);
              setModalOpen(true);
            }}
          >
            <Plus size={13} />
            Nueva tarifa
          </Button>
        </div>
      </div>

      {agrupadas.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-border shadow-sm p-10 text-center">
          <p className="text-muted-foreground text-sm">
            {tarifas.length === 0
              ? "Aún no hay tarifas registradas. Creá la primera con el botón Nueva tarifa."
              : "No se encontraron tarifas con esos filtros."}
          </p>
        </div>
      ) : (
        agrupadas.map(([cliente, items]) => (
          <div key={cliente}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {cliente}
              </h3>
              <span className="text-[10px] text-muted-foreground/70">
                {items.length} tarifa{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-2.5">Ruta</th>
                    <th className="px-4 py-2.5">Modalidad</th>
                    <th className="px-4 py-2.5 text-right">Valor</th>
                    <th className="px-4 py-2.5">Vigencia</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((t) => {
                    const meta = getModalidadMeta(t.modalidad);
                    return (
                      <tr key={t.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 text-foreground">
                          {t.ruta_label ?? (
                            <span className="text-muted-foreground/70 italic">Sin ruta específica</span>
                          )}
                          {t.ruta_km !== null && (
                            <p className="text-[11px] text-muted-foreground/70">{t.ruta_km} km</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-[#E1F5FE] text-[#004A99] font-medium">
                            {meta.label}
                          </span>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{meta.unidad}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                          {fmtValor(Number(t.valor), t.moneda)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <p>Desde: {fmtFecha(t.vigencia_desde)}</p>
                          <p>Hasta: {fmtFecha(t.vigencia_hasta)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {t.activa ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981]">
                              <CheckCircle2 size={12} />
                              Activa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/70">
                              <XCircle size={12} />
                              Inactiva
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setTarifaEditar(t);
                                setModalOpen(true);
                              }}
                              aria-label="Editar"
                            >
                              <Pencil size={12} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => onToggleActiva(t)}
                              aria-label={t.activa ? "Desactivar" : "Activar"}
                              className={t.activa ? "text-[#FFB300]" : "text-[#10B981]"}
                            >
                              {t.activa ? (
                                <PauseCircle size={12} />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setHistorialId(t.id);
                                setHistorialLabel(tarifaLabel(t));
                              }}
                              aria-label="Ver historial"
                              className="text-muted-foreground/70 hover:text-primary"
                            >
                              <History size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <ModalNuevaTarifa
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setTarifaEditar(null);
        }}
        onSaved={onSaved}
        clientes={clientes}
        rutas={rutas}
        tarifa={tarifaEditar}
      />

      <TarifaHistorialDrawer
        open={historialId !== null}
        onClose={() => setHistorialId(null)}
        tarifaId={historialId}
        tarifaLabel={historialLabel}
      />
    </div>
  );
}
