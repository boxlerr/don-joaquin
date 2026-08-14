"use client";

/**
 * El ritual de principio de mes.
 *
 * Quien usa la sección lo describió así: "a principio de mes corrijo todas las
 * fechas que tengo, como hago con las planillas, y listo, ya tengo todo lo demás
 * cargado". Hacer eso cuota por cuota —abrir el préstamo, buscar la fila,
 * editar, guardar, cerrar— eran cincuenta idas y vueltas, y por eso el
 * cronograma se desactualizaba.
 *
 * Acá está todo el mes en una lista: se corrigen las fechas (y los importes, que
 * en los de tasa variable también cambian) y se guarda una sola vez.
 *
 * A propósito NO sugiere ni corre fechas solo. El banco ya planifica los fines
 * de semana, y quien usa esto lo dijo claro: "no me quiero recostar sobre eso".
 * La fecha la pone ella.
 */

import { useMemo, useState } from "react";
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
import { MoneyInput } from "@/components/ui/MoneyInput";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { actualizarCuotasAction, type PrestamoRow } from "./actions";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function labelMes(id: string): string {
  const [y, m] = id.split("-").map(Number);
  return `${MESES[m! - 1]} ${y}`;
}

function correrMes(id: string, delta: number): string {
  const [y, m] = id.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Fila = {
  cuotaId: string;
  banco: string;
  identificacion: string;
  nro: number;
  cuotasTotal: number;
  fechaOriginal: string;
  importeOriginal: number;
  moneda: string;
};

export default function FechasDelMesDialog({
  prestamos,
  open,
  onOpenChange,
  mesInicial,
}: {
  prestamos: PrestamoRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mesInicial: string;
}) {
  const router = useRouter();
  const [mes, setMes] = useState(mesInicial);
  const [fechas, setFechas] = useState<Record<string, string>>({});
  /** Sólo las cuotas que se tocaron. `null` es "lo vaciaron", que no es lo
   *  mismo que "no lo tocaron": por eso se pregunta con `in` y no con `??`. */
  const [importes, setImportes] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filas = useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    for (const p of prestamos) {
      for (const c of p.cuotas) {
        if (c.pagada) continue;
        if (c.fecha_vencimiento.slice(0, 7) !== mes) continue;
        out.push({
          cuotaId: c.id,
          banco: p.banco,
          identificacion: p.detalle ?? p.referencia ?? "",
          nro: c.nro,
          cuotasTotal: p.cuotas_total,
          fechaOriginal: c.fecha_vencimiento,
          importeOriginal: c.importe,
          moneda: p.moneda,
        });
      }
    }
    return out.sort(
      (a, b) => a.fechaOriginal.localeCompare(b.fechaOriginal) || a.banco.localeCompare(b.banco),
    );
  }, [prestamos, mes]);

  const valorFecha = (f: Fila) => fechas[f.cuotaId] ?? f.fechaOriginal;
  const valorImporte = (f: Fila): number | null =>
    f.cuotaId in importes ? importes[f.cuotaId]! : f.importeOriginal > 0 ? f.importeOriginal : null;

  const cambios = useMemo(
    () =>
      filas
        .map((f) => {
          const fecha = valorFecha(f);
          const importe = valorImporte(f) ?? 0;
          const cambioFecha = fecha !== f.fechaOriginal;
          const cambioImporte = importe !== f.importeOriginal;
          if (!cambioFecha && !cambioImporte) return null;
          return {
            id: f.cuotaId,
            ...(cambioFecha ? { fecha_vencimiento: fecha } : {}),
            ...(cambioImporte ? { importe } : {}),
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, fechas, importes],
  );

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await actualizarCuotasAction(cambios);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setFechas({});
    setImportes({});
    onOpenChange(false);
    router.refresh();
  };

  const cambiarMes = (delta: number) => {
    // Cambiar de mes con cambios sin guardar los perdería sin avisar.
    if (cambios.length > 0 && !confirm("Tenés cambios sin guardar en este mes. ¿Los descartás?"))
      return;
    setFechas({});
    setImportes({});
    setMes((m) => correrMes(m, delta));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Fechas del mes</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Todo lo que vence este mes en una sola lista. Corregí las fechas que te pasó el banco y
            guardá una vez. Los importes también se pueden ajustar, para los que cambian mes a mes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border pb-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => cambiarMes(-1)}
              className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-9"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold text-foreground">
              {labelMes(mes)}
            </span>
            <button
              type="button"
              onClick={() => cambiarMes(1)}
              className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-9"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-[12px] text-muted-foreground">
            {filas.length} {filas.length === 1 ? "cuota" : "cuotas"} por pagar
            {cambios.length > 0 && (
              <span className="ml-2 font-medium text-primary">
                · {cambios.length} sin guardar
              </span>
            )}
          </span>
        </div>

        {error && (
          <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
        )}

        {filas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay cuotas por pagar en {labelMes(mes)}.
          </p>
        ) : (
          /* Cada cuota es una fila de carga, no una tabla de consulta: en
             celular el banco va arriba y los dos campos abajo, lado a lado.
             Desde sm vuelve a leerse como la planilla, en una sola línea. */
          <div className="max-h-[52vh] overflow-y-auto">
            <div className="sticky top-0 z-10 hidden border-b border-border bg-card pb-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:flex sm:items-center sm:gap-3">
              <span className="min-w-0 flex-1 font-medium">Banco</span>
              <span className="w-[9.5rem] font-medium">Vence</span>
              <span className="w-[9.5rem] text-right font-medium">Importe</span>
            </div>
            <ul className="divide-y divide-border/60">
              {filas.map((f) => {
                const fecha = valorFecha(f);
                const tocada = fecha !== f.fechaOriginal;
                return (
                  <li
                    key={f.cuotaId}
                    className="flex flex-wrap items-start gap-x-3 gap-y-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{f.banco}</span>
                      {f.identificacion && (
                        <span className="block text-[11px] leading-tight text-muted-foreground">
                          {f.identificacion}
                        </span>
                      )}
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        cuota {f.nro}/{f.cuotasTotal}
                      </span>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
                      <div className="min-w-0">
                        <Input
                          type="date"
                          value={fecha}
                          onChange={(e) =>
                            setFechas((v) => ({ ...v, [f.cuotaId]: e.target.value }))
                          }
                          className={`w-full sm:w-[9.5rem] ${tocada ? "border-primary/60" : ""}`}
                        />
                        {tocada && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            antes {fmtFecha(f.fechaOriginal)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <MoneyInput
                          value={valorImporte(f)}
                          onValueChange={(n) => setImportes((v) => ({ ...v, [f.cuotaId]: n }))}
                          prefijo={f.moneda === "USD" ? "US$" : "$"}
                          placeholder="—"
                          className={`w-full text-right sm:w-[9.5rem] ${
                            valorImporte(f) !== null && valorImporte(f) !== f.importeOriginal
                              ? "border-primary/60"
                              : ""
                          }`}
                        />
                        {f.moneda === "USD" && (
                          <span className="mt-1 block text-right text-[10px] text-muted-foreground">
                            en dólares
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-muted-foreground"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={guardar}
            disabled={loading || cambios.length === 0}
          >
            <CalendarCheck size={14} />
            {loading
              ? "Guardando…"
              : cambios.length === 0
                ? "Sin cambios"
                : `Guardar ${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
