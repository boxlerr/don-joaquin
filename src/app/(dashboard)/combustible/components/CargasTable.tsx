"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Fuel, User, ArrowUpDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import type { CargaRowUI } from "../actions";

interface ChoferLookup {
  id: string;
  nombre: string;
  apellido: string;
}

interface CargasTableProps {
  cargas: CargaRowUI[];
  count: number;
  choferes: ChoferLookup[];
  currentPage: number;
  currentChoferId: string;
  currentSortBy: string;
}

const PAGE_SIZE = 25;

const SORT_OPTIONS = [
  { id: "fecha_desc", label: "Más recientes primero" },
  { id: "fecha_asc", label: "Más antiguos primero" },
  { id: "litros_desc", label: "Litros: de mayor a menor" },
  { id: "litros_asc", label: "Litros: de menor a mayor" },
  { id: "importe_desc", label: "Importe: de mayor a menor" },
  { id: "importe_asc", label: "Importe: de menor a mayor" },
  { id: "km_desc", label: "Kilómetros: de mayor a menor" },
  { id: "km_asc", label: "Kilómetros: de menor a mayor" },
];

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNum(n: number, decimals = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function CargasTable({
  cargas,
  count,
  choferes,
  currentPage,
  currentChoferId,
  currentSortBy,
}: CargasTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const activeChoferId = currentChoferId || "todos";
  const activeSortBy = currentSortBy || "fecha_desc";

  const setQueryParam = (name: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    // Al cambiar filtros o criterio de orden, reseteamos a la primera página
    if (name === "choferId" || name === "sort") {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleChoferChange = (val: string) => {
    setQueryParam("choferId", val === "todos" ? null : val);
  };

  const handleSortChange = (val: string) => {
    setQueryParam("sort", val === "fecha_desc" ? null : val);
  };

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 0) {
      params.set("page", String(p));
    } else {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("choferId");
    params.delete("sort");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-border gap-4">
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">
            Cargas recientes
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">{count} en total</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 gap-3 bg-muted/10 border-b border-border">
        <div className="flex flex-wrap items-center gap-3 w-full">
          {/* Selector de Chofer */}
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/70 pointer-events-none" />
            <Combobox
              value={activeChoferId}
              onValueChange={handleChoferChange}
              options={[
                { id: "todos", label: "Todos los choferes" },
                ...choferes.map((c) => ({
                  id: c.id,
                  label: `${c.apellido}, ${c.nombre}`,
                })),
              ]}
              searchable={true}
              placeholder="Filtrar por chofer..."
              triggerClassName="h-9 min-w-[220px] pl-9"
            />
          </div>

          {/* Selector de Ordenamiento */}
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/70 pointer-events-none" />
            <Combobox
              value={activeSortBy}
              onValueChange={handleSortChange}
              options={SORT_OPTIONS}
              searchable={false}
              placeholder="Ordenar por..."
              triggerClassName="h-9 min-w-[200px] pl-9"
            />
          </div>

          {/* Limpiar Filtros */}
          {(activeChoferId !== "todos" || activeSortBy !== "fecha_desc") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 text-muted-foreground text-xs hover:text-foreground gap-1.5"
            >
              <X size={14} />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Fecha</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Camión</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estación</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">KM</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Litros</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-16 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Fuel size={20} />
                  </div>
                  <div className="max-w-md">
                    <p className="text-foreground text-sm font-bold">No se encontraron cargas</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      No hay registros de carga de combustible que coincidan con los filtros aplicados.
                    </p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            cargas.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="pl-6 text-muted-foreground font-medium">
                  {new Date(c.fecha).toLocaleDateString("es-AR")}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] font-bold bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155] px-2 py-0.5 rounded shadow-sm tracking-wider uppercase w-fit select-none">
                      {c.camion_patente}
                    </span>
                    {c.camion_marca_modelo && (
                      <span className="text-[10px] text-muted-foreground max-w-[180px] truncate" title={c.camion_marca_modelo}>
                        {c.camion_marca_modelo}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-foreground font-semibold">
                  {c.chofer ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center text-primary text-[10px] font-bold border border-primary/15 shrink-0 uppercase select-none">
                        {c.chofer.charAt(0)}
                      </div>
                      <span className="truncate">{c.chofer}</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/50">
                      Sin asignar
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground font-medium">
                  <div className="flex flex-col gap-1 items-start">
                    {c.estacion ? (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200/40">
                        {c.estacion}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 font-normal">—</span>
                    )}
                    {c.lugar_carga === "en_ruta" ? (
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-200/50">
                        En ruta
                      </span>
                    ) : c.lugar_carga === "propia" ? (
                      <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200/50">
                        Propia
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground font-mono font-medium">
                  {formatNum(c.km_odometro)} <span className="text-[10px] text-muted-foreground/60 font-semibold font-sans">km</span>
                </TableCell>
                <TableCell className="text-right text-foreground font-mono font-bold">
                  {formatNum(c.litros, 2)} <span className="text-[10px] text-primary/70 font-semibold font-sans">L</span>
                </TableCell>
                <TableCell className="text-right pr-6 text-foreground font-mono font-black text-sm">
                  ${formatARS(c.importe_total)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Footer y Paginación */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
        <span className="text-xs text-muted-foreground font-medium">
          {count > 0
            ? `Mostrando ${currentPage * PAGE_SIZE + 1} a ${Math.min((currentPage + 1) * PAGE_SIZE, count)} de ${count} cargas`
            : "Sin cargas"}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => handlePageChange(currentPage - 1)}
              className="h-8 gap-1.5"
            >
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => handlePageChange(currentPage + 1)}
              className="h-8 gap-1.5"
            >
              Siguiente
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
