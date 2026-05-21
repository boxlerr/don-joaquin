"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
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
import {
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Truck,
  User,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getViajesAction, deleteViajeAction, updateViajeEstadoAction } from "../actions";
import type { ViajeBasico } from "../types";
import HelpTutorialButton from "../help-tutorial-button";
import AuditTrailDrawer from "./audit-trail-drawer";
import ViajeGastosPanel from "./ViajeGastosPanel";
import CerrarViajeDialog from "./CerrarViajeDialog";
import EditViajeDialog from "./EditViajeDialog";

interface Props {
  choferId?: string;
}

const ESTADO_TONE: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  cerrado: "success",
  en_curso: "info",
  pendiente: "warning",
  cancelado: "error",
};

const COLUMNS = [
  "Fecha",
  "Cliente",
  "Origen",
  "Destino",
  "KM",
  "Toneladas",
  "Estado",
  "Facturado",
  "",
];

export default function ViajesTable({ choferId }: Props) {
  const router = useRouter();

  const [rows, setRows] = useState<ViajeBasico[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [auditTrailViajeId, setAuditTrailViajeId] = useState<string | null>(null);
  const [cerrandoViaje, setCerrandoViaje] = useState<ViajeBasico | null>(null);
  const [editingViaje, setEditingViaje] = useState<ViajeBasico | null>(null);
  const [confirmEditViaje, setConfirmEditViaje] = useState<ViajeBasico | null>(null);

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
        <HelpTutorialButton />
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
              <React.Fragment key={v.id}>
                <TableRow
                  className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  tabIndex={0}
                  onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setExpandedId(expandedId === v.id ? null : v.id);
                  }}
                >
                  <TableCell className="text-sm text-[#475569]">
                    {new Date(v.fecha_viaje).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-[#0F172A]">
                    {v.cliente ?? "—"}
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
                  <TableCell className="text-sm text-[#475569] font-mono">
                    {v.toneladas ?? 0} tn
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
                      aria-label="Expandir detalles"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === v.id ? null : v.id);
                      }}
                    >
                      {expandedId === v.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Sub-fila Desplegable de Detalles */}
                {expandedId === v.id && (
                  <TableRow className="bg-[#F8FAFC]/60 hover:bg-[#F8FAFC]/60">
                    <TableCell colSpan={COLUMNS.length} className="p-0 border-b border-[#E2E8F0]">
                      <div className="p-6 grid grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
                        {/* Detalles Operativos */}
                        <div className="space-y-3 bg-white p-4 rounded-lg border border-[#E2E8F0]/80 shadow-2xs">
                          <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2">
                            <User size={14} className="text-[#0088D1]" /> Chofer Asignado
                          </h4>
                          <p className="text-sm font-medium text-[#334155]">{v.chofer ?? "—"}</p>

                          <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2 pt-2">
                            <Truck size={14} className="text-[#0088D1]" /> Vehículo / Patente
                          </h4>
                          <p className="text-sm font-medium text-[#334155]">{v.camion ?? "—"}</p>
                        </div>

                        {/* Finanzas y Distancias Parciales */}
                        <div className="space-y-3 bg-white p-4 rounded-lg border border-[#E2E8F0]/80 shadow-2xs">
                          <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2">
                            <Coins size={14} className="text-[#10B981]" /> Flete y Distancias
                          </h4>
                          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                            <span className="text-[#64748B]">Monto Flete:</span>
                            <span className="font-semibold text-[#0F172A] text-right">
                              {v.monto_flete ? `$ ${v.monto_flete.toLocaleString("es-AR")}` : "—"}
                            </span>
                            <span className="text-[#64748B]">KM con Carga:</span>
                            <span className="font-mono text-[#334155] text-right">{v.km_con_carga ?? 0} km</span>
                            <span className="text-[#64748B]">KM Vacíos:</span>
                            <span className="font-mono text-[#334155] text-right">{v.km_vacios ?? 0} km</span>
                          </div>
                        </div>

                        {/* Notas y Acciones Operativas */}
                        <div className="space-y-3 flex flex-col justify-between bg-white p-4 rounded-lg border border-[#E2E8F0]/80 shadow-2xs">
                          <div>
                            <h4 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2">
                              <FileText size={14} className="text-[#F59E0B]" /> Notas / Descripción
                            </h4>
                            <p className="text-xs text-[#475569] pt-1.5 italic line-clamp-3">
                              {v.observaciones
                                ? v.observaciones
                                    .split("|")
                                    .filter((p) => !p.includes("Origen:") && !p.includes("Destino:"))
                                    .join(" | ")
                                    .trim() || "Sin notas adicionales"
                                : "Sin notas adicionales"}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5">
                            {v.facturado ? (
                              <>
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                                  <span className="text-[11px] font-semibold text-amber-700">
                                    Viaje facturado — ya impactó en caja
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-7 px-2 text-[#0088D1] hover:text-[#0277BD] hover:bg-[#E1F5FE] text-[11px] gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAuditTrailViajeId(v.id);
                                      setAuditTrailOpen(true);
                                    }}
                                  >
                                    <Clock size={12} /> Historial
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-7 px-2 text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 text-[11px] gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmEditViaje(v);
                                    }}
                                  >
                                    <Pencil size={12} /> Editar
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                                  Cambiar Estado Operativo:
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {["pendiente", "en_curso", "cerrado"].map((st) => {
                                    const isCurrent = v.estado === st;
                                    const isUpd = updatingId === `${v.id}-${st}`;
                                    const labels: Record<string, string> = {
                                      pendiente: "Pendiente",
                                      en_curso: "En Curso",
                                      cerrado: "Cerrado",
                                    };
                                    return (
                                      <Button
                                        key={st}
                                        variant={isCurrent ? "default" : "outline"}
                                        size="xs"
                                        disabled={isCurrent || isUpd || updatingId !== null}
                                        className={`text-[11px] h-7 px-2.5 ${isCurrent ? "bg-[#0F172A]" : ""}`}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (st === "cerrado") {
                                            setCerrandoViaje(v);
                                            return;
                                          }
                                          setUpdatingId(`${v.id}-${st}`);
                                          const res = await updateViajeEstadoAction(v.id, st);
                                          setUpdatingId(null);
                                          if (res && res.ok) {
                                            setRows((prev) =>
                                              prev.map((item) => (item.id === v.id ? { ...item, estado: st } : item))
                                            );
                                          }
                                        }}
                                      >
                                        {isUpd && <Loader2 size={10} className="animate-spin mr-1" />}
                                        {labels[st]}
                                      </Button>
                                    );
                                  })}
                                </div>

                                {v.estado === "cerrado" && !v.facturado && (
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    className="h-7 px-2.5 text-[11px] gap-1 text-green-700 border-green-300 hover:bg-green-50 w-full mt-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCerrandoViaje(v);
                                    }}
                                  >
                                    <Coins size={12} /> Registrar cobro
                                  </Button>
                                )}

                                <div className="pt-2 flex justify-between items-center">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-[#0088D1] hover:text-[#0277BD] hover:bg-[#E1F5FE] text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAuditTrailViajeId(v.id);
                                        setAuditTrailOpen(true);
                                      }}
                                    >
                                      <Clock size={12} /> Historial
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (v.facturado) {
                                          setConfirmEditViaje(v);
                                        } else {
                                          setEditingViaje(v);
                                        }
                                      }}
                                    >
                                      <Pencil size={12} /> Editar
                                    </Button>
                                  </div>
                                  {deletingId === v.id ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-red-600 font-medium">¿Confirmar?</span>
                                      <Button
                                        variant="destructive"
                                        size="xs"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const res = await deleteViajeAction(v.id);
                                          if (res && res.ok) {
                                            setRows((prev) => prev.filter((item) => item.id !== v.id));
                                            setExpandedId(null);
                                          }
                                          setDeletingId(null);
                                        }}
                                      >
                                        Sí, borrar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="xs"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingId(null);
                                        }}
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(v.id);
                                      }}
                                    >
                                      <Trash2 size={12} /> Eliminar Viaje
                                    </Button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <ViajeGastosPanel viajeId={v.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
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

      {/* Dialog cerrar viaje */}
      {cerrandoViaje && (
        <CerrarViajeDialog
          viaje={cerrandoViaje}
          open={!!cerrandoViaje}
          onOpenChange={(v) => { if (!v) setCerrandoViaje(null); }}
          onSuccess={(cobrado) => {
            setRows((prev) =>
              prev.map((item) =>
                item.id === cerrandoViaje.id ? { ...item, estado: "cerrado", facturado: cobrado } : item
              )
            );
            setCerrandoViaje(null);
          }}
        />
      )}

      {/* Confirm edit facturado */}
      {confirmEditViaje && (
        <Dialog open={!!confirmEditViaje} onOpenChange={(v) => { if (!v) setConfirmEditViaje(null); }}>
          <DialogContent className="sm:max-w-[420px] p-6 gap-0">
            <DialogHeader className="border-b border-[#E2E8F0] pb-4 -mx-6 px-6 pt-1">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-11 rounded-full bg-amber-100 text-amber-600 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <DialogTitle className="text-[#0F172A] text-base font-bold">
                    Viaje facturado
                  </DialogTitle>
                  <DialogDescription className="text-[#64748B] text-xs mt-0.5">
                    {confirmEditViaje.codigo} · {confirmEditViaje.cliente}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-4 space-y-2">
              <p className="text-sm text-[#0F172A] font-medium">
                Este viaje ya está facturado y su cobro impactó en la caja.
              </p>
              <p className="text-sm text-[#475569]">
                Podés editar los datos del viaje, pero si cambiás el monto de flete el movimiento en caja <span className="font-semibold text-amber-700">no se actualiza automáticamente</span>. Tendrás que ajustarlo desde la sección Caja.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 -mx-6 px-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmEditViaje(null)}
                className="h-9 px-5 text-sm border-[#E2E8F0] text-[#475569]"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-9 px-5 text-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                onClick={() => {
                  setEditingViaje(confirmEditViaje);
                  setConfirmEditViaje(null);
                }}
              >
                Entendido, editar igual
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Viaje Dialog */}
      {editingViaje && (
        <EditViajeDialog
          viaje={editingViaje}
          open={!!editingViaje}
          onOpenChange={(v) => { if (!v) setEditingViaje(null); }}
          onSuccess={(patch) => {
            setRows((prev) =>
              prev.map((item) =>
                item.id === editingViaje.id ? { ...item, ...patch } : item
              )
            );
            setEditingViaje(null);
          }}
        />
      )}

      {/* Audit Trail Drawer */}
      {auditTrailViajeId && (
        <AuditTrailDrawer
          viajeId={auditTrailViajeId}
          open={auditTrailOpen}
          onOpenChange={setAuditTrailOpen}
        />
      )}
    </div>
  );
}
