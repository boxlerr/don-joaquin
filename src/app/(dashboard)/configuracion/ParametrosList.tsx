"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  History,
  Lock,
  Pencil,
  PencilLine,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { coincideEnAlguno } from "@/lib/texto";
import { actualizarParametro } from "./actions";
import HistorialDrawer from "./HistorialDrawer";
import BulkEditForm from "./BulkEditForm";
import { getValidacion } from "./validaciones";
import {
  CATEGORY_LINK,
  CATEGORY_ORDER,
  displayValorParam,
  esAvanzado,
  etiquetaParam,
  getCategoryMeta,
  moduloDeParam,
  type Parametro,
} from "./meta";

export default function ParametrosList({
  parametros,
  canWrite = false,
  hideClaves = [],
}: {
  parametros: Parametro[];
  canWrite?: boolean;
  /** Claves que se muestran en otra ficha y no deben duplicarse en la lista. */
  hideClaves?: string[];
}) {
  const [search, setSearch] = useState("");
  const [bulkCategoria, setBulkCategoria] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<{ cat: string; count: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historialParam, setHistorialParam] = useState<Parametro | null>(null);

  const visibles = useMemo(() => {
    if (hideClaves.length === 0) return parametros;
    const ocultas = new Set(hideClaves);
    return parametros.filter((p) => !ocultas.has(p.clave));
  }, [parametros, hideClaves]);

  const filtered = useMemo(() => {
    if (!search.trim()) return visibles;
    return visibles.filter((p) =>
      coincideEnAlguno([p.clave, p.descripcion, p.categoria], search),
    );
  }, [visibles, search]);

  /** Buscar y editar en bloque no conviven: el form recibiría sólo lo filtrado. */
  function onSearchChange(value: string) {
    setSearch(value);
    if (value && bulkCategoria) setBulkCategoria(null);
  }

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

  const totalEditables = useMemo(
    () => visibles.filter((p) => p.editable && !esAvanzado(p)).length,
    [visibles],
  );

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Buscador + resumen */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full max-w-md sm:w-auto sm:flex-1 sm:min-w-[220px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Buscar parámetro por nombre o categoría…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 max-md:h-10 pl-9 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {visibles.length} parámetro{visibles.length !== 1 ? "s" : ""} ·{" "}
          {totalEditables} editable{totalEditables !== 1 ? "s" : ""}
        </span>
      </div>

      {categoriasVisibles.length === 0 && (
        <div className="bg-card rounded-[10px] border border-border shadow-sm p-6 sm:p-10 text-center">
          <Search size={28} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-foreground text-sm font-medium">Sin resultados</p>
          <p className="text-muted-foreground text-xs mt-1">
            No hay parámetros que coincidan con “{search}”.
          </p>
          {search && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              className="mt-4"
            >
              Limpiar búsqueda
            </Button>
          )}
        </div>
      )}

      {categoriasVisibles.map((cat) => {
        const meta = getCategoryMeta(cat);
        const Icon = meta.icon;
        const isBulk = bulkCategoria === cat;
        const items = grouped[cat]!;
        const tieneEditables = items.some((p) => p.editable && !esAvanzado(p));
        const isSaved = savedBanner?.cat === cat;
        const isCollapsed = !search && collapsed.has(cat);
        const link = CATEGORY_LINK[cat];

        return (
          <section
            key={cat}
            className="bg-card rounded-[10px] border border-border shadow-sm overflow-hidden"
          >
            {/* Encabezado de categoría */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border bg-muted/30">
              <button
                type="button"
                onClick={() => toggleCollapse(cat)}
                disabled={!!search}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? "Expandir categoría" : "Contraer categoría"}
                className="flex items-center gap-3 flex-1 min-w-0 text-left group disabled:cursor-default"
              >
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  <Icon size={17} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground text-sm font-semibold truncate">
                      {meta.titulo}
                    </h3>
                    <span className="shrink-0 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">
                    {meta.descripcion}
                  </p>
                </div>
                {!search && (
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-muted-foreground/60 transition-transform ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                )}
              </button>

              <div className="flex flex-wrap items-center gap-1 shrink-0 ml-auto">
                {link && (
                  <Link
                    href={link.href}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "xs" }),
                      "text-muted-foreground hover:text-primary",
                    )}
                  >
                    <Settings2 size={12} />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                )}
                {isSaved && (
                  <span
                    role="status"
                    className="flex items-center gap-1 text-xs text-[#059669] font-medium px-1"
                  >
                    <Check size={13} />
                    {savedBanner!.count === 1
                      ? "1 cambio guardado"
                      : `${savedBanner!.count} cambios guardados`}
                  </span>
                )}
                {canWrite && !isBulk && tieneEditables && !search && !isCollapsed && (
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
                    <PencilLine size={12} />
                    Editar categoría
                  </Button>
                )}
              </div>
            </div>

            {/* Cuerpo */}
            {!isCollapsed &&
              (isBulk ? (
                <div className="p-3">
                  <BulkEditForm
                    params={items}
                    onCancel={() => setBulkCategoria(null)}
                    onSaved={(count) => {
                      setBulkCategoria(null);
                      setSavedBanner({ cat, count });
                      setTimeout(() => setSavedBanner(null), 3000);
                    }}
                  />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((p) => (
                    <ParametroRow
                      key={p.id}
                      parametro={p}
                      canWrite={canWrite}
                      onOpenHistorial={() => setHistorialParam(p)}
                    />
                  ))}
                </div>
              ))}
          </section>
        );
      })}

      {/* Único drawer de historial para toda la lista (evita N paneles fixed).
          El `key` remonta el panel al cambiar de parámetro, así no arrastra el
          historial ni los errores del anterior. */}
      <HistorialDrawer
        key={historialParam?.id ?? "sin-parametro"}
        open={historialParam !== null}
        onClose={() => setHistorialParam(null)}
        parametroId={historialParam?.id ?? ""}
        parametroDescripcion={historialParam ? etiquetaParam(historialParam) : ""}
        parametroTipo={historialParam?.tipo_dato ?? "string"}
      />
    </div>
  );
}

