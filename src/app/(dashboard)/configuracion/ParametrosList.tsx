"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bell,
  Building2,
  Check,
  History,
  type LucideIcon,
  Pencil,
  PencilLine,
  Search,
  Shield,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actualizarParametro } from "./actions";
import HistorialDrawer from "./HistorialDrawer";
import BulkEditForm from "./BulkEditForm";
import { getValidacion } from "./validaciones";
import type { Database } from "@/types/database";

type Parametro = Database["public"]["Tables"]["parametros_sistema"]["Row"];

const CATEGORY_META: Record<string, { icon: LucideIcon; titulo: string }> = {
  general: { icon: Building2, titulo: "Empresa y datos generales" },
  notificaciones: { icon: Bell, titulo: "Notificaciones" },
  seguridad: { icon: Shield, titulo: "Seguridad" },
  liquidacion: { icon: Wallet, titulo: "Liquidación" },
  tarifas: { icon: Wallet, titulo: "Tarifas" },
};

const CATEGORY_ORDER = ["general", "notificaciones", "seguridad", "liquidacion", "tarifas"];

function getCategoryMeta(cat: string) {
  return (
    CATEGORY_META[cat] ?? {
      icon: Building2,
      titulo: cat.charAt(0).toUpperCase() + cat.slice(1),
    }
  );
}

function formatValor(valor: string, tipo: string): string {
  if (valor === "") return "—";
  if (tipo === "boolean") return valor === "true" ? "Activado" : "Desactivado";
  return valor;
}

