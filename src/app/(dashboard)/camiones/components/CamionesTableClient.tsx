"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Truck, Container, ChevronRight, Search, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import CamionRow from "./CamionRow";
import AcopladoRow from "./AcopladoRow";
import CamionDetailSheet from "./CamionDetailSheet";
import AcopladoDetailSheet from "./AcopladoDetailSheet";
import type { Camion, Acoplado } from "../types";
import type { TipoServicio } from "../actions";

type TercerizacionFilter = "todas" | "interno" | "en_transicion" | "tercerizado";
type Vista = "camiones" | "acoplados";

const TERCERIZACION_FILTROS: { value: TercerizacionFilter; label: string }[] = [
  { value: "todas", label: "Todas las tercerizaciones" },
  { value: "interno", label: "Internos" },
  { value: "en_transicion", label: "En transición" },
  { value: "tercerizado", label: "Tercerizados" },
];

const CAMION_COLS = [
  "Patente",
  "Marca/Modelo",
  "Año / KM",
  "Capacidad",
  "Tipo",
  "Vinculación",
  "Tercerización",
  "Estado",
];

const ACOPLADO_COLS = [
  "Patente",
  "Marca/Modelo",
  "Año",
  "Capacidad",
  "Tipo",
  "Vinculación",
  "Estado",
];

export default function CamionesTableClient({
  camiones,
  acoplados,
  tiposServicio,
}: {
  camiones: Camion[];
  acoplados: Acoplado[];
  tiposServicio: TipoServicio[];
}) {
  const [vista, setVista] = useState<Vista>("camiones");
  const [tercerizacion, setTercerizacion] = useState<TercerizacionFilter>("todas");
  const [busqueda, setBusqueda] = useState("");

  const searchParams = useSearchParams();
  const [selectedCamion, setSelectedCamion] = useState<Camion | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedAcoplado, setSelectedAcoplado] = useState<Acoplado | null>(null);
  const [isAcopladoSheetOpen, setIsAcopladoSheetOpen] = useState(false);
  const urlTab = searchParams.get("tab") || "info";

  useEffect(() => {
    const camionId = searchParams.get("camionId");
    if (camionId) {
      const found = camiones.find((c) => c.id === camionId);
      if (found) {
        setSelectedCamion(found);
        setIsSheetOpen(true);
      }
    }
  }, [searchParams, camiones]);

  const handleOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen);
    if (!isOpen) {
      setSelectedCamion(null);
      const params = new URLSearchParams(window.location.search);
      if (params.has("camionId") || params.has("tab")) {
        params.delete("camionId");
        params.delete("tab");
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState(null, "", newUrl);
      }
    }
  };

  const camionesFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return camiones.filter((c) => {
      if (tercerizacion !== "todas" && c.tercerizacion_estado !== tercerizacion) return false;
      if (q && !c.patente.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [camiones, tercerizacion, busqueda]);

  const acopladosFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return acoplados.filter((a) => {
      if (q && !a.patente.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [acoplados, busqueda]);

  const conteoPorTerc = useMemo(() => {
    const acc: Record<TercerizacionFilter, number> = {
      todas: camiones.length,
      interno: 0,
      en_transicion: 0,
      tercerizado: 0,
    };
    for (const c of camiones) {
      const k = c.tercerizacion_estado as TercerizacionFilter | null;
      if (k && k in acc) acc[k]++;
    }
    return acc;
  }, [camiones]);

  const esCamiones = vista === "camiones";
  const mostrados = esCamiones ? camionesFiltrados.length : acopladosFiltrados.length;
  const total = esCamiones ? camiones.length : acoplados.length;
  const cols = esCamiones ? CAMION_COLS : ACOPLADO_COLS;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 gap-4 bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E1F5FE] rounded-lg text-primary">
              {esCamiones ? <Truck size={20} /> : <Container size={20} />}
            </div>
            <div>
              <h2 className="text-foreground text-lg font-bold">
                {esCamiones ? "Chasis" : "Acoplados"}
              </h2>
              <p className="text-muted-foreground text-xs font-medium">
                Mostrando {mostrados} de {total} unidades
              </p>
            </div>
          </div>

          {/* Selector Camiones / Acoplados — anclado a la izquierda para que no se mueva */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setVista("camiones")}
              className={`px-3 h-8 text-sm font-medium rounded-md transition-all ${
                esCamiones
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Chasis ({camiones.length})
            </button>
            <button
              type="button"
              onClick={() => setVista("acoplados")}
              className={`px-3 h-8 text-sm font-medium rounded-md transition-all ${
                !esCamiones
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Acoplados ({acoplados.length})
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtro de tercerización (solo camiones) */}
          {esCamiones && (
            <div className="relative group">
              <Building2
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
              />
              <select
                value={tercerizacion}
                onChange={(e) => setTercerizacion(e.target.value as TercerizacionFilter)}
                className="h-10 pl-9 pr-10 text-sm border border-border rounded-lg bg-card text-muted-foreground appearance-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] outline-none transition-all cursor-pointer min-w-[220px]"
              >
                {TERCERIZACION_FILTROS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label} ({conteoPorTerc[f.value]})
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/70">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          )}

          {/* Búsqueda por patente */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar patente..."
              className="w-64 h-10 pl-9 text-sm rounded-lg border-border focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all"
            />
          </div>
        </div>
      </div>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {cols.map((col) => (
              <TableHead
                key={col}
                className={`text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 ${col === "Patente" ? "pl-6" : ""}`}
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {esCamiones ? (
            camionesFiltrados.length === 0 ? (
              <EmptyTableRow
                message={
                  camiones.length === 0
                    ? "Sin camiones registrados"
                    : "Ningún camión coincide con los filtros"
                }
              />
            ) : (
              camionesFiltrados.map((c) => (
                <CamionRow
                  key={c.id}
                  camion={c}
                  tiposServicio={tiposServicio}
                  onSelect={(camion) => {
                    setSelectedCamion(camion);
                    setIsSheetOpen(true);
                  }}
                />
              ))
            )
          ) : acopladosFiltrados.length === 0 ? (
            <EmptyTableRow
              message={
                acoplados.length === 0
                  ? "Sin acoplados registrados"
                  : "Ningún acoplado coincide con la búsqueda"
              }
            />
          ) : (
            acopladosFiltrados.map((a) => (
              <AcopladoRow
                key={a.id}
                acoplado={a}
                onSelect={(ac) => {
                  setSelectedAcoplado(ac);
                  setIsAcopladoSheetOpen(true);
                }}
              />
            ))
          )}
        </TableBody>
      </Table>

      {selectedCamion && (
        <CamionDetailSheet
          camion={selectedCamion}
          tiposServicio={tiposServicio}
          open={isSheetOpen}
          onOpenChange={handleOpenChange}
          initialTab={urlTab as any}
        />
      )}

      {selectedAcoplado && (
        <AcopladoDetailSheet
          acoplado={selectedAcoplado}
          open={isAcopladoSheetOpen}
          onOpenChange={setIsAcopladoSheetOpen}
        />
      )}
    </div>
  );
}
