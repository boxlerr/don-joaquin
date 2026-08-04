"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Combobox } from "@/components/ui/combobox";
import { setUsuarioAreaAction, setUsuarioSeccionAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldPlus, Trash2, Clock, AlertCircle, Lock, ChevronsUpDown, X } from "lucide-react";
import { areaTitulo, rolLabel, GRUPOS_SIDEBAR, GRUPO_COLOR } from "./area-meta";
import { seccionesDeArea, SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";

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
  overrides: AreaOverrideRow[];
  seccionOverrides: SeccionOverrideRow[];
  confidencial: Record<SeccionCodigo, boolean>;
}

type Grupo = (typeof GRUPOS_SIDEBAR)[number];

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

export default function UsuarioPermisosOverrides({
  usuarios,
  overrides: initialAreaOverrides,
  seccionOverrides: initialSeccionOverrides,
  confidencial,
}: Props) {
  const [areaOverrides, setAreaOverrides] = useState<AreaOverrideRow[]>(initialAreaOverrides);
  const [seccionOverrides, setSeccionOverrides] = useState<SeccionOverrideRow[]>(initialSeccionOverrides);

  const [selectedUsuario, setSelectedUsuario] = useState<string | "">("");
  const [grupoSel, setGrupoSel] = useState<string | "">("");
  const [secs, setSecs] = useState<SeccionCodigo[]>([]);
  const [newNivel, setNewNivel] = useState<AreaNivel>("read");
  const [newVence, setNewVence] = useState<string>("");
  const [newMotivo, setNewMotivo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grupoActual = GRUPOS_SIDEBAR.find((g) => g.group === grupoSel) ?? null;

  function toggleSec(codigo: SeccionCodigo) {
    setSecs((prev) => (prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]));
  }

  function handleAgregar() {
    if (!selectedUsuario || secs.length === 0) return;
    const vence_en = newVence ? new Date(newVence).toISOString() : null;
    setError(null);

    const elegidas = secs;
    const nuevos: SeccionOverrideRow[] = elegidas.map((seccion) => ({
      usuario_id: selectedUsuario, seccion_codigo: seccion, nivel: newNivel, vence_en, motivo: newMotivo || null,
    }));
    setSeccionOverrides((prev) => [
      ...prev.filter((o) => !(o.usuario_id === selectedUsuario && elegidas.includes(o.seccion_codigo))),
      ...nuevos,
    ]);

    startTransition(async () => {
      const results = await Promise.all(
        elegidas.map((s) => setUsuarioSeccionAction(selectedUsuario, s, newNivel, vence_en, newMotivo || undefined)),
      );
      const fallo = results.find((r): r is { error: string } => "error" in r);
      if (fallo) {
        setError(fallo.error);
        setSeccionOverrides(initialSeccionOverrides);
      } else {
        setSecs([]);
        setNewVence("");
        setNewMotivo("");
      }
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

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center gap-2 px-4 sm:px-5 py-4 border-b border-border">
        <ShieldPlus size={16} className="text-primary shrink-0" />
        <h2 className="text-foreground text-sm font-semibold">Permisos individuales por usuario</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Formulario de nuevo override — compacto, en una fila */}
      <div className="px-4 sm:px-5 py-4 border-b border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Agregar permiso puntual
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto] gap-2 items-end">
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

          {/* Área (grupos del sidebar, con color) */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Área</label>
            <Combobox
              value={grupoSel}
              onValueChange={(v) => { setGrupoSel(v); setSecs([]); }}
              options={[
                { id: "", label: "Seleccionar…" },
                ...GRUPOS_SIDEBAR.map((g) => ({ id: g.group, label: g.label, dot: GRUPO_COLOR[g.group] })),
              ]}
              searchPlaceholder="Buscar área..."
              triggerClassName="h-9 w-full text-xs"
            />
          </div>

          {/* Secciones (multi-check en un desplegable) */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Secciones</label>
            <SeccionesPicker grupo={grupoActual} secs={secs} onToggle={toggleSec} confidencial={confidencial} />
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
                className="h-9 max-md:h-10 flex-1 min-w-0 text-xs rounded-md px-2 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
              />
              <button
                type="button"
                onClick={() => setNewVence(finDeHoy())}
                title="Habilitar solo por hoy"
                className="h-9 max-md:h-10 shrink-0 px-3 text-[11px] rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Hoy
              </button>
            </div>
          </div>

          {/* Botón agregar */}
          <button
            type="button"
            disabled={!selectedUsuario || secs.length === 0 || isPending}
            onClick={handleAgregar}
            className="h-9 max-md:h-11 w-full px-4 text-xs font-semibold rounded-md bg-[#0088D1] text-white hover:bg-[#0077BB] disabled:opacity-40 transition-colors whitespace-nowrap xl:w-auto"
          >
            {secs.length > 0 ? `Agregar ${secs.length}` : "Agregar"}
          </button>
        </div>

        {/* Secciones elegidas (aparecen a medida que se tildan) */}
        {secs.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {secs.map((s) => {
              const sec = SECCION_BY_CODIGO[s];
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-[#BAE6FD] bg-[#F0F9FF] px-2 py-0.5 max-md:py-1.5 text-[11px] max-md:text-xs font-medium text-[#075985]"
                >
                  {confidencial[s] && <Lock size={10} className="shrink-0" />}
                  {sec?.nombre ?? s}
                  <button
                    type="button"
                    onClick={() => toggleSec(s)}
                    className="flex items-center justify-center rounded-full text-[#075985]/60 hover:text-red-500 max-md:size-8"
                    title="Sacar"
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Motivo opcional */}
        <div className="mt-2">
          <input
            type="text"
            value={newMotivo}
            onChange={(e) => setNewMotivo(e.target.value)}
            placeholder="Motivo (opcional)…"
            className="h-9 max-md:h-10 w-full text-xs rounded-md px-2 border border-border bg-card focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
          />
        </div>
      </div>

      {/* Lista de overrides vigentes */}
      {usuariosConOverrides.length === 0 ? (
        <div className="px-4 sm:px-5 py-8 text-center text-sm text-muted-foreground/70">
          No hay permisos individuales configurados.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {usuariosConOverrides.map((u) => {
            const areaRows = areaOverrides.filter((o) => o.usuario_id === u.id);
            const seccionRows = seccionOverrides.filter((o) => o.usuario_id === u.id);
            return (
              <div key={u.id} className="px-4 sm:px-5 py-3">
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

/** Desplegable de secciones con checkboxes (multi-selección) del área elegida. */
function SeccionesPicker({
  grupo, secs, onToggle, confidencial,
}: {
  grupo: Grupo | null;
  secs: SeccionCodigo[];
  onToggle: (s: SeccionCodigo) => void;
  confidencial: Record<SeccionCodigo, boolean>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const disabled = !grupo;
  const multiArea = (grupo?.areas.length ?? 0) > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 max-md:h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-xs text-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={secs.length ? "text-foreground" : "text-muted-foreground"}>
          {secs.length
            ? `${secs.length} sección${secs.length > 1 ? "es" : ""}`
            : disabled
              ? "Elegí un área"
              : "Elegí secciones…"}
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground/70" />
      </button>

      {open && grupo && (
        <div className="absolute z-50 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {grupo.areas.map((area) => {
            const list = seccionesDeArea(area);
            if (!list.length) return null;
            return (
              <div key={area}>
                {multiArea && (
                  <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {areaTitulo(area)}
                  </div>
                )}
                {list.map((s) => (
                  <label
                    key={s.codigo}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 max-md:py-2.5 text-xs hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={secs.includes(s.codigo)}
                      onChange={() => onToggle(s.codigo)}
                      className="h-3.5 w-3.5 max-md:h-4 max-md:w-4 shrink-0 cursor-pointer accent-[#0088D1]"
                    />
                    {confidencial[s.codigo] && <Lock size={11} className="shrink-0 text-amber-600" />}
                    <span className="min-w-0 truncate text-foreground">{s.nombre}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Chip de un permiso otorgado, con botón de quitar. */
function OverrideChip({
  label, lock, nivel, vence_en, motivo, onDelete, disabled,
}: {
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
      className={`flex max-w-full flex-wrap items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
        vencido
          ? "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground/50"
          : "bg-[#F0F9FF] border-[#BAE6FD] text-[#075985]"
      }`}
    >
      <span className={NIVEL_CLASS[nivel] + " px-1.5 py-0.5 rounded text-[10px]"}>
        {NIVEL_LABEL[nivel]}
      </span>
      <span className="font-semibold inline-flex min-w-0 items-center gap-1">
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
        className="ml-auto flex items-center justify-center rounded p-0.5 max-md:size-9 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-30 sm:ml-1"
        title="Quitar permiso"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
