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
  Banknote,
} from "lucide-react";
import SiniestroArchivosPanel from "./SiniestroArchivosPanel";
import RegistrarPagoSiniestroDialog from "./RegistrarPagoSiniestroDialog";
import { coincideEnAlguno } from "@/lib/texto";

export type TipoSiniestro = "choque" | "robo" | "incendio" | "vandalismo" | "vuelco" | "otro";
export type EstadoSiniestro = "abierto" | "en_gestion" | "cerrado";

export interface SiniestroConRelaciones {
  id: string;
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  tipo_siniestro: TipoSiniestro;
  tipo_siniestro_detalle?: string | null;
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
  otro: "bg-muted/40 text-muted-foreground border-border",
};

const ESTADO_LABELS: Record<EstadoSiniestro, string> = {
  abierto: "Abierto",
  en_gestion: "En gestión",
  cerrado: "Cerrado",
};

const ESTADO_STYLES: Record<EstadoSiniestro, string> = {
  abierto: "bg-green-50 text-green-700 border-green-200",
  en_gestion: "bg-blue-50 text-blue-700 border-blue-200",
  cerrado: "bg-muted text-muted-foreground border-border",
};

interface SiniestrosTableProps {
  siniestros: SiniestroConRelaciones[];
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null; disabled?: boolean; motivo?: string }[];
  onEdit: (siniestro: SiniestroConRelaciones) => void;
  onDelete: (id: string) => void;
}

