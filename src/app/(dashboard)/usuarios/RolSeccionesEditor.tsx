"use client";

import { useMemo, useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
import { updateRolSeccionAction } from "./actions";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";
import { SECCIONES, seccionesDeArea, type SeccionCodigo } from "@/lib/secciones";
import { areaTitulo, NIVEL_INFO, rolLabel } from "./area-meta";
import { ListChecks, Lock, AlertCircle } from "lucide-react";

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
type Overrides = Record<string, Partial<Record<SeccionCodigo, AreaNivel>>>;

interface Props {
  roles: Rol[];
  areas: Area[];
  /** Nivel por rol×área (la matriz) — de ahí hereda cada subsección. */
  matriz: Matriz;
  /** Overrides actuales rol×subsección. */
  initial: Overrides;
  /** Confidencialidad efectiva por subsección (DB > catálogo de código). */
  confidencial: Record<SeccionCodigo, boolean>;
}

const RANK: Record<AreaNivel, number> = { none: 0, read: 1, write: 2, admin: 3 };
const ESCALA: AreaNivel[] = ["none", "read", "write", "admin"];

// Áreas que tienen al menos una subsección, en orden.
const AREAS_CON_SECCIONES = [...new Set(SECCIONES.map((s) => s.area))];

export default function RolSeccionesEditor({ roles, areas, matriz, initial, confidencial }: Props) {
  const esConf = (s: { codigo: SeccionCodigo; confidencial?: boolean }) =>
    confidencial[s.codigo] ?? !!s.confidencial;
  const editables = useMemo(() => roles.filter((r) => r.codigo !== "admin"), [roles]);
  const [rolId, setRolId] = useState<string>(editables[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Overrides>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const areaOrden = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of areas) m[a.codigo] = a.orden;
    return m;
  }, [areas]);

  const areasMostrar = useMemo(
    () => [...AREAS_CON_SECCIONES].sort((a, b) => (areaOrden[a] ?? 99) - (areaOrden[b] ?? 99)),
    [areaOrden],
  );

  if (editables.length === 0) return null;

  const rolOverrides = overrides[rolId] ?? {};

  const handleChange = (seccion: SeccionCodigo, valor: AreaNivel | "hereda") => {
    const cellKey = `${rolId}:${seccion}`;
    const prev = rolOverrides[seccion];
    setError(null);
    setSaving(cellKey);

    // Optimistic
    setOverrides((o) => {
      const delRol = { ...(o[rolId] ?? {}) };
      if (valor === "hereda") delete delRol[seccion];
      else delRol[seccion] = valor;
      return { ...o, [rolId]: delRol };
    });

    startTransition(async () => {
      const res = await updateRolSeccionAction(rolId, seccion, valor);
      setSaving(null);
      if ("error" in res) {
        setError(res.error);
        // revertir
        setOverrides((o) => {
          const delRol = { ...(o[rolId] ?? {}) };
          if (prev === undefined) delete delRol[seccion];
          else delRol[seccion] = prev;
          return { ...o, [rolId]: delRol };
        });
      }
    });
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="px-5 py-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Permisos finos por subsección</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada subsección <b className="text-foreground">hereda el permiso del área</b>. Acá podés
          cerrar páginas puntuales de un rol sin tocar el resto — por ejemplo, dar{" "}
          <b className="text-foreground">Choferes</b> pero no <b className="text-foreground">Sueldos</b>.
          Las marcadas con <Lock size={11} className="inline -mt-0.5 text-amber-600" /> son sensibles:
          arrancan cerradas y hay que abrirlas a mano.
        </p>
        <div className="w-full max-w-xs">
          <label className="text-[11px] text-muted-foreground font-medium">Rol a configurar</label>
          <Combobox
            value={rolId}
            onValueChange={setRolId}
            options={editables.map((r) => ({ id: r.id, label: rolLabel(r.nombre) }))}
            searchPlaceholder="Buscar rol..."
            triggerClassName="h-9 w-full text-xs mt-1"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {areasMostrar.map((area) => {
          const areaLvl = (matriz[rolId]?.[area] ?? "none") as AreaNivel;
          const subs = seccionesDeArea(area).filter(
            // si el rol no tiene el área, solo tiene sentido mostrar las confidenciales (otorgables aparte)
            (s) => esConf(s) || RANK[areaLvl] > 0,
          );
          if (subs.length === 0) return null;

          return (
            <div key={area} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
                <span className="text-xs font-semibold text-foreground">{areaTitulo(area)}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${NIVEL_INFO[areaLvl].clase}`}
                  title="Nivel del área que se hereda por defecto"
                >
                  Área: {NIVEL_INFO[areaLvl].label}
                </span>
              </div>
              <div className="divide-y divide-border">
                {subs.map((s) => {
                  const ov = rolOverrides[s.codigo];
                  const cellKey = `${rolId}:${s.codigo}`;
                  const isSaving = saving === cellKey && isPending;

                  // Opciones: "Hereda" + niveles válidos. No confidencial: solo restringir (<= área).
                  const confSec = esConf(s);
                  const opciones = confSec
                    ? [
                        { id: "hereda", label: "Sin acceso (cerrado)" },
                        { id: "read", label: "Lectura" },
                        { id: "write", label: "Edición" },
                        { id: "admin", label: "Admin" },
                      ]
                    : [
                        { id: "hereda", label: `Hereda · ${NIVEL_INFO[areaLvl].label}` },
                        { id: "none", label: "Sin acceso" },
                        ...ESCALA.filter((n) => n !== "none" && RANK[n] < RANK[areaLvl]).map((n) => ({
                          id: n,
                          label: NIVEL_INFO[n].label,
                        })),
                      ];

                  // El value siempre debe estar entre las opciones (si un override viejo
                  // quedó por encima del tope del área, se muestra como "Hereda").
                  const value = ov && opciones.some((o) => o.id === ov) ? ov : "hereda";
                  // Clase del trigger según el nivel efectivo mostrado.
                  const efectivo: AreaNivel = ov ?? (confSec ? "none" : areaLvl);

                  return (
                    <div key={s.codigo} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-foreground min-w-0">
                        {confSec && <Lock size={12} className="text-amber-600 shrink-0" />}
                        <span className="truncate">{s.nombre}</span>
                      </span>
                      <Combobox
                        value={value}
                        disabled={isSaving}
                        onValueChange={(v) => handleChange(s.codigo, v as AreaNivel | "hereda")}
                        options={opciones}
                        searchable={false}
                        triggerClassName={`h-8 w-40 text-[11px] font-medium shrink-0 ${NIVEL_INFO[efectivo].clase} ${
                          isSaving ? "opacity-60" : ""
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