function ParametroRow({
  parametro,
  canWrite = false,
  onOpenHistorial,
}: {
  parametro: Parametro;
  canWrite?: boolean;
  onOpenHistorial: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(parametro.valor);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const validacion = getValidacion(parametro.clave, parametro.tipo_dato);
  const avanzado = esAvanzado(parametro);
  const modulo = moduloDeParam(parametro);
  const editable = canWrite && parametro.editable && !avanzado;

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
    <div className="flex flex-col gap-2 px-4 py-3.5 hover:bg-muted/20 transition-colors sm:flex-row sm:items-start sm:gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-foreground text-sm font-medium">{etiquetaParam(parametro)}</p>
        {error && (
          <p role="alert" className="text-[#DC2626] text-xs mt-1.5">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:pt-0.5">
        {/* Parámetro avanzado — se edita en su módulo */}
        {avanzado && (
          <>
            {modulo ? (
              <Link
                href={modulo.href}
                className={buttonVariants({ variant: "outline", size: "xs" })}
              >
                {modulo.label}
                <ArrowUpRight size={12} />
              </Link>
            ) : (
              <span className="text-[11px] text-muted-foreground">Configuración avanzada</span>
            )}
          </>
        )}

        {/* Solo lectura */}
        {!avanzado && !editable && (
          <>
            <span
              className="text-foreground text-sm font-semibold min-w-0 max-w-[240px] truncate"
              title={displayValorParam(parametro)}
            >
              {displayValorParam(parametro)}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted border border-border px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              <Lock size={9} />
              Solo lectura
            </span>
          </>
        )}

        {/* Booleano editable */}
        {editable && parametro.tipo_dato === "boolean" && (
          <BooleanToggle
            value={parametro.valor === "true"}
            disabled={isPending}
            onToggle={onToggleBoolean}
            saved={saved}
            nombre={etiquetaParam(parametro)}
          />
        )}

        {/* Editable no-booleano — vista */}
        {editable && parametro.tipo_dato !== "boolean" && !editing && (
          <>
            <span className="text-foreground text-sm font-semibold min-w-0 max-w-[240px] truncate">
              {displayValorParam(parametro)}
            </span>
            {saved ? (
              <span
                role="status"
                className="inline-flex items-center gap-1 text-[#059669] text-xs font-medium"
              >
                <Check size={13} />
                Guardado
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                aria-label={`Editar ${etiquetaParam(parametro)}`}
              >
                <Pencil size={13} />
              </Button>
            )}
          </>
        )}

        {/* Editable no-booleano — edición */}
        {editable && parametro.tipo_dato !== "boolean" && editing && (
          <>
            <div className="flex min-w-0 flex-col items-stretch gap-1 sm:items-end">
              {validacion.opciones ? (
                <Combobox
                  value={valor}
                  onValueChange={setValor}
                  disabled={isPending}
                  options={validacion.opciones.map((opt) => ({
                    id: opt,
                    label: validacion.opcionesLabels?.[opt] ?? opt,
                  }))}
                  triggerClassName="h-8 max-md:h-10 w-40 sm:w-48 text-sm"
                />
              ) : validacion.inputTipo === "time" ? (
                <Input
                  type="time"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  autoFocus
                  disabled={isPending}
                  className="h-8 max-md:h-10 w-32 text-sm"
                />
              ) : (
                <MoneyOrTextInput
                  parametro={parametro}
                  validacion={validacion}
                  valor={valor}
                  onChange={setValor}
                  disabled={isPending}
                />
              )}
              {validacion.pista && (
                <span className="text-[10px] text-muted-foreground/70 max-w-[220px] sm:text-right">
                  {validacion.pista}
                </span>
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
              <Check size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              disabled={isPending}
              aria-label="Cancelar"
            >
              <X size={13} />
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenHistorial}
          aria-label={`Ver historial de ${etiquetaParam(parametro)}`}
          title="Ver historial de cambios"
          className="text-muted-foreground/70 hover:text-primary"
        >
          <History size={13} />
        </Button>
      </div>
    </div>
  );
}

function MoneyOrTextInput({
  parametro,
  validacion,
  valor,
  onChange,
  disabled,
}: {
  parametro: Parametro;
  validacion: ReturnType<typeof getValidacion>;
  valor: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const isNumber = parametro.tipo_dato === "number";
  const hasPrefix = validacion.prefijo && isNumber;

  return (
    <div className="relative">
      {hasPrefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {validacion.prefijo}
        </span>
      )}
      <Input
        type={isNumber ? "number" : "text"}
        step={isNumber ? (validacion.step ?? 0.01).toString() : undefined}
        min={isNumber && validacion.min !== undefined ? validacion.min : undefined}
        max={isNumber && validacion.max !== undefined ? validacion.max : undefined}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        disabled={disabled}
        className={`h-8 max-md:h-10 w-40 sm:w-48 text-sm ${hasPrefix ? "pl-6" : ""}`}
      />
    </div>
  );
}

function BooleanToggle({
  value,
  disabled,
  onToggle,
  saved,
  nombre,
}: {
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
  saved: boolean;
  nombre: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* El botón es la zona táctil (36px en celular); la pastilla de adentro es
          lo que se ve. En desktop el botón vuelve a medir lo mismo que ella. */}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={nombre}
        disabled={disabled}
        onClick={onToggle}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md disabled:opacity-50 disabled:cursor-not-allowed sm:size-auto"
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            value ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
              value ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
      <span className="text-foreground text-sm font-semibold w-20">
        {value ? "Activado" : "Desactivado"}
      </span>
      {saved && (
        <span className="inline-flex items-center gap-1 text-[#059669] text-xs font-medium">
          <Check size={13} />
        </span>
      )}
    </div>
  );
}
