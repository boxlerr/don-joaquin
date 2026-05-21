"use client";

import React, { useState } from "react";
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
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  User,
  Truck,
  Coins,
  FileText,
} from "lucide-react";
import { updateViajeEstadoAction, deleteViajeAction } from "@/app/(dashboard)/viajes/actions";
import type { ViajeBasico } from "@/app/(dashboard)/viajes/types";

interface Props {
  initialViajes: ViajeBasico[];
}

export default function RecentViajesTable({ initialViajes }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ViajeBasico[]>(initialViajes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpdateEstado = async (id: string, nuevoEstado: string) => {
    setUpdatingId(`${id}-${nuevoEstado}`);
    const res = await updateViajeEstadoAction(id, nuevoEstado);
    setUpdatingId(null);
    if (res && res.ok) {
      setRows((prev) =>
        prev.map((item) => (item.id === id ? { ...item, estado: nuevoEstado } : item))
      );
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteViajeAction(id);
    if (res && res.ok) {
      setRows((prev) => prev.filter((item) => item.id !== id));
      setExpandedId(null);
      router.refresh();
    }
    setDeletingId(null);
  };

  return (
    <Table>
      <TableHeader className="bg-slate-50/50">
        <TableRow className="border-b border-[#E2E8F0]">
          {["Origen → Destino", "Cliente", "Chofer", "Estado", "Facturación", ""].map(
            (col) => (
              <TableHead
                key={col}
                className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider h-9 px-3"
              >
                {col}
              </TableHead>
            ),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <span className="text-slate-800 text-sm font-bold tracking-tight">Sin viajes registrados</span>
                <span className="text-slate-400 text-xs font-medium mt-1">Los viajes que registres aparecerán aquí</span>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          rows.map((v) => {
            const isExpanded = expandedId === v.id;
            return (
              <React.Fragment key={v.id}>
                <TableRow
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className={`hover:bg-slate-50/30 transition-colors border-b border-[#E2E8F0] last:border-0 cursor-pointer ${
                    isExpanded ? "bg-slate-50/30" : ""
                  }`}
                >
                  <TableCell className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[#0F172A]">
                        {v.origen || "—"} → {v.destino || "—"}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] mt-0.5">
                        {new Date(v.fecha_viaje).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[#334155] font-semibold py-3 px-3">
                    {v.cliente}
                  </TableCell>
                  <TableCell className="text-xs text-[#475569] py-3 px-3">
                    {v.chofer}
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <StatusBadge
                      label={v.estado.replace("_", " ")}
                      tone={
                        v.estado === "cerrado"
                          ? "success"
                          : v.estado === "en_curso"
                          ? "info"
                          : v.estado === "pendiente"
                          ? "warning"
                          : "neutral"
                      }
                    />
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-slate-500 py-3 px-3">
                    {v.facturado ? (
                      <span className="text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#A7F3D0]/50 uppercase">Sí</span>
                    ) : (
                      <span className="text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200/50 uppercase">No</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-right w-10">
                    <Button variant="ghost" size="icon" className="w-6 h-6 p-0 hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="bg-[#F8FAFC]/40 hover:bg-[#F8FAFC]/40">
                    <TableCell colSpan={6} className="p-0 border-b border-[#E2E8F0]">
                      <div className="p-5 grid grid-cols-3 gap-5 animate-in fade-in-50 duration-200">
                        {/* Detalles Operativos */}
                        <div className="space-y-3 bg-white p-3.5 rounded-[8px] border border-[#E2E8F0] shadow-sm">
                          <div>
                            <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-1.5 mb-1.5">
                              <User size={13} className="text-[#0088D1]" /> Chofer Asignado
                            </h4>
                            <p className="text-xs font-semibold text-[#334155]">{v.chofer ?? "—"}</p>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-1.5 mb-1.5">
                              <Truck size={13} className="text-[#0088D1]" /> Vehículo / Patente
                            </h4>
                            <p className="text-xs font-semibold text-[#334155]">{v.camion ?? "—"}</p>
                          </div>
                        </div>

                        {/* Finanzas y KMs */}
                        <div className="space-y-3 bg-white p-3.5 rounded-[8px] border border-[#E2E8F0] shadow-sm text-xs">
                          <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-1.5 mb-1.5">
                            <Coins size={13} className="text-[#10B981]" /> Detalles Financieros
                          </h4>
                          <div className="grid grid-cols-2 gap-1.5">
                            <span className="text-[#64748B] text-[11px]">Monto Flete:</span>
                            <span className="font-bold text-[#0F172A] text-right">
                              {v.monto_flete ? `$ ${v.monto_flete.toLocaleString("es-AR")}` : "—"}
                            </span>
                            <span className="text-[#64748B] text-[11px]">KM con Carga:</span>
                            <span className="font-mono text-[#334155] text-right">{v.km_con_carga ?? 0} km</span>
                            <span className="text-[#64748B] text-[11px]">KM Vacíos:</span>
                            <span className="font-mono text-[#334155] text-right">{v.km_vacios ?? 0} km</span>
                          </div>
                        </div>

                        {/* Notas y Acciones de Estado */}
                        <div className="space-y-3 bg-white p-3.5 rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                          <div>
                            <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-1.5 mb-1.5">
                              <FileText size={13} className="text-[#F59E0B]" /> Notas de Viaje
                            </h4>
                            <p className="text-[11px] text-[#475569] italic line-clamp-2 leading-relaxed">
                              {v.observaciones
                                ? v.observaciones
                                    .split("|")
                                    .filter((p) => !p.includes("Origen:") && !p.includes("Destino:"))
                                    .join(" | ")
                                    .trim() || "Sin notas adicionales"
                                : "Sin notas adicionales"}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                            <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">
                              Cambiar Estado Operativo:
                            </span>
                            <div className="flex items-center gap-1">
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
                                    className={`text-[10px] h-6 px-2 font-semibold ${isCurrent ? "bg-[#0F172A] hover:bg-[#0F172A] text-white" : "border-[#E2E8F0]"}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateEstado(v.id, st);
                                    }}
                                  >
                                    {isUpd && <Loader2 size={10} className="animate-spin mr-1" />}
                                    {labels[st]}
                                  </Button>
                                );
                              })}
                            </div>

                            <div className="pt-1 text-right">
                              {deletingId === v.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-[10px] text-red-600 font-bold">¿Confirmar?</span>
                                  <Button
                                    variant="destructive"
                                    size="xs"
                                    className="h-5 px-1.5 text-[9px] font-bold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(v.id);
                                    }}
                                  >
                                    Sí, borrar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    className="h-5 px-1.5 text-[9px] border-[#E2E8F0]"
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
                                  className="h-6 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 text-[10px] gap-1 font-semibold"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(v.id);
                                  }}
                                >
                                  <Trash2 size={11} /> Eliminar
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
