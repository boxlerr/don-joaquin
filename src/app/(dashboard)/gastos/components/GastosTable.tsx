"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Receipt, X, Loader2, AlertCircle } from "lucide-react";
import { getGastosAction, type GastoRow } from "../actions";
import type {
  TipoGastoOption,
  ViajeOption,
  CamionOption,
} from "./AddGastoDialog";

const MEDIO_LABEL: Record<string, string> = {
  efectivo_caja: "Efectivo (caja)",
  efectivo_viatico: "Efectivo (viático)",
  transferencia: "Transferencia",
  tarjeta_empresa: "Tarjeta empresa",
  cuenta_corriente: "Cuenta corriente",
};

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  tiposGasto: TipoGastoOption[];
  viajes: ViajeOption[];
  camiones: CamionOption[];
}

export default function GastosTable({ tiposGasto, viajes, camiones }: Props) {
  const [rows, setRows] = useState<GastoRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoGastoId, setTipoGastoId] = useState("");
  const [viajeId, setViajeId] = useState("");
  const [camionId, setCamionId] = useState("");
  const [sinAsignar, setSinAsignar] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener("gastos:refresh", handler);
    return () => window.removeEventListener("gastos:refresh", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    setError(null);
    getGastosAction({
      desde: desde || undefined,
      hasta: hasta || undefined,
      tipoGastoId: tipoGastoId || undefined,
      viajeId: viajeId || undefined,
      camionId: camionId || undefined,
      sinAsignar: sinAsignar || undefined,
      search: debouncedSearch || undefined,
      page: 0,
    }).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setRows(result.data);
        setHasMore(result.hasMore);
        setPage(0);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [desde, hasta, tipoGastoId, viajeId, camionId, sinAsignar, debouncedSearch, refreshTick]);

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await getGastosAction({
        desde: desde || undefined,
        hasta: hasta || undefined,
        tipoGastoId: tipoGastoId || undefined,
        viajeId: viajeId || undefined,
        camionId: camionId || undefined,
          sinAsignar: sinAsignar || undefined,
        search: debouncedSearch || undefined,
        page: nextPage,
      });
      if ("data" in result) {
        setRows((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
      }
    });
  };

  const hayFiltros =
    !!desde ||
    !!hasta ||
    !!tipoGastoId ||
    !!viajeId ||
    !!camionId ||
    sinAsignar ||
    !!search;

  const limpiar = () => {
    setDesde("");
    setHasta("");
    setTipoGastoId("");
    setViajeId("");
    setCamionId("");
    setSinAsignar(false);
    setSearch("");
  };

  const tiposPorCategoria = tiposGasto.reduce<Record<string, TipoGastoOption[]>>((acc, t) => {
    const key = t.categoria ?? "otros";
    (acc[key] = acc[key] ?? []).push(t);
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Listado de Gastos</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="text-sm w-auto"
            aria-label="Fecha desde"
          />
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="text-sm w-auto"
            aria-label="Fecha hasta"
          />
          <Select
            value={tipoGastoId || "__all__"}
            onValueChange={(v) => setTipoGastoId(v === "__all__" ? "" : v ?? "")}
          >
            <SelectTrigger aria-label="Tipo de gasto" className="h-9 text-sm w-auto min-w-[160px]">
              <SelectValue>
                {(value: unknown) => {
                  if (!value || value === "__all__") return "Todos los tipos";
                  return tiposGasto.find((t) => t.id === value)?.nombre ?? null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los tipos</SelectItem>
              {Object.entries(tiposPorCategoria).map(([cat, items]) => (
                <SelectGroup key={cat}>
                  <SelectLabel>{cat.toUpperCase()}</SelectLabel>
                  {items.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={camionId || "__all__"}
            onValueChange={(v) => setCamionId(v === "__all__" ? "" : v ?? "")}
          >
            <SelectTrigger aria-label="Camión" className="h-9 text-sm w-auto min-w-[140px]">
              <SelectValue>
                {(value: unknown) => {
                  if (!value || value === "__all__") return "Todos los camiones";
                  return camiones.find((c) => c.id === value)?.patente ?? null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los camiones</SelectItem>
              {camiones.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.patente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={viajeId || "__all__"}
            onValueChange={(v) => setViajeId(v === "__all__" ? "" : v ?? "")}
          >
            <SelectTrigger aria-label="Viaje" className="h-9 text-sm w-auto min-w-[140px]">
              <SelectValue>
                {(value: unknown) => {
                  if (!value || value === "__all__") return "Todos los viajes";
                  return viajes.find((v) => v.id === value)?.codigo ?? null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los viajes</SelectItem>
              {viajes.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={sinAsignar ? "brand" : "outline"}
            size="sm"
            onClick={() => setSinAsignar((v) => !v)}
            className="h-9"
          >
            <AlertCircle size={13} />
            Sin asignar
          </Button>

          <Input
            type="search"
            placeholder="Buscar descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 text-sm"
            aria-label="Buscar"
          />
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limpiar}
              className="text-muted-foreground hover:text-foreground h-9"
            >
              <X size={13} className="mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {[
              "Fecha",
              "Tipo",
              "Descripción",
              "Proveedor",
              "Asignación",
              "Medio",
              "Comprobante",
              "Monto",
              "Usuario",
            ].map((col) => (
              <TableHead
                key={col}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground/70 text-sm">
                <Loader2 className="inline-block animate-spin mr-2" size={14} />
                Cargando gastos...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-[#EF4444] text-sm">
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Sin gastos registrados" />
          ) : (
            rows.map((g) => {
              const asignaciones: string[] = [];
              if (g.viaje_codigo) asignaciones.push(`Viaje ${g.viaje_codigo}`);
              if (g.camion_patente) asignaciones.push(g.camion_patente);
              if (g.chofer_nombre) asignaciones.push(g.chofer_nombre);
              const sinAsignar = asignaciones.length === 0;

              return (
                <TableRow key={g.id}>
                  <TableCell className="text-sm text-muted-foreground">{formatFecha(g.fecha)}</TableCell>
                  <TableCell className="text-sm text-foreground font-medium">
                    {g.tipo_gasto_nombre ?? "—"}
                    {g.tipo_gasto_categoria && (
                      <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mt-0.5">
                        {g.tipo_gasto_categoria}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                    {g.descripcion ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.proveedor ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {sinAsignar ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle size={10} />
                        Sin asignar
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {asignaciones.map((a, i) => (
                          <span key={i} className="text-muted-foreground">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {MEDIO_LABEL[g.medio_pago] ?? g.medio_pago}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.numero_comprobante ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-[#EF4444]">
                    $ {formatARS(g.monto)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.usuario ?? "—"}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {hasMore && !loading && (
        <div className="flex justify-center py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Cargando...
              </>
            ) : (
              "Cargar más"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
