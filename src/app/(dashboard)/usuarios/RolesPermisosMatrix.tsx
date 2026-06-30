"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
import { updateRolAreaAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { areaTitulo, areaPaginas, NIVEL_INFO, rolLabel } from "./area-meta";

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

const NIVELES: AreaNivel[] = ["none", "read", "write", "admin"];

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
      <div className="px-5 py-4 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Matriz de permisos por área</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada <b className="text-foreground">fila</b> es un rol y cada <b className="text-foreground">columna</b> un área del sistema.
          Definí acá el nivel base por área. ¿Necesitás cerrar una página puntual (ej.{" "}
          <b className="text-foreground">Sueldos</b>)? Usá <b className="text-foreground">Permisos finos por subsección</b>,
          más abajo. El rol <b className="text-foreground">Administrador</b> siempre tiene todo.
        </p>
        {/* Leyenda de niveles */}
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 top-0 bg-muted z-20 border-b border-border">
                Rol
              </th>
              {areasOrdered.map((a) => (
                <th
                  key={a.codigo}
                  title={`Controla: ${areaPaginas(a.codigo).join(", ") || a.nombre}`}
                  className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap bg-muted/40 border-b border-border text-center cursor-help"
                >
                  {areaTitulo(a.codigo, a.nombre)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((rol) => {
              const isAdminRow = rol.codigo === "admin";
              return (
                <tr key={rol.id} className="hover:bg-muted/20">
                  <td
                    className="px-4 py-2 sticky left-0 bg-card z-10 border-b border-border"
                    title={`Código interno: ${rol.codigo}`}
                  >
                    <div className="font-medium text-foreground whitespace-nowrap">{rolLabel(rol.nombre)}</div>
                  </td>
                  {areasOrdered.map((a) => {
                    const nivel = matriz[rol.id]?.[a.codigo] ?? "none";
                    const cellKey = `${rol.id}:${a.codigo}`;
                    const saving = savingCell === cellKey && isPending;
                    return (
                      <td key={a.codigo} className="px-2 py-2 text-center border-b border-border">
                        {isAdminRow ? (
                          <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${NIVEL_INFO.admin.clase}`}>
                            Admin
                          </span>
                        ) : (
                          <Combobox
                            value={nivel}
                            disabled={saving}
                            onValueChange={(v) => handleChange(rol.id, a.codigo, v as AreaNivel)}
                            options={NIVELES.map((n) => ({ id: n, label: NIVEL_INFO[n].label }))}
                            searchable={false}
                            triggerClassName={`h-8 w-32 text-xs font-medium ${NIVEL_INFO[nivel].clase} ${saving ? "opacity-60" : ""}`}
                          />
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
