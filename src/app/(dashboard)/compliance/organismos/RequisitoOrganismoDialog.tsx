"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  crearRequisitoOrganismoAction,
  editarRequisitoOrganismoAction,
  type OrganismoPeriodicidad,
} from "./actions";
import type { ComplianceDestinatario, ComplianceNivel, OrganismoChecklistRow } from "../types";

/**
 * Alta y edición de un requisito del organismo.
 *
 * Antes esto no existía: SICOP y Secondi eran pantallas de solo lectura sobre
 * una tabla vacía, y el estado vacío decía "agregá requisitos desde la base de
 * datos" — que para quien usa el sistema no es una instrucción, es una pared.
 *
 * El código interno del requisito no se pide: se genera del nombre en el server.
 * Es una clave que nadie de la oficina tiene por qué inventar.
 */

const NIVELES: { value: ComplianceNivel; label: string; ayuda: string }[] = [
  { value: "empresa", label: "De la empresa", ayuda: "Uno solo para toda la firma" },
  { value: "unidad", label: "Por unidad", ayuda: "Uno por cada camión o acoplado" },
  { value: "chofer", label: "Por chofer", ayuda: "Uno por cada chofer" },
];

const PERIODICIDADES: { value: OrganismoPeriodicidad; label: string }[] = [
  { value: "anual", label: "Anual" },
  { value: "mensual", label: "Mensual" },
  { value: "renovable", label: "Renovable (sin período fijo)" },
  { value: "unica", label: "Única vez" },
];

export type RequisitoEditable = Pick<
  OrganismoChecklistRow,
  "requisito_id" | "requisito_nombre" | "requisito_descripcion" | "enviar_a" | "nivel" | "dias_alerta"
> & {
  periodicidad?: OrganismoPeriodicidad;
};

interface Props {
  destinatario: ComplianceDestinatario;
  /** Sin esto es un alta. */
  edit?: RequisitoEditable | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function RequisitoOrganismoDialog({
  destinatario,
  edit,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const esEdicion = !!edit;
  const [nombre, setNombre] = useState(edit?.requisito_nombre ?? "");
  const [descripcion, setDescripcion] = useState(edit?.requisito_descripcion ?? "");
  const [nivel, setNivel] = useState<ComplianceNivel>(edit?.nivel ?? "empresa");
  const [periodicidad, setPeriodicidad] = useState<OrganismoPeriodicidad>(
    edit?.periodicidad ?? "anual",
  );
  const [diasAlerta, setDiasAlerta] = useState(String(edit?.dias_alerta ?? 30));
  const [enviarA, setEnviarA] = useState(edit?.enviar_a ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return setError("Poné el nombre del requisito");

    const dias = Number(diasAlerta);
    if (!Number.isFinite(dias) || dias <= 0) {
      return setError("Los días de aviso tienen que ser un número mayor a 0");
    }

    setLoading(true);
    setError(null);
    try {
      const base = {
        nombre,
        descripcion: descripcion || null,
        nivel,
        periodicidad,
        dias_alerta: dias,
        enviar_a: enviarA || null,
        destinatario_slug: destinatario.codigo.toLowerCase(),
      };
      const res = esEdicion
        ? await editarRequisitoOrganismoAction({ ...base, id: edit!.requisito_id })
        : await crearRequisitoOrganismoAction({ ...base, destinatario_id: destinatario.id });

      if ("error" in res && res.error) setError(res.error);
      else onSuccess();
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg sm:text-xl">
            {esEdicion ? "Editar requisito" : "Nuevo requisito"} — {destinatario.nombre}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {esEdicion
              ? "Cambiá cómo se llama y cuándo avisa. Las presentaciones ya cargadas no se tocan."
              : `Lo que hay que presentar ante ${destinatario.nombre}. Después vas cargando cada presentación con su vencimiento.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="req-nombre" className="text-sm font-medium">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="req-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Habilitación de tránsito"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-desc" className="text-sm font-medium">
              Detalle (opcional)
            </Label>
            <Input
              id="req-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Para qué sirve o qué incluye"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Alcance</Label>
              <Select value={nivel} onValueChange={(v) => setNivel(v as ComplianceNivel)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVELES.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {NIVELES.find((n) => n.value === nivel)?.ayuda}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cada cuánto</Label>
              <Select
                value={periodicidad}
                onValueChange={(v) => setPeriodicidad(v as OrganismoPeriodicidad)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-dias" className="text-sm font-medium">
              Avisar con cuántos días de anticipación
            </Label>
            <Input
              id="req-dias"
              type="number"
              min={1}
              max={365}
              value={diasAlerta}
              onChange={(e) => setDiasAlerta(e.target.value)}
              className="sm:max-w-[140px]"
            />
            <p className="text-[11px] text-muted-foreground">
              Con cuánta anticipación aparece en las alertas y en el correo del día.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-enviar" className="text-sm font-medium">
              A dónde se manda (opcional)
            </Label>
            <Input
              id="req-enviar"
              value={enviarA}
              onChange={(e) => setEnviarA(e.target.value)}
              placeholder="Portal, mail o a quién se le entrega"
            />
            <p className="text-[11px] text-muted-foreground">
              Se muestra en el checklist y en la alerta, para que cualquiera sepa a dónde enviarlo.
            </p>
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading && <Loader2 size={15} className="animate-spin" />}
              {esEdicion ? "Guardar" : "Crear requisito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
