"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SiluetaPersona } from "@/components/ui/AvatarPersona";
import StatusBadge from "@/components/ui/StatusBadge";
import { Combobox } from "@/components/ui/combobox";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Camera, Edit, Loader2, Phone, Mail, MapPin, Calendar, Clock, AlertCircle, LogOut, FileText, Check, Truck, Cake, AlertTriangle, Trash2, X, Trophy } from "lucide-react";
import type { ChoferDetail } from "./types";
import { createClient } from "@/lib/supabase/client";
import { marcarAlertasVistas } from "@/app/(dashboard)/notificaciones/actions";
import { uploadFotoChoferAction, deleteFotoChoferAction, deleteChoferAction } from "../actions";
import { updateEgresoAction } from "./actions";
import ExportarLegajoButton from "./ExportarLegajoButton";
import { formatFecha } from "@/lib/utils";

interface Props {
  chofer: ChoferDetail;
  onRefresh: () => void;
  onSelectTab?: (tabId: "documentos") => void;
  editing?: boolean;
  onEditar?: () => void;
}

export default function ChoferHeader({ chofer, onRefresh, onSelectTab, editing, onEditar }: Props) {
  const router = useRouter();
  const [markingRead, setMarkingRead] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Eliminar el legajo entero. Está acá porque es donde se termina cuando se
  // cargó a alguien por error: antes había que egresarlo para que apareciera el
  // botón en la tarjeta del listado.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEliminar = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteChoferAction(chofer.id);
    if (res?.error) {
      setDeleteError(res.error);
      setConfirmDelete(false);
      setDeleting(false);
      return;
    }
    router.push("/choferes");
    router.refresh();
  };

  // Edición de la información del egreso (solo para choferes dados de baja).
  const [editandoEgreso, setEditandoEgreso] = useState(false);
  const [savingEgreso, setSavingEgreso] = useState(false);
  const [egMotivo, setEgMotivo] = useState<string>(chofer.motivo_egreso ?? "");
  const [egFecha, setEgFecha] = useState<string>(chofer.fecha_egreso ?? "");
  const [egObs, setEgObs] = useState<string>(chofer.observaciones ?? "");

  const handleGuardarEgreso = async () => {
    setSavingEgreso(true);
    try {
      const res = await updateEgresoAction(chofer.id, {
        motivo_egreso: egMotivo || null,
        fecha_egreso: egFecha || null,
        observaciones: egObs.trim() || null,
      });
      if (!res.error) {
        setEditandoEgreso(false);
        onRefresh();
      }
    } finally {
      setSavingEgreso(false);
    }
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFotoError("Solo se permiten imágenes (JPG, PNG, WEBP, GIF, HEIC).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFotoError(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. Máximo 5 MB.`);
      return;
    }

    setUploadingFoto(true);
    setFotoError(null);
    try {
      const formData = new FormData();
      formData.set("chofer_id", chofer.id);
      formData.set("file", file);
      const res = await uploadFotoChoferAction(formData);
      if (res.error) setFotoError(res.error);
      else onRefresh();
    } catch (err) {
      console.error(err);
      setFotoError("No se pudo subir la foto. Probá con otra imagen o formato.");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFotoDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadingFoto(true);
    setFotoError(null);
    try {
      const res = await deleteFotoChoferAction(chofer.id);
      if (res.error) setFotoError(res.error);
      else onRefresh();
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleMarcarLeidas = async () => {
    if (!chofer.alertas || chofer.alertas.length === 0) return;
    setMarkingRead(true);
    try {
      await marcarAlertasVistas(chofer.alertas.map((a) => a.id));
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingRead(false);
    }
  };


  const estadoTone: "success" | "archivado" | "neutral" | "error" =
    chofer.estado === "activo"
      ? "success"
      : chofer.estado === "baja"
      ? "archivado"
      : "neutral";
  const estadoLabel = chofer.estado === "baja" ? "egresado" : chofer.estado;

  const esBaja = chofer.estado === "baja";
  // Solo los choferes usan camión de la flota; admin/mantenimiento/fleteros no.
  const rolChofer = (chofer as { rol?: string | null }).rol;
  const esChofer = !rolChofer || rolChofer === "chofer";
  const antiguedad = formatAntiguedad(chofer.fecha_ingreso, esBaja ? chofer.fecha_egreso : null);
  const edad = calcularEdad(chofer.fecha_nacimiento);
  const periodoPrueba = !esBaja ? diasRestantesPeriodoPrueba(chofer.fecha_ingreso) : null;
  const cumple = !esBaja ? proximoCumpleanos(chofer.fecha_nacimiento) : null;
  const docsResumen = !esBaja ? resumirVencimientos(chofer.documentos_vigencia) : null;
  const camionLabel = chofer.camion_actual
    ? [chofer.camion_actual.marca, chofer.camion_actual.patente].filter(Boolean).join(" · ")
    : null;
  const tiempoEnEmpresa =
    esBaja && chofer.fecha_ingreso && chofer.fecha_egreso
      ? formatDuracion(chofer.fecha_ingreso, chofer.fecha_egreso)
      : null;
  const observacionEgreso = obtenerObservacionEgreso(chofer.observaciones);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  return (
    // El legajo de un egresado se leía como una alerta: la tarjeta entera lavada
    // de amarillo, con otro recuadro amarillo adentro. Un egreso es un archivo,
    // no un problema: misma tarjeta que el resto y el estado se dice con
    // palabras, no tiñendo el fondo.
    <div className="rounded-[8px] border border-border bg-card shadow-sm p-4 sm:p-6">
      {/* En celular el bloque de acciones no entra al lado del nombre: se apila
          debajo y ocupa el ancho, en vez de aplastar el avatar y los datos. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative flex-shrink-0 group/avatar">
            <div
              className="w-14 h-14 rounded-full bg-[#E1F5FE] flex items-center justify-center overflow-hidden border border-[#B3E5FC] cursor-pointer relative"
              onClick={() => fileInputRef.current?.click()}
              title={fotoUrl ? "Hacer clic para cambiar la foto" : "Hacer clic para subir una foto"}
            >
              {fotoUrl ? (
                <img src={fotoUrl} alt={`${chofer.nombre} ${chofer.apellido}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                // Mientras no haya foto, la silueta del área. Las iniciales no
                // decían nada teniendo el nombre al lado.
                <SiluetaPersona rol={chofer.rol} className="text-primary" />
              )}

              <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                <Camera size={14} className="text-white" />
                <span className="text-[9px] font-medium text-white tracking-wider uppercase">
                  {fotoUrl ? "Cambiar" : "Subir"}
                </span>
              </div>

              {uploadingFoto && (
                <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-10">
                  <Loader2 size={18} className="animate-spin text-primary" />
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

            {/* En celular no hay hover: si el botón queda en opacity-0 no hay
                forma de borrar la foto desde el teléfono. Abajo de md se ve
                siempre y es más grande para el dedo. */}
            {fotoUrl && !uploadingFoto && (
              <button
                type="button"
                onClick={handleFotoDelete}
                className="absolute -top-1.5 -right-1.5 size-7 md:-top-1 md:-right-1 md:size-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md border-2 border-white transition-opacity z-20 md:opacity-0 md:group-hover/avatar:opacity-100"
                title="Eliminar foto"
              >
                <Trash2 size={12} className="md:size-2.5" />
              </button>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-foreground text-lg sm:text-xl font-semibold break-words">
              {chofer.apellido}, {chofer.nombre}
            </h1>
            <p className="text-muted-foreground text-sm font-mono mt-0.5">DNI {chofer.dni}</p>
            {fotoError && (
              <p className="mt-1 text-[11px] text-red-600">{fotoError}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <StatusBadge label={estadoLabel} tone={estadoTone} />
              {!esBaja && chofer.score_trimestre !== null && (
                <TooltipProvider delay={100}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span
                          className="inline-flex cursor-help items-center gap-1.5 text-[13px] text-muted-foreground"
                          style={{
                            color:
                              chofer.score_trimestre >= 80
                                ? "#059669"
                                : chofer.score_trimestre >= 60
                                  ? "#B45309"
                                  : "#B91C1C",
                          }}
                        >
                          <Trophy size={14} />
                          <span className="font-semibold">Score {chofer.score_trimestre}</span>
                        </span>
                      }
                    />
                    <TooltipContent side="bottom" className="block max-w-[260px] text-left">
                      <div className="font-semibold mb-1">
                        Score del último trimestre: {chofer.score_trimestre}
                      </div>
                      {chofer.score_trimestre_desglose.length === 0 ? (
                        <div className="text-[11px]">Sin penalizaciones — conducta perfecta 🟢</div>
                      ) : (
                        <ul className="space-y-0.5 text-[11px]">
                          <li className="flex justify-between gap-4 opacity-70">
                            <span>Base</span>
                            <b>100</b>
                          </li>
                          {chofer.score_trimestre_desglose.map((d, i) => (
                            <li key={i} className="flex justify-between gap-4">
                              <span>{d.label}</span>
                              <b className="tabular-nums">{d.puntos}</b>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-1.5 pt-1 border-t border-background/20 text-[10px] opacity-70">
                        🟢 ≥80 · 🟡 60-79 · 🔴 &lt;60 · detalle completo en Ranking
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {!esBaja && esChofer && (
                <span
                  className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"
                  title={camionLabel ? "Camión asignado actualmente" : "Sin camión asignado"}
                >
                  <Truck size={14} className={camionLabel ? "text-primary" : "text-muted-foreground/60"} />
                  {camionLabel ? (
                    <span className="font-medium text-foreground">{camionLabel}</span>
                  ) : (
                    "Sin camión asignado"
                  )}
                </span>
              )}
              {periodoPrueba !== null && periodoPrueba > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-[#B45309]">
                  <AlertCircle size={14} />
                  <span className="font-medium">
                    Período de prueba: quedan {periodoPrueba} {periodoPrueba === 1 ? "día" : "días"}
                  </span>
                </span>
              )}
              {cumple && (
                <span
                  className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"
                  title={`Fecha de nacimiento: ${cumple.fechaLabel}`}
                >
                  <Cake size={14} className="text-[#DB2777]" />
                  <span className="font-medium text-foreground">{cumple.label}</span>
                </span>
              )}
              {docsResumen && (
                <button
                  type="button"
                  onClick={() => onSelectTab?.("documentos")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium hover:underline ${
                    docsResumen.vencidos > 0 ? "text-[#B91C1C]" : "text-[#B45309]"
                  }`}
                  title="Ver documentación"
                >
                  <AlertTriangle size={14} />
                  {docsResumen.label}
                </button>
              )}
              {chofer.alertas && chofer.alertas.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarcarLeidas}
                  disabled={markingRead}
                  className="inline-flex min-h-9 cursor-pointer select-none items-center gap-1.5 rounded-[6px] border border-border px-2.5 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50 md:min-h-0"
                  title="Marcar todas las alertas de este legajo como leídas"
                >
                  <Check size={12} strokeWidth={3} className={markingRead ? "animate-spin" : ""} />
                  Marcar como leídas
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:flex-nowrap">
          <ExportarLegajoButton choferId={chofer.id} canVerSueldos={chofer.can_ver_sueldos} />
          {!editing && (
            <Button
              variant="outline"
              className="h-10 flex-1 border-[#CBD5E1] px-4 text-sm text-foreground/90 hover:bg-muted/40 sm:flex-none"
              onClick={() => onEditar?.()}
            >
              <Edit size={15} className="mr-2 text-primary" />
              Editar
            </Button>
          )}
          {!editing && (
            <Button
              variant="outline"
              className="h-10 flex-1 border-red-200 px-3 text-sm text-red-600 hover:bg-red-50 sm:flex-none"
              onClick={() => {
                setDeleteError(null);
                setConfirmDelete(true);
              }}
              title="Eliminar este legajo del sistema"
            >
              <Trash2 size={15} className="mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">
            ¿Eliminar el legajo de {chofer.apellido}, {chofer.nombre}?
          </p>
          <p className="mt-0.5 text-red-600/80">
            Se borra entero y no se puede deshacer. Es para los que se cargaron por error: si la
            persona ya tiene viajes o documentos, el sistema lo impide y hay que egresarla.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 max-md:h-9 bg-red-600 text-white hover:bg-red-700"
              onClick={handleEliminar}
              disabled={deleting}
            >
              {deleting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Trash2 size={13} className="mr-1.5" />}
              Sí, eliminar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 max-md:h-9 border-red-200 text-red-700 hover:bg-red-100"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="mt-4 flex items-start gap-2 rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{deleteError}</span>
          <button type="button" onClick={() => setDeleteError(null)} className="hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Antes eran 7 columnas fijas y el texto se cortaba en "Ingreso: 01/09/20…".
          Ahora fluye y cada dato ocupa lo que necesita. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#F1F5F9] pt-4 sm:gap-x-6">
        <InfoItem icon={<Phone size={14} />} tono="#059669" label={chofer.telefono ?? "—"} />
        <InfoItem icon={<Mail size={14} />} tono="#0277BD" label={chofer.email ?? "—"} />
        <InfoItem icon={<MapPin size={14} />} tono="#DC2626" label={chofer.localidad ?? "—"} />
        {esChofer && (
          <InfoItem
            icon={<Truck size={13} />}
            label={chofer.camion_actual ? `Camión: ${chofer.camion_actual.patente}` : "Sin camión"}
          />
        )}
        <InfoItem
          icon={<Calendar size={14} />}
          tono="#7C3AED"
          label={`Ingreso: ${formatFecha(chofer.fecha_ingreso)}`}
        />
        <InfoItem icon={<Clock size={14} />} tono="#D97706" label={`Antigüedad: ${antiguedad}`} />
        <InfoItem
          icon={<Cake size={14} />}
          tono="#DB2777"
          label={`Edad: ${edad != null ? `${edad} años` : "—"}`}
        />
      </div>

      {/* Egreso — sin caja de color: es una sección más del encabezado. */}
      {esBaja && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <LogOut size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Información del egreso
              </h3>
            </div>
            {!editandoEgreso ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 max-md:h-9 text-xs"
                onClick={() => {
                  setEgMotivo(chofer.motivo_egreso ?? "");
                  setEgFecha(chofer.fecha_egreso ?? "");
                  setEgObs(chofer.observaciones ?? "");
                  setEditandoEgreso(true);
                }}
              >
                <Edit size={12} className="mr-1.5 text-primary" /> Editar
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 max-md:h-9 text-xs" onClick={() => setEditandoEgreso(false)} disabled={savingEgreso}>
                  <X size={12} className="mr-1" /> Cancelar
                </Button>
                <Button variant="brand" size="sm" className="h-7 max-md:h-9 text-xs" onClick={handleGuardarEgreso} disabled={savingEgreso}>
                  {savingEgreso ? "Guardando..." : <><Check size={12} className="mr-1" /> Guardar</>}
                </Button>
              </div>
            )}
          </div>
          {!editandoEgreso ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Motivo</div>
                  <div className="font-medium text-foreground capitalize">
                    {chofer.motivo_egreso ?? "No especificado"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Fecha de egreso</div>
                  <div className="font-medium text-foreground">
                    {chofer.fecha_egreso ? formatFecha(chofer.fecha_egreso) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Tiempo en la empresa</div>
                  <div className="font-medium text-foreground">{tiempoEnEmpresa ?? "—"}</div>
                </div>
              </div>
              {observacionEgreso && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                    <FileText size={11} /> Observaciones del egreso
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{observacionEgreso}</p>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Motivo</div>
                <Combobox
                  value={egMotivo}
                  onValueChange={setEgMotivo}
                  options={[
                    { id: "", label: "— Sin especificar —" },
                    { id: "renuncia", label: "Renuncia" },
                    { id: "despido", label: "Despido" },
                    { id: "jubilacion", label: "Jubilación" },
                    { id: "otro", label: "Otro" },
                  ]}
                  searchable={false}
                  triggerClassName="h-9 w-full"
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Fecha de egreso</div>
                <input
                  type="date"
                  value={egFecha}
                  onChange={(e) => setEgFecha(e.target.value)}
                  className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
                />
              </div>
              <div className="sm:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">Observaciones</div>
                <textarea
                  value={egObs}
                  onChange={(e) => setEgObs(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
                  placeholder="Detalle del egreso…"
                />
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

/**
 * Un dato del encabezado. El ícono lleva color propio —era una fila de siete
 * grises iguales y no se distinguía nada— y el texto NO se trunca: "Ingreso:
 * 01/09/20…" no sirve para nada.
 */
function InfoItem({
  icon,
  label,
  tono,
}: {
  icon: React.ReactNode;
  label: string;
  tono?: string;
}) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-foreground/90" title={label}>
      <span
        style={tono ? { color: tono } : undefined}
        className={`shrink-0 ${tono ? "" : "text-muted-foreground/70"}`}
      >
        {icon}
      </span>
      {/* En celular un email largo empujaba la página de costado: se parte en
          dos renglones en vez de truncarse (el dato entero tiene que leerse). */}
      <span className="min-w-0 break-all sm:whitespace-nowrap sm:break-normal">{label}</span>
    </div>
  );
}

function calcularEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return edad >= 0 && edad < 120 ? edad : null;
}

function formatAntiguedad(fechaIngreso: string | null, hasta: string | null = null): string {
  if (!fechaIngreso) return "—";
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return "—";
  const hoy = hasta ? new Date(hasta) : new Date();
  if (Number.isNaN(hoy.getTime())) return "—";
  let años = hoy.getFullYear() - ingreso.getFullYear();
  let meses = hoy.getMonth() - ingreso.getMonth();
  if (hoy.getDate() < ingreso.getDate()) meses -= 1;
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  if (años <= 0 && meses <= 0) {
    const diasMs = hoy.getTime() - ingreso.getTime();
    const dias = Math.max(0, Math.floor(diasMs / 86400000));
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (años <= 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  if (meses <= 0) return `${años} ${años === 1 ? "año" : "años"}`;
  return `${años} ${años === 1 ? "año" : "años"} ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

function formatDuracion(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return "—";
  let años = fin.getFullYear() - inicio.getFullYear();
  let meses = fin.getMonth() - inicio.getMonth();
  if (fin.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  if (años <= 0 && meses <= 0) {
    const dias = Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 86400000));
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (años <= 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  if (meses <= 0) return `${años} ${años === 1 ? "año" : "años"}`;
  return `${años} ${años === 1 ? "año" : "años"} ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

/** Extrae la línea de observación cargada al egresar (formato "Egreso: ...") si existe. */
function obtenerObservacionEgreso(observaciones: string | null | undefined): string | null {
  if (!observaciones) return null;
  const match = observaciones
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith("egreso:"));
  if (match) return match.replace(/^egreso:\s*/i, "");
  return observaciones; // fallback: si no hay marcador, muestro todo
}

function diasRestantesPeriodoPrueba(fechaIngreso: string | null): number | null {
  if (!fechaIngreso) return null;
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return null;
  const fin = new Date(ingreso);
  fin.setMonth(fin.getMonth() + 6);
  const diff = fin.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function proximoCumpleanos(
  fechaNacimiento: string | null,
): { label: string; fechaLabel: string } | null {
  if (!fechaNacimiento) return null;
  // Parseo manual para evitar que YYYY-MM-DD sea interpretado como UTC y se corra un día.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  if (!match) return null;
  const nacMes = parseInt(match[2], 10) - 1;
  const nacDia = parseInt(match[3], 10);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let proximo = new Date(hoy.getFullYear(), nacMes, nacDia);
  if (proximo.getTime() < inicioHoy.getTime()) {
    proximo = new Date(hoy.getFullYear() + 1, nacMes, nacDia);
  }
  const dias = Math.round((proximo.getTime() - inicioHoy.getTime()) / 86400000);
  const fechaLabel = `${String(nacDia).padStart(2, "0")}/${String(nacMes + 1).padStart(2, "0")}`;
  if (dias === 0) return { label: "Cumple hoy 🎉", fechaLabel };
  if (dias <= 30)
    return { label: `Cumple en ${dias} ${dias === 1 ? "día" : "días"}`, fechaLabel };
  return null;
}

function resumirVencimientos(
  documentos: { dias_restantes: number | null }[] | undefined,
): { label: string; vencidos: number; proximos: number } | null {
  if (!documentos || documentos.length === 0) return null;
  let vencidos = 0;
  let proximos = 0;
  for (const doc of documentos) {
    const d = doc.dias_restantes;
    if (d === null || d === undefined) continue;
    if (d < 0) vencidos += 1;
    else if (d <= 30) proximos += 1;
  }
  if (vencidos === 0 && proximos === 0) return null;
  const partes: string[] = [];
  if (vencidos > 0) partes.push(`${vencidos} vencido${vencidos === 1 ? "" : "s"}`);
  if (proximos > 0) partes.push(`${proximos} por vencer`);
  return { label: partes.join(" · "), vencidos, proximos };
}
