"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFecha } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Package, Search, Trash2, MoreHorizontal, DollarSign, Power, PowerOff,
  ChevronDown, ChevronUp, ChevronsUpDown, ListFilter, Loader2, X, Clock,
} from "lucide-react";
import AddInsumoDialog from "./AddInsumoDialog";
import { tipoRoturaLabel, TIPOS_ROTURA } from "./AddRoturaDialog";
import { updateInsumoAction, setInsumoEstadoAction, type InsumoRow } from "../actions";

const CATS = TIPOS_ROTURA.filter((t) => t.value !== "otro");
// Input de edición inline (celda de la tabla).
const cellInput = "w-full bg-card border border-primary/50 rounded-md px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25";

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
type Field = "nombre" | "marca" | "precio";

export default function InsumosPanel({
  insumos,
  canWrite,
  onDelete,
  onToast,
}: {
  insumos: InsumoRow[];
  canWrite: boolean;
  onDelete: (i: InsumoRow) => void;
  onToast: (msg: string, tone?: "success" | "info" | "error") => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<string>("all");
  const [hideInactivos, setHideInactivos] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  // Edición inline (celda por celda).
  const [editing, setEditing] = useState<{ id: string; field: Field } | null>(null);
  const [val, setVal] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const categoriasPresentes = useMemo(() => {
    const set = new Set(insumos.map((i) => i.tipo));
    return CATS.filter((t) => set.has(t.value));
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
      return null;
    });
  };

  // Guarda un cambio parcial del insumo (una celda). Reusa updateInsumoAction, que
  // refresca precio_actualizado_en cuando cambia el precio.
  const save = async (i: InsumoRow, patch: Partial<{ tipo: string; nombre: string; marca: string | null; precio: number; estado: string }>) => {
    setSavingId(i.id);
    try {
      const res = await updateInsumoAction(i.id, {
        tipo: patch.tipo ?? i.tipo,
        nombre: patch.nombre ?? i.nombre,
        marca: patch.marca !== undefined ? patch.marca : i.marca,
        precio: patch.precio !== undefined ? patch.precio : i.precio,
        estado: patch.estado ?? i.estado,
        observaciones: i.observaciones,
      });
      if (res.error) { onToast(res.error, "error"); return false; }
      router.refresh();
      return true;
    } catch {
      onToast("Ocurrió un error inesperado.", "error");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const startEdit = (i: InsumoRow, field: Field) => {
    setEditing({ id: i.id, field });
    setVal(field === "precio" ? (i.precio ? String(i.precio) : "") : field === "marca" ? (i.marca ?? "") : i.nombre);
  };

  const commitText = async (i: InsumoRow, field: Field) => {
    setEditing(null);
    const raw = val.trim();
    if (field === "nombre") {
      if (!raw || raw === i.nombre) return;
      await save(i, { nombre: raw });
    } else if (field === "marca") {
      const nueva = raw || null;
      if (nueva === (i.marca ?? null)) return;
      await save(i, { marca: nueva });
    } else {
      const p = raw ? parseFloat(raw) : 0;
      if (!Number.isFinite(p) || p < 0 || p === i.precio) return;
      await save(i, { precio: p });
    }
  };

  const toggleEstado = async (i: InsumoRow) => {
    const nuevo = i.estado === "inactivo" ? "activo" : "inactivo";
    setSavingId(i.id);
    try {
      const res = await setInsumoEstadoAction(i.id, nuevo);
      if (res.error) { onToast(res.error, "error"); return; }
      router.refresh();
      onToast(nuevo === "activo" ? `${i.nombre} reactivado` : `${i.nombre} desactivado`);
    } catch {
      onToast("Ocurrió un error inesperado.", "error");
    } finally {
      setSavingId(null);
    }
  };

  // Celda de texto editable al toque (nombre / marca / precio).
  const textCell = (i: InsumoRow, field: Field, display: React.ReactNode, opts?: { right?: boolean; numeric?: boolean }) => {
    if (!canWrite) return display;
    const isEditing = editing?.id === i.id && editing.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          type={opts?.numeric ? "number" : "text"}
          min={opts?.numeric ? "0" : undefined}
          step={opts?.numeric ? "any" : undefined}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => commitText(i, field)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            else if (e.key === "Escape") { setEditing(null); }
          }}
          className={`${cellInput} ${opts?.right ? "text-right font-mono" : ""}`}
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => startEdit(i, field)}
        className={`w-full ${opts?.right ? "text-right" : "text-left"} rounded px-2 py-1 -mx-2 hover:bg-primary/5 hover:ring-1 hover:ring-primary/20 transition-colors`}
        title="Tocá para editar"
      >
        {display}
      </button>
    );
  };

  const sortHead = (label: string, sortKey: SortKey, className?: string) => {
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
      {kpis.desactualizados > 0 && (
        <div className="flex items-start gap-2 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <Clock size={16} className="mt-0.5 text-[#B45309] shrink-0" />
          <p className="text-sm text-[#92400E]">
            Hay <strong>{kpis.desactualizados}</strong> insumo{kpis.desactualizados !== 1 ? "s" : ""} con el
            precio sin actualizar hace tiempo. {canWrite ? "Tocá la celda de precio para refrescarlo" : "Pedí que revisen los precios"} y el costo por chofer queda confiable.
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o marca…" className="pl-8 h-9" />
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

      {/* Tabla editable al toque */}
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
                {sortHead("Insumo", "nombre", "pl-6")}
                {sortHead("Categoría", "categoria")}
                {sortHead("Marca", "marca")}
                {sortHead("Precio", "precio", "text-right")}
                {sortHead("Actualizado", "fecha")}
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estado</TableHead>
                {canWrite && <TableHead className="text-right pr-6 w-12"><span className="sr-only">Acciones</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((i) => (
                <TableRow key={i.id} className={i.estado === "inactivo" ? "opacity-60" : undefined}>
                  <TableCell className="pl-6 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">{textCell(i, "nombre", i.nombre)}</span>
                      {i.usos > 0 && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] px-2 py-0.5 text-[10px] font-semibold" title={`Usado en ${i.usos} rotura(s)`}>
                          {i.usos} uso{i.usos !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {canWrite ? (
                      <Select value={i.tipo} onValueChange={(v) => { if (v && v !== i.tipo) save(i, { tipo: v }); }}>
                        <SelectTrigger className="h-8 w-full max-w-[190px] border-transparent bg-transparent shadow-none hover:bg-primary/5 hover:border-border px-2 -mx-2">
                          <span>{tipoRoturaLabel(i.tipo)}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {CATS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : tipoRoturaLabel(i.tipo)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {textCell(i, "marca", i.marca ?? <span className="text-muted-foreground/50">—</span>)}
                  </TableCell>
                  <TableCell className="text-right font-medium font-mono">
                    {textCell(i, "precio", i.precio > 0 ? fmtMoneda(i.precio) : <span className="text-muted-foreground/60 italic font-sans">sin precio</span>, { right: true, numeric: true })}
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
                  <TableCell>
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => toggleEstado(i)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border transition-colors ${
                          i.estado === "inactivo"
                            ? "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100"
                        }`}
                        title={i.estado === "inactivo" ? "Reactivar insumo" : "Desactivar insumo"}
                      >
                        {i.estado === "inactivo" ? "Inactivo" : "Activo"}
                      </button>
                    ) : (
                      <span className={`text-[11px] font-semibold ${i.estado === "inactivo" ? "text-muted-foreground" : "text-emerald-700"}`}>
                        {i.estado === "inactivo" ? "Inactivo" : "Activo"}
                      </span>
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {savingId === i.id && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Más acciones" aria-label={`Más acciones para ${i.nombre}`}>
                                <MoreHorizontal size={14} />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end" className="min-w-[180px]">
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

      {canWrite && filtrados.length > 0 && (
        <p className="text-[11px] text-muted-foreground px-1">
          Tocá cualquier celda (nombre, categoría, marca o precio) para editarla al toque. Enter guarda, Esc cancela.
        </p>
      )}
    </div>
  );
}

const TONE_CLS: Record<string, { icon: string }> = {
  brand: { icon: "bg-primary/10 text-primary" },
  emerald: { icon: "bg-emerald-100 text-emerald-700" },
  amber: { icon: "bg-amber-100 text-amber-700" },
  rose: { icon: "bg-rose-100 text-rose-700" },
  muted: { icon: "bg-muted text-muted-foreground" },
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
