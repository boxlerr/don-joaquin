"use client";

import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronDown, ChevronRight, RefreshCw, Trash2, Loader2, MapPin } from "lucide-react";
import { updateChoferEstadoAction, deleteChoferAction } from "../actions";
import { getChoferDetailAction } from "../[id]/actions";
import ChoferInfoTab from "../[id]/ChoferInfoTab";
import ChoferDocumentosTab from "../[id]/ChoferDocumentosTab";
import ChoferViajesTab from "../[id]/ChoferViajesTab";
import ChoferCuentaTab from "../[id]/ChoferCuentaTab";
import type { ChoferDetail } from "../[id]/types";

type TabId = "info" | "documentos" | "viajes" | "cuenta";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Información General" },
  { id: "documentos", label: "Documentación" },
  { id: "viajes", label: "Historial Viajes" },
  { id: "cuenta", label: "Cuenta Corriente" },
];

export default function ChoferRow({ chofer }: { chofer: any }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [detail, setDetail] = useState<ChoferDetail | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleExpand = async () => {
    const opening = !expanded;
    setExpanded(opening);
    if (opening && !detail) {
      setTabLoading(true);
      const data = await getChoferDetailAction(chofer.id);
      setDetail(data);
      setTabLoading(false);
    }
  };

  const refresh = async () => {
    setTabLoading(true);
    const data = await getChoferDetailAction(chofer.id);
    setDetail(data);
    setTabLoading(false);
  };

  const handleToggleEstado = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    const nuevo = chofer.estado === "activo" ? "inactivo" : "activo";
    await updateChoferEstadoAction(chofer.id, nuevo);
    setActionLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar a ${chofer.apellido}, ${chofer.nombre}?`)) return;
    setActionLoading(true);
    const res = await deleteChoferAction(chofer.id);
    if (res.error) alert(res.error);
    setActionLoading(false);
  };

  const estadoTone = chofer.estado === "activo" ? "success" : "neutral";

  return (
    <>
      <TableRow
        className={`hover:bg-[#F8FAFC] transition-all cursor-pointer select-none ${
          expanded ? "bg-[#F0F9FF]" : ""
        }`}
        onClick={handleExpand}
      >
        <TableCell className="font-medium text-[#0F172A]">
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8]">
              {expanded ? (
                <ChevronDown size={15} className="text-[#0088D1]" />
              ) : (
                <ChevronRight size={15} />
              )}
            </span>
            <span>
              {chofer.apellido}, {chofer.nombre}
            </span>
          </div>
        </TableCell>
        <TableCell className="font-mono">{chofer.dni}</TableCell>
        <TableCell className="text-[#475569]">{chofer.localidad ?? "—"}</TableCell>
        <TableCell className="text-[#475569]">{chofer.telefono ?? "—"}</TableCell>
        <TableCell className="text-[#475569] text-xs">
          {new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR")}
        </TableCell>
        <TableCell>
          <StatusBadge label={chofer.estado} tone={estadoTone} />
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-white hover:bg-white">
          <TableCell colSpan={6} className="p-0 border-b border-[#E2E8F0]">
            <div className="animate-in fade-in-50 slide-in-from-top-1 duration-150">
              {/* Barra de tabs + acciones */}
              <div className="flex items-center justify-between px-4 border-b border-[#E2E8F0] bg-[#F8FAFC] overflow-x-auto">
                <div className="flex items-center">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(tab.id);
                      }}
                      className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                        activeTab === tab.id
                          ? "text-[#0088D1] border-[#0088D1]"
                          : "text-[#64748B] border-transparent hover:text-[#0F172A]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div
                  className="flex items-center gap-2 pl-4 py-2 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/viajes?choferId=${chofer.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 h-7 px-3 text-xs font-medium rounded-md border border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                    aria-label={`Ver viajes de ${chofer.apellido}, ${chofer.nombre}`}
                  >
                    <MapPin size={12} className="text-[#0088D1]" />
                    Ver viajes
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-[#CBD5E1] text-[#334155]"
                    onClick={handleToggleEstado}
                    disabled={actionLoading}
                  >
                    <RefreshCw
                      size={12}
                      className={`mr-1 ${
                        chofer.estado === "activo" ? "text-amber-500" : "text-emerald-500"
                      }`}
                    />
                    {chofer.estado === "activo" ? "Inactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleDelete}
                    disabled={actionLoading}
                  >
                    <Trash2 size={12} className="mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>

              {/* Contenido del tab */}
              <div
                className="p-5 bg-[#FDFDFD]"
                onClick={(e) => e.stopPropagation()}
              >
                {tabLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[#0088D1]" />
                  </div>
                ) : detail ? (
                  <>
                    {activeTab === "info" && (
                    <ChoferInfoTab key={detail.updated_at} chofer={detail} onSaved={refresh} />
                  )}
                    {activeTab === "documentos" && (
                      <ChoferDocumentosTab chofer={detail} onRefresh={refresh} />
                    )}
                    {activeTab === "viajes" && (
                      <ChoferViajesTab viajes={detail.viajes_recientes} />
                    )}
                    {activeTab === "cuenta" && (
                      <ChoferCuentaTab movimientos={detail.movimientos_mes} />
                    )}
                  </>
                ) : (
                  <p className="text-center text-[#94A3B8] text-sm py-8">
                    No se pudo cargar el legajo.
                  </p>
                )}
              </div>
            </div>

          </TableCell>
        </TableRow>
      )}
    </>
  );
}
