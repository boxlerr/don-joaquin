"use client";

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
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
import { Wallet, X, Loader2, EyeOff, Eye, ListFilter } from "lucide-react";
import {
  getCajaMovimientosAction,
  setMovimientoPrivadoAction,
  type CajaFiltro,
  type CajaMovimientoRow,
  type CajaVista,
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

/**
 * Color del chip de cada categoría: lo que entra tira a verde, lo que sale a
 * rojo/ámbar y lo que solo mueve plata de un lado al otro queda neutro. Es para
 * poder barrer la columna con la vista sin leer cada fila.
 */
const CATEGORIA_CHIP: Record<string, string> = {
  cobro_cliente: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  rendicion_vuelto: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  pago_proveedor: "bg-rose-50 text-rose-700 border-rose-200/70",
  pago_chofer: "bg-rose-50 text-rose-700 border-rose-200/70",
  gasto_operativo: "bg-amber-50 text-amber-700 border-amber-200/70",
  entrega_viatico: "bg-sky-50 text-sky-700 border-sky-200/70",
  transferencia_interna: "bg-violet-50 text-violet-700 border-violet-200/70",
  ajuste: "bg-slate-100 text-slate-600 border-slate-200",
  otro: "bg-slate-100 text-slate-600 border-slate-200",
};

const CHIP_NEUTRO = "bg-slate-100 text-slate-600 border-slate-200";

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
  /** Caja chica (filtrada, igual para todos) o vista general de dirección. */
  vista?: CajaVista;
  /** Dentro de la vista general: qué caja mostrar, o las dos juntas. */
  caja?: CajaFiltro;
  /** Primer día consultable: la caja chica es una ventana móvil. */
  minDate?: string;
  /** En la vista general conviene ver de qué caja es cada movimiento. */
  mostrarColumnaCaja?: boolean;
  /** Dirección: puede mostrar u ocultar un movimiento al personal operativo. */
  puedeMarcarPrivado?: boolean;
}

