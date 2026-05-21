"use client";

import { useState, useRef } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Camera,
  Loader2,
  MapPin,
  Phone,
  Calendar,
  RefreshCw,
  Trash2,
  FileText,
  User,
} from "lucide-react";
import {
  updateChoferEstadoAction,
  deleteChoferAction,
  uploadFotoChoferAction,
  deleteFotoChoferAction,
} from "../actions";
import { getChoferDetailAction } from "../[id]/actions";
import ChoferInfoTab from "../[id]/ChoferInfoTab";
import ChoferDocumentosTab from "../[id]/ChoferDocumentosTab";
import ChoferViajesTab from "../[id]/ChoferViajesTab";
import ChoferCuentaTab from "../[id]/ChoferCuentaTab";
import type { ChoferDetail } from "../[id]/types";
import { createClient } from "@/lib/supabase/client";

type TabId = "info" | "documentos" | "viajes" | "cuenta";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Información General" },
  { id: "documentos", label: "Documentación" },
  { id: "viajes", label: "Historial Viajes" },
  { id: "cuenta", label: "Cuenta Corriente" },
];

export default function ChoferCard({ chofer }: { chofer: any }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [detail, setDetail] = useState<ChoferDetail | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  const initials = `${chofer.nombre[0] ?? ""}${chofer.apellido[0] ?? ""}`.toUpperCase();
  const estadoTone = chofer.estado === "activo" ? "success" : "neutral";

  const handleOpenDetail = async () => {
    setDetailOpen(true);
    if (!detail) {
      setTabLoading(true);
      const data = await getChoferDetailAction(chofer.id);
      setDetail(data);
      setTabLoading(false);
    }
  };

  const refreshDetail = async () => {
    setTabLoading(true);
    const data = await getChoferDetailAction(chofer.id);
    setDetail(data);
    setTabLoading(false);
  };

  const handleToggleEstado = async () => {
    setActionLoading(true);
    const nuevo = chofer.estado === "activo" ? "inactivo" : "activo";
    await updateChoferEstadoAction(chofer.id, nuevo);
    setActionLoading(false);
    if (detail) refreshDetail();
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar a ${chofer.apellido}, ${chofer.nombre}?`)) return;
    setActionLoading(true);
    const res = await deleteChoferAction(chofer.id);
    if (res.error) alert(res.error);
    setActionLoading(false);
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes (JPG, PNG, WEBP, GIF, HEIC).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo permitido es 5 MB.`);
      return;
    }

    setUploadingFoto(true);
    try {
      const formData = new FormData();
      formData.set("chofer_id", chofer.id);
      formData.set("file", file);
      const res = await uploadFotoChoferAction(formData);
      if (res.error) {
        alert(res.error);
      } else if (detailOpen) {
        refreshDetail();
      }
    } catch (err) {
      console.error(err);
      alert("No se pudo subir la foto. Probá con una imagen más liviana o en otro formato.");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFotoDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fotoUrl) return;
    if (!confirm("¿Eliminar la foto de perfil?")) return;
    setUploadingFoto(true);
    try {
      const res = await deleteFotoChoferAction(chofer.id);
      if (res.error) {
        alert(res.error);
      } else if (detailOpen) {
        refreshDetail();
      }
    } finally {
      setUploadingFoto(false);
    }
  };

  return (
    <>
      <div className="bg-card rounded-[12px] border border-border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative group overflow-hidden">
        {/* Barra superior de acento premium */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0088D1] to-[#4FC3F7]" />

        <div className="p-5 flex-1 flex flex-col">
          {/* Header de la Card: Avatar + Nombre/Estado */}
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar interactivo */}
            <div className="relative flex-shrink-0 group/avatar">
              <div
                className="w-16 h-16 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center cursor-pointer overflow-hidden shadow-inner relative"
                onClick={() => fileInputRef.current?.click()}
                title="Hacer clic para cambiar foto"
              >
                {fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt={`${chofer.nombre} ${chofer.apellido}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-primary text-xl font-bold">{initials}</span>
                )}

                {/* Overlay de hover con icono de cámara */}
                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                  <Camera size={16} className="text-white" />
                  <span className="text-[9px] font-medium text-white tracking-wider uppercase">
                    {fotoUrl ? "Cambiar" : "Subir"}
                  </span>
                </div>

                {/* Loader al subir foto */}
                {uploadingFoto && (
                  <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-10">
                    <Loader2 size={20} className="animate-spin text-primary" />
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </div>

              {fotoUrl && !uploadingFoto && (
                <button
                  type="button"
                  onClick={handleFotoDelete}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md border-2 border-white opacity-0 group-hover/avatar:opacity-100 transition-opacity z-20"
                  title="Eliminar foto"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>

            {/* Datos principales */}
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold text-base leading-snug truncate group-hover:text-primary transition-colors">
                {chofer.apellido}, {chofer.nombre}
              </h3>
              <p className="text-muted-foreground text-xs font-mono mt-0.5">DNI {chofer.dni}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge label={chofer.estado} tone={estadoTone} />
              </div>
            </div>
          </div>

          {/* Sub-información del chofer */}
          <div className="space-y-2 mt-2 pt-3 border-t border-[#F1F5F9] text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-muted-foreground/70 flex-shrink-0" />
              <span className="truncate">{chofer.telefono || "Sin teléfono"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-muted-foreground/70 flex-shrink-0" />
              <span className="truncate">{chofer.localidad || "Sin localidad"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-muted-foreground/70 flex-shrink-0" />
              <span>Ingreso: {new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR")}</span>
            </div>
          </div>
        </div>

        {/* Footer de Acciones */}
        <div className="bg-muted/40 px-4 py-3 border-t border-border flex items-center justify-between gap-1">
          <Button
            variant="brand"
            size="sm"
            className="h-8 px-3 text-xs font-medium shadow-xs"
            onClick={handleOpenDetail}
          >
            <User size={13} className="mr-1.5" />
            Ver legajo
          </Button>

          <div className="flex items-center gap-1">
            <Link
              href={`/viajes?choferId=${chofer.id}`}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-card transition-colors border border-transparent hover:border-[#CBD5E1]"
              title="Ver viajes asociados"
            >
              <MapPin size={14} />
            </Link>

            <button
              onClick={handleToggleEstado}
              disabled={actionLoading}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors border border-transparent hover:bg-card hover:border-[#CBD5E1] ${
                chofer.estado === "activo"
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-emerald-500 hover:text-emerald-600"
              }`}
              title={chofer.estado === "activo" ? "Pasar a inactivo" : "Activar chofer"}
            >
              <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
              title="Eliminar chofer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog Premium para ver Legajo completo */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[760px] md:max-w-[880px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 bg-card border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#E1F5FE] border border-[#B3E5FC] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt={`${chofer.nombre} ${chofer.apellido}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-primary text-base font-bold">{initials}</span>
                )}
              </div>
              <div>
                <DialogTitle className="text-foreground text-xl font-semibold">
                  Legajo Digital: {chofer.apellido}, {chofer.nombre}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs font-mono mt-0.5">
                  DNI {chofer.dni} • Estado: <span className="font-semibold uppercase">{chofer.estado}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Pestañas / Tabs internas */}
            <div className="flex items-center gap-1 mt-5 border-b border-border -mb-4 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-primary border-[#0088D1]"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </DialogHeader>

          <div className="p-6 bg-card max-h-[70vh] overflow-y-auto">
            {tabLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={32} className="animate-spin text-primary" />
              </div>
            ) : detail ? (
              <div className="animate-in fade-in-50 duration-200">
                {activeTab === "info" && (
                  <ChoferInfoTab key={detail.updated_at} chofer={detail} onSaved={refreshDetail} />
                )}
                {activeTab === "documentos" && (
                  <ChoferDocumentosTab chofer={detail} onRefresh={refreshDetail} />
                )}
                {activeTab === "viajes" && <ChoferViajesTab viajes={detail.viajes_recientes} />}
                {activeTab === "cuenta" && <ChoferCuentaTab movimientos={detail.movimientos_mes} />}
              </div>
            ) : (
              <p className="text-center text-muted-foreground/70 text-sm py-12">
                No se pudo cargar el detalle del legajo.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
