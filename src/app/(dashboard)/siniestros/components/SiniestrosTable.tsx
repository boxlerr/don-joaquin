"use client";

import React, { useState } from "react";
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
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit,
  User,
  Truck,
  ShieldCheck,
  FileText,
  Search,
  AlertTriangle,
} from "lucide-react";
import SiniestroArchivosPanel from "./SiniestroArchivosPanel";

export type TipoSiniestro = "choque" | "robo" | "incendio" | "vandalismo" | "vuelco" | "otro";
export type EstadoSiniestro = "abierto" | "en_gestion" | "cerrado";

export interface SiniestroConRelaciones {
  id: string;
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  tipo_siniestro: TipoSiniestro;
  tipo_siniestro_detalle: string | null;
  estado: EstadoSiniestro;
  descripcion: string;
  monto_danos: number | null;
  compania_seguro: string | null;
  numero_siniestro_seguro: string | null;
  terceros_involucrados: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  camion: { patente: string; marca: string; modelo: string } | null;
  chofer: { nombre: string; apellido: string | null } | null;
}

const TIPO_LABELS: Record<TipoSiniestro, string> = {
  choque: "Choque",
  robo: "Robo",
  incendio: "Incendio",
  vandalismo: "Vandalismo",
  vuelco: "Vuelco",
  otro: "Otro",
};

const TIPO_STYLES: Record<TipoSiniestro, string> = {
  choque: "bg-red-50 text-red-700 border-red-200",
  robo: "bg-purple-50 text-purple-700 border-purple-200",
  incendio: "bg-orange-50 text-orange-700 border-orange-200",
  vandalismo: "bg-yellow-50 text-yellow-700 border-yellow-200",
  vuelco: "bg-rose-50 text-rose-800 border-rose-200",
  otro: "bg-slate-50 text-slate-600 border-slate-200",
};

const ESTADO_LABELS: Record<EstadoSiniestro, string> = {
  abierto: "Abierto",
  en_gestion: "En gestión",
  cerrado: "Cerrado",
};

const ESTADO_STYLES: Record<EstadoSiniestro, string> = {
  abierto: "bg-green-50 text-green-700 border-green-200",
  en_gestion: "bg-blue-50 text-blue-700 border-blue-200",
  cerrado: "bg-slate-100 text-slate-500 border-slate-200",
};

interface SiniestrosTableProps {
  siniestros: SiniestroConRelaciones[];
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null }[];
  onEdit: (siniestro: SiniestroConRelaciones) => void;
  onDelete: (id: string) => void;
}