export default function MovimientosCajaTable({
  tiposGasto,
  desde,
  hasta,
  onRangeChange,
  vista = "chica",
  caja = "diaria",
  minDate,
  mostrarColumnaCaja = false,
  puedeMarcarPrivado = false,
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
  // En celular los filtros se despliegan: apilados ocupaban media pantalla
  // antes de que apareciera el primer movimiento.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

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

  const parsedFiltro = useMemo(
    () =>
      tipoFiltro.startsWith("cat:")
        ? { categoria: tipoFiltro.slice(4), tipoGastoId: undefined as string | undefined }
        : tipoFiltro.startsWith("tg:")
          ? { categoria: undefined as string | undefined, tipoGastoId: tipoFiltro.slice(3) }
          : { categoria: undefined as string | undefined, tipoGastoId: undefined as string | undefined },
    [tipoFiltro],
  );

  // Los filtros vigentes, para que la recarga silenciosa no dependa de ellos en
  // su lista de dependencias (si no, se dispararía con cada tecla del buscador).
  const consultaRef = useRef({ desde, hasta, parsedFiltro, debouncedSearch, vista, caja, page });
  useEffect(() => {
    consultaRef.current = { desde, hasta, parsedFiltro, debouncedSearch, vista, caja, page };
  });

  /**
   * Recarga silenciosa: trae lo que cambió en otras sesiones —por ejemplo, un
   * movimiento que dirección acaba de ocultar— sin spinner y sin reiniciar la
   * paginación. Si el usuario cargó más páginas se saltea, para no borrarle lo
   * que está mirando; ese caso se resuelve solo en la próxima carga.
   */
  useEffect(() => {
    const handler = () => {
      const q = consultaRef.current;
      if (q.page !== 0) return;
      getCajaMovimientosAction({
        desde: q.desde || undefined,
        hasta: q.hasta || undefined,
        categoria: q.parsedFiltro.categoria,
        tipoGastoId: q.parsedFiltro.tipoGastoId,
        search: q.debouncedSearch || undefined,
        page: 0,
        vista: q.vista,
        caja: q.caja,
      }).then((result) => {
        if ("data" in result) {
          setRows(result.data);
          setHasMore(result.hasMore);
        }
      });
    };
    window.addEventListener("caja:sync", handler);
    return () => window.removeEventListener("caja:sync", handler);
  }, []);

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
      vista,
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
  }, [desde, hasta, tipoFiltro, parsedFiltro, debouncedSearch, refreshTick, vista, caja]);

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
        vista,
        caja,
      });
      if ("data" in result) {
        setRows((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
      }
    });
  };

  const [cambiandoPrivacidad, setCambiandoPrivacidad] = useState<string | null>(null);
  const esVistaChica = vista === "chica";

  /**
   * Ocultar/mostrar un movimiento. En la caja chica —que solo lista lo visible—
   * ocultar hace desaparecer la fila al instante; para reponerlo hay que ir a la
   * caja general. En la general la fila se queda y el ícono refleja el estado.
   * Emite `caja:sync` para que las demás sesiones se actualicen sin refrescar.
   */
  const togglePrivado = async (m: CajaMovimientoRow) => {
    const nuevo = esVistaChica ? true : !(m.privado ?? true);
    setCambiandoPrivacidad(m.id);
    const res = await setMovimientoPrivadoAction({ id: m.id, privado: nuevo });
    setCambiandoPrivacidad(null);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setRows((prev) =>
      esVistaChica
        ? prev.filter((r) => r.id !== m.id)
        : prev.map((r) => (r.id === m.id ? { ...r, privado: nuevo } : r)),
    );
    window.dispatchEvent(new CustomEvent("caja:sync"));
  };

  const colSpan = 7 + (mostrarColumnaCaja ? 1 : 0) + (puedeMarcarPrivado ? 1 : 0);
  const hayFiltros = !!desde || !!hasta || !!tipoFiltro || !!search;

  // Los pedazos que comparten la tabla (desktop) y las tarjetas (celular): el
  // mapeo de datos es uno solo, cambia nada más la presentación.
  const chipTipo = (m: CajaMovimientoRow) => (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        CATEGORIA_CHIP[m.categoria] ?? CHIP_NEUTRO
      }`}
    >
      {m.tipo_gasto_nombre ?? CATEGORIA_LABEL[m.categoria] ?? m.categoria}
    </span>
  );

  const chipCaja = (m: CajaMovimientoRow) => (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        m.caja === "grande" ? "bg-[#E1F5FE] text-[#004A99]" : "bg-muted text-muted-foreground"
      }`}
    >
      {m.caja === "grande" ? "General" : "Chica"}
    </span>
  );

  const botonPrivado = (m: CajaMovimientoRow, extra = "") => (
    <button
      type="button"
      onClick={() => togglePrivado(m)}
      disabled={cambiandoPrivacidad === m.id}
      aria-label={esVistaChica ? "Ocultar de la caja chica" : "Cambiar visibilidad"}
      title={
        esVistaChica
          ? "Ocultar de la caja chica. Queda solo en la caja general."
          : m.privado === true
            ? "Oculto en la caja chica. Tocá para mostrarlo."
            : m.privado === false
              ? "Visible en la caja chica. Tocá para ocultarlo."
              : "Se oculta si lo cargó dirección. Tocá para mostrarlo."
      }
      className={`inline-flex items-center justify-center gap-1 rounded text-xs transition-colors disabled:opacity-50 ${
        !esVistaChica && m.privado !== true
          ? "text-[#10B981] hover:bg-[#10B981]/10"
          : "text-muted-foreground hover:bg-muted"
      } ${extra}`}
    >
      {cambiandoPrivacidad === m.id ? (
        <Loader2 size={14} className="animate-spin" />
      ) : esVistaChica || m.privado === true ? (
        <EyeOff size={14} />
      ) : (
        <Eye size={14} />
      )}
    </button>
  );

  const monto = (m: CajaMovimientoRow) => {
    const esIngreso = m.tipo === "ingreso";
    return (
      <span
        className={`font-semibold tabular-nums ${
          esIngreso ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        <span className="mr-0.5 opacity-70">{esIngreso ? "+" : "−"}</span>$ {formatARS(m.monto)}
      </span>
    );
  };

  /** Mensaje único de carga / error / vacío, para no repetirlo en las dos vistas. */
  const estado = loading
    ? "Cargando movimientos..."
    : error
      ? error
      : rows.length === 0
        ? "Sin movimientos registrados"
        : null;

  const limpiarFiltros = () => {
    onRangeChange("", "");
    setTipoFiltro("");
    setSearch("");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <Wallet size={15} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            {caja === "grande"
              ? "Movimientos de Caja General"
              : caja === "todas"
                ? "Movimientos de todas las cajas"
                : "Movimientos de Caja Chica"}
          </h2>
        </div>

        {/* Abajo de sm los filtros viven detrás de este botón; desde sm son la
            barra de siempre y el botón no existe. */}
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
          {/* Desde–hasta se leen como un rango: van juntos en un mismo marco. */}
          {/* El marco crece a 44px abajo de md porque los campos que lleva
              adentro miden 40px de alto en táctil (max-md:h-10 del Input). */}
          <div className="flex h-11 w-full items-center rounded-lg border border-input bg-background px-1 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:w-auto md:h-9">
            <Input
              type="date"
              value={desde}
              min={minDate}
              onChange={(e) => onRangeChange(e.target.value, hasta)}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm focus-visible:ring-0 sm:w-auto sm:flex-none md:h-7"
              aria-label="Fecha desde"
            />
            <span className="shrink-0 text-muted-foreground/60">–</span>
            <Input
              type="date"
              value={hasta}
              min={minDate}
              onChange={(e) => onRangeChange(desde, e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm focus-visible:ring-0 sm:w-auto sm:flex-none md:h-7"
              aria-label="Fecha hasta"
            />
          </div>
          <Select
            value={tipoFiltro || "__all__"}
            onValueChange={(v) => setTipoFiltro(v === "__all__" ? "" : (v ?? ""))}
          >
            <SelectTrigger
              aria-label="Filtrar por tipo"
              className="h-10 w-full min-w-0 text-sm sm:h-9 sm:w-auto sm:min-w-[200px]"
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
            className="h-10 w-full text-sm sm:h-9 sm:w-44"
            aria-label="Buscar por concepto"
          />
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limpiarFiltros}
              className="text-muted-foreground hover:text-foreground h-10 w-full sm:h-9 sm:w-auto"
            >
              <X size={13} className="mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Las celdas del sistema vienen apretadas (p-2): acá se les da aire para
          que la lista se pueda barrer de un vistazo.
          Abajo de md la tabla desaparece: 9 columnas no entran en 343px y esta
          lista ES la pantalla, así que cada movimiento pasa a ser una tarjeta. */}
      <Table className="hidden md:table [&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            {[
              "Fecha",
              ...(mostrarColumnaCaja ? ["Caja"] : []),
              "Concepto",
              "Tipo",
              "Vinculado a",
              "Medio de pago",
              "Monto",
              "Usuario",
              ...(puedeMarcarPrivado ? [esVistaChica ? "Ocultar" : "Visible"] : []),
            ].map((col) => (
              <TableHead
                key={col}
                className={`h-9 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90 ${
                  col === "Monto" ? "text-right" : ""
                }`}
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground/70 text-sm">
                <Loader2 className="inline-block animate-spin mr-2" size={14} />
                Cargando movimientos...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-rose-600">
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Sin movimientos registrados" />
          ) : (
            rows.map((m) => (
              <TableRow key={m.id} className="border-border/60 hover:bg-muted/40">
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {formatFecha(m.fecha)}
                </TableCell>
                {mostrarColumnaCaja && <TableCell>{chipCaja(m)}</TableCell>}
                <TableCell className="text-sm font-medium text-foreground">{m.concepto}</TableCell>
                <TableCell>{chipTipo(m)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.vinculado_a ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {MEDIO_LABEL[m.medio] ?? m.medio}
                </TableCell>
                {/* El signo va aparte del número para que las columnas de
                    montos queden alineadas al leerlas de arriba a abajo. */}
                <TableCell className="text-right text-sm">{monto(m)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.usuario ?? "—"}</TableCell>
                {puedeMarcarPrivado && (
                  <TableCell>{botonPrivado(m, "px-1.5 py-1")}</TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Celular: la misma lista como tarjetas. Concepto y monto arriba —que es
          lo que se busca— y abajo el resto, sin perder ninguna acción. */}
      <div className="md:hidden">
        {estado ? (
          <p
            className={`px-4 py-8 text-center text-sm ${
              error ? "text-rose-600" : "text-muted-foreground/70"
            }`}
          >
            {loading && <Loader2 className="mr-2 inline-block animate-spin" size={14} />}
            {estado}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {m.concepto}
                  </p>
                  <span className="shrink-0 text-sm">{monto(m)}</span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatFecha(m.fecha)}
                  </span>
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {MEDIO_LABEL[m.medio] ?? m.medio}
                  </span>
                  {chipTipo(m)}
                  {mostrarColumnaCaja && chipCaja(m)}
                </div>

                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {m.vinculado_a ? `${m.vinculado_a} · ` : ""}
                    {m.usuario ?? "—"}
                  </p>
                  {puedeMarcarPrivado && botonPrivado(m, "size-9 shrink-0")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center border-t border-border bg-muted/20 py-3">
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
