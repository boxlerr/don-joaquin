"use client";

// Importar circuitos desde los viajes cargados: previsualiza cada par
// origen→destino con su km (el más repetido entre los viajes) y recién al
// confirmar crea las rutas. Los pares que ya existen quedan marcados y no se
// duplican (re-ejecutar es seguro).

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Route, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { coincideBusqueda } from "@/lib/texto";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  importarCircuitosDesdeViajes,
  sugerirCircuitosDesdeViajes,
  type CircuitoSugerido,
} from "./actions-circuitos";

const km = (n: number) => n.toLocaleString("es-AR");

export default function ImportarCircuitosDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (creados: number) => void;
}) {
  const [sugeridos, setSugeridos] = useState<CircuitoSugerido[] | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    sugerirCircuitosDesdeViajes()
      .then((s) => {
        if (!vivo) return;
        setSugeridos(s);
        // Preselección: todos los nuevos (los que ya existen quedan afuera).
        setSeleccion(new Set(s.filter((x) => !x.yaExiste).map((x) => `${x.origenId}|${x.destinoId}`)));
      })
      .catch(() => vivo && setError("No se pudieron leer los viajes."));
    return () => {
      vivo = false;
    };
  }, [open]);

  const filtrados = useMemo(() => {
    if (!sugeridos) return [];
    if (!busqueda.trim()) return sugeridos;
    return sugeridos.filter((s) =>
      coincideBusqueda(`${s.origenLabel} ${s.destinoLabel}`, busqueda),
    );
  }, [sugeridos, busqueda]);

  const nuevos = useMemo(() => (sugeridos ?? []).filter((s) => !s.yaExiste), [sugeridos]);
  const todosMarcados = nuevos.length > 0 && nuevos.every((s) => seleccion.has(`${s.origenId}|${s.destinoId}`));

  const toggle = (key: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTodos = () => {
    setSeleccion(todosMarcados ? new Set() : new Set(nuevos.map((s) => `${s.origenId}|${s.destinoId}`)));
  };

  const handleImportar = async () => {
    if (!sugeridos) return;
    const items = sugeridos
      .filter((s) => !s.yaExiste && seleccion.has(`${s.origenId}|${s.destinoId}`))
      .map((s) => ({
        origenId: s.origenId,
        destinoId: s.destinoId,
        km: s.km,
        kmVacios: s.kmVacios,
        viajes: s.viajes,
      }));
    if (!items.length) return;
    setGuardando(true);
    setError(null);
    const res = await importarCircuitosDesdeViajes(items);
    setGuardando(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onImported(res.creados);
  };

  const cargando = sugeridos === null && !error;
  const seleccionados = nuevos.filter((s) => seleccion.has(`${s.origenId}|${s.destinoId}`)).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !guardando && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route size={16} className="text-[#0088D1]" /> Importar circuitos desde viajes
          </DialogTitle>
          <DialogDescription>
            Cada recorrido con viajes cargados se propone como circuito, con el km más
            repetido entre esos viajes. Después podés ajustar cualquier km editando el circuito.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
            Analizando los viajes cargados…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="relative w-full sm:w-auto">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                />
                <Input
                  type="search"
                  placeholder="Filtrar por origen o destino…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="h-8 pl-8 text-sm w-full sm:w-64"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {sugeridos?.length ?? 0} recorridos en viajes · {nuevos.length} nuevos ·{" "}
                {(sugeridos?.length ?? 0) - nuevos.length} ya existen
              </p>
            </div>

            {/* Previsualización densa (5 columnas): scroll horizontal adentro
                del panel, nunca empujando el diálogo. */}
            <div className="max-h-[46vh] overflow-auto rounded-md border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/40 border-b border-border sticky top-0">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={todosMarcados}
                        onChange={toggleTodos}
                        disabled={!nuevos.length}
                        className="size-4 max-md:size-5 rounded"
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th className="px-3 py-2">Recorrido</th>
                    <th className="px-3 py-2 text-right">Viajes</th>
                    <th className="px-3 py-2 text-right">Km con carga</th>
                    <th className="px-3 py-2 text-right">Km vacíos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((s) => {
                    const key = `${s.origenId}|${s.destinoId}`;
                    const marcado = seleccion.has(key);
                    return (
                      <tr
                        key={key}
                        className={s.yaExiste ? "opacity-50" : "hover:bg-muted/40 cursor-pointer"}
                        onClick={() => !s.yaExiste && toggle(key)}
                      >
                        <td className="px-3 py-2">
                          {s.yaExiste ? (
                            <span className="text-[10px] text-muted-foreground">✓</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggle(key)}
                              onClick={(e) => e.stopPropagation()}
                              className="size-4 max-md:size-5 rounded"
                              aria-label={`Importar ${s.origenLabel} a ${s.destinoLabel}`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {s.origenLabel}
                            <ArrowRight size={12} className="text-muted-foreground/70 shrink-0" />
                            {s.destinoLabel}
                          </span>
                          {s.yaExiste && (
                            <span className="ml-2 text-[10px] text-muted-foreground">ya existe</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{s.viajes}</td>
                        <td className="px-3 py-2 text-right font-mono text-foreground whitespace-nowrap">
                          {km(s.km)} km
                          {s.kmMin > 0 && s.kmMin !== s.kmMax && (
                            <span
                              className="ml-1 text-[10px] text-amber-600"
                              title={`En los viajes varía entre ${km(s.kmMin)} y ${km(s.kmMax)} km; se toma el más repetido.`}
                            >
                              ({km(s.kmMin)}–{km(s.kmMax)})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-foreground whitespace-nowrap">
                          {km(s.kmVacios)} km
                        </td>
                      </tr>
                    );
                  })}
                  {!filtrados.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {sugeridos?.length
                          ? "Ningún recorrido coincide con la búsqueda."
                          : "No hay viajes con origen y destino cargados."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Los recorridos solo de vuelta en vacío aparecen con 0 km con carga y sus km
              vacíos: también sirven como circuito. Nada se crea hasta confirmar.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={handleImportar}
            disabled={guardando || !seleccionados}
          >
            {guardando && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Crear {seleccionados} circuito{seleccionados === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
