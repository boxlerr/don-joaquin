"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Truck, Container, Search, Building2, ArrowDownWideNarrow } from "lucide-react";
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
import CamionRow, { CamionCard } from "./CamionRow";
import AcopladoRow, { AcopladoCard } from "./AcopladoRow";
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
  ordenarFlota,
  ORDENES,
  ORDEN_LABEL,
  type FiltrosFlota,
  type OrdenFlota,
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
  const [orden, setOrden] = useState<OrdenFlota>("marca");

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
      ordenarFlota(
        camionesBuscables.filter((c) => {
          if (tercerizacion !== "todas" && c.tercerizacion_estado !== tercerizacion) return false;
          return pasaFiltros(c, filtros) && coincide(c, busqueda);
        }),
        orden,
      ),
    [camionesBuscables, tercerizacion, busqueda, filtros, orden],
  );

  const acopladosFiltrados = useMemo(
    () =>
      ordenarFlota(
        acopladosBuscables.filter((a) => pasaFiltros(a, filtros) && coincide(a, busqueda)),
        orden,
      ),
    [acopladosBuscables, busqueda, filtros, orden],
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

  // Mensajes y handlers compartidos entre la tabla (desktop) y las tarjetas
  // (celular): la presentación cambia, la lógica es una sola.
  const vacioCamiones =
    camiones.length === 0
      ? "Sin camiones registrados"
      : "Ningún camión coincide con los filtros";
  const vacioAcoplados =
    acoplados.length === 0
      ? "Sin acoplados registrados"
      : "Ningún acoplado coincide con la búsqueda";

  const abrirCamion = (camion: Camion) => {
    setSelectedCamion(camion);
    setIsSheetOpen(true);
  };
  const abrirAcoplado = (ac: Acoplado) => {
    setSelectedAcoplado(ac);
    setIsAcopladoSheetOpen(true);
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Dos filas: identidad arriba, controles abajo. En una sola fila los
          controles no entraban y el título y el selector se partían en
          varias líneas. */}
      <div className="space-y-3 bg-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-[#E1F5FE] p-2 text-primary">
              {esCamiones ? <Truck size={20} /> : <Container size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {esCamiones ? "Chasis" : "Acoplados"}
              </h2>
              <p className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                Mostrando {mostrados} de {total} unidades
                {(busqueda.trim() !== "" || contarFiltros(filtros) > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusqueda("");
                      setFiltros(FILTROS_VACIOS);
                    }}
                    className="ml-2 -my-1 px-1 py-1 text-primary hover:underline"
                  >
                    ver todas
                  </button>
                )}
              </p>
            </div>
          </div>

          {/* El selector chasis/acoplados va a ancho completo en celular: es la
              decisión principal de la pantalla y con el dedo hay que pegarle. */}
          <div className="flex w-full shrink-0 items-center gap-1 rounded-lg bg-muted p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setVista("camiones")}
              className={`h-9 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all sm:h-8 sm:flex-none ${
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
              className={`h-9 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all sm:h-8 sm:flex-none ${
                !esCamiones
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Acoplados ({acoplados.length})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {esCamiones && (
            <div className="relative w-full sm:w-auto sm:shrink-0">
              <Building2
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/70"
              />
              <Combobox
                value={tercerizacion}
                onValueChange={(v) => setTercerizacion(v as TercerizacionFilter)}
                options={TERCERIZACION_FILTROS.map((f) => ({
                  id: f.value,
                  label: `${f.label} (${conteoPorTerc[f.value]})`,
                }))}
                searchable={false}
                triggerClassName="h-10 w-full pl-9 sm:min-w-[210px]"
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

          {/* Sin orden explícito la lista salía como vinieron de la base y las
              marcas quedaban mezcladas. Por defecto agrupa por marca. */}
          <div className="relative min-w-0 flex-1 sm:flex-none sm:shrink-0">
            <ArrowDownWideNarrow
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/70"
            />
            <Combobox
              value={orden}
              onValueChange={(v) => setOrden(v as OrdenFlota)}
              options={ORDENES.map((o) => ({ id: o, label: ORDEN_LABEL[o] }))}
              searchable={false}
              triggerClassName="h-10 w-full pl-9 sm:min-w-[190px]"
            />
          </div>

          {/* Búsqueda: mira todo lo que se ve en la fila, no sólo la patente. */}
          <div className="relative w-full flex-1 sm:min-w-[16rem]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Patente, marca, modelo, año, chofer…"
              className="h-10 w-full rounded-lg border-border pl-9 text-sm transition-all focus:border-[#0088D1] focus:ring-2 focus:ring-[#0088D1]/20"
            />
          </div>
        </div>
      </div>

      {/* Desde md, la tabla de siempre (con scroll horizontal propio: 8
          columnas no entran en una tablet angosta). */}
      <div className="hidden md:block">
        <Table className="min-w-[900px]">
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
                <EmptyTableRow message={vacioCamiones} />
              ) : (
                camionesFiltrados.map((c) => (
                  <CamionRow
                    key={c.id}
                    camion={c}
                    tiposServicio={tiposServicio}
                    onSelect={abrirCamion}
                  />
                ))
              )
            ) : acopladosFiltrados.length === 0 ? (
              <EmptyTableRow message={vacioAcoplados} />
            ) : (
              acopladosFiltrados.map((a) => (
                <AcopladoRow key={a.id} acoplado={a} onSelect={abrirAcoplado} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* En celular la fila es una tarjeta: la flota es lo que se consulta
          desde el teléfono y una tabla de 8 columnas ahí no se lee. */}
      <div className="divide-y divide-[#F1F5F9] border-t border-border md:hidden">
        {esCamiones ? (
          camionesFiltrados.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {vacioCamiones}
            </p>
          ) : (
            camionesFiltrados.map((c) => (
              <CamionCard key={c.id} camion={c} onSelect={abrirCamion} />
            ))
          )
        ) : acopladosFiltrados.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {vacioAcoplados}
          </p>
        ) : (
          acopladosFiltrados.map((a) => (
            <AcopladoCard key={a.id} acoplado={a} onSelect={abrirAcoplado} />
          ))
        )}
      </div>

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
