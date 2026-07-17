"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  updateRolAreaAction,
  crearRolAction,
  renombrarRolAction,
  eliminarRolAction,
} from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldCheck, AlertCircle, Pencil, Trash2, Plus, Check, X, Lock } from "lucide-react";
import { areaPaginas, NIVEL_INFO, rolLabel, GRUPOS_SIDEBAR, type GrupoSidebar } from "./area-meta";

interface Rol {
  id: string;
  codigo: string;
  nombre: string;
}

interface Area {
  codigo: AreaCodigo;
  nombre: string;
  orden: number;
}

type Matriz = Record<string, Partial<Record<AreaCodigo, AreaNivel>>>;

interface Props {
  roles: Rol[];
  areas: Area[];
  initialMatriz: Matriz;
  /** rol_id -> cantidad de usuarios con ese rol. */
  conteoPorRol: Record<string, number>;
}

const NIVELES: AreaNivel[] = ["none", "read", "write"];
// "admin" ya no se ofrece; para mostrar niveles viejos se topea en "write".
const RANK: Record<AreaNivel, number> = { none: 0, read: 1, write: 2, admin: 2 };
const cap = (n: AreaNivel): AreaNivel => (n === "admin" ? "write" : n);

export default function RolesPermisosMatrix({ roles, initialMatriz, conteoPorRol }: Props) {
  const [matriz, setMatriz] = useState<Matriz>(initialMatriz);
  const [listaRoles, setListaRoles] = useState<Rol[]>(roles);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  // Edición inline del nombre de un rol / creación de rol nuevo.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [borrando, setBorrando] = useState<Rol | null>(null);

  /** Nivel de un grupo para un rol: el más alto de sus áreas (topeado en "write").
   * Al setearlo se emparejan todas las áreas del grupo a ese nivel. */
  const nivelGrupo = (rol_id: string, grupo: GrupoSidebar): AreaNivel =>
    grupo.areas
      .map((a) => cap(matriz[rol_id]?.[a] ?? "none"))
      .reduce((max, n) => (RANK[n] > RANK[max] ? n : max), "none" as AreaNivel);

  /** Setea todas las áreas de un grupo al mismo nivel (control grueso). */
  const setGrupo = (rol_id: string, grupo: GrupoSidebar, nivel: AreaNivel) => {
    const prev = Object.fromEntries(grupo.areas.map((a) => [a, matriz[rol_id]?.[a] ?? "none"]));
    setMatriz((m) => {
      const row = { ...m[rol_id] };
      for (const a of grupo.areas) row[a] = nivel;
      return { ...m, [rol_id]: row };
    });
    setSavingCell(`${rol_id}:${grupo.group}`);
    setError(null);

    startTransition(async () => {
      let err: string | null = null;
      for (const a of grupo.areas) {
        const res = await updateRolAreaAction(rol_id, a, nivel);
        if ("error" in res) { err = res.error; break; }
      }
      setSavingCell(null);
      if (err) {
        setError(err);
        setMatriz((m) => {
          const row = { ...m[rol_id] };
          for (const a of grupo.areas) row[a] = prev[a] as AreaNivel;
          return { ...m, [rol_id]: row };
        });
      }
    });
  };

  const guardarNombre = (rol: Rol) => {
    const nombre = nombreEdit.trim();
    if (nombre.length < 2 || nombre === rol.nombre) { setEditandoId(null); return; }
    setError(null);
    startTransition(async () => {
      const res = await renombrarRolAction(rol.id, nombre);
      if ("error" in res) setError(res.error);
      else { setListaRoles((rs) => rs.map((r) => (r.id === rol.id ? { ...r, nombre } : r))); setEditandoId(null); }
    });
  };

  const crear = () => {
    const nombre = nombreNuevo.trim();
    if (nombre.length < 2) return;
    setError(null);
    startTransition(async () => {
      const res = await crearRolAction(nombre);
      if ("error" in res) setError(res.error);
      else { setListaRoles((rs) => [...rs, res.rol]); setNombreNuevo(""); setCreando(false); }
    });
  };

  const eliminar = (rol: Rol) => {
    setError(null);
    startTransition(async () => {
      const res = await eliminarRolAction(rol.id);
      if ("error" in res) setError(res.error);
      else { setListaRoles((rs) => rs.filter((r) => r.id !== rol.id)); setBorrando(null); }
    });
  };

  const rolesOrdenados = [...listaRoles].sort((a, b) => {
    if (a.codigo === "admin") return -1;
    if (b.codigo === "admin") return 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  const tituloGrupo = (g: GrupoSidebar) =>
    `Controla: ${g.areas.flatMap((a) => areaPaginas(a)).join(", ")}`;

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="px-5 py-4 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Roles y permisos (vista del sidebar)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada <b className="text-foreground">fila</b> es un rol (pasá el mouse por el nombre para
          renombrarlo o borrarlo) y cada <b className="text-foreground">columna</b> un grupo del menú.
          Lo <b className="text-foreground">confidencial</b> (Sueldos, Caja, Métricas…) queda cerrado para todos
          salvo el Administrador, aunque el grupo esté en Edición. El rol{" "}
          <b className="text-foreground">Administrador</b> siempre tiene todo.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {NIVELES.map((n) => (
            <span key={n} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${NIVEL_INFO[n].clase}`} title={NIVEL_INFO[n].desc}>
              {NIVEL_INFO[n].label}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 top-0 bg-muted z-20 border-b border-border min-w-[220px]">
                Rol
              </th>
              {GRUPOS_SIDEBAR.map((g) => (
                <th
                  key={g.group}
                  title={tituloGrupo(g)}
                  className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap bg-muted/40 border-b border-border text-center cursor-help"
                >
                  {g.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rolesOrdenados.map((rol) => {
              const isAdminRow = rol.codigo === "admin";
              const usuarios = conteoPorRol[rol.id] ?? 0;
              return (
                <tr key={rol.id} className="hover:bg-muted/20 group/rol">
                  <td className="px-4 py-2 sticky left-0 bg-card z-10 border-b border-border align-middle" title={`Código interno: ${rol.codigo}`}>
                    {editandoId === rol.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={nombreEdit}
                          disabled={isPending}
                          onChange={(e) => setNombreEdit(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(rol); if (e.key === "Escape") setEditandoId(null); }}
                          className="h-8 w-40 rounded-md border border-border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
                        />
                        <button type="button" title="Guardar" onClick={() => guardarNombre(rol)} disabled={isPending} className="flex items-center justify-center size-7 rounded-md text-emerald-600 hover:bg-emerald-50">
                          <Check size={15} />
                        </button>
                        <button type="button" title="Cancelar" onClick={() => setEditandoId(null)} disabled={isPending} className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-muted">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground whitespace-nowrap flex items-center gap-1.5">
                            {rolLabel(rol.nombre)}
                            {isAdminRow && (
                              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700">
                                <Lock size={10} /> Protegido
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {usuarios} usuario{usuarios === 1 ? "" : "s"}
                          </span>
                        </div>
                        {!isAdminRow && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/rol:opacity-100 transition-opacity">
                            <button type="button" title="Renombrar" onClick={() => { setEditandoId(rol.id); setNombreEdit(rol.nombre); setError(null); }} className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-primary hover:bg-muted">
                              <Pencil size={13} />
                            </button>
                            <button type="button" title={usuarios > 0 ? "No se puede borrar: tiene usuarios asignados" : "Eliminar rol"} disabled={usuarios > 0} onClick={() => { setBorrando(rol); setError(null); }} className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:bg-transparent">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  {GRUPOS_SIDEBAR.map((g) => {
                    const value = nivelGrupo(rol.id, g);
                    const cellKey = `${rol.id}:${g.group}`;
                    const saving = savingCell === cellKey && isPending;
                    return (
                      <td key={g.group} className="px-2 py-2 text-center border-b border-border">
                        {isAdminRow ? (
                          <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${NIVEL_INFO.admin.clase}`}>
                            Total
                          </span>
                        ) : (
                          <Combobox
                            value={value}
                            disabled={saving}
                            onValueChange={(v) => setGrupo(rol.id, g, v as AreaNivel)}
                            options={NIVELES.map((n) => ({ id: n, label: NIVEL_INFO[n].label }))}
                            searchable={false}
                            triggerClassName={`h-8 w-32 text-xs font-medium ${NIVEL_INFO[value].clase} ${saving ? "opacity-60" : ""}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Fila para crear un rol nuevo, inline (sin modal). */}
            <tr className="bg-muted/10">
              <td className="px-4 py-2.5 sticky left-0 bg-muted/10 z-10 border-b border-border">
                {creando ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={nombreNuevo}
                      disabled={isPending}
                      placeholder="Nombre del rol nuevo"
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") crear(); if (e.key === "Escape") { setCreando(false); setNombreNuevo(""); } }}
                      className="h-8 w-48 rounded-md border border-border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30"
                    />
                    <button type="button" title="Crear" onClick={crear} disabled={isPending || nombreNuevo.trim().length < 2} className="flex items-center justify-center size-7 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
                      <Check size={15} />
                    </button>
                    <button type="button" title="Cancelar" onClick={() => { setCreando(false); setNombreNuevo(""); }} disabled={isPending} className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-muted">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setCreando(true); setError(null); }} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <Plus size={15} /> Crear rol
                  </button>
                )}
              </td>
              <td colSpan={GRUPOS_SIDEBAR.length} className="border-b border-border bg-muted/10">
                {creando && (
                  <span className="text-[11px] text-muted-foreground px-3">
                    Arranca sin permisos: le asignás el acceso a cada grupo una vez creado.
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!borrando}
        onOpenChange={(o) => !o && setBorrando(null)}
        title="Eliminar rol"
        description={borrando ? (<>Vas a eliminar el rol <b>{borrando.nombre}</b>. No se puede deshacer.</>) : undefined}
        confirmLabel="Eliminar rol"
        loading={isPending}
        onConfirm={() => borrando && eliminar(borrando)}
      />
    </div>
  );
}
