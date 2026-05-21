"use client";

import { useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import ChoferCard from "./ChoferCard";

type EstadoFilter = "todos" | "activo" | "inactivo";

type Chofer = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  estado: string;
  [key: string]: unknown;
};

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

  const filtered = useMemo(() => {
    const q = normalize(query);
    return choferes.filter((c) => {
      if (estadoFilter !== "todos" && c.estado !== estadoFilter) return false;
      if (!q) return true;
      const haystack = normalize(`${c.apellido} ${c.nombre} ${c.dni}`);
      return haystack.includes(q);
    });
  }, [choferes, estadoFilter, query]);

  const sinFiltros = estadoFilter === "todos" && !query;
  const hayResultados = filtered.length > 0;

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <ChoferCard key={c.id} chofer={c} />
          ))}
        </div>
      )}
    </div>
  );
}
