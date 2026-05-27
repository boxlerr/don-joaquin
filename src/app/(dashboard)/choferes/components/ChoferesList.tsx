"use client";

import { useMemo, useState } from "react";
import { Users, X, ChevronDown, ChevronRight, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import ChoferCard from "./ChoferCard";

type EstadoFilter = "todos" | "activo" | "inactivo" | "baja" | "periodo_prueba";

type Chofer = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  estado: string;
  fecha_ingreso?: string | null;
  [key: string]: unknown;
};

const PRUEBA_MESES = 6;

function enPeriodoPrueba(fechaIngreso?: string | null): boolean {
  if (!fechaIngreso) return false;
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return false;
  const fin = new Date(ingreso);
  fin.setMonth(fin.getMonth() + PRUEBA_MESES);
  return Date.now() < fin.getTime();
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export default function ChoferesList({ choferes }: { choferes: Chofer[] }) {
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [query, setQuery] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return choferes.filter((c) => {
      if (estadoFilter === "periodo_prueba") {
        if (c.estado === "baja" || !enPeriodoPrueba(c.fecha_ingreso)) return false;
      } else if (estadoFilter !== "todos" && c.estado !== estadoFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = normalize(`${c.apellido} ${c.nombre} ${c.dni}`);
      return haystack.includes(q);
    });
  }, [choferes, estadoFilter, query]);

  // Activos = todos los que NO estén dados de baja (incluye "activo" e "inactivo")
  // Egresados = estado "baja". Los mostramos siempre separados al final.
  const activos = useMemo(() => filtered.filter((c) => c.estado !== "baja"), [filtered]);
  const egresados = useMemo(() => filtered.filter((c) => c.estado === "baja"), [filtered]);

  const sinFiltros = estadoFilter === "todos" && !query;
  const hayResultados = filtered.length > 0;
  const totalEgresadosGlobal = useMemo(
    () => choferes.filter((c) => c.estado === "baja").length,
    [choferes],
  );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-[8px] border border-border px-5 py-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Listado de Choferes en Plantilla</h2>
          <span className="text-xs text-muted-foreground ml-2">
            {hayResultados
              ? `${filtered.length} de ${choferes.length}`
              : `0 de ${choferes.length}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as EstadoFilter)}
            className="h-9 px-3 text-sm border border-border rounded-md bg-card text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="periodo_prueba">En período de prueba</option>
            <option value="baja">Egresado</option>
          </select>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o DNI..."
            className="w-64 text-sm"
          />
          {!sinFiltros && (
            <button
              type="button"
              onClick={() => {
                setEstadoFilter("todos");
                setQuery("");
              }}
              className="inline-flex items-center gap-1 h-9 px-2.5 text-xs text-muted-foreground hover:bg-muted rounded-md border border-border"
              title="Limpiar filtros"
            >
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {!hayResultados ? (
        <div className="bg-card rounded-[8px] border border-border">
          <EmptyState
            icon={Users}
            message={
              sinFiltros
                ? "Sin choferes registrados"
                : "Ningún chofer coincide con los filtros"
            }
          />
        </div>
      ) : (
        <>
          {/* Activos */}
          {activos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activos.map((c) => (
                <ChoferCard key={c.id} chofer={c} />
              ))}
            </div>
          )}

          {/* Sección egresados — siempre al final, separada y colapsable */}
          {egresados.length > 0 && (
            <div className="mt-8 pt-6 border-t-2 border-dashed border-border">
              <button
                type="button"
                onClick={() => setHistorialOpen((v) => !v)}
                className="w-full bg-card rounded-[8px] border border-border px-5 py-4 shadow-xs flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Archive size={16} className="text-muted-foreground" />
                  <h2 className="text-foreground text-sm font-semibold">
                    Historial de Choferes Egresados
                  </h2>
                  <span className="text-xs text-muted-foreground ml-2">
                    {egresados.length} {egresados.length === 1 ? "chofer" : "choferes"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {historialOpen ? "Ocultar" : "Ver"}
                  {historialOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {historialOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-90">
                  {egresados.map((c) => (
                    <ChoferCard key={c.id} chofer={c} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mensaje cuando no hay egresados pero sí hay totalmente filtrados */}
          {egresados.length === 0 && totalEgresadosGlobal > 0 && estadoFilter === "todos" && !query && (
            <div className="mt-8 pt-6 border-t-2 border-dashed border-border">
              <div className="text-xs text-muted-foreground text-center py-3">
                Hay {totalEgresadosGlobal} {totalEgresadosGlobal === 1 ? "chofer egresado" : "choferes egresados"} en el historial.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
