"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { CalendarPlus, Loader2 } from "lucide-react";
import { crearAusenciaAction } from "../choferes/[slug]/actions";
import {
  getChoferesParaDiaPedidoAction,
  getDiasPedidosAnioAction,
  type ChoferParaDiaPedido,
} from "./dias-pedidos-actions";

/**
 * Alta rápida de un día pedido (turno médico, trámite, dentista).
 *
 * Bárbara los recibe por teléfono en cualquier momento del día — "te piden el
 * día para ir a hacerse un carnet, un turno, el dentista" — y hasta ahora no
 * tenían dónde anotarse: había que entrar al legajo del chofer, buscar la
 * pestaña y cargar una ausencia. Por eso las 170 ausencias del sistema son
 * todas vacaciones. Acá se hace desde el dashboard, en tres campos.
 *
 * El contador del año es la otra mitad del pedido: "che flaco, vos me pediste
 * el mes pasado cuatro días". Aparece al elegir la persona, antes de guardar.
 */

/** Los motivos que ella nombró. Son atajos para el campo, no una lista cerrada. */
const MOTIVOS = ["Turno médico", "Trámite", "Dentista", "Carnet de conducir", "Estudios"];

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DiaPedidoQuickAction() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choferes, setChoferes] = useState<ChoferParaDiaPedido[]>([]);
  const [choferId, setChoferId] = useState("");
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [previo, setPrevio] = useState<{ dias: number; veces: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los choferes se piden al abrir, no al montar: es un botón del dashboard y
  // no tiene sentido pagar la consulta en cada carga de la página.
  useEffect(() => {
    if (!open || choferes.length > 0) return;
    getChoferesParaDiaPedidoAction()
      .then(setChoferes)
      .catch(() => setError("No se pudo cargar la lista de choferes."));
  }, [open, choferes.length]);

  useEffect(() => {
    if (!choferId) return;
    let vigente = true;
    getDiasPedidosAnioAction(choferId, new Date(`${desde}T00:00:00`).getFullYear())
      .then((r) => {
        if (vigente) setPrevio(r);
      })
      .catch(() => {
        if (vigente) setPrevio(null);
      });
    return () => {
      vigente = false;
    };
  }, [choferId, desde]);

  const elegirChofer = (id: string) => {
    setChoferId(id);
    // El contador se limpia acá y no en un efecto: si no, al cambiar de persona
    // se veía un instante el número de la anterior.
    setPrevio(null);
  };

  const reset = () => {
    setChoferId("");
    setDesde(hoyISO());
    setHasta("");
    setMotivo("");
    setPrevio(null);
    setError(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choferId) return setError("Elegí de quién es el día");
    if (!desde) return setError("Poné la fecha");
    if (!motivo.trim()) return setError("Poné el motivo");

    setLoading(true);
    setError(null);
    try {
      const res = await crearAusenciaAction(choferId, {
        tipo: motivo.trim(),
        fecha_inicio: desde,
        // Un día suelto es lo normal: si no ponen "hasta", es el mismo día.
        fecha_fin: hasta || desde,
        es_vacaciones: false,
        justificada: true,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        reset();
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const nombreElegido = choferes.find((c) => c.id === choferId);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5"
        title="Registrar un día pedido (turno médico, trámite)"
      >
        <CalendarPlus size={15} />
        Día pedido
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) reset();
          setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Registrar un día pedido</DialogTitle>
            <DialogDescription>
              El turno médico, el trámite, el dentista. Queda anotado en el legajo y Logística lo
              ve como un chofer menos ese día.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="space-y-4 py-1">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Quién <span className="text-red-500">*</span>
              </Label>
              <Combobox
                options={choferes.map((c) => ({ id: c.id, label: `${c.apellido}, ${c.nombre}` }))}
                value={choferId}
                onValueChange={elegirChofer}
                placeholder={choferes.length ? "Buscá por apellido…" : "Cargando…"}
              />
              {previo && nombreElegido && (
                <p className="text-[11px] text-muted-foreground">
                  {previo.dias === 0
                    ? `${nombreElegido.nombre} no pidió ningún día este año.`
                    : `${nombreElegido.nombre} ya pidió ${previo.dias} día${previo.dias === 1 ? "" : "s"} este año, en ${previo.veces} ${previo.veces === 1 ? "vez" : "veces"}.`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dp-desde" className="text-sm font-medium">
                  Día <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dp-desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dp-hasta" className="text-sm font-medium">
                  Hasta <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="dp-hasta"
                  type="date"
                  value={hasta}
                  min={desde}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dp-motivo" className="text-sm font-medium">
                Motivo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dp-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Turno médico"
              />
              {/* Atajos, no una lista cerrada: el motivo se guarda como texto,
                  así que siempre se puede escribir algo que no esté acá. */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivo(m)}
                    className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                      motivo === m
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={loading}>
                {loading && <Loader2 size={15} className="animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
