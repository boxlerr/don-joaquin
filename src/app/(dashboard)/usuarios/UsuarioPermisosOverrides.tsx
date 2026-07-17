"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
import { setUsuarioAreaAction, setUsuarioSeccionAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldPlus, Trash2, Clock, AlertCircle, Lock } from "lucide-react";
import { areaTitulo, areaColor, rolLabel } from "./area-meta";
import { seccionesDeArea, SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";

interface Area {
  codigo: AreaCodigo;
  nombre: string;
  orden: number;
}

interface AreaOverrideRow {
  usuario_id: string;
  area_codigo: AreaCodigo;
  nivel: AreaNivel;
  vence_en: string | null;
  motivo: string | null;
}

interface SeccionOverrideRow {
  usuario_id: string;
  seccion_codigo: SeccionCodigo;
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
  overrides: AreaOverrideRow[];
  seccionOverrides: SeccionOverrideRow[];
  confidencial: Record<SeccionCodigo, boolean>;
}

const NIVEL_LABEL: Record<AreaNivel, string> = {
  none: "—",
  read: "Lectura",
  write: "Edición",
  admin: "Admin",
};

const NIVEL_CLASS: Record<AreaNivel, string> = {
  none: "bg-muted text-muted-foreground",
  read: "bg-blue-50 text-blue-700",
  write: "bg-green-50 text-green-700",
  admin: "bg-amber-50 text-amber-700",
};

function finDeHoy(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`;
}

function formatVence(vence_en: string | null): string {
  if (!vence_en) return "Permanente";
  const d = new Date(vence_en);
  if (d <= new Date()) return "Expirado";
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function estaVencido(vence_en: string | null): boolean {
  if (!vence_en) return false;
  return new Date(vence_en) <= new Date();
}

/** Fondo + borde tenue en el color del área (funciona en claro y oscuro). */
function tint(hex: string) {
  return { background: `${hex}14`, borderColor: `${hex}55` };
}

export default function UsuarioPermisosOverrides({
  usuarios,
  areas,
  overrides: initialAreaOverrides,
  seccionOverrides: initialSeccionOverrides,
  confidencial,
}: Props) {
  const [areaOverrides, setAreaOverrides] = useState<AreaOverrideRow[]>(initialAreaOverrides);
  const [seccionOverrides, setSeccionOverrides] = useState<SeccionOverrideRow[]>(initialSeccionOverrides);

  const [selectedUsuario, setSelectedUsuario] = useState<string | "">("");
  const [newArea, setNewArea] = useState<AreaCodigo | "">("");
  const [selectedSecs, setSelectedSecs] = useState<SeccionCodigo[]>([]); // vacío = toda el área
  const [newNivel, setNewNivel] = useState<AreaNivel>("read");
  const [newVence, setNewVence] = useState<string>("");
  const [newMotivo, setNewMotivo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const areasOrdered = [...areas].sort((a, b) => a.orden - b.orden);
  const seccionesDelArea = newArea ? seccionesDeArea(newArea) : [];

  function resetForm() {
    setNewArea("");
    setSelectedSecs([]);
    setNewVence("");
    setNewMotivo("");
  }

  function toggleSec(codigo: SeccionCodigo) {
    setSelectedSecs((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo],
    );
  }

  function handleAgregar() {
    if (!selectedUsuario || !newArea) return;
    const vence_en = newVence ? new Date(newVence).toISOString() : null;
    setError(null);

    // Sin secciones elegidas → override de toda el área (comportamiento original).
    if (selectedSecs.length === 0) {
      const area = newArea as AreaCodigo;
      const nuevo: AreaOverrideRow = {
        usuario_id: selectedUsuario, area_codigo: area, nivel: newNivel, vence_en, motivo: newMotivo || null,
      };
      setAreaOverrides((prev) => [
        ...prev.filter((o) => !(o.usuario_id === selectedUsuario && o.area_codigo === area)),
        nuevo,
      ]);
      startTransition(async () => {
        const res = await setUsuarioAreaAction(selectedUsuario, area, newNivel, vence_en, newMotivo || undefined);
        if ("error" in res) { setError(res.error); setAreaOverrides(initialAreaOverrides); }
        else resetForm();
      });
      return;
    }

    // Una o varias secciones puntuales, de un tiro.
    const secs = selectedSecs;
    const nuevos: SeccionOverrideRow[] = secs.map((seccion) => ({
      usuario_id: selectedUsuario, seccion_codigo: seccion, nivel: newNivel, vence_en, motivo: newMotivo || null,
    }));
    setSeccionOverrides((prev) => [
      ...prev.filter((o) => !(o.usuario_id === selectedUsuario && secs.includes(o.seccion_codigo))),
      ...nuevos,
    ]);
    startTransition(async () => {
      const results = await Promise.all(
        secs.map((seccion) =>
          setUsuarioSeccionAction(selectedUsuario, seccion, newNivel, vence_en, newMotivo || undefined),
        ),
      );
      const fallo = results.find((r): r is { error: string } => "error" in r);
      if (fallo) { setError(fallo.error); setSeccionOverrides(initialSeccionOverrides); }
      else resetForm();
    });
  }

  function quitarArea(usuario_id: string, area_codigo: AreaCodigo) {
    setError(null);
    setAreaOverrides((prev) => prev.filter((o) => !(o.usuario_id === usuario_id && o.area_codigo === area_codigo)));
    startTransition(async () => {
      const res = await setUsuarioAreaAction(usuario_id, area_codigo, "quitar", null);
      if ("error" in res) { setError(res.error); setAreaOverrides(initialAreaOverrides); }
    });
  }

  function quitarSeccion(usuario_id: string, seccion_codigo: SeccionCodigo) {
    setError(null);
    setSeccionOverrides((prev) => prev.filter((o) => !(o.usuario_id === usuario_id && o.seccion_codigo === seccion_codigo)));
    startTransition(async () => {
      const res = await setUsuarioSeccionAction(usuario_id, seccion_codigo, "quitar", null);
      if ("error" in res) { setError(res.error); setSeccionOverrides(initialSeccionOverrides); }
    });
  }

  const usuariosConOverrides = usuarios.filter(
    (u) =>
      areaOverrides.some((o) => o.usuario_id === u.id) ||
      seccionOverrides.some((o) => o.usuario_id === u.id),
  );

  const btnLabel = selectedSecs.length > 1 ? `Agregar ${selectedSecs.length}` : "Agregar";

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldPlus size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Permisos individuales por usuario</h2>
        </div>
        <p className="text-xs text-muted-foreground">Solo suman sobre el permiso del rol — nunca restan.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Formulario de nuevo override */}
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Agregar permiso puntual
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.3fr)_auto] gap-2 items-end">
          {/* Usuario */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Usuario</label>
            <Combobox
              value={selectedUsuario}
              onValueChange={setSelectedUsuario}
              options={[
                { id: "", label: "Seleccionar…" },
                ...usuarios.map((u) => ({
                  id: u.id,
                  label: `${u.nombre} ${u.apellido ?? ""} (${u.rol_nombre ? rolLabel(u.rol_nombre) : "sin rol"})`,
                })),
              ]}
              searchPlaceholder="Buscar usuario..."
              triggerClassName="h-9 w-full text-xs"
            />
          </div>

          {/* Área */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              Área
              {newArea && (
                <span className="size-2 rounded-full" style={{ background: areaColor(newArea) }} />
              )}
            </label>
            <Combobox
              value={newArea}
              onValueChange={(v) => {
                setNewArea(v as AreaCodigo);
                setSelectedSecs([]); // al cambiar de área se resetean las secciones
              }}
              options={[
                { id: "", label: "Seleccionar…" },
                ...areasOrdered.map((a) => ({ id: a.codigo, label: areaTitulo(a.codigo, a.nombre) })),
              ]}
              searchPlaceholder="Buscar área..."
              triggerClassName="h-9 w-full text-xs"
            />
          </div>

          {/* Nivel */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nivel</label>
            <Combobox
              value={newNivel}
              onValueChange={(v) => setNewNivel(v as AreaNivel)}
              options={(["read", "write"] as AreaNivel[]).map((n) => ({ id: n, label: NIVEL_LABEL[n] }))}
              searchable={false}
              triggerClassName={`h-9 w-full text-xs ${NIVEL_CLASS[newNivel]}`}
            />
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
                className="flex-1 min-w-0 text-xs rounded-md px-2 py-1.5 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
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
            className="h-9 px-4 text-xs font-semibold rounded-md bg-[#0088D1] text-white hover:bg-[#0077BB] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {btnLabel}
          </button>
        </div>

        {/* Selector de secciones (multi) — aparece al elegir un área con subsecciones */}
        {newArea && seccionesDelArea.length > 0 && (
          <div className="mt-3">
            <label className="text-xs text-muted-foreground">
              Secciones <span className="text-muted-foreground/70">— elegí una o varias, o dejá “Toda el área”</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <SecChip
                active={selectedSecs.length === 0}
                color={areaColor(newArea)}
                onClick={() => setSelectedSecs([])}
              >
                Toda el área
              </SecChip>
              {seccionesDelArea.map((s) => (
                <SecChip
                  key={s.codigo}
                  active={selectedSecs.includes(s.codigo)}
                  color={areaColor(newArea)}
                  lock={confidencial[s.codigo]}
                  onClick={() => toggleSec(s.codigo)}
                >
                  {s.nombre}
                </SecChip>
              ))}
            </div>
          </div>
        )}

        {/* Motivo opcional */}
        <div className="mt-3">
          <input
            type="text"
            value={newMotivo}
            onChange={(e) => setNewMotivo(e.target.value)}
            placeholder="Motivo (opcional)…"
            className="w-full text-xs rounded-md px-2 py-1.5 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
          />
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Elegí <span className="font-medium">un área</span> para todas sus páginas, o bajá a{" "}
          <span className="font-medium">una o varias secciones</span> — incluidas las{" "}
          <span className="inline-flex items-center gap-0.5"><Lock size={10} /> confidenciales</span>{" "}
          (Préstamos, Cheques, Sueldos…), sin abrírselas al resto del rol.
        </p>
      </div>

      {/* Lista de overrides vigentes */}
      {usuariosConOverrides.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground/70">
          No hay permisos individuales configurados.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {usuariosConOverrides.map((u) => {
            const areaRows = areaOverrides.filter((o) => o.usuario_id === u.id);
            const seccionRows = seccionOverrides.filter((o) => o.usuario_id === u.id);
            return (
              <div key={u.id} className="px-5 py-3">
                <p className="text-xs font-semibold text-foreground mb-2">
                  {u.nombre} {u.apellido ?? ""}
                  <span className="text-muted-foreground font-normal ml-1">
                    ({u.rol_nombre ? rolLabel(u.rol_nombre) : "sin rol"})
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {areaRows.map((row) => (
                    <OverrideChip
                      key={`area-${row.area_codigo}`}
                      color={areaColor(row.area_codigo)}
                      label={areaTitulo(row.area_codigo)}
                      nivel={row.nivel}
                      vence_en={row.vence_en}
                      motivo={row.motivo}
                      disabled={isPending}
                      onDelete={() => quitarArea(row.usuario_id, row.area_codigo)}
                    />
                  ))}
                  {seccionRows.map((row) => {
                    const sec = SECCION_BY_CODIGO[row.seccion_codigo];
                    return (
                      <OverrideChip
                        key={`sec-${row.seccion_codigo}`}
                        color={sec ? areaColor(sec.area) : "#64748B"}
                        label={sec ? `${areaTitulo(sec.area)} · ${sec.nombre}` : row.seccion_codigo}
                        lock={confidencial[row.seccion_codigo]}
                        nivel={row.nivel}
                        vence_en={row.vence_en}
                        motivo={row.motivo}
                        disabled={isPending}
                        onDelete={() => quitarSeccion(row.usuario_id, row.seccion_codigo)}
                      />
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

/** Chip togglable del selector de secciones. */
function SecChip({
  active, color, lock, onClick, children,
}: {
  active: boolean;
  color: string;
  lock?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? tint(color) : undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {active && <span className="size-1.5 rounded-full shrink-0" style={{ background: color }} />}
      {lock && <Lock size={10} className="shrink-0" />}
      {children}
    </button>
  );
}

/** Chip de un permiso otorgado (en el color de su área), con botón de quitar. */
function OverrideChip({
  color, label, lock, nivel, vence_en, motivo, onDelete, disabled,
}: {
  color: string;
  label: string;
  lock?: boolean;
  nivel: AreaNivel;
  vence_en: string | null;
  motivo: string | null;
  onDelete: () => void;
  disabled: boolean;
}) {
  const vencido = estaVencido(vence_en);
  return (
    <div
      style={vencido ? undefined : tint(color)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
        vencido ? "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground/50" : "text-foreground"
      }`}
    >
      <span className={NIVEL_CLASS[nivel] + " px-1.5 py-0.5 rounded text-[10px]"}>
        {NIVEL_LABEL[nivel]}
      </span>
      {!vencido && <span className="size-2 rounded-full shrink-0" style={{ background: color }} />}
      <span className="font-semibold inline-flex items-center gap-1">
        {lock && <Lock size={10} className="shrink-0" />}
        {label}
      </span>
      <span className="text-muted-foreground font-normal">
        {vencido ? "· Expirado" : `· ${formatVence(vence_en)}`}
      </span>
      {motivo && <span className="text-muted-foreground/60 italic">&quot;{motivo}&quot;</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="ml-1 text-muted-foreground/50 hover:text-red-500 transition-colors disabled:opacity-30"
        title="Quitar permiso"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
