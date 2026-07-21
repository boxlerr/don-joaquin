"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalNuevoCircuito from "./ModalNuevoCircuito";
import ImportarCircuitosDialog from "./ImportarCircuitosDialog";
import {
  cambiarEstadoCircuito,
  obtenerCircuitos,
  type CircuitoConRelaciones,
  type PuntoRutaOption,
} from "./actions";

type Props = {
  circuitosIniciales: CircuitoConRelaciones[];
  puntos: PuntoRutaOption[];
  canWrite?: boolean;
};

export default function TabCircuitos({
  circuitosIniciales,
  puntos,
  canWrite = false,
}: Props) {
  const [circuitos, setCircuitos] = useState(circuitosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editar, setEditar] = useState<CircuitoConRelaciones | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return circuitos.filter((c) => {
      if (soloActivos && c.estado !== "activa") return false;
      if (!q) return true;
      const hay = [
        c.codigo_interno ?? "",
        c.origen_label,
        c.destino_label,
        c.descripcion ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [circuitos, busqueda, soloActivos]);

  async function refresh() {
    setCircuitos(await obtenerCircuitos());
  }

  function onSaved() {
    setModalOpen(false);
    const fueEdicion = !!editar;
    setEditar(null);
    setSavedFlash(fueEdicion ? "Circuito actualizado" : "Circuito creado");
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(null), 2500);
    startTransition(() => {
      refresh();
    });
  }

  function onToggle(c: CircuitoConRelaciones) {
    startTransition(async () => {
      const activar = c.estado !== "activa";
      const result = await cambiarEstadoCircuito(c.id, activar);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setCircuitos((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, estado: activar ? "activa" : "inactiva" } : x,
        ),
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
              placeholder="Buscar por código, origen, destino…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-9 pl-8 text-sm w-72"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
              className="rounded"
            />
            Solo activos
          </label>
        </div>

        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-medium">
              <CheckCircle2 size={12} />
              {savedFlash}
            </span>
          )}
          {canWrite && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Download size={13} />
              Importar desde viajes
            </Button>
          )}
          {canWrite && (
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() => {
                setEditar(null);
                setModalOpen(true);
              }}
            >
              <Plus size={13} />
              Nuevo circuito
            </Button>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-border shadow-sm p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            {circuitos.length === 0
              ? "Aún no hay circuitos cargados. Podés importarlos automáticamente desde los viajes ya cargados (cada recorrido con su km), o crear uno con Nuevo circuito."
              : "No se encontraron circuitos con esos filtros."}
          </p>
          {circuitos.length === 0 && canWrite && (
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Download size={13} />
              Importar desde viajes
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2.5">Código</th>
                <th className="px-4 py-2.5">Recorrido</th>
                <th className="px-4 py-2.5 text-right">Km con carga</th>
                <th className="px-4 py-2.5 text-right">Km vacíos</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((c) => {
                const activo = c.estado === "activa";
                return (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-foreground font-mono text-xs">
                      {c.codigo_interno ?? (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {c.origen_label}
                        <ArrowRight size={13} className="text-muted-foreground/70 shrink-0" />
                        {c.destino_label}
                      </span>
                      {c.descripcion && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {c.descripcion}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {c.km_oficiales.toLocaleString("es-AR")} km
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {c.km_vacios.toLocaleString("es-AR")} km
                    </td>
                    <td className="px-4 py-3">
                      {activo ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981]">
                          <CheckCircle2 size={12} />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/70">
                          <XCircle size={12} />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditar(c);
                              setModalOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil size={12} />
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onToggle(c)}
                            aria-label={activo ? "Desactivar" : "Activar"}
                            className={activo ? "text-[#FFB300]" : "text-[#10B981]"}
                          >
                            {activo ? (
                              <PauseCircle size={12} />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ModalNuevoCircuito
          key={editar?.id ?? "nuevo"}
          open
          onClose={() => {
            setModalOpen(false);
            setEditar(null);
          }}
          onSaved={onSaved}
          puntos={puntos}
          circuito={editar}
        />
      )}

      {importOpen && (
        <ImportarCircuitosDialog
          open
          onClose={() => setImportOpen(false)}
          onImported={(creados) => {
            setImportOpen(false);
            setSavedFlash(`${creados} circuito${creados === 1 ? "" : "s"} importado${creados === 1 ? "" : "s"}`);
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setSavedFlash(null), 3500);
            startTransition(() => {
              refresh();
            });
          }}
        />
      )}
    </div>
  );
}
