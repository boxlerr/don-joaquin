"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import InlineFeedback from "@/components/ui/InlineFeedback";
import UnidadPicker, { type UnidadValue } from "./UnidadPicker";
import { addServicioAction } from "../actions";
import type { CamionOption, TipoServicioOption } from "../types";

const ESTADO_LABEL: Record<string, string> = {
  interno: "Interno",
  en_transicion: "En transición",
  tercerizado: "Tercerizado",
};


export default function AddServicioDialog({
  children,
  camiones,
  tiposServicio,
}: {
  children?: React.ReactNode;
  camiones: CamionOption[];
  tiposServicio: TipoServicioOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [unidad, setUnidad] = useState<UnidadValue>("");
  const camionId = unidad.startsWith("c:") ? unidad.slice(2) : "";
  const [tipoServicioId, setTipoServicioId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [km, setKm] = useState("");
  const [taller, setTaller] = useState("");
  const [costo, setCosto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [proxFecha, setProxFecha] = useState("");
  const [proxKm, setProxKm] = useState("");

  const camionSel = camiones.find((c) => c.id === camionId);
  const esTercerizado = camionSel?.tercerizacion_estado === "tercerizado";

  // El form se adapta al estado del camión: si está tercerizado (Scania) solo
  // se cargan servicios que aplican a tercerizados (gomería/cubiertas).
  const tiposVisibles = esTercerizado
    ? tiposServicio.filter((t) => t.aplica_a_tercerizado)
    : tiposServicio;

  const tipoSel = tiposServicio.find((t) => t.id === tipoServicioId);

  useEffect(() => {
    if (!open) return;
    setUnidad("");
    setTipoServicioId("");
    setFecha(new Date().toISOString().split("T")[0]);
    setKm("");
    setTaller("");
    setCosto("");
    setObservaciones("");
    setProxFecha("");
    setProxKm("");
    setError(null);
    setSuccess(null);
  }, [open]);

  // Si cambia el camión a tercerizado y el tipo elegido ya no aplica, resetearlo.
  useEffect(() => {
    if (esTercerizado && tipoSel && !tipoSel.aplica_a_tercerizado) {
      setTipoServicioId("");
    }
  }, [esTercerizado, tipoSel]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!camionId) return setError("Elegí un camión.");
    if (!tipoServicioId) return setError("Elegí el tipo de servicio.");
    const kmN = parseInt(km);
    if (!Number.isFinite(kmN) || kmN <= 0) return setError("Cargá el KM del camión.");

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await addServicioAction({
        camion_id: camionId,
        tipo_servicio_id: tipoServicioId,
        fecha,
        km_odometro: kmN,
        taller: taller || null,
        costo: costo ? parseFloat(costo) : null,
        observaciones: observaciones || null,
        proximo_service_fecha: proxFecha || null,
        proximo_service_km: proxKm ? parseInt(proxKm) : null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Servicio registrado");
        router.refresh();
        setTimeout(() => setOpen(false), 800);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Cargar servicio</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registrá un service, reparación o gomería de un camión.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="space-y-2">
            <Label htmlFor="camion" className="text-sm font-medium text-foreground">Camión</Label>
            <UnidadPicker
              id="camion"
              mode="camion"
              value={unidad}
              onChange={setUnidad}
              camiones={camiones}
              placeholder="Buscar por patente, marca o modelo…"
            />
            {camionSel && (
              <p className="text-[11px] text-muted-foreground">
                {esTercerizado
                  ? `Tercerizado — solo se cargan gomería y cubiertas (el resto lo controla la concesionaria).`
                  : `Estado: ${ESTADO_LABEL[camionSel.tercerizacion_estado] ?? camionSel.tercerizacion_estado} — se pueden cargar todos los servicios.`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-sm font-medium text-foreground">Tipo de servicio</Label>
            <Select value={tipoServicioId} onValueChange={(v) => setTipoServicioId(v ?? "")}>
              <SelectTrigger id="tipo" className="w-full">
                <span className={tipoSel ? "" : "text-muted-foreground"}>
                  {tipoSel?.nombre ?? "Seleccionar tipo..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                {tiposVisibles.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-foreground">Fecha</Label>
              <Input id="fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="km" className="text-sm font-medium text-foreground">KM del camión</Label>
              <Input id="km" type="number" placeholder="Ej: 150000" required value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taller" className="text-sm font-medium text-foreground">
                Taller / Concesionaria <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input id="taller" placeholder="Ej: Scania oficial" value={taller} onChange={(e) => setTaller(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo" className="text-sm font-medium text-foreground">
                Costo $ <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input id="costo" type="number" placeholder="Ej: 80000" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs" className="text-sm font-medium text-foreground">
              Notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="obs" placeholder="Detalle del trabajo" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          <div className="rounded-[8px] border border-dashed border-border bg-muted/20 px-4 py-3 space-y-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Próximo service <span className="font-normal normal-case">(opcional — genera alerta)</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proxFecha" className="text-xs font-medium text-muted-foreground">Fecha estimada</Label>
                <Input id="proxFecha" type="date" value={proxFecha} onChange={(e) => setProxFecha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proxKm" className="text-xs font-medium text-muted-foreground">KM estimado</Label>
                <Input id="proxKm" type="number" placeholder="Ej: 170000" value={proxKm} onChange={(e) => setProxKm(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
              {loading ? "Guardando..." : "Registrar servicio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
