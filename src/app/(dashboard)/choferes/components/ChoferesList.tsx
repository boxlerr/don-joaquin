"use client";

import { useMemo, useState } from "react";
import { Users, X, ChevronDown, ChevronRight, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/EmptyState";
import { coincideTerminos } from "@/lib/texto";
import ChoferCard from "./ChoferCard";

type EstadoFilter = "todos" | "activo" | "inactivo" | "baja" | "periodo_prueba";
type RolReal = "chofer" | "administrativo" | "mantenimiento" | "fletero";
type RolFilter = "todos" | RolReal;
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
  todos: "Todos",
  chofer: "Choferes",
  administrativo: "Administración",
  mantenimiento: "Mantenimiento",
  fletero: "Fleteros",
};

const rolDe = (c: { rol?: unknown }): RolReal => {
  const r = typeof c.rol === "string" ? c.rol : "chofer";
  return r === "administrativo" || r === "mantenimiento" || r === "fletero" ? r : "chofer";
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
  /** Camión que tiene asignado hoy, para verlo y para buscarlo. */
  camion_patente?: string | null;
  camion_marca?: string | null;
  camion_modelo?: string | null;
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

export default function ChoferesList({ choferes }: { choferes: Chofer[] }) {
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  // Entrar a Legajos muestra a TODO el personal: filtrado en "Choferes" de arranque,
  // administración/mantenimiento/fleteros parecían no existir.
  const [rolFilter, setRolFilter] = useState<RolFilter>("todos");
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
    return choferes.filter((c) => {
      if (rolFilter !== "todos" && rolDe(c) !== rolFilter) return false;
      if (estadoFilter === "periodo_prueba") {
        if (c.estado === "baja" || !enPeriodoPrueba(c.fecha_ingreso)) return false;
      } else if (estadoFilter !== "todos" && c.estado !== estadoFilter) {
        return false;
      }
      // Se busca por todo lo que está a la vista en la tarjeta, incluido el
      // camión: escribir "iveco" tiene que traer a los que manejan un Iveco, y
      // "azul" a los de esa localidad.
      // Cada palabra tiene que estar: "iveco azul" angosta en vez de sumar.
      return coincideTerminos(
        [
          c.apellido,
          c.nombre,
          c.dni,
          c.cuil,
          c.telefono,
          c.localidad,
          c.camion_patente,
          c.camion_marca,
          c.camion_modelo,
        ],
        query,
      );
    });
  }, [choferes, estadoFilter, rolFilter, query]);

  const conteoPorRol = useMemo(() => {
    const acc: Record<RolFilter, number> = { todos: choferes.length, chofer: 0, administrativo: 0, mantenimiento: 0, fletero: 0 };
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

  const sinFiltros = estadoFilter === "todos" && rolFilter === "todos" && !query;
  const hayResultados = filtered.length > 0;
  const totalEgresadosGlobal = useMemo(
    () => choferes.filter((c) => c.estado === "baja").length,
    [choferes],
  );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-[8px] border border-border px-3 py-3 sm:px-5 sm:py-4 shadow-xs flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex min-w-0 items-center gap-2">
          <Users size={16} className="text-primary shrink-0" />
          <h2 className="text-foreground text-sm font-semibold truncate">{ROL_LABELS[rolFilter]} en plantilla</h2>
          <span className="text-xs text-muted-foreground ml-1 sm:ml-2 shrink-0">
            {filtered.length} de {conteoPorRol[rolFilter]}
          </span>
        </div>
        {/* En celular los filtros se apilan a ancho completo (el buscador
            primero, que es lo que más se usa con el pulgar); desde sm vuelven a
            ser una fila que envuelve. */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {/* La tira de roles mide ~600px con los conteos puestos: no entra ni
              en 343px ni en el celular acostado (667px de ancho dejan ~580 de
              contenido). Scrollea de costado dentro de su propia píldora en
              todos los tamaños — donde entra, no se ve ninguna diferencia. */}
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex w-max items-center gap-1 bg-muted p-1 rounded-lg">
              {(["todos", "chofer", "administrativo", "mantenimiento", "fletero"] as RolFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRolFilter(r)}
                  className={`shrink-0 whitespace-nowrap px-3 h-9 sm:h-7 text-xs font-medium rounded-md transition-all ${
                    rolFilter === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ROL_LABELS[r]} ({conteoPorRol[r]})
                </button>
              ))}
            </div>
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
            triggerClassName="h-10 w-full sm:h-9 sm:w-52"
          />
          <Combobox
            value={orden}
            onValueChange={(v) => setOrden(v as OrdenFilter)}
            options={ORDEN_OPTIONS}
            searchable={false}
            triggerClassName="h-10 w-full sm:h-9 sm:w-60"
            aria-label="Ordenar choferes"
          />
          {/* El buscador va primero en celular: es lo que más se toca. */}
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, DNI, camión, marca, localidad…"
            className="order-first w-full sm:order-none sm:w-64"
          />
          {!sinFiltros && (
            <button
              type="button"
              onClick={() => {
                setEstadoFilter("todos");
                setRolFilter("todos");
                setQuery("");
                setOrden("apellido_az");
              }}
              className="inline-flex items-center justify-center gap-1 h-10 w-full sm:h-9 sm:w-auto px-2.5 text-xs text-muted-foreground hover:bg-muted rounded-md border border-border"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {activos.map((c) => (
                <ChoferCard key={c.id} chofer={c} />
              ))}
            </div>
          )}

          {/* Sección egresados — siempre al final, separada y colapsable */}
          {egresados.length > 0 && (
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t-2 border-dashed border-border">
              <button
                type="button"
                onClick={() => setHistorialOpen((v) => !v)}
                className="w-full bg-card rounded-[8px] border border-border px-3 py-3 sm:px-5 sm:py-4 shadow-xs flex items-center justify-between gap-2 sm:gap-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Archive size={16} className="text-muted-foreground shrink-0" />
                  <h2 className="text-foreground text-sm font-semibold">
                    Historial de Choferes Egresados
                  </h2>
                  <span className="text-xs text-muted-foreground sm:ml-1">
                    {egresados.length} {egresados.length === 1 ? "chofer" : "choferes"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {historialOpen ? "Ocultar" : "Ver"}
                  {historialOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {historialOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 opacity-90">
                  {egresados.map((c) => (
                    <ChoferCard key={c.id} chofer={c} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mensaje cuando no hay egresados pero sí hay totalmente filtrados */}
          {egresados.length === 0 && totalEgresadosGlobal > 0 && estadoFilter === "todos" && !query && (
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t-2 border-dashed border-border">
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
