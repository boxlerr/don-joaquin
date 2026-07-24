"use client";

import React, { useState } from "react";
import { formatFecha } from "@/lib/utils";
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
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  User,
  Truck,
  Coins,
  FileText,
} from "lucide-react";
import { deleteViajeAction } from "@/app/(dashboard)/viajes/actions";
import type { ViajeBasico } from "@/app/(dashboard)/viajes/types";

interface Props {
  initialViajes: ViajeBasico[];
  /**
   * Mostrar el monto de flete en el detalle expandido. Default false: en el
   * dashboard general no van montos (solo dirección los ve en /dashboard/completo).
   * El "Sí/No" de facturado queda siempre — es un estado, no un importe.
   */
  mostrarFacturacion?: boolean;
}

export default function RecentViajesTable({ initialViajes, mostrarFacturacion = false }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ViajeBasico[]>(initialViajes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      <TableHeader className="bg-muted/40">
        <TableRow className="border-b border-border">
          {["Origen → Destino", "Cliente", "Chofer", "Facturación", ""].map(
            (col) => (
              <TableHead
                key={col}
                className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider h-9 px-3"
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
            <TableCell colSpan={5} className="py-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <span className="text-foreground text-sm font-bold tracking-tight">Sin viajes registrados</span>
                <span className="text-muted-foreground/70 text-xs font-medium mt-1">Los viajes que registres aparecerán aquí</span>
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
                  className={`hover:bg-muted/30 transition-colors border-b border-border last:border-0 cursor-pointer ${
                    isExpanded ? "bg-muted/30" : ""
                  }`}
                >
                  <TableCell className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">
                        {v.origen || "—"} → {v.destino || "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {formatFecha(v.fecha_viaje)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-foreground/90 font-semibold py-3 px-3">
                    {v.cliente}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3 px-3">
                    {v.chofer}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-muted-foreground py-3 px-3">
                    {v.facturado ? (
                      <span className="text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#A7F3D0]/50 uppercase">Sí</span>
                    ) : (
                      <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded-full text-[10px] font-bold border border-border uppercase">No</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-right w-10">
                    <Button variant="ghost" size="icon" className="w-6 h-6 p-0 hover:bg-muted text-muted-foreground/70 hover:text-foreground">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={5} className="p-0 border-b border-border">
                      <div className="p-5 grid grid-cols-3 gap-5 animate-in fade-in-50 duration-200">
                        {/* Detalles Operativos */}
                        <div className="space-y-3 bg-card p-3.5 rounded-[8px] border border-border shadow-sm">
                          <div>
                            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5 mb-1.5">
                              <User size={13} className="text-primary" /> Chofer Asignado
                            </h4>
                            <p className="text-xs font-semibold text-foreground/90">{v.chofer ?? "—"}</p>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5 mb-1.5">
                              <Truck size={13} className="text-primary" /> Vehículo / Patente
                            </h4>
                            <p className="text-xs font-semibold text-foreground/90">{v.camion ?? "—"}</p>
                          </div>
                        </div>

                        {/* Finanzas y KMs */}
                        <div className="space-y-3 bg-card p-3.5 rounded-[8px] border border-border shadow-sm text-xs">
                          <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5 mb-1.5">
                            <Coins size={13} className="text-[#10B981]" /> Detalles Financieros
                          </h4>
                          <div className="grid grid-cols-2 gap-1.5">
                            {mostrarFacturacion && (
                              <>
                                <span className="text-muted-foreground text-[11px]">Monto Flete:</span>
                                <span className="font-bold text-foreground text-right">
                                  {v.monto_flete ? `$ ${v.monto_flete.toLocaleString("es-AR")}` : "—"}
                                </span>
                              </>
                            )}
                            <span className="text-muted-foreground text-[11px]">KM con Carga:</span>
                            <span className="font-mono text-foreground/90 text-right">{v.km_con_carga ?? 0} km</span>
                            <span className="text-muted-foreground text-[11px]">KM Vacíos:</span>
                            <span className="font-mono text-foreground/90 text-right">{v.km_vacios ?? 0} km</span>
                          </div>
                        </div>

                        {/* Notas y Acciones de Estado */}
                        <div className="space-y-3 bg-card p-3.5 rounded-[8px] border border-border shadow-sm flex flex-col justify-between">
                          <div>
                            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5 mb-1.5">
                              <FileText size={13} className="text-[#F59E0B]" /> Notas de Viaje
                            </h4>
                            <p className="text-[11px] text-muted-foreground italic line-clamp-2 leading-relaxed">
                              {v.observaciones
                                ? v.observaciones
                                    .split("|")
                                    .filter((p) => !p.includes("Origen:") && !p.includes("Destino:"))
                                    .join(" | ")
                                    .trim() || "Sin notas adicionales"
                                : "Sin notas adicionales"}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-border space-y-2">
                            <div className="pt-1 text-right">
                              {deletingId === v.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-[10px] text-destructive font-bold">¿Confirmar?</span>
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
                                    className="h-5 px-1.5 text-[9px]"
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
                                  className="h-6 px-1.5 text-destructive hover:text-destructive/80 hover:bg-destructive/10 text-[10px] gap-1 font-semibold"
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
