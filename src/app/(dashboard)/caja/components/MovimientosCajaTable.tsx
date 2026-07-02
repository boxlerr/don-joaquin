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
import { Wallet, X, Loader2 } from "lucide-react";
import {
  getCajaMovimientosAction,
  type CajaId,
  type CajaMovimientoRow,
} from "../actions";

const CATEGORIA_LABEL: Record<string, string> = {
  cobro_cliente: "Cobro a cliente",
  pago_proveedor: "Pago a proveedor",
  entrega_viatico: "Entrega de viático",
  rendicion_vuelto: "Rendición / vuelto",
  gasto_operativo: "Gasto operativo",
  pago_chofer: "Pago a chofer",
  transferencia_interna: "Transferencia interna",
  ajuste: "Ajuste",
  otro: "Otro",
};

const CATEGORIAS_FILTRO: { value: string; label: string }[] = [
  { value: "cobro_cliente", label: "Cobro a cliente" },
  { value: "pago_proveedor", label: "Pago a proveedor" },
  { value: "entrega_viatico", label: "Entrega de viático" },
  { value: "rendicion_vuelto", label: "Rendición / vuelto" },
  { value: "gasto_operativo", label: "Gasto operativo" },
  { value: "pago_chofer", label: "Pago a chofer" },
  { value: "transferencia_interna", label: "Transferencia interna" },
  { value: "ajuste", label: "Ajuste" },
  { value: "otro", label: "Otro" },
];

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
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
  tiposGasto: { id: string; nombre: string; categoria: string }[];
  /** Rango de fechas controlado por el dashboard (selector de mes). */
  desde: string;
  hasta: string;
  onRangeChange: (desde: string, hasta: string) => void;
  /** Caja activa: diaria (operativa) o grande (privada de dirección). */
  caja?: CajaId;
}

export default function MovimientosCajaTable({
  tiposGasto,
  desde,
  hasta,
  onRangeChange,
  caja = "diaria",
}: Props) {
  const [rows, setRows] = useState<CajaMovimientoRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // tipoFiltro almacena un valor con prefijo: "cat:<categoria>" o "tg:<tipo_gasto_id>"
  const [tipoFiltro, setTipoFiltro] = useState("");
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
    window.addEventListener("caja:refresh", handler);
    return () => window.removeEventListener("caja:refresh", handler);
  }, []);

  const parsedFiltro = tipoFiltro.startsWith("cat:")
    ? { categoria: tipoFiltro.slice(4), tipoGastoId: undefined as string | undefined }
    : tipoFiltro.startsWith("tg:")
    ? { categoria: undefined as string | undefined, tipoGastoId: tipoFiltro.slice(3) }
    : { categoria: undefined as string | undefined, tipoGastoId: undefined as string | undefined };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    setError(null);

    getCajaMovimientosAction({
      desde: desde || undefined,
      hasta: hasta || undefined,
      categoria: parsedFiltro.categoria,
      tipoGastoId: parsedFiltro.tipoGastoId,
      search: debouncedSearch || undefined,
      page: 0,
      caja,
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
  }, [desde, hasta, tipoFiltro, debouncedSearch, refreshTick, caja]);

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await getCajaMovimientosAction({
        desde: desde || undefined,
        hasta: hasta || undefined,
        categoria: parsedFiltro.categoria,
        tipoGastoId: parsedFiltro.tipoGastoId,
        search: debouncedSearch || undefined,
        page: nextPage,
        caja,
      });
      if ("data" in result) {
        setRows((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
      }
    });
  };

  const hayFiltros = !!desde || !!hasta || !!tipoFiltro || !!search;

  const limpiarFiltros = () => {
    onRangeChange("", "");
    setTipoFiltro("");
    setSearch("");
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">
            {caja === "grande" ? "Movimientos de Caja Grande" : "Movimientos de Caja"}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={desde}
            onChange={(e) => onRangeChange(e.target.value, hasta)}
            className="text-sm w-auto"
            aria-label="Fecha desde"
          />
          <Input
            type="date"
            value={hasta}
            onChange={(e) => onRangeChange(desde, e.target.value)}
            className="text-sm w-auto"
            aria-label="Fecha hasta"
          />
          <Select
            value={tipoFiltro || "__all__"}
            onValueChange={(v) => setTipoFiltro(v === "__all__" ? "" : (v ?? ""))}
          >
            <SelectTrigger
              aria-label="Filtrar por tipo"
              className="h-9 text-sm w-auto min-w-[200px]"
            >
              <SelectValue>
                {(value: unknown) => {
                  const v = value as string;
                  if (!v || v === "__all__") {
                    return `Todos los tipos (${CATEGORIAS_FILTRO.length + tiposGasto.length})`;
                  }
                  if (v.startsWith("cat:")) {
                    return CATEGORIAS_FILTRO.find((c) => c.value === v.slice(4))?.label ?? null;
                  }
                  if (v.startsWith("tg:")) {
                    return tiposGasto.find((t) => t.id === v.slice(3))?.nombre ?? null;
                  }
                  return null;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={4} align="start">
              <SelectItem value="__all__">
                Todos los tipos ({CATEGORIAS_FILTRO.length + tiposGasto.length})
              </SelectItem>
              <SelectGroup>
                <SelectLabel>Categorías</SelectLabel>
                {CATEGORIAS_FILTRO.map((c) => (
                  <SelectItem key={c.value} value={`cat:${c.value}`}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {tiposGasto.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Tipos de gasto</SelectLabel>
                  {tiposGasto.map((t) => (
                    <SelectItem key={t.id} value={`tg:${t.id}`}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <Input
            type="search"
            placeholder="Buscar concepto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 text-sm"
            aria-label="Buscar por concepto"
          />
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limpiarFiltros}
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
              "Concepto",
              "Tipo",
              "Vinculado a",
              "Medio de pago",
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
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground/70 text-sm">
                <Loader2 className="inline-block animate-spin mr-2" size={14} />
                Cargando movimientos...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-[#EF4444] text-sm">
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Sin movimientos registrados" />
          ) : (
            rows.map((m) => {
              const esIngreso = m.tipo === "ingreso";
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFecha(m.fecha)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-medium">
                    {m.concepto}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.tipo_gasto_nombre ?? CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.vinculado_a ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {MEDIO_LABEL[m.medio] ?? m.medio}
                  </TableCell>
                  <TableCell
                    className={`text-sm font-semibold ${
                      esIngreso ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {esIngreso ? "+" : "-"} $ {formatARS(m.monto)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.usuario ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {hasMore && !loading && (
        <div className="flex justify-center py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isPending}
          >
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
