"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import { Wrench, Search, ChevronDown, ChevronUp, MoreHorizontal, Truck, Save, X, Edit, Calendar, Users, Building2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Unidad {
  patente: string;
  marca: string;
  modelo: string;
}

export interface Chofer {
  id: string;
  nombre: string;
  apellido: string;
}

export interface MantenimientoOrden {
  id: string;
  unidad: Unidad;
  tipo: string;
  descripcion: string;
  fechaProgramada: string;
  estado: string;
  prioridad: string;
  encargado?: "Propio" | "Tercerizado";
  empresa?: string;
  chofer?: Chofer;
}

interface MantenimientoTableProps {
  data: MantenimientoOrden[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterUnidad: string;
  setFilterUnidad: (v: string) => void;
  onUpdate?: (id: string, updatedFields: Partial<MantenimientoOrden>) => void;
  onDelete?: (id: string) => void;
  camiones: Unidad[];
  choferes: Chofer[];
}

export default function MantenimientoTable({
  data,
  searchTerm,
  setSearchTerm,
  filterUnidad,
  setFilterUnidad,
  onUpdate,
  onDelete,
  camiones,
  choferes
}: MantenimientoTableProps) {
  
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MantenimientoOrden>>({});
  const [openDropdown, setOpenDropdown] = useState<"unidad" | "estado" | "prioridad" | "tipo" | "encargado" | "chofer" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  const handleRowClick = (row: MantenimientoOrden) => {
    if (expandedRowId === row.id) {
      setExpandedRowId(null);
      setOpenDropdown(null);
    } else {
      setExpandedRowId(row.id);
      setOpenDropdown(null);
      setEditForm({
        estado: row.estado,
        descripcion: row.descripcion,
        prioridad: row.prioridad,
        tipo: row.tipo,
        fechaProgramada: row.fechaProgramada,
        unidad: row.unidad,
        encargado: row.encargado || "Propio",
        empresa: row.empresa || "",
        chofer: row.chofer
      });
    }
  };

  const handleSave = (id: string) => {
    if (editForm.tipo === "Correctivo" && !editForm.chofer) {
      alert("Por favor, seleccione un chofer para el mantenimiento correctivo.");
      return;
    }
    if (editForm.encargado === "Tercerizado" && !editForm.empresa?.trim()) {
      alert("Por favor, ingrese el nombre de la empresa encargada.");
      return;
    }
    if (onUpdate) {
      onUpdate(id, editForm);
    }
    setExpandedRowId(null);
    setOpenDropdown(null);
  };

  const showingText = `Mostrando 1 a ${data.length} de ${data.length} órdenes`;

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-[#E2E8F0] overflow-hidden flex flex-col">
      <div className="p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#F0F9FF] p-2 rounded-lg text-[#0088D1]">
            <Wrench size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[#0F172A] text-base">Órdenes de Mantenimiento</h3>
            <p className="text-sm text-[#64748B]">Seguimiento de mantenimientos de la flota</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative">
            <select
              className="appearance-none bg-white border border-[#E2E8F0] text-[#475569] text-sm rounded-lg pl-4 pr-10 py-2 outline-none focus:border-[#0088D1] focus:ring-1 focus:ring-[#0088D1] w-full sm:w-[180px] cursor-pointer"
              value={filterUnidad}
              onChange={(e) => setFilterUnidad(e.target.value)}
            >
              <option value="Todas las unidades">Todas las unidades</option>
              {camiones.map((c) => (
                <option key={c.patente} value={c.patente}>{c.patente}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
          </div>

          <div className="relative w-full sm:w-[250px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Buscar orden, unidad..."
              className="w-full bg-white border border-[#E2E8F0] text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:border-[#0088D1] focus:ring-1 focus:ring-[#0088D1]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">N° ORDEN</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">UNIDAD</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">TIPO</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">DESCRIPCIÓN</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">FECHA PROGRAMADA</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">ESTADO</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12">PRIORIDAD</TableHead>
              <TableHead className="font-bold text-[10px] uppercase text-[#64748B] h-12 text-center">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <React.Fragment key={row.id}>
                <TableRow 
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => handleRowClick(row)}
                >
                  <TableCell className="font-semibold text-[#0F172A]">{row.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden">
                         <Truck size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#0F172A] text-sm">{row.unidad.patente}</span>
                        <span className="text-xs text-[#64748B]">{row.unidad.marca} {row.unidad.modelo}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.tipo === "Preventivo" ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-[#B3E5FC] bg-[#F0F9FF] text-[#0088D1] text-[10px] font-bold uppercase">
                        Preventivo
                      </span>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-[#FECACA] bg-[#FEF2F2] text-[#EF4444] text-[10px] font-bold uppercase">
                          Correctivo
                        </span>
                        {row.chofer && (
                          <span className="text-[10px] text-[#64748B] font-semibold leading-none mt-0.5">
                            Chofer: {row.chofer.apellido}, {row.chofer.nombre}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[#475569]">
                    <div className="flex flex-col gap-1">
                      <span>{row.descripcion}</span>
                      {row.encargado && (
                        <span className="text-[11px] text-[#64748B] flex items-center gap-1 font-medium mt-0.5">
                          <Users size={12} className="text-[#0088D1] shrink-0" />
                          {row.encargado === "Tercerizado" ? (
                            <span>Tercerizado: <strong className="text-[#334155]">{row.empresa}</strong></span>
                          ) : (
                            <span>Propio</span>
                          )}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[#0F172A] font-medium">{row.fechaProgramada}</TableCell>
                  <TableCell>
                    <StatusBadge 
                      label={row.estado} 
                      tone={
                        row.estado === "Programada" ? "info" :
                        row.estado === "En proceso" ? "warning" :
                        row.estado === "Completada" ? "success" : "error"
                      } 
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        row.prioridad === "Media" ? "bg-[#F59E0B]" :
                        row.prioridad === "Alta" ? "bg-[#EF4444]" : "bg-[#22C55E]"
                      }`}></span>
                      <span className="text-xs font-semibold text-[#475569]">{row.prioridad}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-[#64748B]"
                      onClick={(e) => {
                        e.stopPropagation();
                        // other row actions if needed
                        handleRowClick(row);
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Expanded Row for inline editing */}
                {expandedRowId === row.id && (
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell colSpan={8} className="p-4 bg-slate-50/30">
                      <div className="border-2 border-[#0088D1] bg-white rounded-2xl p-6 shadow-md animate-in slide-in-from-top-3 duration-200">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                          <div className="flex items-center gap-3">
                            <div className="bg-[#F0F9FF] border border-[#B3E5FC] p-2.5 rounded-lg text-[#0088D1]">
                              <Edit size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-[#0F172A] text-base">Editar orden de mantenimiento</h4>
                              <p className="text-sm text-[#64748B]">Actualiza los detalles de la orden seleccionada.</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full border border-[#E2E8F0] hover:bg-slate-50 text-[#0088D1]"
                            onClick={() => {
                              setExpandedRowId(null);
                              setOpenDropdown(null);
                            }}
                          >
                            <ChevronUp size={16} />
                          </Button>
                        </div>

                        {/* Form Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          
                          {/* N° ORDEN */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">N° Orden</label>
                            <input 
                              type="text" 
                              disabled
                              value={row.id}
                              className="w-full bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] text-sm rounded-lg px-3.5 py-3 outline-none font-medium cursor-not-allowed"
                            />
                          </div>

                          {/* UNIDAD Custom Select */}
                          <div className="space-y-2 relative" ref={openDropdown === "unidad" ? dropdownRef : null}>
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Unidad</label>
                            <div 
                              onClick={() => setOpenDropdown(openDropdown === "unidad" ? null : "unidad")}
                              className="w-full bg-white border border-[#E2E8F0] hover:border-slate-300 text-[#0F172A] text-sm rounded-lg px-3.5 py-2 outline-none flex items-center justify-between cursor-pointer min-h-[46px]"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
                                  <Truck size={14} />
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-[#0F172A] text-xs leading-tight">{editForm.unidad?.patente || row.unidad.patente}</span>
                                  <span className="text-[10px] text-[#64748B] leading-tight">{editForm.unidad?.marca || row.unidad.marca} {editForm.unidad?.modelo || row.unidad.modelo}</span>
                                </div>
                              </div>
                              <ChevronDown size={14} className="text-[#64748B]" />
                            </div>

                            {openDropdown === "unidad" && (
                              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
                                {camiones.map((u: Unidad) => (
                                  <div 
                                    key={u.patente}
                                    className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-b-0"
                                    onClick={() => {
                                      setEditForm({ ...editForm, unidad: u });
                                      setOpenDropdown(null);
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
                                        <Truck size={14} />
                                      </div>
                                      <div className="flex flex-col text-left">
                                        <span className="font-bold text-[#0F172A] text-xs leading-tight">{u.patente}</span>
                                        <span className="text-[10px] text-[#64748B] leading-tight">{u.marca} {u.modelo}</span>
                                      </div>
                                    </div>
                                    {editForm.unidad?.patente === u.patente && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#0088D1]"></span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* FECHA PROGRAMADA */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Fecha Programada</label>
                            <div className="relative flex items-center">
                              <Calendar size={16} className="absolute left-3.5 text-[#64748B] pointer-events-none" />
                              <input 
                                type="text" 
                                value={editForm.fechaProgramada}
                                onChange={(e) => setEditForm({...editForm, fechaProgramada: e.target.value})}
                                className="w-full bg-white border border-[#E2E8F0] text-[#0F172A] text-sm rounded-lg pl-10 pr-10 py-3 outline-none focus:border-[#0088D1] focus:ring-1 focus:ring-[#0088D1] font-medium"
                              />
                              <div className="absolute right-3 pl-2.5 border-l border-[#E2E8F0] h-5 flex items-center">
                                <Calendar size={16} className="text-[#64748B] cursor-pointer hover:text-slate-800" />
                              </div>
                            </div>
                          </div>

                          {/* ESTADO Custom Select */}
                          <div className="space-y-2 relative" ref={openDropdown === "estado" ? dropdownRef : null}>
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Estado</label>
                            <div 
                              onClick={() => setOpenDropdown(openDropdown === "estado" ? null : "estado")}
                              className="w-full bg-white border border-[#E2E8F0] hover:border-slate-300 text-[#0F172A] text-sm rounded-lg px-3.5 py-3 outline-none flex items-center justify-between cursor-pointer min-h-[46px]"
                            >
                              <div className="flex items-center">
                                <span className={`w-2 h-2 rounded-full mr-2.5 ${
                                  editForm.estado === "Programada" ? "bg-[#0088D1]" :
                                  editForm.estado === "En proceso" ? "bg-[#F59E0B]" :
                                  editForm.estado === "Completada" ? "bg-[#22C55E]" : "bg-[#EF4444]"
                                }`}></span>
                                <span className="text-sm font-semibold text-[#475569]">{editForm.estado}</span>
                              </div>
                              <ChevronDown size={14} className="text-[#64748B]" />
                            </div>

                            {openDropdown === "estado" && (
                              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1">
                                {[
                                  { value: "Programada", color: "bg-[#0088D1]" },
                                  { value: "En proceso", color: "bg-[#F59E0B]" },
                                  { value: "Completada", color: "bg-[#22C55E]" },
                                  { value: "Vencida", color: "bg-[#EF4444]" }
                                ].map((opt) => (
                                  <div 
                                    key={opt.value}
                                    className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                    onClick={() => {
                                      setEditForm({ ...editForm, estado: opt.value });
                                      setOpenDropdown(null);
                                    }}
                                  >
                                    <div className="flex items-center">
                                      <span className={`w-2 h-2 rounded-full mr-2.5 ${opt.color}`}></span>
                                      <span className="text-sm font-semibold text-[#475569]">{opt.value}</span>
                                    </div>
                                    {editForm.estado === opt.value && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#0088D1]"></span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* PRIORIDAD Custom Select */}
                          <div className="space-y-2 relative" ref={openDropdown === "prioridad" ? dropdownRef : null}>
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Prioridad</label>
                            <div 
                              onClick={() => setOpenDropdown(openDropdown === "prioridad" ? null : "prioridad")}
                              className="w-full bg-white border border-[#E2E8F0] hover:border-slate-300 text-[#0F172A] text-sm rounded-lg px-3.5 py-3 outline-none flex items-center justify-between cursor-pointer min-h-[46px]"
                            >
                              <div className="flex items-center">
                                <span className={`w-2 h-2 rounded-full mr-2.5 ${
                                  editForm.prioridad === "Alta" ? "bg-[#EF4444]" :
                                  editForm.prioridad === "Media" ? "bg-[#F59E0B]" : "bg-[#22C55E]"
                                }`}></span>
                                <span className="text-sm font-semibold text-[#475569]">{editForm.prioridad}</span>
                              </div>
                              <ChevronDown size={14} className="text-[#64748B]" />
                            </div>

                            {openDropdown === "prioridad" && (
                              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1">
                                {[
                                  { value: "Alta", color: "bg-[#EF4444]" },
                                  { value: "Media", color: "bg-[#F59E0B]" },
                                  { value: "Baja", color: "bg-[#22C55E]" }
                                ].map((opt) => (
                                  <div 
                                    key={opt.value}
                                    className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                    onClick={() => {
                                      setEditForm({ ...editForm, prioridad: opt.value });
                                      setOpenDropdown(null);
                                    }}
                                  >
                                    <div className="flex items-center">
                                      <span className={`w-2 h-2 rounded-full mr-2.5 ${opt.color}`}></span>
                                      <span className="text-sm font-semibold text-[#475569]">{opt.value}</span>
                                    </div>
                                    {editForm.prioridad === opt.value && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#0088D1]"></span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* TIPO DE MANTENIMIENTO Custom Select */}
                          <div className="space-y-2 relative" ref={openDropdown === "tipo" ? dropdownRef : null}>
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Tipo de Mantenimiento</label>
                            <div 
                              onClick={() => setOpenDropdown(openDropdown === "tipo" ? null : "tipo")}
                              className="w-full bg-white border border-[#E2E8F0] hover:border-slate-300 text-[#0F172A] text-sm rounded-lg px-3.5 py-3 outline-none flex items-center justify-between cursor-pointer min-h-[46px]"
                            >
                              <div className="flex items-center text-[#475569]">
                                <Wrench size={14} className="mr-2.5 text-[#0088D1]" />
                                <span className="text-sm font-semibold text-[#475569]">{editForm.tipo}</span>
                              </div>
                              <ChevronDown size={14} className="text-[#64748B]" />
                            </div>

                            {openDropdown === "tipo" && (
                              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1">
                                {[
                                  { value: "Preventivo" },
                                  { value: "Correctivo" }
                                ].map((opt) => (
                                  <div 
                                    key={opt.value}
                                    className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                    onClick={() => {
                                      const newForm = { ...editForm, tipo: opt.value };
                                      if (opt.value === "Preventivo") {
                                        delete newForm.chofer;
                                      }
                                      setEditForm(newForm);
                                      setOpenDropdown(null);
                                    }}
                                  >
                                    <div className="flex items-center text-[#475569]">
                                      <Wrench size={14} className="mr-2.5 text-[#0088D1]" />
                                      <span className="text-sm font-semibold text-[#475569]">{opt.value}</span>
                                    </div>
                                    {editForm.tipo === opt.value && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#0088D1]"></span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* CHOFER Custom Select */}
                          {editForm.tipo === "Correctivo" && (
                            <div className="md:col-span-3 space-y-2 relative animate-in fade-in slide-in-from-top-2 duration-200" ref={openDropdown === "chofer" ? dropdownRef : null}>
                              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Chofer Asignado *</label>
                              <div 
                                onClick={() => setOpenDropdown(openDropdown === "chofer" ? null : "chofer")}
                                className="w-full bg-white border border-[#E2E8F0] hover:border-slate-300 text-[#0F172A] text-sm rounded-lg px-3.5 py-3 outline-none flex items-center justify-between cursor-pointer min-h-[46px]"
                              >
                                <div className="flex items-center text-[#475569]">
                                  <Users size={14} className="mr-2.5 text-[#0088D1]" />
                                  <span className="text-sm font-semibold text-[#475569]">
                                    {editForm.chofer ? `${editForm.chofer.apellido}, ${editForm.chofer.nombre}` : "Seleccionar chofer..."}
                                  </span>
                                </div>
                                <ChevronDown size={14} className="text-[#64748B]" />
                              </div>

                              {openDropdown === "chofer" && (
                                <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
                                  {choferes.map((c) => (
                                    <div 
                                      key={c.id}
                                      className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-b-0"
                                      onClick={() => {
                                        setEditForm({ ...editForm, chofer: c });
                                        setOpenDropdown(null);
                                      }}
                                    >
                                      <div className="flex items-center text-[#475569]">
                                        <Users size={14} className="mr-2.5 text-[#64748B]" />
                                        <span className="text-sm font-semibold">{c.apellido}, {c.nombre}</span>
                                      </div>
                                      {editForm.chofer?.id === c.id && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#0088D1]"></span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ENCARGADO Custom Select */}
                          <div className={`space-y-2 relative ${editForm.encargado === "Tercerizado" ? "col-span-1" : "col-span-3"}`} ref={openDropdown === "encargado" ? dropdownRef : null}>
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Encargado del Mantenimiento</label>
                            <div 
                              onClick={() => setOpenDropdown(openDropdown === "encargado" ? null : "encargado")}
                              className="w-full bg-white border border-[#E2E8F0] hover:border-slate-300 text-[#0F172A] text-sm rounded-lg px-3.5 py-3 outline-none flex items-center justify-between cursor-pointer min-h-[46px]"
                            >
                              <div className="flex items-center text-[#475569]">
                                <Users size={14} className="mr-2.5 text-[#0088D1]" />
                                <span className="text-sm font-semibold text-[#475569]">{editForm.encargado || "Propio"}</span>
                              </div>
                              <ChevronDown size={14} className="text-[#64748B]" />
                            </div>

                            {openDropdown === "encargado" && (
                              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1">
                                {[
                                  { value: "Propio" },
                                  { value: "Tercerizado" }
                                ].map((opt) => (
                                  <div 
                                    key={opt.value}
                                    className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                    onClick={() => {
                                      setEditForm({ 
                                        ...editForm, 
                                        encargado: opt.value as "Propio" | "Tercerizado",
                                        empresa: opt.value === "Propio" ? "" : editForm.empresa 
                                      });
                                      setOpenDropdown(null);
                                    }}
                                  >
                                    <div className="flex items-center text-[#475569]">
                                      <Users size={14} className="mr-2.5 text-[#0088D1]" />
                                      <span className="text-sm font-semibold text-[#475569]">{opt.value}</span>
                                    </div>
                                    {(editForm.encargado || "Propio") === opt.value && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#0088D1]"></span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* EMPRESA ENCARGADA */}
                          {editForm.encargado === "Tercerizado" && (
                            <div className="col-span-2 space-y-2 animate-in fade-in slide-in-from-left-2 duration-200">
                              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Empresa Encargada</label>
                              <div className="relative flex items-center">
                                <Building2 size={16} className="absolute left-3.5 text-[#64748B] pointer-events-none" />
                                <input 
                                  type="text" 
                                  placeholder="Ej: Taller mecánico"
                                  value={editForm.empresa || ""}
                                  onChange={(e) => setEditForm({...editForm, empresa: e.target.value})}
                                  className="w-full bg-white border border-[#E2E8F0] text-[#0F172A] text-sm rounded-lg pl-10 pr-4 py-3 outline-none focus:border-[#0088D1] focus:ring-1 focus:ring-[#0088D1] font-medium"
                                />
                              </div>
                            </div>
                          )}

                          {/* DESCRIPCIÓN Textarea */}
                          <div className="md:col-span-3 space-y-2">
                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Descripción</label>
                            <textarea 
                              rows={4}
                              value={editForm.descripcion}
                              onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                              className="w-full bg-white border border-[#E2E8F0] text-[#0F172A] text-sm rounded-lg px-3.5 py-3 outline-none focus:border-[#0088D1] focus:ring-1 focus:ring-[#0088D1] min-h-[90px] resize-y font-medium"
                            />
                          </div>

                        </div>

                        {/* Actions Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                          {onDelete ? (
                            <Button 
                              variant="ghost" 
                              onClick={() => {
                                if (window.confirm("¿Estás seguro de que deseas eliminar esta orden de mantenimiento?")) {
                                  onDelete(row.id);
                                  setExpandedRowId(null);
                                  setOpenDropdown(null);
                                }
                              }}
                              className="text-[#EF4444] hover:bg-red-50 hover:text-[#DC2626] border border-[#FECACA] font-semibold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm bg-white"
                            >
                              <Trash2 size={16} /> Eliminar orden
                            </Button>
                          ) : (
                            <div />
                          )}
                          <div className="flex items-center gap-3">
                            <Button 
                              variant="ghost" 
                              onClick={() => {
                                  setExpandedRowId(null);
                                  setOpenDropdown(null);
                              }}
                              className="text-[#64748B] hover:bg-slate-100 border border-[#E2E8F0] font-semibold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm bg-white"
                            >
                              <X size={16} /> Cancelar
                            </Button>
                            <Button 
                              onClick={() => handleSave(row.id)}
                              className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-semibold px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm shadow-sm"
                            >
                              <Save size={16} /> Guardar Cambios
                            </Button>
                          </div>
                        </div>

                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between text-sm text-[#64748B]">
        <p>{showingText}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 text-[#94A3B8] border-[#E2E8F0]" disabled>
            &laquo;
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 text-[#0088D1] border-[#B3E5FC] bg-[#F0F9FF] font-medium">
            1
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 text-[#64748B] border-[#E2E8F0] hover:bg-slate-50">
            2
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 text-[#64748B] border-[#E2E8F0] hover:bg-slate-50">
            &raquo;
          </Button>
        </div>
      </div>
    </div>
  );
}