export default function SiniestrosTable({ siniestros, onEdit, onDelete }: SiniestrosTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    onDelete(id);
    setDeletingId(null);
    setExpandedId(null);
  };

  const filtered = siniestros.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      (s.camion ? `${s.camion.patente} ${s.camion.marca} ${s.camion.modelo}`.toLowerCase() : "").includes(q) ||
      (s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}`.toLowerCase() : "sin chofer").includes(q) ||
      s.descripcion.toLowerCase().includes(q) ||
      (s.compania_seguro || "").toLowerCase().includes(q) ||
      TIPO_LABELS[s.tipo_siniestro].toLowerCase().includes(q) ||
      ESTADO_LABELS[s.estado].toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 gap-4 bg-white border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-lg text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-[#0F172A] text-lg font-bold">Listado de Siniestros</h2>
            <p className="text-[#64748B] text-xs font-medium">
              Historial de siniestros y reclamos de seguros de la flota
            </p>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            type="search"
            placeholder="Buscar patente, chofer, tipo, estado..."
            className="w-80 h-10 pl-9 text-sm rounded-lg border-[#E2E8F0] focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {["Fecha", "Camión", "Chofer", "Tipo", "Estado", "Monto Daños", ""].map((col) => (
                <TableHead
                  key={col}
                  className={`text-[11px] font-bold text-[#64748B] uppercase tracking-wider py-4 ${col === "Fecha" ? "pl-6" : ""}`}
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-slate-800 text-sm font-bold tracking-tight">
                      No se encontraron siniestros
                    </span>
                    <span className="text-slate-400 text-xs font-medium mt-1">
                      {searchTerm ? "Probá ajustando los términos de búsqueda" : "Los siniestros registrados aparecerán aquí"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const isExpanded = expandedId === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <TableRow
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className={`hover:bg-slate-50/30 transition-colors border-b border-[#E2E8F0] last:border-0 cursor-pointer ${isExpanded ? "bg-slate-50/30" : ""}`}
                    >
                      <TableCell className="text-xs text-[#64748B] py-4 px-6 font-semibold">
                        {new Date(s.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-[#0F172A] py-4 px-4">
                        {s.camion ? (
                          <div className="flex flex-col">
                            <span className="text-[#0088D1]">{s.camion.patente}</span>
                            <span className="text-[10px] text-[#64748B] font-medium">{s.camion.marca} {s.camion.modelo}</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[#334155] font-semibold py-4 px-4">
                        {s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}` : (
                          <span className="text-slate-400 font-medium">Sin chofer</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${TIPO_STYLES[s.tipo_siniestro]}`}>
                          {s.tipo_siniestro === "otro" && s.tipo_siniestro_detalle
                            ? s.tipo_siniestro_detalle
                            : TIPO_LABELS[s.tipo_siniestro]}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_STYLES[s.estado]}`}>
                          {ESTADO_LABELS[s.estado]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900 py-4 px-4">
                        {s.monto_danos != null ? (
                          <span className="text-red-600">$ {s.monto_danos.toLocaleString("es-AR")}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-8 px-2.5 text-[11px] font-bold text-[#0088D1] hover:bg-blue-50 gap-1"
                            onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                          >
                            <Edit size={12} /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 p-0 hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-[#F8FAFC]/40 hover:bg-[#F8FAFC]/40">
                        <TableCell colSpan={7} className="p-0 border-b border-[#E2E8F0]">
                          <div className="p-6 space-y-4 animate-in fade-in-50 duration-200">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Unidad y Chofer */}
                            <div className="space-y-4 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
                              <div>
                                <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                                  <Truck size={13} className="text-[#0088D1]" /> Unidad Afectada
                                </h4>
                                {s.camion ? (
                                  <p className="text-xs font-bold text-[#0F172A]">
                                    {s.camion.marca} {s.camion.modelo}{" "}
                                    <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-50 text-[#0088D1] border border-sky-100">
                                      {s.camion.patente}
                                    </span>
                                  </p>
                                ) : <p className="text-xs text-slate-500">—</p>}
                              </div>
                              <div>
                                <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                                  <User size={13} className="text-[#0088D1]" /> Chofer Involucrado
                                </h4>
                                <p className="text-xs font-semibold text-[#334155]">
                                  {s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}` : (
                                    <span className="text-slate-400 font-medium">Sin chofer / Otro</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Seguro y Daños */}
                            <div className="space-y-4 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm text-xs">
                              <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                                <ShieldCheck size={13} className="text-[#10B981]" /> Seguro y Daños
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                                  <span className="text-[#64748B]">Compañía:</span>
                                  <span className="font-semibold text-slate-800">{s.compania_seguro || "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                                  <span className="text-[#64748B]">Nro Reclamación:</span>
                                  <span className="font-mono font-semibold text-slate-800">{s.numero_siniestro_seguro || "—"}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                                  <span className="text-[#64748B]">Terceros:</span>
                                  <span className="font-semibold text-slate-800 text-right line-clamp-1 max-w-[200px]" title={s.terceros_involucrados || ""}>
                                    {s.terceros_involucrados || "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between pt-1">
                                  <span className="text-[#64748B] font-bold">Daños Estimados:</span>
                                  <span className="font-black text-red-600">
                                    {s.monto_danos != null ? `$ ${s.monto_danos.toLocaleString("es-AR")}` : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Descripción y Acciones */}
                            <div className="space-y-4 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                              <div>
                                <h4 className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E2E8F0] pb-2 mb-2">
                                  <FileText size={13} className="text-[#F59E0B]" /> Descripción del Accidente
                                </h4>
                                <p className="text-xs text-[#475569] leading-relaxed max-h-24 overflow-y-auto pr-1">
                                  {s.descripcion}
                                </p>
                                {s.terceros_involucrados && (
                                  <p className="text-[10px] text-[#64748B] mt-2 font-medium bg-slate-50 p-1.5 rounded border border-slate-100">
                                    <strong className="text-slate-700">Terceros:</strong> {s.terceros_involucrados}
                                  </p>
                                )}
                              </div>

                              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end">
                                {deletingId === s.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-red-600 font-bold">¿Confirmar?</span>
                                    <Button
                                      variant="destructive"
                                      size="xs"
                                      className="h-7 px-2 text-[10px] font-bold"
                                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                                    >
                                      Sí, borrar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="xs"
                                      className="h-7 px-2 text-[10px] border-[#E2E8F0]"
                                      onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                    >
                                      No
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-8 px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] gap-1.5 font-bold"
                                    onClick={(e) => { e.stopPropagation(); setDeletingId(s.id); }}
                                  >
                                    <Trash2 size={12} /> Eliminar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Archivos adjuntos — fila completa */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <SiniestroArchivosPanel siniestro_id={s.id} />
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
      </div>
    </div>
  );
}
