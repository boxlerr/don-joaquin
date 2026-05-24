"use client";

import { useState, useTransition } from "react";
import { updateRolAreaAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldCheck, AlertCircle } from "lucide-react";

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

export default function RolesPermisosMatrix({ roles, areas, initialMatriz }: Props) {
  const [matriz, setMatriz] = useState<Matriz>(initialMatriz);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const handleChange = (rol_id: string, area: AreaCodigo, nivel: AreaNivel) => {
    const cellKey = `${rol_id}:${area}`;
    const prev = matriz[rol_id]?.[area] ?? "none";
    setMatriz((m) => ({ ...m, [rol_id]: { ...m[rol_id], [area]: nivel } }));
    setSavingCell(cellKey);
    setError(null);

    startTransition(async () => {
      const res = await updateRolAreaAction(rol_id, area, nivel);
      setSavingCell(null);
      if ("error" in res) {
        setError(res.error);
        setMatriz((m) => ({ ...m, [rol_id]: { ...m[rol_id], [area]: prev } }));
      }
    });
  };

  const areasOrdered = [...areas].sort((a, b) => a.orden - b.orden);

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">
            Matriz de permisos por área
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          El rol <span className="font-mono">admin</span> no es editable.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/40 z-10">
                Rol
              </th>
              {areasOrdered.map((a) => (
                <th
                  key={a.codigo}
                  className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {a.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((rol) => {
              const isAdminRow = rol.codigo === "admin";
              return (
                <tr key={rol.id} className="border-t border-border">
                  <td className="px-4 py-2 sticky left-0 bg-card z-10">
                    <div className="font-medium text-foreground">{rol.nombre}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{rol.codigo}</div>
                  </td>
                  {areasOrdered.map((a) => {
                    const nivel = matriz[rol.id]?.[a.codigo] ?? "none";
                    const cellKey = `${rol.id}:${a.codigo}`;
                    const saving = savingCell === cellKey && isPending;
                    return (
                      <td key={a.codigo} className="px-2 py-2 text-center">
                        {isAdminRow ? (
                          <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${NIVEL_CLASS.admin}`}>
                            Admin
                          </span>
                        ) : (
                          <select
                            value={nivel}
                            disabled={saving}
                            onChange={(e) =>
                              handleChange(rol.id, a.codigo, e.target.value as AreaNivel)
                            }
                            className={`text-xs rounded px-2 py-1 border border-border font-medium cursor-pointer transition-colors ${NIVEL_CLASS[nivel]} ${saving ? "opacity-60" : ""}`}
                          >
                            {(Object.keys(NIVEL_LABEL) as AreaNivel[]).map((n) => (
                              <option key={n} value={n}>
                                {NIVEL_LABEL[n]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
