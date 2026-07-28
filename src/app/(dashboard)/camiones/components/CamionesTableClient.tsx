"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Truck, Container, Search, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import FiltrosFlotaPopover from "./FiltrosFlotaPopover";
import CamionRow from "./CamionRow";
import AcopladoRow from "./AcopladoRow";
import CamionDetailSheet, { type TabId } from "./CamionDetailSheet";
import AcopladoDetailSheet from "./AcopladoDetailSheet";
import type { Camion, Acoplado } from "../types";
import type { TipoServicio } from "../actions";
import {
  coincide,
  contarFiltros,
  etiquetaEstado,
  etiquetaTipo,
  FILTROS_VACIOS,
  opcionesDe,
  pasaFiltros,
  rangoAnios,
  type FiltrosFlota,
  type UnidadBuscable,
} from "../filtros";

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
  const [filtros, setFiltros] = useState<FiltrosFlota>(FILTROS_VACIOS);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
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

  /** La flota vista como algo buscable, con el tipo unificado entre chasis y acoplados. */
  const camionesBuscables = useMemo<(Camion & UnidadBuscable)[]>(
    () => camiones.map((c) => ({ ...c, tipo: c.tipo_camion })),
    [camiones],
  );
  const acopladosBuscables = useMemo<(Acoplado & UnidadBuscable)[]>(
    () => acoplados.map((a) => ({ ...a, chofer_nombre: a.chofer_nombre })),
    [acoplados],
  );

  const camionesFiltrados = useMemo(
    () =>
      camionesBuscables.filter((c) => {
        if (tercerizacion !== "todas" && c.tercerizacion_estado !== tercerizacion) return false;
        return pasaFiltros(c, filtros) && coincide(c, busqueda);
      }),
    [camionesBuscables, tercerizacion, busqueda, filtros],
  );

  const acopladosFiltrados = useMemo(
    () => acopladosBuscables.filter((a) => pasaFiltros(a, filtros) && coincide(a, busqueda)),
    [acopladosBuscables, busqueda, filtros],
  );

  // Las opciones salen de lo que hay cargado, así no se ofrece filtrar por algo
  // que no existe. Se calculan sobre la vista activa.
  const base = vista === "camiones" ? camionesBuscables : acopladosBuscables;
  const opciones = useMemo(
    () => ({
      marcas: opcionesDe(base, (u) => u.marca),
      tipos: opcionesDe(base, (u) => u.tipo, etiquetaTipo),
      capacidades: opcionesDe(
        base,
        (u) => (u.capacidad_tn != null ? Number(u.capacidad_tn) : null),
        (v) => `${v} tn`,
      ),
      estados: opcionesDe(base, (u) => u.estado, etiquetaEstado),
      anios: rangoAnios(base),
    }),
    [base],
  );

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
                {(busqueda.trim() !== "" || contarFiltros(filtros) > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusqueda("");
                      setFiltros(FILTROS_VACIOS);
                    }}
                    className="ml-2 text-primary hover:underline"
                  >
                    ver todas
                  </button>
                )}
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
            <div className="relative">
              <Building2
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/70 pointer-events-none"
              />
              <Combobox
                value={tercerizacion}
                onValueChange={(v) => setTercerizacion(v as TercerizacionFilter)}
                options={TERCERIZACION_FILTROS.map((f) => ({
                  id: f.value,
                  label: `${f.label} (${conteoPorTerc[f.value]})`,
                }))}
                searchable={false}
                triggerClassName="h-10 min-w-[220px] pl-9"
              />
            </div>
          )}

          <FiltrosFlotaPopover
            filtros={filtros}
            onChange={setFiltros}
            marcas={opciones.marcas}
            tipos={opciones.tipos}
            capacidades={opciones.capacidades}
            estados={opciones.estados}
            anios={opciones.anios}
          />

          {/* Búsqueda: mira todo lo que se ve en la fila, no sólo la patente. */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Patente, marca, modelo, año, chofer…"
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
          initialTab={urlTab as TabId}
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
