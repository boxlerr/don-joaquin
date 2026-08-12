"use client";

import { useState, useRef } from "react";
import { formatFecha } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { SiluetaPersona } from "@/components/ui/AvatarPersona";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
  Truck,
} from "lucide-react";
import {
  uploadFotoChoferAction,
  deleteFotoChoferAction,
  type ChoferMotivoEgreso,
} from "../actions";
import EgresarChoferDialog from "./EgresarChoferDialog";
import { useChoferAcciones } from "./useChoferAcciones";
import { createClient } from "@/lib/supabase/client";
import { choferSlug } from "@/lib/chofer-slug";
import { getLegajoEstado } from "@/lib/chofer-validation";
import { logoDeMarca } from "@/components/ui/MarcaLogo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila de chofer (DB) con muchos campos; los tipos generados no están disponibles acá
export default function ChoferCard({ chofer }: { chofer: any }) {
  // Las acciones (activar/inactivar, egresar, reactivar, eliminar) las comparte
  // con la fila de la tabla: viven en el hook, no acá.
  const acciones = useChoferAcciones(chofer);
  const {
    loading: actionLoading,
    error: actionError,
    setError: setActionError,
    egresarOpen,
    setEgresarOpen,
  } = acciones;
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  const esBaja = chofer.estado === "baja";
  // Fecha de egreso a mostrar: la real si está cargada; si no (bajas cargadas en
  // masa), la fecha en que se registró la baja (updated_at), marcada como
  // aproximada. Así el legajo siempre muestra cuándo egresó.
  const fechaEgresoReal: string | null = chofer.fecha_egreso ?? null;
  const fechaEgresoMostrar: string | null =
    fechaEgresoReal ?? (chofer.updated_at ? String(chofer.updated_at).slice(0, 10) : null);
  const fechaEgresoAprox = esBaja && !fechaEgresoReal;
  const faltanDatosEgreso = esBaja && (!fechaEgresoReal || !chofer.motivo_egreso);
  const legajoEstado = getLegajoEstado(chofer);
  const estadoTone: "success" | "archivado" | "neutral" =
    chofer.estado === "activo" ? "success" : esBaja ? "archivado" : "neutral";
  const estadoLabel = esBaja ? "egresado" : chofer.estado;

  // El camión solo aplica a choferes (no administración/mantenimiento/fletero).
  const esChofer = !chofer.rol || chofer.rol === "chofer";
  const camionPatente: string | null = chofer.camion_patente ?? null;
  const camionMarca: string | null = chofer.camion_marca ?? null;
  // Avisamos "sin camión" solo para choferes activos: un egresado/inactivo sin
  // camión es lo esperado y sería ruido.
  const sinCamion = esChofer && !esBaja && chofer.estado === "activo" && !camionPatente;

  const handleToggleEstado = () => acciones.toggleEstado();
  const handleEgresar = acciones.abrirEgresar;
  const handleReactivar = () => acciones.reactivar();

  const handleEliminar = async () => {
    // Si falló, el motivo se muestra en la tarjeta y la confirmación se cierra:
    // el cartel rojo del server (por ejemplo "ya tiene viajes") es la respuesta.
    await acciones.eliminar();
    setConfirmDelete(false);
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
        acciones.refrescar();
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
        acciones.refrescar();
      }
    } finally {
      setUploadingFoto(false);
    }
  };

  return (
    <>
      <div
        className={`bg-card rounded-[12px] border border-border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative group overflow-hidden ${
          esBaja ? "opacity-75 hover:opacity-100" : ""
        }`}
      >
        <div className={`h-[2px] w-full ${esBaja ? "bg-border" : "bg-primary"}`} />

        <div className="p-4 sm:p-5 flex-1 flex flex-col">
          <div className="flex items-start gap-3 sm:gap-4 mb-4">
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
                  // Mientras no haya foto, la silueta del área. Las iniciales no
                  // decían nada teniendo el nombre al lado.
                  <SiluetaPersona rol={chofer.rol} className="text-primary" />
                )}

                {/* Sólo desde md: en celular no hay hover y el cartel taparía
                    la foto para siempre (ahí va el chip de abajo). */}
                <div className="absolute inset-0 bg-black/55 hidden md:flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
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

              {/* En celular el hover no existe: el disparador de "cambiar foto"
                  tiene que verse siempre o la acción queda inaccesible. */}
              {!uploadingFoto && (
                <span
                  aria-hidden
                  className="md:hidden pointer-events-none absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-card border border-border text-muted-foreground flex items-center justify-center shadow-sm"
                >
                  <Camera size={11} />
                </span>
              )}

              {fotoUrl && !uploadingFoto && (
                <button
                  type="button"
                  onClick={handleFotoDelete}
                  className="absolute -top-1 -right-1 size-6 md:size-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md border-2 border-white opacity-100 md:opacity-0 md:group-hover/avatar:opacity-100 transition-opacity z-20"
                  title="Eliminar foto"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <Link href={`/choferes/${choferSlug(chofer)}`}>
                <h3 className="text-foreground font-semibold text-base leading-snug truncate group-hover:text-primary transition-colors hover:underline cursor-pointer">
                  {chofer.apellido}, {chofer.nombre}
                </h3>
              </Link>
              <p className="text-muted-foreground text-xs font-mono mt-0.5">
                DNI {chofer.dni}
                {chofer.cuil && (
                  <span className="ml-2 text-muted-foreground/60">· CUIL {chofer.cuil}</span>
                )}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <StatusBadge label={estadoLabel} tone={estadoTone} />
                {chofer.rol && chofer.rol !== "chofer" && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${
                      chofer.rol === "fletero"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {chofer.rol === "administrativo"
                      ? "Administración"
                      : chofer.rol === "fletero"
                        ? "Fletero"
                        : "Mantenimiento"}
                  </span>
                )}
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
                  ? `Ingreso: ${formatFecha(chofer.fecha_ingreso)}`
                  : "Fecha de ingreso: pendiente"}
              </span>
            </div>
            {/* Camión asignado — solo para choferes. Patente si tiene; aviso si no. */}
            {esChofer && !esBaja && (
              <div className="flex items-center gap-2">
                <Truck
                  size={13}
                  className={`flex-shrink-0 ${sinCamion ? "text-amber-500" : "text-muted-foreground/70"}`}
                />
                {camionPatente ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    {/* Qué maneja, no sólo la patente: es lo que se pregunta. */}
                    {logoDeMarca(camionMarca) && (
                      // eslint-disable-next-line @next/next/no-img-element -- SVG local
                      <img
                        src={logoDeMarca(camionMarca)!}
                        alt=""
                        title={camionMarca ?? undefined}
                        className="h-3.5 max-w-[26px] shrink-0 object-contain"
                        loading="lazy"
                      />
                    )}
                    <span className="font-mono text-foreground/80">{camionPatente}</span>
                    {camionMarca && camionMarca !== "Sin datos" && (
                      <span className="truncate text-muted-foreground/80">· {camionMarca}</span>
                    )}
                  </span>
                ) : sinCamion ? (
                  <span className="text-[11px] font-medium text-[#B45309]">
                    Sin camión asignado
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">Sin camión</span>
                )}
              </div>
            )}
          </div>

          {!legajoEstado.completo && !esBaja && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-red-700 font-semibold">
                <AlertTriangle size={12} />
                <span className="uppercase tracking-wide">Legajo incompleto</span>
              </div>
              <p className="text-red-700/90">
                Falta: <span className="font-medium">{legajoEstado.faltantes.join(", ")}</span>.
              </p>
              <p className="text-red-700/80">
                No puede ser asignado a viajes, siniestros ni otros movimientos hasta completarse.
              </p>
            </div>
          )}

          {/* Datos recomendados (teléfono/localidad): solo aviso, NO bloquea nada. */}
          {legajoEstado.completo && legajoEstado.faltantesRecomendados.length > 0 && !esBaja && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                <AlertTriangle size={12} />
                <span className="uppercase tracking-wide">Faltan datos</span>
              </div>
              <p className="text-amber-700/90">
                Falta: <span className="font-medium">{legajoEstado.faltantesRecomendados.join(", ")}</span>.
              </p>
            </div>
          )}

          {esBaja && (
            <div className="mt-3 pt-2.5 border-t border-border space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                <LogOut size={12} />
                <span className="uppercase tracking-wide">Chofer egresado</span>
              </div>
              <div className="text-foreground/90">
                <span className="text-muted-foreground">Motivo:</span>{" "}
                <span className="font-medium capitalize">
                  {chofer.motivo_egreso ?? <span className="text-[#B45309] not-italic">Sin especificar</span>}
                </span>
              </div>
              <div className="text-foreground/90">
                <span className="text-muted-foreground">Fecha de egreso:</span>{" "}
                {fechaEgresoMostrar ? (
                  <>
                    {formatFecha(fechaEgresoMostrar)}
                    {fechaEgresoAprox && (
                      <span
                        className="ml-1 text-muted-foreground font-mono"
                        title="Aproximada: es la fecha en que se registró la baja, no un egreso cargado. Completala abajo."
                      >
                        ≈
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[#B45309]">Sin cargar</span>
                )}
              </div>
              {chofer.fecha_ingreso && fechaEgresoMostrar && (
                <div className="text-foreground/90">
                  <span className="text-muted-foreground">Tiempo en la empresa:</span>{" "}
                  {formatDuracionEmpresa(chofer.fecha_ingreso, fechaEgresoMostrar)}
                  {fechaEgresoAprox && <span className="text-muted-foreground font-mono ml-0.5">≈</span>}
                </div>
              )}
              {chofer.observaciones && (
                <div className="pt-1 mt-1 border-t border-border text-muted-foreground italic line-clamp-2">
                  {chofer.observaciones}
                </div>
              )}
              {faltanDatosEgreso && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setEgresarOpen(true);
                  }}
                  className="mt-1 inline-flex min-h-9 items-center gap-1 py-1 font-medium text-[#B45309] hover:underline sm:min-h-0 sm:py-0"
                >
                  <LogOut size={11} />
                  Completar datos de egreso
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pie de acciones: los íconos son 36px en celular (área táctil) y
            vuelven a 32 en desktop. */}
        <div className="bg-muted/40 px-3 py-2.5 sm:px-4 sm:py-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
          <Link href={`/choferes/${choferSlug(chofer)}`}>
            <Button
              variant="brand"
              size="sm"
              className="h-9 sm:h-8 px-3 text-xs font-medium shadow-xs"
            >
              <User size={13} className="mr-1.5" />
              Ver legajo
            </Button>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href={`/viajes?choferId=${chofer.id}`}
              className="inline-flex items-center justify-center size-9 sm:size-8 rounded-md text-muted-foreground hover:text-primary hover:bg-card transition-colors border border-transparent hover:border-[#CBD5E1]"
              title="Ver viajes asociados"
            >
              <MapPin size={14} />
            </Link>

            {!esBaja && (
              <button
                onClick={handleToggleEstado}
                disabled={actionLoading}
                className={`inline-flex items-center justify-center size-9 sm:size-8 rounded-md transition-colors border border-transparent hover:bg-card hover:border-[#CBD5E1] ${
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
                className="inline-flex items-center justify-center size-9 sm:size-8 rounded-md text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200"
                title="Reactivar chofer"
              >
                <RotateCcw size={14} className={actionLoading ? "animate-spin" : ""} />
              </button>
            ) : (
              <button
                onClick={handleEgresar}
                disabled={actionLoading}
                className="inline-flex items-center justify-center size-9 sm:size-8 rounded-md text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors border border-transparent hover:border-amber-200"
                title="Egresar chofer (lo pasa al historial)"
              >
                <LogOut size={14} />
              </button>
            )}

            {/* Eliminar está siempre a mano: un legajo cargado por error se borra
                el mismo día, sin tener que egresarlo primero para que aparezca
                el tacho. Si ya tiene movimientos, el server lo impide. */}
            <button
              onClick={() => {
                setActionError(null);
                setConfirmDelete(true);
              }}
              disabled={actionLoading}
              className="inline-flex items-center justify-center size-9 sm:size-8 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
              title="Eliminar definitivamente del sistema"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="px-4 py-2.5 bg-red-50 border-t border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">¿Eliminar definitivamente a {chofer.apellido}, {chofer.nombre}?</p>
              <p className="text-red-600/80 mt-0.5">
                Se borra el legajo entero y no se puede deshacer. Es para los que se cargaron por error:
                si la persona ya tiene viajes o documentos, el sistema lo impide y hay que usar &quot;Egresar&quot;.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleEliminar}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-1 px-3 h-9 sm:h-7 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {actionLoading && <Loader2 size={11} className="animate-spin" />}
                  Sí, eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={actionLoading}
                  className="px-3 h-9 sm:h-7 rounded-md border border-red-200 hover:bg-red-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {actionError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 self-start px-1 py-1 -my-1 text-red-700 hover:underline"
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
        mode={esBaja ? "editar" : "egresar"}
        initial={
          esBaja
            ? {
                motivo: (chofer.motivo_egreso as ChoferMotivoEgreso | null) ?? undefined,
                fecha_egreso: fechaEgresoMostrar ?? undefined,
              }
            : undefined
        }
        onSuccess={() => {
          acciones.refrescar();
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
