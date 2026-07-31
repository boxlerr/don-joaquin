"use client";

import { useState } from "react";
import { formatFecha } from "@/lib/utils";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronDown, ChevronRight, RefreshCw, Trash2, Loader2, MapPin } from "lucide-react";
import { updateChoferEstadoAction, deleteChoferAction } from "../actions";
import { getChoferDetailAction } from "../[slug]/actions";
import ChoferInfoTab from "../[slug]/ChoferInfoTab";
import ChoferDocumentosTab from "../[slug]/ChoferDocumentosTab";
import ChoferViajesTab from "../[slug]/ChoferViajesTab";
import ChoferCuentaTab from "../[slug]/ChoferCuentaTab";
import type { ChoferDetail } from "../[slug]/types";

type TabId = "info" | "documentos" | "viajes" | "cuenta";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Información General" },
  { id: "documentos", label: "Documentación" },
  { id: "viajes", label: "Historial Viajes" },
  { id: "cuenta", label: "Cuenta Corriente" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila de chofer (DB) con muchos campos; los tipos generados no están disponibles acá
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

  // La tabla decía "baja" en gris mientras la tarjeta y el legajo del MISMO
  // chofer decían "egresado": tres pantallas, tres idiomas.
  const esBaja = chofer.estado === "baja";
  const estadoTone = chofer.estado === "activo" ? "success" : esBaja ? "archivado" : "neutral";

  return (
    <>
      <TableRow
        className={`hover:bg-muted/40 transition-all cursor-pointer select-none ${
          expanded ? "bg-[#F0F9FF]" : ""
        }`}
        onClick={handleExpand}
      >
        <TableCell className="font-medium text-foreground">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/70">
              {expanded ? (
                <ChevronDown size={15} className="text-primary" />
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
        <TableCell className="text-muted-foreground">{chofer.localidad ?? "—"}</TableCell>
        <TableCell className="text-muted-foreground">{chofer.telefono ?? "—"}</TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {formatFecha(chofer.fecha_ingreso)}
        </TableCell>
        <TableCell>
          <StatusBadge label={esBaja ? "egresado" : chofer.estado} tone={estadoTone} />
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-card hover:bg-card">
          <TableCell colSpan={6} className="p-0 border-b border-border">
            <div className="animate-in fade-in-50 slide-in-from-top-1 duration-150">
              {/* Barra de tabs + acciones */}
              <div className="flex items-center justify-between px-4 border-b border-border bg-muted/40 overflow-x-auto">
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
                          ? "text-primary border-[#0088D1]"
                          : "text-muted-foreground border-transparent hover:text-foreground"
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
                    className="inline-flex items-center gap-1 h-7 px-3 text-xs font-medium rounded-md border border-[#CBD5E1] text-foreground/90 hover:bg-muted/40 transition-colors"
                    aria-label={`Ver viajes de ${chofer.apellido}, ${chofer.nombre}`}
                  >
                    <MapPin size={12} className="text-primary" />
                    Ver viajes
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-[#CBD5E1] text-foreground/90"
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
                className="p-5 bg-card"
                onClick={(e) => e.stopPropagation()}
              >
                {tabLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-primary" />
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
                  <p className="text-center text-muted-foreground/70 text-sm py-8">
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