export default function ParametrosList({ parametros }: { parametros: Parametro[] }) {
  const [search, setSearch] = useState("");
  const [bulkCategoria, setBulkCategoria] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<{ cat: string; count: number } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parametros;
    return parametros.filter(
      (p) =>
        p.clave.toLowerCase().includes(q) ||
        (p.descripcion ?? "").toLowerCase().includes(q) ||
        (p.categoria ?? "").toLowerCase().includes(q),
    );
  }, [parametros, search]);

  const grouped = useMemo(() => {
    const acc: Record<string, Parametro[]> = {};
    for (const p of filtered) {
      const cat = p.categoria ?? "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(p);
    }
    return acc;
  }, [filtered]);

  const categoriasVisibles = useMemo(() => {
    const conocidas = CATEGORY_ORDER.filter((c) => grouped[c]?.length);
    const extras = Object.keys(grouped)
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .sort();
    return [...conocidas, ...extras];
  }, [grouped]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
        />
        <Input
          type="search"
          placeholder="Buscar parámetro por nombre, clave o categoría…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {categoriasVisibles.length === 0 && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No se encontraron parámetros con ese criterio.
          </p>
        </div>
      )}

      {categoriasVisibles.map((cat) => {
        const meta = getCategoryMeta(cat);
        const Icon = meta.icon;
        const isBulk = bulkCategoria === cat;
        const tieneEditables = grouped[cat]!.some((p) => p.editable);
        const isSaved = savedBanner?.cat === cat;

        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-muted-foreground" />
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {meta.titulo}
                </h3>
              </div>
              {!isBulk && tieneEditables && !search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setSavedBanner(null);
                    setBulkCategoria(cat);
                  }}
                  className="text-muted-foreground hover:text-primary"
                >
                  <PencilLine size={11} />
                  Editar categoría
                </Button>
              )}
              {isSaved && (
                <span className="flex items-center gap-1 text-xs text-[#10B981] font-medium">
                  <Check size={12} />
                  {savedBanner!.count === 1
                    ? "1 cambio guardado"
                    : `${savedBanner!.count} cambios guardados`}
                </span>
              )}
            </div>

            {isBulk ? (
              <BulkEditForm
                params={grouped[cat]!}
                onCancel={() => setBulkCategoria(null)}
                onSaved={(count) => {
                  setBulkCategoria(null);
                  setSavedBanner({ cat, count });
                  setTimeout(() => setSavedBanner(null), 3000);
                }}
              />
            ) : (
              <div className="bg-card rounded-[8px] border border-border shadow-sm divide-y divide-border">
                {grouped[cat]!.map((p) => (
                  <ParametroRow key={p.id} parametro={p} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ParametroRow({ parametro }: { parametro: Parametro }) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(parametro.valor);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const validacion = getValidacion(parametro.clave, parametro.tipo_dato);

  function onEdit() {
    setValor(parametro.valor);
    setError(null);
    setEditing(true);
  }

  function onCancel() {
    setValor(parametro.valor);
    setError(null);
    setEditing(false);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await actualizarParametro(parametro.id, valor);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function onToggleBoolean() {
    const nuevo = parametro.valor === "true" ? "false" : "true";
    setError(null);
    startTransition(async () => {
      const result = await actualizarParametro(parametro.id, nuevo);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-start gap-4 px-5 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-foreground text-sm font-medium">
          {parametro.descripcion ?? parametro.clave}
        </p>
        <p className="text-muted-foreground/70 text-xs mt-0.5 font-mono">{parametro.clave}</p>
        {error && (
          <p className="text-[#EF4444] text-xs mt-1.5">{error}</p>
        )}
      </div>

      <HistorialDrawer
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        parametroId={parametro.id}
        parametroDescripcion={parametro.descripcion ?? parametro.clave}
        parametroClave={parametro.clave}
        parametroTipo={parametro.tipo_dato}
      />

      <div className="shrink-0 flex items-center gap-2">
        {!parametro.editable && (
          <>
            <span className="text-foreground text-sm font-semibold">
              {formatValor(parametro.valor, parametro.tipo_dato)}
            </span>
            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide ml-2">
              Solo lectura
            </span>
          </>
        )}

        {parametro.editable && parametro.tipo_dato === "boolean" && (
          <BooleanToggle
            value={parametro.valor === "true"}
            disabled={isPending}
            onToggle={onToggleBoolean}
            saved={saved}
          />
        )}

        {parametro.editable && parametro.tipo_dato !== "boolean" && !editing && (
          <>
            <span className="text-foreground text-sm font-semibold max-w-[240px] truncate">
              {formatValor(parametro.valor, parametro.tipo_dato)}
            </span>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-[#10B981] text-xs font-medium">
                <Check size={12} />
                Guardado
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                aria-label={`Editar ${parametro.clave}`}
              >
                <Pencil size={12} />
              </Button>
            )}
          </>
        )}

        {parametro.editable && parametro.tipo_dato !== "boolean" && editing && (
          <>
            <div className="flex flex-col items-end gap-1">
              {validacion.opciones ? (
                <select
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  autoFocus
                  disabled={isPending}
                  className="h-8 w-48 text-sm rounded-lg border border-border bg-card px-2.5 outline-none focus-visible:border-[#0088D1] focus-visible:ring-3 focus-visible:ring-[#0088D1]/30"
                >
                  {validacion.opciones.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type={parametro.tipo_dato === "number" ? "number" : "text"}
                  step={
                    parametro.tipo_dato === "number"
                      ? (validacion.step ?? 0.01).toString()
                      : undefined
                  }
                  min={
                    parametro.tipo_dato === "number" && validacion.min !== undefined
                      ? validacion.min
                      : undefined
                  }
                  max={
                    parametro.tipo_dato === "number" && validacion.max !== undefined
                      ? validacion.max
                      : undefined
                  }
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  autoFocus
                  disabled={isPending}
                  className="h-8 w-48 text-sm"
                />
              )}
              {validacion.pista && (
                <span className="text-[10px] text-muted-foreground/70">{validacion.pista}</span>
              )}
            </div>
            <Button
              type="button"
              variant="brand"
              size="icon-sm"
              onClick={onSave}
              disabled={isPending}
              aria-label="Guardar"
            >
              <Check size={12} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              disabled={isPending}
              aria-label="Cancelar"
            >
              <X size={12} />
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setHistorialOpen(true)}
          aria-label={`Ver historial de ${parametro.clave}`}
          className="text-muted-foreground/70 hover:text-primary"
        >
          <History size={12} />
        </Button>
      </div>
    </div>
  );
}

function BooleanToggle({
  value,
  disabled,
  onToggle,
  saved,
}: {
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
  saved: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-foreground text-sm font-semibold w-20">
        {value ? "Activado" : "Desactivado"}
      </span>
      {saved && (
        <span className="inline-flex items-center gap-1 text-[#10B981] text-xs font-medium">
          <Check size={12} />
        </span>
      )}
    </div>
  );
}
