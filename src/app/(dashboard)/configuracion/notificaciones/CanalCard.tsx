"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/ui/StatusBadge";
import { Edit2, AlertCircle, Mail, MessageCircle, Webhook } from "lucide-react";
import { toggleCanalAction, updateCanalConfigAction } from "./actions";
import type { CanalKey } from "./constants";

type CanalCampo = {
  clave: string;
  label: string;
  placeholder: string;
  type: "email" | "tel" | "url";
};

const CANAL_ICONS: Record<CanalKey, React.ElementType> = {
  email: Mail,
  whatsapp: MessageCircle,
  webhook: Webhook,
};

interface Props {
  canal: {
    key: CanalKey;
    nombre: string;
    descripcion: string;
    configCampos: CanalCampo[];
  };
  activo: boolean;
  configValores: Record<string, string>;
}

export default function CanalCard({ canal, activo, configValores }: Props) {
  const Icon = CANAL_ICONS[canal.key];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(configValores);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();

  function onToggle() {
    setError(null);
    startToggle(async () => {
      const result = await toggleCanalAction({ canal: canal.key, activo: !activo });
      if ("error" in result) setError(result.error);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const result = await updateCanalConfigAction({ canal: canal.key, campos: values });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 800);
    });
  }

  function onOpenChange(next: boolean) {
    if (next) {
      setValues(configValores);
      setError(null);
      setSaved(false);
    }
    setOpen(next);
  }

  return (
    <div className="p-4 bg-card rounded-[8px] border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#E1F5FE] flex items-center justify-center shrink-0">
            <Icon size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-foreground">{canal.nombre}</p>
              <StatusBadge
                label={activo ? "Activo" : "Inactivo"}
                tone={activo ? "success" : "neutral"}
              />
            </div>
            <p className="text-xs text-muted-foreground">{canal.descripcion}</p>
            {error && (
              <p className="text-xs text-[#7F1D1D] mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} />
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Dialog open={open} onOpenChange={onOpenChange}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(true)}
              title={`Configurar ${canal.nombre}`}
            >
              <Edit2 size={14} className="text-primary" />
            </Button>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar {canal.nombre}</DialogTitle>
                <DialogDescription>
                  Datos utilizados para enviar notificaciones por este canal.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={onSubmit} className="space-y-4">
                {canal.configCampos.map((campo) => (
                  <div className="space-y-1.5" key={campo.clave}>
                    <Label htmlFor={campo.clave}>{campo.label}</Label>
                    <Input
                      id={campo.clave}
                      type={campo.type}
                      value={values[campo.clave] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [campo.clave]: e.target.value }))
                      }
                      placeholder={campo.placeholder}
                      disabled={savePending}
                    />
                  </div>
                ))}

                {error && (
                  <div className="text-xs text-[#7F1D1D] bg-[#FEF2F2] border border-[#FEE2E2] rounded-md px-3 py-2 flex items-start gap-2">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {saved && (
                  <div className="text-xs text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-md px-3 py-2">
                    Configuración guardada
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={savePending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="brand" disabled={savePending}>
                    {savePending ? "Guardando..." : "Guardar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* El botón es la zona táctil (36px en celular); la pastilla de adentro
              es lo que se ve. En desktop mide lo mismo que ella. */}
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            disabled={togglePending}
            onClick={onToggle}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md disabled:opacity-50 disabled:cursor-not-allowed sm:size-auto"
            aria-label={`Activar ${canal.nombre}`}
          >
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                activo ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                  activo ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
