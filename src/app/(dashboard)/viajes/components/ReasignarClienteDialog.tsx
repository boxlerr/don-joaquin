"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { getClientesConViajesAction, reasignarClienteViajesAction } from "../actions";

/**
 * Mover viajes de un cliente a otro, sin tocar la base a mano.
 *
 * Existe por los 1.315 viajes colgados de "Sin asignar (import)". La clave del
 * diálogo es el alcance: **por cliente entero, no por lo que esté tildado**.
 * Con la tabla paginada, tildar 1.315 filas es imposible, así que una
 * herramienta que sólo trabajara sobre la selección no resolvía el caso que la
 * hizo necesaria.
 *
 * Antes de mover nada se pregunta cuántos son (`simular`) y ese número es el
 * que aparece en el botón. No es una estimación: es el mismo conteo que va a
 * ejecutarse.
 */

type ClienteConViajes = { id: string; razon_social: string; viajes: number };

export default function ReasignarClienteDialog({
  open,
  onOpenChange,
  seleccionados = 0,
  idsSeleccionados = [],
  onListo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Cuántas filas están tildadas en la tabla. */
  seleccionados?: number;
  idsSeleccionados?: string[];
  onListo?: () => void;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteConViajes[]>([]);
  const [cargando, setCargando] = useState(false);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [alcance, setAlcance] = useState<"cliente" | "seleccion">("cliente");
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [contando, setContando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    setError(null);
    setHecho(null);
    getClientesConViajesAction()
      .then(setClientes)
      .catch(() => setError("No se pudo leer la lista de clientes."))
      .finally(() => setCargando(false));
  }, [open]);

  // Cuántos se moverían, preguntado al servidor cada vez que cambia el alcance.
  useEffect(() => {
    if (!open || !destino) {
      setCuantos(null);
      return;
    }
    if (alcance === "cliente" && !origen) {
      setCuantos(null);
      return;
    }
    let cancelado = false;
    setContando(true);
    reasignarClienteViajesAction({
      clienteDestinoId: destino,
      simular: true,
      ...(alcance === "cliente" ? { clienteOrigenId: origen } : { ids: idsSeleccionados }),
    })
      .then((r) => {
        if (cancelado) return;
        setCuantos("ok" in r ? r.movidos : null);
        setError("error" in r ? r.error : null);
      })
      .finally(() => !cancelado && setContando(false));
    return () => {
      cancelado = true;
    };
  }, [open, origen, destino, alcance, idsSeleccionados]);

  const opciones = clientes.map((c) => ({
    id: c.id,
    label: `${c.razon_social} — ${c.viajes.toLocaleString("es-AR")} viaje${c.viajes === 1 ? "" : "s"}`,
  }));

  const nombreDe = (id: string) => clientes.find((c) => c.id === id)?.razon_social ?? "—";

  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    const r = await reasignarClienteViajesAction({
      clienteDestinoId: destino,
      ...(alcance === "cliente" ? { clienteOrigenId: origen } : { ids: idsSeleccionados }),
    });
    setGuardando(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setHecho(r.movidos);
    onListo?.();
    router.refresh();
  };

  const listo = destino && (alcance === "seleccion" ? seleccionados > 0 : !!origen) && (cuantos ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Reasignar viajes a otro cliente</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Mueve los viajes de un cliente a otro. No cambia nada más del viaje: ni fechas, ni
            importes, ni remitos.
          </DialogDescription>
        </DialogHeader>

        {hecho !== null ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">
              Listo: se movieron{" "}
              <span className="font-semibold">{hecho.toLocaleString("es-AR")} viajes</span> a{" "}
              <span className="font-semibold">{nombreDe(destino)}</span>.
            </p>
            <Button type="button" variant="brand" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-1">
              {error && (
                <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
              )}

              {seleccionados > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAlcance("cliente")}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      alcance === "cliente"
                        ? "border-foreground/25 bg-foreground/[0.06] text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Todos los de un cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlcance("seleccion")}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      alcance === "seleccion"
                        ? "border-foreground/25 bg-foreground/[0.06] text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Los {seleccionados} seleccionados
                  </button>
                </div>
              )}

              {alcance === "cliente" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Sacar los viajes de
                  </Label>
                  <Combobox
                    value={origen}
                    onValueChange={setOrigen}
                    options={opciones}
                    placeholder={cargando ? "Cargando clientes…" : "Elegí el cliente de origen"}
                    aria-label="Cliente de origen"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Y pasarlos a</Label>
                <Combobox
                  value={destino}
                  onValueChange={setDestino}
                  options={opciones.filter((o) => o.id !== origen)}
                  placeholder={cargando ? "Cargando clientes…" : "Elegí el cliente de destino"}
                  aria-label="Cliente de destino"
                />
              </div>

              {destino && (origen || alcance === "seleccion") && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    {contando ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin" /> Contando…
                      </span>
                    ) : cuantos === 0 ? (
                      <span>No hay viajes para mover con esa combinación.</span>
                    ) : (
                      <>
                        <p className="font-semibold">
                          Se van a mover {(cuantos ?? 0).toLocaleString("es-AR")} viajes
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                          {alcance === "cliente" ? nombreDe(origen) : `${seleccionados} seleccionados`}
                          <ArrowRight size={12} className="shrink-0" />
                          {nombreDe(destino)}
                        </p>
                        <p className="mt-1 text-[12px] text-amber-800">
                          Se puede volver a hacer al revés, pero no hay un botón de deshacer.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={guardando}
                className="border-border text-muted-foreground"
              >
                Cancelar
              </Button>
              <Button type="button" variant="brand" onClick={confirmar} disabled={!listo || guardando}>
                {guardando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Moviendo…
                  </>
                ) : (
                  `Mover ${(cuantos ?? 0).toLocaleString("es-AR")} viajes`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
