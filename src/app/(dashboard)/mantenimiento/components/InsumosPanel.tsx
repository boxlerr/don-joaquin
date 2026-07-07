"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFecha } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  Package, Search, Pencil, Trash2, MoreHorizontal, DollarSign, Power, PowerOff,
  ChevronDown, ChevronUp, ChevronsUpDown, ListFilter, Loader2, X, CheckCircle2, Clock,
} from "lucide-react";
import AddInsumoDialog from "./AddInsumoDialog";
import { tipoRoturaLabel, TIPOS_ROTURA } from "./AddRoturaDialog";
import { updateInsumoPrecioAction, setInsumoEstadoAction, type InsumoRow } from "../actions";

function fmtMoneda(n: number | null): string {
  if (n == null) return "—";
  return `$ ${n.toLocaleString("es-AR")}`;
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return formatFecha(iso);
}
/** Normaliza para buscar sin importar acentos ni mayúsculas. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type SortKey = "nombre" | "categoria" | "marca" | "precio" | "fecha";
type SortDir = "asc" | "desc";

export default function InsumosPanel({
  insumos,
  canWrite,
  onEdit,
  onDelete,
  onToast,
}: {
  insumos: InsumoRow[];
  canWrite: boolean;
  onEdit: (i: InsumoRow) => void;
  onDelete: (i: InsumoRow) => void;
  onToast: (msg: string, tone?: "success" | "info" | "error") => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<string>("all");
  const [hideInactivos, setHideInactivos] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  // Precio rápido
  const [precioEdit, setPrecioEdit] = useState<InsumoRow | null>(null);
  const [precioVal, setPrecioVal] = useState("");
  const [savingPrecio, setSavingPrecio] = useState(false);
  const [precioError, setPrecioError] = useState<string | null>(null);

  // Estado (activar/desactivar) en curso, por id
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Categorías presentes en el catálogo (para el filtro).
  const categoriasPresentes = useMemo(() => {
    const set = new Set(insumos.map((i) => i.tipo));
    return TIPOS_ROTURA.filter((t) => t.value !== "otro" && set.has(t.value));
  }, [insumos]);

  const filtrados = useMemo(() => {
    let arr = insumos;
    if (hideInactivos) arr = arr.filter((i) => i.estado !== "inactivo");
    if (categoria !== "all") arr = arr.filter((i) => i.tipo === categoria);
    if (q.trim()) {
      const nq = norm(q.trim());
      arr = arr.filter((i) => norm(i.nombre).includes(nq) || (i.marca ? norm(i.marca).includes(nq) : false));
    }
    if (sort) {
      const factor = sort.dir === "asc" ? 1 : -1;
      arr = [...arr].sort((a, b) => {
        switch (sort.key) {
          case "precio": return (a.precio - b.precio) * factor;
          case "fecha": return String(a.precio_actualizado_en).localeCompare(String(b.precio_actualizado_en)) * factor;
          case "categoria": return tipoRoturaLabel(a.tipo).localeCompare(tipoRoturaLabel(b.tipo), "es") * factor;
          case "marca": return (a.marca ?? "").localeCompare(b.marca ?? "", "es") * factor;
          default: return a.nombre.localeCompare(b.nombre, "es") * factor;
        }
      });
    }
    return arr;
  }, [insumos, hideInactivos, categoria, q, sort]);

  // KPIs sobre TODO el catálogo (no el filtro).
  const kpis = useMemo(() => {
    const activos = insumos.filter((i) => i.estado === "activo");
    const conPrecio = activos.filter((i) => i.precio > 0);
    const promedio = conPrecio.length ? Math.round(conPrecio.reduce((s, i) => s + i.precio, 0) / conPrecio.length) : 0;
    const desactualizados = insumos.filter((i) => i.precio_desactualizado).length;
    const sinPrecio = activos.filter((i) => i.precio === 0).length;
    return { total: insumos.length, activos: activos.length, promedio, desactualizados, sinPrecio };
  }, [insumos]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // tercer click: vuelve al orden del servidor
    });
  };

  const abrirPrecio = (i: InsumoRow) => {
    setPrecioEdit(i);
    setPrecioVal(i.precio ? String(i.precio) : "");
    setPrecioError(null);
  };

  const guardarPrecio = async () => {
    if (!precioEdit) return;
    const val = parseFloat(precioVal);
    if (!Number.isFinite(val) || val < 0) { setPrecioError("Ingresá un precio válido."); return; }
    setSavingPrecio(true);
    setPrecioError(null);
    try {
      const res = await updateInsumoPrecioAction(precioEdit.id, val);
      if (res.error) { setPrecioError(res.error); return; }
      setPrecioEdit(null);
      router.refresh();
      onToast(`Precio de ${precioEdit.nombre} actualizado`);
    } catch {
      setPrecioError("Ocurrió un error inesperado.");
    } finally {
      setSavingPrecio(false);
    }
  };

  const toggleEstado = async (i: InsumoRow) => {
    const nuevo = i.estado === "inactivo" ? "activo" : "inactivo";
    setTogglingId(i.id);
    try {
      const res = await setInsumoEstadoAction(i.id, nuevo);
      if (res.error) { onToast(res.error, "error"); return; }
      router.refresh();
      onToast(nuevo === "activo" ? `${i.nombre} reactivado` : `${i.nombre} desactivado`);
    } catch {
      onToast("Ocurrió un error inesperado.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const SortHead = ({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) => {
    const active = sort?.key === sortKey;
    const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <TableHead className={`text-[11px] font-bold text-muted-foreground uppercase tracking-wider ${className ?? ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
        >
          {label}
          <Icon size={12} className={active ? "text-primary" : "text-muted-foreground/50"} />
        </button>
      </TableHead>
    );
  };

  const catLabel = categoria === "all" ? "Todas las categorías" : tipoRoturaLabel(categoria);
  const hayFiltro = q.trim() !== "" || categoria !== "all" || hideInactivos;

  return (
    <div className="space-y-4">
      {/* Aviso de precios desactualizados */}
      {kpis.desactualizados > 0 && (
        <div className="flex items-start gap-2 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <Clock size={16} className="mt-0.5 text-[#B45309] shrink-0" />
          <p className="text-sm text-[#92400E]">
            Hay <strong>{kpis.desactualizados}</strong> insumo{kpis.desactualizados !== 1 ? "s" : ""} con el
            precio sin actualizar hace tiempo. {canWrite ? "Usá «Actualizar precio» para refrescarlos" : "Pedí que revisen los precios"} y el costo por chofer queda confiable.
          </p>
        </div>
      )}

      {/* KPIs del catálogo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Insumos activos" value={String(kpis.activos)} sub={`de ${kpis.total} en total`} icon={Package} tone="brand" />
        <MiniStat label="Precio promedio" value={kpis.promedio ? `$ ${kpis.promedio.toLocaleString("es-AR")}` : "—"} sub="insumos con precio" icon={DollarSign} tone="emerald" />
        <MiniStat label="Precio desactualizado" value={String(kpis.desactualizados)} sub="a revisar" icon={Clock} tone={kpis.desactualizados > 0 ? "amber" : "muted"} />
        <MiniStat label="Sin precio cargado" value={String(kpis.sinPrecio)} sub="en $0" icon={DollarSign} tone={kpis.sinPrecio > 0 ? "rose" : "muted"} />
      </div>

      {/* Toolbar: buscar + filtros + agregar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o marca…"
            className="pl-8 h-9"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpiar búsqueda">
              <X size={14} />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <ListFilter size={14} /> {catLabel}
                <ChevronDown size={13} className="text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuLabel>Categoría</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCategoria("all")}>Todas las categorías</DropdownMenuItem>
            <DropdownMenuSeparator />
            {categoriasPresentes.map((t) => (
              <DropdownMenuItem key={t.value} onClick={() => setCategoria(t.value)}>{t.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => setHideInactivos((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
            hideInactivos
              ? "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
              : "border-primary/40 bg-primary/5 text-primary"
          }`}
          aria-pressed={!hideInactivos}
        >
          {hideInactivos ? <PowerOff size={14} /> : <Power size={14} />}
          {hideInactivos ? "Ocultando inactivos" : "Mostrando inactivos"}
        </button>

        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          <strong className="text-foreground">{filtrados.length}</strong> {filtrados.length === 1 ? "insumo" : "insumos"}
          {filtrados.length !== insumos.length && <span> de {insumos.length}</span>}
        </span>

        {canWrite && (
          <AddInsumoDialog>
            <Button variant="brand" size="sm" className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-1.5 shadow-sm">
              <Package size={14} strokeWidth={2.5} /> Agregar insumo
            </Button>
          </AddInsumoDialog>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        {filtrados.length === 0 ? (
          insumos.length === 0 ? (
            <EmptyState
              icon={Package}
              message={canWrite ? "Todavía no hay insumos. Agregá los más comunes (gomas, lámparas, espejos…) con el botón «Agregar insumo»." : "Todavía no hay insumos cargados en el catálogo."}
            />
          ) : (
            <div className="py-12 flex flex-col items-center gap-3">
              <EmptyState icon={Search} message="Ningún insumo coincide con la búsqueda o los filtros." />
              {hayFiltro && (
                <Button variant="outline" size="sm" onClick={() => { setQ(""); setCategoria("all"); setHideInactivos(false); }}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          )
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <SortHead label="Insumo" sortKey="nombre" className="pl-6" />
                <SortHead label="Categoría" sortKey="categoria" />
                <SortHead label="Marca" sortKey="marca" />
                <SortHead label="Precio" sortKey="precio" className="text-right" />
                <SortHead label="Actualizado" sortKey="fecha" />
                {canWrite && <TableHead className="text-right pr-6 w-24"><span className="sr-only">Acciones</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
                {filtrados.map((i) => (
                  <TableRow
                    key={i.id}
                    onClick={canWrite ? () => onEdit(i) : undefined}
                    className={`group ${canWrite ? "cursor-pointer" : ""} ${i.estado === "inactivo" ? "opacity-60" : ""}`}
                    title={canWrite ? "Editar insumo" : undefined}
                  >
                    <TableCell className="pl-6 font-medium">
                      {i.nombre}
                      {i.estado === "inactivo" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Inactivo
                        </span>
                      )}
                      {i.usos > 0 && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2 py-0.5 text-[10px] font-semibold" title={`Usado en ${i.usos} rotura(s)`}>
                          {i.usos} uso{i.usos !== 1 ? "s" : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tipoRoturaLabel(i.tipo)}</TableCell>
                    <TableCell className="text-muted-foreground">{i.marca ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium font-mono">
                      {i.precio > 0 ? fmtMoneda(i.precio) : <span className="text-muted-foreground/60 italic font-sans">sin precio</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {fmtFecha(i.precio_actualizado_en)}
                        {i.precio_desactualizado && (
                          <span className="inline-flex items-center rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                            Desactualizado
                          </span>
                        )}
                      </span>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => onEdit(i)}
                            className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            title="Editar insumo"
                            aria-label={`Editar ${i.nombre}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                  title="Más acciones"
                                  aria-label={`Más acciones para ${i.nombre}`}
                                >
                                  {togglingId === i.id ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={14} />}
                                </button>
                              }
                            />
                            <DropdownMenuContent align="end" className="min-w-[190px]">
                              <DropdownMenuItem onClick={() => abrirPrecio(i)}>
                                <DollarSign size={14} /> Actualizar precio
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEdit(i)}>
                                <Pencil size={14} /> Editar todo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleEstado(i)}>
                                {i.estado === "inactivo" ? <><Power size={14} /> Reactivar</> : <><PowerOff size={14} /> Desactivar</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => onDelete(i)}>
                                <Trash2 size={14} /> Borrar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal: actualizar precio rápido */}
      <Dialog open={!!precioEdit} onOpenChange={(v) => { if (!savingPrecio && !v) { setPrecioEdit(null); setPrecioError(null); } }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
                <DollarSign size={18} />
              </span>
              <div>
                <DialogTitle className="text-foreground text-base">Actualizar precio</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {precioEdit?.nombre}{precioEdit?.marca ? ` · ${precioEdit.marca}` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-3 space-y-3">
            {precioError && <InlineFeedback variant="error" message={precioError} onDismiss={() => setPrecioError(null)} autoHideMs={0} />}
            <div className="space-y-1.5">
              <Label htmlFor="precio-rapido" className="text-sm font-medium text-foreground">Precio $</Label>
              <Input
                id="precio-rapido"
                type="number"
                min="0"
                step="any"
                autoFocus
                value={precioVal}
                onChange={(e) => setPrecioVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarPrecio(); } }}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">Se guarda con la fecha de hoy y apaga el aviso de precio desactualizado.</p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setPrecioEdit(null)} disabled={savingPrecio} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button onClick={guardarPrecio} disabled={savingPrecio} variant="brand" className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-1.5">
              {savingPrecio ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><CheckCircle2 size={14} /> Guardar precio</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TONE_CLS: Record<string, { icon: string; box: string }> = {
  brand: { icon: "bg-primary/10 text-primary", box: "" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", box: "" },
  amber: { icon: "bg-amber-100 text-amber-700", box: "" },
  rose: { icon: "bg-rose-100 text-rose-700", box: "" },
  muted: { icon: "bg-muted text-muted-foreground", box: "" },
};
function MiniStat({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: typeof Package; tone: keyof typeof TONE_CLS }) {
  const c = TONE_CLS[tone] ?? TONE_CLS.muted;
  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm p-3.5 flex items-center gap-3">
      <span className={`size-9 rounded-lg inline-flex items-center justify-center shrink-0 ${c.icon}`}><Icon size={17} /></span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-black tracking-tight text-foreground leading-tight truncate">{value}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
    </div>
  );
}
