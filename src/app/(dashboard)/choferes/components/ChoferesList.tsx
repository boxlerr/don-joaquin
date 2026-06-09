"use client";

import { useMemo, useState } from "react";
import { Users, X, ChevronDown, ChevronRight, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/EmptyState";
import ChoferCard from "./ChoferCard";

type EstadoFilter = "todos" | "activo" | "inactivo" | "baja" | "periodo_prueba";
type RolFilter = "chofer" | "administrativo" | "mantenimiento";
type OrdenFilter = "apellido_az" | "apellido_za" | "antiguedad_asc" | "antiguedad_desc";

const ORDEN_OPTIONS: { id: OrdenFilter; label: string }[] = [
  { id: "apellido_az", label: "Apellido (A–Z)" },
  { id: "apellido_za", label: "Apellido (Z–A)" },
  { id: "antiguedad_asc", label: "Antigüedad (más antiguo primero)" },
  { id: "antiguedad_desc", label: "Antigüedad (más reciente primero)" },
];

/** Timestamp de ingreso, o null si falta/inválido (van al final en orden por antigüedad). */
function tsIngreso(c: { fecha_ingreso?: string | null }): number | null {
  if (!c.fecha_ingreso) return null;
  const t = new Date(c.fecha_ingreso).getTime();
  return Number.isNaN(t) ? null : t;
}

const ROL_LABELS: Record<RolFilter, string> = {
  chofer: "Choferes",
  administrativo: "Administración",
  mantenimiento: "Mantenimiento",
};

const rolDe = (c: { rol?: unknown }): RolFilter => {
  const r = typeof c.rol === "string" ? c.rol : "chofer";
  return r === "administrativo" || r === "mantenimiento" ? r : "chofer";
};

type Chofer = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  cuil?: string | null;
  telefono?: string | null;
  localidad?: string | null;
  estado: string;
  rol?: string | null;
  fecha_ingreso?: string | null;
  foto?: { bucket: string; path: string } | null;
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
  const [rolFilter, setRolFilter] = useState<RolFilter>("chofer");
  const [orden, setOrden] = useState<OrdenFilter>("apellido_az");
  const [query, setQuery] = useState("");
  const [historialOpen, setHistorialOpen] = useState(false);

  const ordenarChoferes = useMemo(() => {
    const cmpApellido = (a: Chofer, b: Chofer) =>
      `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es", {
        sensitivity: "base",
      });
    return (lista: Chofer[]): Chofer[] => {
      const arr = [...lista];
      arr.sort((a, b) => {
        if (orden === "apellido_az") return cmpApellido(a, b);
        if (orden === "apellido_za") return -cmpApellido(a, b);
        const ta = tsIngreso(a);
        const tb = tsIngreso(b);
        if (ta == null && tb == null) return cmpApellido(a, b);
        if (ta == null) return 1; // sin fecha → al final
        if (tb == null) return -1;
        return (orden === "antiguedad_asc" ? ta - tb : tb - ta) || cmpApellido(a, b);
      });
      return arr;
    };
  }, [orden]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return choferes.filter((c) => {
      if (rolDe(c) !== rolFilter) return false;
      if (estadoFilter === "periodo_prueba") {
        if (c.estado === "baja" || !enPeriodoPrueba(c.fecha_ingreso)) return false;
      } else if (estadoFilter !== "todos" && c.estado !== estadoFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = normalize(`${c.apellido} ${c.nombre} ${c.dni} ${c.cuil ?? ""} ${c.telefono ?? ""}`);
      return haystack.includes(q);
    });
  }, [choferes, estadoFilter, rolFilter, query]);

  const conteoPorRol = useMemo(() => {
    const acc: Record<RolFilter, number> = { chofer: 0, administrativo: 0, mantenimiento: 0 };
    for (const c of choferes) acc[rolDe(c)]++;
    return acc;
  }, [choferes]);

  // Activos = todos los que NO estén dados de baja (incluye "activo" e "inactivo")
  // Egresados = estado "baja". Los mostramos siempre separados al final.
  const activos = useMemo(
    () => ordenarChoferes(filtered.filter((c) => c.estado !== "baja")),
    [filtered, ordenarChoferes],
  );
  const egresados = useMemo(
    () => ordenarChoferes(filtered.filter((c) => c.estado === "baja")),
    [filtered, ordenarChoferes],
  );

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
          <h2 className="text-foreground text-sm font-semibold">{ROL_LABELS[rolFilter]} en plantilla</h2>
          <span className="text-xs text-muted-foreground ml-2">
            {filtered.length} de {conteoPorRol[rolFilter]}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(["chofer", "administrativo", "mantenimiento"] as RolFilter[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRolFilter(r)}
                className={`px-3 h-7 text-xs font-medium rounded-md transition-all ${
                  rolFilter === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ROL_LABELS[r]} ({conteoPorRol[r]})
              </button>
            ))}
          </div>
          <Combobox
            value={estadoFilter}
            onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}
            options={[
              { id: "todos", label: "Todos los estados" },
              { id: "activo", label: "Activo" },
              { id: "inactivo", label: "Inactivo" },
              { id: "periodo_prueba", label: "En período de prueba" },
              { id: "baja", label: "Egresado" },
            ]}
            searchable={false}
            triggerClassName="h-9 w-52"
          />
          <Combobox
            value={orden}
            onValueChange={(v) => setOrden(v as OrdenFilter)}
            options={ORDEN_OPTIONS}
            searchable={false}
            triggerClassName="h-9 w-60"
            aria-label="Ordenar choferes"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, DNI, CUIL o teléfono..."
            className="w-64 text-sm"
          />
          {!sinFiltros && (
            <button
              type="button"
              onClick={() => {
                setEstadoFilter("todos");
                setQuery("");
                setOrden("apellido_az");
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
