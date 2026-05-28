"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Flame, Search, ChevronRight, HelpCircle, Truck, FileText, Settings, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";

export interface Extintor {
  id: string;
  dominio: string;
  n_extintor: string;
  n_interno: string | null;
  capacidad: string | null;
  fecha_vencimiento: string | null;
  categoria: string; // 'chasis', 'acoplado', 'otros'
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

interface CamionLookup {
  id: string;
  patente: string;
}

type CategoriaFilter = "todos" | "chasis" | "acoplado" | "otros";
type VencimientoFilter = "todos" | "vigente" | "por_vencer" | "vencido" | "sin_fecha";

const CATEGORIA_LABELS: Record<string, string> = {
  chasis: "Chasis (Camiones)",
  acoplado: "Acoplados",
  otros: "Otros (Galpones, Oficinas, etc.)",
};

export default function ExtintoresTable({
  extintores,
  camiones,
}: {
  extintores: Extintor[];
  camiones: CamionLookup[];
}) {
  const [categoria, setCategoria] = useState<CategoriaFilter>("todos");
  const [vencimiento, setVencimiento] = useState<VencimientoFilter>("todos");
  const [busqueda, setBusqueda] = useState("");

  // Crear un mapa para buscar camiones por patente normalizada de forma O(1)
  const camionMap = useMemo(() => {
    const map = new Map<string, string>(); // patente compacta -> id
    for (const c of camiones) {
      const compact = c.patente.replace(/[\s-]/g, "").toUpperCase();
      map.set(compact, c.id);
    }
    return map;
  }, [camiones]);

  // Determinar estado de vigencia
  const getVigenciaState = (fechaVencimiento: string | null): VencimientoFilter => {
    if (!fechaVencimiento) return "sin_fecha";
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaVencimiento);
    venc.setHours(0, 0, 0, 0);
    
    if (venc < hoy) return "vencido";
    
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    limite.setHours(23, 59, 59, 999);
    
    if (venc <= limite) return "por_vencer";
    
    return "vigente";
  };