export default function SiniestrosTable({ siniestros, onEdit, onDelete }: SiniestrosTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pagoSiniestro, setPagoSiniestro] = useState<SiniestroConRelaciones | null>(null);

  const handleDelete = (id: string) => {
    onDelete(id);
    setDeletingId(null);
    setExpandedId(null);
  };

  const filtered = siniestros.filter((s) =>
    coincideEnAlguno(
      [
        s.camion ? `${s.camion.patente} ${s.camion.marca} ${s.camion.modelo}` : "",
        s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}` : "sin chofer",
        s.descripcion,
        s.compania_seguro,
        TIPO_LABELS[s.tipo_siniestro],
        ESTADO_LABELS[s.estado],
      ],
      searchTerm,
    ),
  );

  // El detalle desplegado es el mismo contenido en la fila expandida (desktop) y
  // en la tarjeta apilada (celular): sólo cambia el envoltorio, no los datos.
  const renderDetalle = (s: SiniestroConRelaciones) => (
    <div className="p-3 sm:p-6 space-y-4 animate-in fade-in-50 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
        {/* Unidad y Chofer */}
        <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm">
          <div>
            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2 mb-2">
              <Truck size={13} className="text-primary" /> Unidad Afectada
            </h4>
            {s.camion ? (
              <p className="text-xs font-bold text-foreground">
                {s.camion.marca} {s.camion.modelo}{" "}
                <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-50 text-primary border border-sky-100">
                  {s.camion.patente}
                </span>
              </p>
            ) : <p className="text-xs text-muted-foreground">—</p>}
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2 mb-2">
              <User size={13} className="text-primary" /> Chofer Involucrado
            </h4>
            <p className="text-xs font-semibold text-foreground/90">
              {s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}` : (
                <span className="text-muted-foreground/70 font-medium">Sin chofer / Otro</span>
              )}
            </p>
          </div>
        </div>

        {/* Seguro y Daños */}
        <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm text-xs">
          <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2 mb-2">
            <ShieldCheck size={13} className="text-[#10B981]" /> Seguro y Daños
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between gap-3 border-b border-border pb-1.5">
              <span className="text-muted-foreground shrink-0">Compañía:</span>
              <span className="font-semibold text-foreground text-right truncate">{s.compania_seguro || "—"}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-border pb-1.5">
              <span className="text-muted-foreground shrink-0">Nro Reclamación:</span>
              <span className="font-mono font-semibold text-foreground text-right truncate">{s.numero_siniestro_seguro || "—"}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-border pb-1.5">
              <span className="text-muted-foreground shrink-0">Terceros:</span>
              <span className="font-semibold text-foreground text-right line-clamp-1 max-w-[200px]" title={s.terceros_involucrados || ""}>
                {s.terceros_involucrados || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-3 pt-1">
              <span className="text-muted-foreground font-bold shrink-0">Daños Estimados:</span>
              <span className="font-black text-red-600 text-right">
                {s.monto_danos != null ? `$ ${s.monto_danos.toLocaleString("es-AR")}` : "—"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="mt-3 w-full h-9 md:h-8 text-[11px] font-bold text-green-700 hover:text-green-800 hover:bg-green-50 border border-green-200 gap-1.5"
            onClick={(e) => { e.stopPropagation(); setPagoSiniestro(s); }}
          >
            <Banknote size={13} /> Registrar pago en caja
          </Button>
        </div>

        {/* Descripción y Acciones */}
        <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2 mb-2">
              <FileText size={13} className="text-[#F59E0B]" /> Descripción del Accidente
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto pr-1">
              {s.descripcion}
            </p>
            {s.terceros_involucrados && (
              <p className="text-[10px] text-muted-foreground mt-2 font-medium bg-muted/40 p-1.5 rounded border border-border">
                <strong className="text-foreground/90">Terceros:</strong> {s.terceros_involucrados}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-border flex flex-wrap items-center justify-end gap-2">
            {/* En celular la edición vive acá adentro: la fila-tarjeta no tiene
                lugar para las dos acciones sin apretujarlas. */}
            <Button
              variant="ghost"
              size="xs"
              className="md:hidden h-9 px-3 text-[11px] font-bold text-primary hover:bg-blue-50 gap-1.5"
              onClick={(e) => { e.stopPropagation(); onEdit(s); }}
            >
              <Edit size={12} /> Editar
            </Button>
            {deletingId === s.id ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-red-600 font-bold">¿Confirmar?</span>
                <Button
                  variant="destructive"
                  size="xs"
                  className="h-9 md:h-7 px-3 md:px-2 text-[10px] font-bold"
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                >
                  Sí, borrar
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="h-9 md:h-7 px-3 md:px-2 text-[10px] border-border"
                  onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className="h-9 md:h-8 px-3 md:px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] gap-1.5 font-bold"
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
  );

  const vacio = (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <span className="text-foreground text-sm font-bold tracking-tight">
        No se encontraron siniestros
      </span>
      <span className="text-muted-foreground/70 text-xs font-medium mt-1">
        {searchTerm ? "Probá ajustando los términos de búsqueda" : "Los siniestros registrados aparecerán aquí"}
      </span>
    </div>
  );

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 sm:py-5 gap-3 sm:gap-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-lg text-red-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-foreground text-base sm:text-lg font-bold">Listado de Siniestros</h2>
            <p className="text-muted-foreground text-xs font-medium">
              Historial de siniestros y reclamos de seguros de la flota
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="search"
            placeholder="Buscar patente, chofer, tipo, estado..."
            className="w-full sm:w-80 h-10 pl-9 text-sm rounded-lg border-border focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Celular: la fila se vuelve tarjeta. La tabla de 7 columnas no entra en
          343px y este listado ES la pantalla, así que no alcanza con scrollear. */}
      <div className="md:hidden">
        {filtered.length === 0 ? vacio : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const isExpanded = expandedId === s.id;
              return (
                <li key={s.id} className={isExpanded ? "bg-muted/30" : ""}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="flex items-start justify-between gap-3 px-4 py-3.5 cursor-pointer"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">
                          {s.camion ? s.camion.patente : "—"}
                        </span>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {new Date(s.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground/90 truncate">
                        {s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}` : (
                          <span className="text-muted-foreground/70 font-medium">Sin chofer</span>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${TIPO_STYLES[s.tipo_siniestro]}`}>
                          {s.tipo_siniestro === "otro" && s.tipo_siniestro_detalle
                            ? s.tipo_siniestro_detalle
                            : TIPO_LABELS[s.tipo_siniestro]}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_STYLES[s.estado]}`}>
                          {ESTADO_LABELS[s.estado]}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-red-600 whitespace-nowrap">
                        {s.monto_danos != null ? `$ ${s.monto_danos.toLocaleString("es-AR")}` : <span className="text-muted-foreground/70">—</span>}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground/70"
                        aria-label={isExpanded ? "Ocultar detalle" : "Ver detalle"}
                        onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : s.id); }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/40">{renderDetalle(s)}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {["Fecha", "Camión", "Chofer", "Tipo", "Estado", "Monto Daños", ""].map((col) => (
                <TableHead
                  key={col}
                  className={`text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 ${col === "Fecha" ? "pl-6" : ""}`}
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">{vacio}</TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const isExpanded = expandedId === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <TableRow
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className={`hover:bg-muted/30 transition-colors border-b border-border last:border-0 cursor-pointer ${isExpanded ? "bg-muted/30" : ""}`}
                    >
                      <TableCell className="text-xs text-muted-foreground py-4 px-6 font-semibold">
                        {new Date(s.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground py-4 px-4">
                        {s.camion ? (
                          <div className="flex flex-col">
                            <span className="text-primary">{s.camion.patente}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">{s.camion.marca} {s.camion.modelo}</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground/90 font-semibold py-4 px-4">
                        {s.chofer ? `${s.chofer.nombre} ${s.chofer.apellido || ""}` : (
                          <span className="text-muted-foreground/70 font-medium">Sin chofer</span>
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
                      <TableCell className="text-xs font-bold text-foreground py-4 px-4">
                        {s.monto_danos != null ? (
                          <span className="text-red-600">$ {s.monto_danos.toLocaleString("es-AR")}</span>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-8 px-2.5 text-[11px] font-bold text-primary hover:bg-blue-50 gap-1"
                            onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                          >
                            <Edit size={12} /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 p-0 hover:bg-muted text-muted-foreground/70 hover:text-foreground/90"
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="p-0 border-b border-border">
                          {renderDetalle(s)}
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

      {pagoSiniestro && (
        <RegistrarPagoSiniestroDialog
          siniestro={pagoSiniestro}
          open={!!pagoSiniestro}
          onOpenChange={(v) => { if (!v) setPagoSiniestro(null); }}
          onSuccess={() => setPagoSiniestro(null)}
        />
      )}
    </div>
  );
}
