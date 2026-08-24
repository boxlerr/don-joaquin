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
import { Receipt, X, Loader2, AlertCircle, ListFilter } from "lucide-react";
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
  /**
   * Búsqueda con la que abre la lista. La manda la caja: al tocar un egreso se
   * llega acá con ese gasto ya filtrado, en vez de caer en la lista entera y
   * tener que buscarlo a mano. Es editable como cualquier filtro.
   */
  busquedaInicial?: string;
}

export default function GastosTable({
  tiposGasto,
  viajes,
  camiones,
  busquedaInicial = "",
}: Props) {
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
  const [search, setSearch] = useState(busquedaInicial);
  const [debouncedSearch, setDebouncedSearch] = useState(busquedaInicial);
  const [refreshTick, setRefreshTick] = useState(0);
  // Son 8 controles: apilados en celular tapaban la pantalla entera antes del
  // primer gasto, así que abajo de sm van detrás del botón "Filtros".
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

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

  // Compartido entre la tabla (desktop) y las tarjetas (celular): el mapeo de
  // la fila es uno solo, cambia nada más cómo se muestra.
  const asignacionesDe = (g: GastoRow) => {
    const a: string[] = [];
    if (g.viaje_codigo) a.push(`Viaje ${g.viaje_codigo}`);
    if (g.camion_patente) a.push(g.camion_patente);
    if (g.chofer_nombre) a.push(g.chofer_nombre);
    return a;
  };

  const chipSinAsignar = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
      <AlertCircle size={10} />
      Sin asignar
    </span>
  );

  /** Mensaje único de carga / error / vacío, para no repetirlo en las dos vistas. */
  const estado = loading
    ? "Cargando gastos..."
    : error
      ? error
      : rows.length === 0
        ? "Sin gastos registrados"
        : null;

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Listado de Gastos</h2>
        </div>

        {/* Abajo de sm la barra de filtros se despliega; desde sm es la de siempre. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:hidden"
          aria-expanded={filtrosAbiertos}
          onClick={() => setFiltrosAbiertos((v) => !v)}
        >
          <ListFilter size={14} />
          Filtros
          {hayFiltros && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
        </Button>

        <div
          className={`${
            filtrosAbiertos ? "flex" : "hidden"
          } w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center`}
        >
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="text-sm min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="Fecha desde"
            />
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="text-sm min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="Fecha hasta"
            />
          </div>
          <Select
            value={tipoGastoId || "__all__"}
            onValueChange={(v) => setTipoGastoId(v === "__all__" ? "" : v ?? "")}
          >
            <SelectTrigger
              aria-label="Tipo de gasto"
              className="h-10 text-sm w-full min-w-0 sm:h-9 sm:w-auto sm:min-w-[160px]"
            >
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
            <SelectTrigger
              aria-label="Camión"
              className="h-10 text-sm w-full min-w-0 sm:h-9 sm:w-auto sm:min-w-[140px]"
            >
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
            <SelectTrigger
              aria-label="Viaje"
              className="h-10 text-sm w-full min-w-0 sm:h-9 sm:w-auto sm:min-w-[140px]"
            >
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
            className="h-10 w-full sm:h-9 sm:w-auto"
          >
            <AlertCircle size={13} />
            Sin asignar
          </Button>

          <Input
            type="search"
            placeholder="Buscar descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm sm:w-44"
            aria-label="Buscar"
          />
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limpiar}
              className="text-muted-foreground hover:text-foreground h-10 w-full sm:h-9 sm:w-auto"
            >
              <X size={13} className="mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Abajo de md la tabla desaparece: 9 columnas no entran en 343px y este
          listado ES la pantalla de Gastos, así que cada fila pasa a tarjeta. */}
      <Table className="hidden md:table">
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
              const asignaciones = asignacionesDe(g);

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
                    {asignaciones.length === 0 ? (
                      chipSinAsignar
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

      {/* Celular: la misma lista como tarjetas. Tipo y monto arriba, y abajo la
          asignación, que es el dato que se viene a controlar acá. */}
      <div className="md:hidden">
        {estado ? (
          <p
            className={`px-4 py-8 text-center text-sm ${
              error ? "text-[#EF4444]" : "text-muted-foreground/70"
            }`}
          >
            {loading && <Loader2 className="mr-2 inline-block animate-spin" size={14} />}
            {estado}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((g) => {
              const asignaciones = asignacionesDe(g);
              return (
                <li key={g.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {g.tipo_gasto_nombre ?? "—"}
                      </p>
                      {g.descripcion && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{g.descripcion}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#EF4444]">
                      $ {formatARS(g.monto)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatFecha(g.fecha)}
                    </span>
                    <span className="text-muted-foreground/40" aria-hidden>
                      ·
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {MEDIO_LABEL[g.medio_pago] ?? g.medio_pago}
                    </span>
                    {asignaciones.length === 0 ? (
                      chipSinAsignar
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {asignaciones.join(" · ")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs text-muted-foreground/80">
                    {g.proveedor ? `${g.proveedor} · ` : ""}
                    {g.numero_comprobante ? `Comp. ${g.numero_comprobante} · ` : ""}
                    {g.usuario ?? "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
