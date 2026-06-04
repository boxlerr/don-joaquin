"use client";

import { useState, useTransition } from "react";
import { setUsuarioAreaAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldPlus, Trash2, Clock, AlertCircle } from "lucide-react";
import { areaTitulo } from "./area-meta";

interface Area {
  codigo: AreaCodigo;
  nombre: string;
  orden: number;
}

interface OverrideRow {
  usuario_id: string;
  area_codigo: AreaCodigo;
  nivel: AreaNivel;
  vence_en: string | null;
  motivo: string | null;
}

interface UsuarioFila {
  id: string;
  nombre: string;
  apellido: string | null;
  rol_nombre: string | null;
}

interface Props {
  usuarios: UsuarioFila[];
  areas: Area[];
  overrides: OverrideRow[];
}

const NIVEL_LABEL: Record<AreaNivel, string> = {
  none: "—",
  read: "Lectura",
  write: "Edición",
  admin: "Admin",
};

const NIVEL_CLASS: Record<AreaNivel, string> = {
  none: "bg-muted text-muted-foreground",
  read: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  write: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  admin: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

function finDeHoy(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  // Formato datetime-local: "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`;
}

function formatVence(vence_en: string | null): string {
  if (!vence_en) return "Permanente";
  const d = new Date(vence_en);
  const ahora = new Date();
  if (d <= ahora) return "Expirado";
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function estaVencido(vence_en: string | null): boolean {
  if (!vence_en) return false;
  return new Date(vence_en) <= new Date();
}

export default function UsuarioPermisosOverrides({ usuarios, areas, overrides: initialOverrides }: Props) {
  const [overrides, setOverrides] = useState<OverrideRow[]>(initialOverrides);
  const [selectedUsuario, setSelectedUsuario] = useState<string | "">("");
  const [newArea, setNewArea] = useState<AreaCodigo | "">("");
  const [newNivel, setNewNivel] = useState<AreaNivel>("read");
  const [newVence, setNewVence] = useState<string>("");
  const [newMotivo, setNewMotivo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const areasOrdered = [...areas].sort((a, b) => a.orden - b.orden);

  const overridesPorUsuario = overrides.reduce<Record<string, OverrideRow[]>>((acc, o) => {
    if (!acc[o.usuario_id]) acc[o.usuario_id] = [];
    acc[o.usuario_id].push(o);
    return acc;
  }, {});

  function handleAgregar() {
    if (!selectedUsuario || !newArea || !newNivel) return;
    const vence_en = newVence ? new Date(newVence).toISOString() : null;
    setError(null);

    // Optimistic update
    const nuevo: OverrideRow = {
      usuario_id: selectedUsuario,
      area_codigo: newArea as AreaCodigo,
      nivel: newNivel,
      vence_en,
      motivo: newMotivo || null,
    };
    setOverrides((prev) => {
      const sin = prev.filter((o) => !(o.usuario_id === selectedUsuario && o.area_codigo === newArea));
      return [...sin, nuevo];
    });

    startTransition(async () => {
      const res = await setUsuarioAreaAction(selectedUsuario, newArea as AreaCodigo, newNivel, vence_en, newMotivo || undefined);
      if ("error" in res) {
        setError(res.error);
        setOverrides(initialOverrides); // revertir
      } else {
        setNewArea("");
        setNewVence("");
        setNewMotivo("");
      }
    });
  }

  function handleQuitar(usuario_id: string, area_codigo: AreaCodigo) {
    setError(null);
    setOverrides((prev) => prev.filter((o) => !(o.usuario_id === usuario_id && o.area_codigo === area_codigo)));
    startTransition(async () => {
      const res = await setUsuarioAreaAction(usuario_id, area_codigo, "quitar", null);
      if ("error" in res) {
        setError(res.error);
        setOverrides(initialOverrides); // revertir
      }
    });
  }

  const usuariosConOverrides = usuarios.filter((u) => (overridesPorUsuario[u.id]?.length ?? 0) > 0);

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldPlus size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">
            Permisos individuales por usuario
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Solo suman sobre el permiso del rol — nunca restan.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Formulario de nuevo override */}
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Agregar permiso puntual
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
          {/* Usuario */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Usuario</label>
            <select
              value={selectedUsuario}
              onChange={(e) => setSelectedUsuario(e.target.value)}
              className="w-full text-xs rounded-md px-2 py-1.5 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
            >
              <option value="">Seleccionar…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido ?? ""} ({u.rol_nombre ?? "sin rol"})
                </option>
              ))}
            </select>
          </div>

          {/* Área */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Área</label>
            <select
              value={newArea}
              onChange={(e) => setNewArea(e.target.value as AreaCodigo)}
              className="w-full text-xs rounded-md px-2 py-1.5 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
            >
              <option value="">Seleccionar…</option>
              {areasOrdered.map((a) => (
                <option key={a.codigo} value={a.codigo}>{areaTitulo(a.codigo, a.nombre)}</option>
              ))}
            </select>
          </div>

          {/* Nivel */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nivel</label>
            <select
              value={newNivel}
              onChange={(e) => setNewNivel(e.target.value as AreaNivel)}
              className={`w-full text-xs rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 ${NIVEL_CLASS[newNivel]}`}
            >
              {(["read", "write", "admin"] as AreaNivel[]).map((n) => (
                <option key={n} value={n}>{NIVEL_LABEL[n]}</option>
              ))}
            </select>
          </div>

          {/* Vencimiento */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={11} />
              Vence (vacío = permanente)
            </label>
            <div className="flex gap-1">
              <input
                type="datetime-local"
                value={newVence}
                onChange={(e) => setNewVence(e.target.value)}
                className="flex-1 text-xs rounded-md px-2 py-1.5 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
              />
              <button
                type="button"
                onClick={() => setNewVence(finDeHoy())}
                title="Habilitar solo por hoy"
                className="px-2 py-1.5 text-[11px] rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Hoy
              </button>
            </div>
          </div>

          {/* Botón agregar */}
          <button
            type="button"
            disabled={!selectedUsuario || !newArea || isPending}
            onClick={handleAgregar}
            className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#0088D1] text-white hover:bg-[#0077BB] disabled:opacity-40 transition-colors"
          >
            Agregar
          </button>
        </div>

        {/* Motivo opcional */}
        <div className="mt-2">
          <input
            type="text"
            value={newMotivo}
            onChange={(e) => setNewMotivo(e.target.value)}
            placeholder="Motivo (opcional)…"
            className="w-full text-xs rounded-md px-2 py-1.5 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
          />
        </div>
      </div>

      {/* Lista de overrides vigentes */}
      {usuariosConOverrides.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground/70">
          No hay permisos individuales configurados.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {usuariosConOverrides.map((u) => {
            const rows = overridesPorUsuario[u.id] ?? [];
            return (
              <div key={u.id} className="px-5 py-3">
                <p className="text-xs font-semibold text-foreground mb-2">
                  {u.nombre} {u.apellido ?? ""}
                  <span className="text-muted-foreground font-normal ml-1">({u.rol_nombre ?? "sin rol"})</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {rows.map((row) => {
                    const vencido = estaVencido(row.vence_en);
                    return (
                      <div
                        key={row.area_codigo}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
                          vencido
                            ? "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground/50"
                            : "bg-[#F0F9FF] border-[#BAE6FD] text-[#075985]"
                        }`}
                      >
                        <span className={NIVEL_CLASS[row.nivel] + " px-1.5 py-0.5 rounded text-[10px]"}>
                          {NIVEL_LABEL[row.nivel]}
                        </span>
                        <span className="font-semibold">
                          {areaTitulo(row.area_codigo)}
                        </span>
                        <span className="text-muted-foreground font-normal">
                          {vencido ? "· Expirado" : `· ${formatVence(row.vence_en)}`}
                        </span>
                        {row.motivo && (
                          <span className="text-muted-foreground/60 italic">"{row.motivo}"</span>
                        )}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleQuitar(row.usuario_id, row.area_codigo)}
                          className="ml-1 text-muted-foreground/50 hover:text-red-500 transition-colors disabled:opacity-30"
                          title="Quitar permiso"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
