"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { Eye, Loader2, X } from "lucide-react";
import { getViajesAction } from "../actions";
import type { ViajeBasico } from "../types";

interface Props {
  choferId?: string;
}

const ESTADO_TONE: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  cerrado: "success",
  en_curso: "info",
  pendiente: "warning",
  cancelado: "error",
};

const COLUMNS = ["Fecha", "Origen", "Destino", "KM", "Estado", "Facturado", ""];

export default function ViajesTable({ choferId }: Props) {
  const router = useRouter();

  const [rows, setRows] = useState<ViajeBasico[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [allLoaded, setAllLoaded] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getViajesAction({
      choferId,
      page: 0,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado: estadoFiltro ? [estadoFiltro] : undefined,
      search: debouncedSearch || undefined,
    }).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setRows(result.data);
        setHasMore(result.hasMore);
        setAllLoaded(false);
        setPage(0);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [choferId, desde, hasta, estadoFiltro, debouncedSearch]);

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await getViajesAction({
        choferId,
        page: nextPage,
        desde: desde || undefined,
        hasta: hasta || undefined,
        estado: estadoFiltro ? [estadoFiltro] : undefined,
        search: debouncedSearch || undefined,
      });
      if ("data" in result) {
        setRows((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
        if (!result.hasMore) setAllLoaded(true);
      }
    });
  };

  const hayFiltros = !!desde || !!hasta || !!search || !!estadoFiltro;

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setSearch("");
    setEstadoFiltro("");
  };

  return (
    <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <Input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="text-sm w-36"
          aria-label="Fecha desde"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="text-sm w-36"
          aria-label="Fecha hasta"
        />
        <Input
          type="text"
          placeholder="Buscar por código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm w-44"
          aria-label="Buscar viaje por código"
        />
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_curso">En curso</option>
          <option value="cerrado">Cerrado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            className="text-[#64748B] hover:text-[#0F172A] h-9"
            aria-label="Limpiar todos los filtros"
          >
            <X size={13} className="mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Tabla */}
      <Table>
        <TableHeader className="bg-[#F8FAFC]">
          <TableRow>
            {COLUMNS.map((col, i) => (
              <TableHead
                key={i}
                className="text-xs font-semibold text-[#475569] uppercase tracking-wide"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {COLUMNS.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length}
                className="py-12 text-center text-red-500 text-sm"
              >
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Sin viajes registrados" />
          ) : (
            rows.map((v) => (
              <TableRow
                key={v.id}
                className="hover:bg-[#F8FAFC] transition-colors"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/viajes/${v.id}`);
                }}
              >
                <TableCell className="text-sm text-[#475569]">
                  {new Date(v.fecha_viaje).toLocaleDateString("es-AR")}
                </TableCell>
                <TableCell className="text-sm text-[#475569]">
                  {v.origen ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-[#475569]">
                  {v.destino ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-[#475569] font-mono">
                  {v.km_totales.toLocaleString("es-AR")} km
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={v.estado.replace("_", " ")}
                    tone={ESTADO_TONE[v.estado] ?? "neutral"}
                  />
                </TableCell>
                <TableCell>
                  <span
                    className={`text-xs font-medium ${
                      v.facturado ? "text-[#10B981]" : "text-[#94A3B8]"
                    }`}
                  >
                    {v.facturado ? "Sí" : "No"}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Ver viaje ${v.codigo}`}
                    onClick={() => router.push(`/viajes/${v.id}`)}
                  >
                    <Eye size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Cargar más / fin de resultados */}
      {!loading && (hasMore || allLoaded) && (
        <div className="flex justify-center px-5 py-4 border-t border-[#E2E8F0]">
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isPending}
              aria-label="Cargar más viajes"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Cargando...
                </>
              ) : (
                "Cargar más"
              )}
            </Button>
          ) : (
            <p className="text-xs text-[#94A3B8]">
              Todos los resultados cargados — {rows.length} viaje{rows.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
