"use client";

import { useState, useRef } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Loader2,
  MapPin,
  Phone,
  Calendar,
  RefreshCw,
  Trash2,
  User,
  LogOut,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import {
  updateChoferEstadoAction,
  reactivarChoferAction,
  uploadFotoChoferAction,
  deleteFotoChoferAction,
} from "../actions";
import EgresarChoferDialog from "./EgresarChoferDialog";
import { createClient } from "@/lib/supabase/client";

export default function ChoferCard({ chofer }: { chofer: any }) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [egresarOpen, setEgresarOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  const initials = `${chofer.nombre[0] ?? ""}${chofer.apellido[0] ?? ""}`.toUpperCase();
  const esBaja = chofer.estado === "baja";
  const estadoTone: "success" | "warning" | "neutral" =
    chofer.estado === "activo" ? "success" : esBaja ? "warning" : "neutral";
  const estadoLabel = esBaja ? "egresado" : chofer.estado;

  const handleToggleEstado = async () => {
    if (esBaja) return;
    setActionLoading(true);
    setActionError(null);
    const nuevo = chofer.estado === "activo" ? "inactivo" : "activo";
    const res = await updateChoferEstadoAction(chofer.id, nuevo);
    if (res?.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setActionLoading(false);
  };

  const handleEgresar = () => {
    setActionError(null);
    setEgresarOpen(true);
  };

  const handleReactivar = async () => {
    setActionLoading(true);
    setActionError(null);
    const res = await reactivarChoferAction(chofer.id);
    if (res?.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setActionLoading(false);
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setActionError("Solo se permiten imágenes (JPG, PNG, WEBP, GIF, HEIC).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionError(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo permitido es 5 MB.`);
      return;
    }

    setUploadingFoto(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.set("chofer_id", chofer.id);
      formData.set("file", file);
      const res = await uploadFotoChoferAction(formData);
      if (res.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setActionError("No se pudo subir la foto. Probá con una imagen más liviana o en otro formato.");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFotoDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fotoUrl) return;
    setUploadingFoto(true);
    setActionError(null);
    try {
      const res = await deleteFotoChoferAction(chofer.id);
      if (res.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setUploadingFoto(false);
    }
  };

  return (
    <>
      <div
        className={`bg-card rounded-[12px] border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative group overflow-hidden ${
          esBaja ? "border-amber-200/70 dark:border-amber-500/30" : "border-border"
        }`}
      >
        <div
          className={`h-1.5 w-full ${
            esBaja
              ? "bg-gradient-to-r from-amber-500 to-amber-300"
              : "bg-gradient-to-r from-[#0088D1] to-[#4FC3F7]"
          }`}
        />

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-start gap-4 mb-4">
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

                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                  <Camera size={16} className="text-white" />
                  <span className="text-[9px] font-medium text-white tracking-wider uppercase">
                    {fotoUrl ? "Cambiar" : "Subir"}
                  </span>
                </div>

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

            <div className="flex-1 min-w-0">
              <Link href={`/choferes/${chofer.id}`}>
                <h3 className="text-foreground font-semibold text-base leading-snug truncate group-hover:text-primary transition-colors hover:underline cursor-pointer">
                  {chofer.apellido}, {chofer.nombre}
                </h3>
              </Link>
              <p className="text-muted-foreground text-xs font-mono mt-0.5">DNI {chofer.dni}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge label={estadoLabel} tone={estadoTone} />
              </div>
            </div>
          </div>

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
              <span>
                {chofer.fecha_ingreso
                  ? `Ingreso: ${new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR")}`
                  : "Fecha de ingreso: pendiente"}
              </span>
            </div>
          </div>

          {esBaja && (
            <div className="mt-3 p-3 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                <LogOut size={12} />
                <span className="uppercase tracking-wide">Chofer egresado</span>
              </div>
              {chofer.motivo_egreso && (
                <div className="text-foreground/90">
                  <span className="text-muted-foreground">Motivo:</span>{" "}
                  <span className="font-medium capitalize">{chofer.motivo_egreso}</span>
                </div>
              )}
              {chofer.fecha_egreso && (
                <div className="text-foreground/90">
                  <span className="text-muted-foreground">Fecha de egreso:</span>{" "}
                  {new Date(chofer.fecha_egreso).toLocaleDateString("es-AR")}
                </div>
              )}
              {chofer.fecha_ingreso && chofer.fecha_egreso && (
                <div className="text-foreground/90">
                  <span className="text-muted-foreground">Tiempo en la empresa:</span>{" "}
                  {formatDuracionEmpresa(chofer.fecha_ingreso, chofer.fecha_egreso)}
                </div>
              )}
              {chofer.observaciones && (
                <div className="pt-1 mt-1 border-t border-amber-200/60 dark:border-amber-500/20 text-muted-foreground italic line-clamp-2">
                  {chofer.observaciones}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-muted/40 px-4 py-3 border-t border-border flex items-center justify-between gap-1">
          <Link href={`/choferes/${chofer.id}`}>
            <Button
              variant="brand"
              size="sm"
              className="h-8 px-3 text-xs font-medium shadow-xs"
            >
              <User size={13} className="mr-1.5" />
              Ver legajo
            </Button>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href={`/viajes?choferId=${chofer.id}`}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-card transition-colors border border-transparent hover:border-[#CBD5E1]"
              title="Ver viajes asociados"
            >
              <MapPin size={14} />
            </Link>

            {!esBaja && (
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
            )}

            {esBaja ? (
              <button
                onClick={handleReactivar}
                disabled={actionLoading}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors border border-transparent hover:border-emerald-200"
                title="Reactivar chofer"
              >
                <RotateCcw size={14} className={actionLoading ? "animate-spin" : ""} />
              </button>
            ) : (
              <button
                onClick={handleEgresar}
                disabled={actionLoading}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors border border-transparent hover:border-amber-200"
                title="Egresar chofer (lo pasa al historial)"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-500/10 border-t border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-700 dark:text-red-300 hover:underline"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      <EgresarChoferDialog
        open={egresarOpen}
        onOpenChange={setEgresarOpen}
        chofer={{ id: chofer.id, nombre: chofer.nombre, apellido: chofer.apellido }}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}

function formatDuracionEmpresa(fechaIngreso: string, fechaEgreso: string): string {
  const ingreso = new Date(fechaIngreso);
  const egreso = new Date(fechaEgreso);
  if (Number.isNaN(ingreso.getTime()) || Number.isNaN(egreso.getTime())) return "—";
  let años = egreso.getFullYear() - ingreso.getFullYear();
  let meses = egreso.getMonth() - ingreso.getMonth();
  if (egreso.getDate() < ingreso.getDate()) meses -= 1;
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  if (años <= 0 && meses <= 0) {
    const dias = Math.max(0, Math.floor((egreso.getTime() - ingreso.getTime()) / 86400000));
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (años <= 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  if (meses <= 0) return `${años} ${años === 1 ? "año" : "años"}`;
  return `${años} ${años === 1 ? "año" : "años"} ${meses} ${meses === 1 ? "mes" : "meses"}`;
}
