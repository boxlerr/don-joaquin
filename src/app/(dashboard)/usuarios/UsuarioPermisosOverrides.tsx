"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
import { setUsuarioAreaAction, setUsuarioSeccionAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldPlus, Trash2, Clock, AlertCircle, Lock } from "lucide-react";
import { areaTitulo, rolLabel } from "./area-meta";
import { SECCION_BY_CODIGO, type SeccionCodigo } from "@/lib/secciones";
import { SIDEBAR_ARBOL } from "./sidebar-tree";

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
  const [secs, setSecs] = useState<SeccionCodigo[]>([]); // secciones tildadas
  const [newNivel, setNewNivel] = useState<AreaNivel>("read");
  const [newVence, setNewVence] = useState<string>("");
  const [newMotivo, setNewMotivo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  // Fila de sección con casillero (misma forma que el editor de confidenciales).
  const filaSeccion = (seccion: SeccionCodigo, label: string, indent: boolean) => {
    const on = secs.includes(seccion);
    return (
      <label
        key={seccion}
        className={`flex items-center gap-2 py-1.5 pr-3 cursor-pointer hover:bg-muted/40 ${indent ? "pl-7" : "pl-3"}`}
      >
        <input
          type="checkbox"
          checked={on}
          onChange={() => toggleSec(seccion)}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#0088D1]"
        />
        {confidencial[seccion] && <Lock size={12} className="shrink-0 text-amber-600" />}
        <span className="min-w-0 truncate text-xs text-foreground">{label}</span>
      </label>
    );
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <ShieldPlus size={16} className="text-primary" />
        <h2 className="text-foreground text-sm font-semibold">Permisos individuales por usuario</h2>
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

        {/* Usuario / Nivel / Vencimiento / botón */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,1.3fr)_auto] gap-2 items-end">
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

          <button
            type="button"
            disabled={!selectedUsuario || secs.length === 0 || isPending}
            onClick={handleAgregar}
            className="h-9 px-4 text-xs font-semibold rounded-md bg-[#0088D1] text-white hover:bg-[#0077BB] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {secs.length > 0 ? `Agregar ${secs.length}` : "Agregar"}
          </button>
        </div>

        {/* Grilla con forma de sidebar (igual que Secciones confidenciales), con casilleros */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {SIDEBAR_ARBOL.map((grupo) => (
            <div key={grupo.label} className="rounded-lg border border-border overflow-hidden self-start">
              <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: grupo.color }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: grupo.color }}>
                  {grupo.label}
                </span>
              </div>
              <div className="divide-y divide-border">
                {grupo.paginas.map((pagina) =>
                  pagina.subs ? (
                    <div key={pagina.label}>
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-foreground bg-muted/20 border-b border-border/60">
                        {pagina.label}
                      </div>
                      <div className="divide-y divide-border/60">
                        {pagina.subs.map((sub) => filaSeccion(sub.seccion, sub.label, true))}
                      </div>
                    </div>
                  ) : (
                    filaSeccion(pagina.seccion!, pagina.label, false)
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

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
          Tildá <span className="font-medium">una o varias secciones</span> — incluidas las{" "}
          <span className="inline-flex items-center gap-0.5"><Lock size={10} /> confidenciales</span>{" "}
          (Préstamos, Cheques, Sueldos…) — y tocá Agregar. Solo suma sobre el permiso del rol, sin abrírselas al resto.
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
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
        vencido
          ? "bg-muted/30 border-dashed border-muted-foreground/30 text-muted-foreground/50"
          : "bg-[#F0F9FF] border-[#BAE6FD] text-[#075985]"
      }`}
    >
      <span className={NIVEL_CLASS[nivel] + " px-1.5 py-0.5 rounded text-[10px]"}>
        {NIVEL_LABEL[nivel]}
      </span>
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
        className="ml-1 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded p-0.5 transition-colors disabled:opacity-30"
        title="Quitar permiso"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