  // Filtrado de extintores
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return extintores.filter((item) => {
      // Filtro por categoría
      if (categoria !== "todos" && item.categoria !== categoria) {
        return false;
      }

      // Filtro por vencimiento
      const vState = getVigenciaState(item.fecha_vencimiento);
      if (vencimiento !== "todos" && vState !== vencimiento) {
        return false;
      }

      // Filtro por búsqueda
      if (q) {
        const inDom = item.dominio.toLowerCase().includes(q);
        const inExt = item.n_extintor.toLowerCase().includes(q);
        const inInt = item.n_interno?.toLowerCase().includes(q) ?? false;
        const inObs = item.observaciones?.toLowerCase().includes(q) ?? false;
        return inDom || inExt || inInt || inObs;
      }

      return true;
    });
  }, [extintores, categoria, vencimiento, busqueda]);

  // Conteos para filtros dinámicos
  const conteosCategoria = useMemo(() => {
    const counts = { todos: extintores.length, chasis: 0, acoplado: 0, otros: 0 };
    for (const item of extintores) {
      if (item.categoria === "chasis") counts.chasis++;
      else if (item.categoria === "acoplado") counts.acoplado++;
      else if (item.categoria === "otros") counts.otros++;
    }
    return counts;
  }, [extintores]);

  const conteosVencimiento = useMemo(() => {
    const counts = { todos: extintores.length, vigente: 0, por_vencer: 0, vencido: 0, sin_fecha: 0 };
    for (const item of extintores) {
      const vState = getVigenciaState(item.fecha_vencimiento);
      counts[vState]++;
    }
    return counts;
  }, [extintores]);

  // Formateador de fechas para mostrar
  const formatFecha = (fechaStr: string | null) => {
    if (!fechaStr) return "—";
    const [year, month, day] = fechaStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Renderizador de Badge de estado
  const renderBadgeVencimiento = (fechaStr: string | null) => {
    const state = getVigenciaState(fechaStr);
    
    switch (state) {
      case "vencido":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Vencido ({formatFecha(fechaStr)})
          </span>
        );
      case "por_vencer":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Por vencer ({formatFecha(fechaStr)})
          </span>
        );
      case "vigente":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Vigente ({formatFecha(fechaStr)})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
            Sin fecha cargada
          </span>
        );
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header y Filtros */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between px-6 py-5 gap-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E1F5FE] rounded-lg text-primary">
            <Flame size={20} className="text-[#E53935]" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-bold">Listado de Extintores</h2>
            <p className="text-muted-foreground text-xs font-medium">
              Mostrando {filtrados.length} de {extintores.length} extintores importados
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro por Categoría */}
          <div className="relative">
            <Truck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaFilter)}
              className="h-10 pl-9 pr-10 text-sm border border-border rounded-lg bg-card text-muted-foreground appearance-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] outline-none transition-all cursor-pointer min-w-[200px]"
            >
              <option value="todos">Todas las ubicaciones ({conteosCategoria.todos})</option>
              <option value="chasis">Chasis/Camiones ({conteosCategoria.chasis})</option>
              <option value="acoplado">Acoplados ({conteosCategoria.acoplado})</option>
              <option value="otros">Otros/Edificios ({conteosCategoria.otros})</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/70">
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>

          {/* Filtro por Vencimiento */}
          <div className="relative">
            <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
            <select
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value as VencimientoFilter)}
              className="h-10 pl-9 pr-10 text-sm border border-border rounded-lg bg-card text-muted-foreground appearance-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] outline-none transition-all cursor-pointer min-w-[200px]"
            >
              <option value="todos">Todos los vencimientos ({conteosVencimiento.todos})</option>
              <option value="vigente">Vigentes ({conteosVencimiento.vigente})</option>
              <option value="por_vencer">Por vencer (30 días) ({conteosVencimiento.por_vencer})</option>
              <option value="vencido">Vencidos ({conteosVencimiento.vencido})</option>
              <option value="sin_fecha">Sin fecha ({conteosVencimiento.sin_fecha})</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/70">
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>

          {/* Buscador Global */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar patente, Nº extintor..."
              className="w-64 h-10 pl-9 text-sm rounded-lg border-border focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 pl-6">
              Ubicación / Dominio
            </TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">
              Nº Extintor
            </TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">
              Nº Interno
            </TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">
              Capacidad
            </TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">
              Vencimiento / Estado
            </TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4">
              Categoría
            </TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 pr-6">
              Observaciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.length === 0 ? (
            <EmptyTableRow
              message={
                extintores.length === 0
                  ? "Sin extintores cargados en el sistema"
                  : "Ningún extintor coincide con los filtros aplicados"
              }
            />
          ) : (
            filtrados.map((item) => {
              // Buscar si existe un camión con esta patente
              const compactPatente = item.dominio.replace(/[\s-]/g, "").toUpperCase();
              const camionId = item.categoria === "chasis" ? camionMap.get(compactPatente) : null;

              return (
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-4 pl-6 font-semibold text-foreground">
                    {camionId ? (
                      <Link
                        href={`/camiones?camionId=${camionId}`}
                        className="inline-flex items-center gap-1 text-[#0088D1] hover:underline"
                        title="Ver detalles del camión"
                      >
                        {item.dominio}
                        <ExternalLink size={12} className="opacity-70" />
                      </Link>
                    ) : (
                      item.dominio
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                    {item.n_extintor}
                  </TableCell>
                  <TableCell className="py-4 text-sm text-neutral-600 dark:text-neutral-400">
                    {item.n_interno ?? "—"}
                  </TableCell>
                  <TableCell className="py-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {item.capacidad ?? "—"}
                  </TableCell>
                  <TableCell className="py-4">
                    {renderBadgeVencimiento(item.fecha_vencimiento)}
                  </TableCell>
                  <TableCell className="py-4 text-xs font-semibold text-neutral-500 uppercase">
                    {item.categoria}
                  </TableCell>
                  <TableCell className="py-4 pr-6 text-sm text-muted-foreground max-w-[250px] truncate" title={item.observaciones ?? ""}>
                    {item.observaciones ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
