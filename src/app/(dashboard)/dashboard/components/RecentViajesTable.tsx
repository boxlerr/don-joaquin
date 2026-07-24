"use client";

// Últimos viajes del dashboard como lista de dos líneas (ruta + contexto), sin
// tabla de columnas: los nombres largos de origen/destino cortaban la vista al
// convivir con el panel de alertas. El desplegado usa el lenguaje "Ruta" del
// detalle de /viajes (ruta dibujada, avatar del chofer, chapa de patente) en
// versión compacta de solo lectura, con acceso directo al módulo Viajes.

import React, { useState } from "react";
import { formatFecha } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Trash2,
  Truck,
  MapPin,
  CheckCircle2,
  Package,
  ArrowRight,
} from "lucide-react";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import { deleteViajeAction } from "@/app/(dashboard)/viajes/actions";
import type { ViajeBasico } from "@/app/(dashboard)/viajes/types";

interface Props {
  initialViajes: ViajeBasico[];
  /**
   * Mostrar el monto de flete en el detalle expandido. Default false: en el
   * dashboard general no van montos (solo dirección los ve en /dashboard/completo).
   * El estado de facturación queda siempre — es un estado, no un importe.
   */
  mostrarFacturacion?: boolean;
}

/** Solo el texto libre de observaciones (sin los segmentos legados Origen/Destino). */
function notasDe(observaciones: string | null): string {
  if (!observaciones) return "";
  return observaciones
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && !/^(Origen|Destino):/i.test(p))
    .join(" | ");
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

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center flex flex-col items-center justify-center">
        <span className="text-foreground text-sm font-bold tracking-tight">Sin viajes registrados</span>
        <span className="text-muted-foreground/70 text-xs font-medium mt-1">
          Los viajes que registres aparecerán aquí
        </span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/70">
      {rows.map((v) => {
        const isExpanded = expandedId === v.id;
        // v.camion viene como "PATENTE - Marca - Modelo".
        const camionParts = v.camion && v.camion !== "—" ? v.camion.split(" - ") : [];
        const patente = camionParts[0]?.trim() || null;
        const marcaModelo = camionParts.slice(1).join(" ").trim();
        const kmTotal = (v.km_con_carga ?? 0) + (v.km_vacios ?? 0);
        const roadColor = v.es_vacio ? "#C00000" : "#0088D1";
        const notas = notasDe(v.observaciones);
        return (
          <div key={v.id}>
            {/* Fila: ruta arriba, contexto abajo — nunca se corta a lo ancho */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : v.id)}
              className={`w-full text-left px-4 sm:px-5 py-2.5 flex items-center gap-3 transition-colors cursor-pointer hover:bg-muted/40 ${
                isExpanded ? "bg-muted/30" : ""
              }`}
              aria-expanded={isExpanded}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="size-1.5 rounded-full bg-[#10B981] shrink-0" aria-hidden />
                  <span className="text-[12.5px] font-bold text-foreground truncate" title={v.origen ?? undefined}>
                    {v.origen || "—"}
                  </span>
                  <ArrowRight size={11} className="text-muted-foreground/50 shrink-0" aria-hidden />
                  <MapPin
                    size={11}
                    className={`shrink-0 ${v.destino ? "text-[#C00000]" : "text-muted-foreground/40"}`}
                    aria-hidden
                  />
                  <span
                    className={`text-[12.5px] font-bold truncate ${v.destino ? "text-foreground" : "text-muted-foreground/50 italic"}`}
                    title={v.destino ?? undefined}
                  >
                    {v.destino || "A definir"}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  {formatFecha(v.fecha_viaje)}
                  {v.cliente && <> · <span className="font-semibold text-foreground/75">{v.cliente}</span></>}
                  {v.chofer && <> · {v.chofer}</>}
                </div>
              </div>

              {v.es_vacio ? (
                <span className="shrink-0 rounded-full bg-[#C00000]/10 text-[#C00000] px-2 py-0.5 text-[10px] font-bold">
                  VACÍO
                </span>
              ) : v.facturado ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 px-2 py-0.5 text-[10px] font-bold">
                  <CheckCircle2 size={10} /> Facturado
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Sin remito
                </span>
              )}
              <ChevronDown
                size={14}
                className={`shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>

            {/* Detalle compacto — mismo lenguaje "Ruta" que /viajes */}
            {isExpanded && (
              <div className="px-4 sm:px-5 pb-3.5 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                  {/* La ruta, dibujada */}
                  <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
                    <div className="flex items-center gap-2 min-w-0 max-w-[34%]">
                      <span className="size-2 rounded-full bg-[#10B981] ring-4 ring-[#10B981]/15 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
                          Origen
                        </div>
                        <div
                          className={`text-xs font-bold truncate ${v.origen ? "text-foreground" : "text-muted-foreground/50 italic"}`}
                          title={v.origen ?? undefined}
                        >
                          {v.origen ?? "A definir"}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-[48px]">
                      <div className="relative h-7" aria-hidden>
                        <span
                          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] opacity-45"
                          style={{
                            color: roadColor,
                            backgroundImage:
                              "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 14px)",
                          }}
                        />
                        <span
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-0.5 shadow-2xs"
                          style={{ color: roadColor }}
                        >
                          <Truck size={12} strokeWidth={2.2} />
                          {kmTotal > 0 && (
                            <span className="font-mono text-[9.5px] font-bold text-foreground/75 whitespace-nowrap">
                              {kmTotal.toLocaleString("es-AR")} km
                            </span>
                          )}
                        </span>
                      </div>
                      {v.material && (
                        <div
                          className="text-center text-[10.5px] font-bold text-foreground/85 truncate px-2 -mt-0.5"
                          title={`Carga: ${v.material}`}
                        >
                          <Package size={10} className="inline-block mr-1 -mt-px text-muted-foreground" />
                          {v.material}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 min-w-0 max-w-[34%]">
                      <MapPin
                        size={14}
                        className={`shrink-0 ${v.destino ? "text-[#C00000]" : "text-muted-foreground/40"}`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
                          Destino
                        </div>
                        <div
                          className={`text-xs font-bold truncate ${v.destino ? "text-foreground" : "text-muted-foreground/50 italic"}`}
                          title={v.destino ?? undefined}
                        >
                          {v.destino ?? "A definir"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chofer · camión · kms · flete */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3.5 pb-3">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      {v.chofer ? (
                        <>
                          <InitialsAvatar name={v.chofer} size={22} />
                          <span className="text-[11.5px] font-bold text-foreground truncate max-w-[180px]" title={v.chofer}>
                            {v.chofer}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11.5px] italic text-muted-foreground/60">Sin chofer asignado</span>
                      )}
                    </span>

                    {patente && (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span
                          className="shrink-0 overflow-hidden rounded-[4px] border-[1.5px] border-foreground/45 bg-background"
                          title={`Patente ${patente}`}
                        >
                          <span className="block h-[2px] bg-[#1D4ED8]" aria-hidden />
                          <span className="block px-1 pt-px pb-0.5 font-mono text-[9.5px] font-black tracking-[0.08em] leading-none text-foreground">
                            {patente}
                          </span>
                        </span>
                        {marcaModelo && (
                          <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-[150px]" title={marcaModelo}>
                            {marcaModelo}
                          </span>
                        )}
                      </span>
                    )}

                    <span className="text-[11px] text-muted-foreground font-mono">
                      <span className="font-bold text-foreground/80">{(v.km_con_carga ?? 0).toLocaleString("es-AR")}</span> km carga
                      {" · "}
                      <span className={`font-bold ${v.km_vacios ? "text-[#C00000]" : "text-foreground/80"}`}>
                        {(v.km_vacios ?? 0).toLocaleString("es-AR")}
                      </span>{" "}
                      km vacíos
                    </span>

                    {mostrarFacturacion && !v.es_vacio && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                          v.monto_flete
                            ? "border-[#10B981]/25 bg-[#10B981]/8 text-[#059669] dark:text-[#34D399] font-mono"
                            : "border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {v.monto_flete ? `$ ${v.monto_flete.toLocaleString("es-AR")}` : "Importe pendiente"}
                      </span>
                    )}
                  </div>

                  {/* Notas + acciones */}
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-border/70 bg-muted/30">
                    <p
                      className={`text-[11px] italic truncate ${notas ? "text-muted-foreground" : "text-muted-foreground/50"}`}
                      title={notas || undefined}
                    >
                      {notas || "Sin notas adicionales"}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href="/viajes"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-bold text-primary hover:bg-[#E1F5FE] dark:hover:bg-sky-950/40 transition-colors"
                      >
                        Abrir en Viajes <ArrowRight size={11} />
                      </a>
                      {deletingId === v.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] text-red-600 font-bold">¿Confirmar?</span>
                          <Button
                            variant="destructive"
                            size="xs"
                            className="h-6 px-2 text-[10px] font-bold"
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
                            className="h-6 px-2 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(null);
                            }}
                          >
                            No
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] gap-1"
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
            )}
          </div>
        );
      })}
    </div>
  );
}
