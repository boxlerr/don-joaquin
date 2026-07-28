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
 * El aviso de "cae sábado" está, pero como ayuda, no como decisión: la mayoría
 * de los préstamos no caen en fin de semana porque el banco ya lo planifica.
 * Donde de verdad sirve es en los feriados y los puentes, que son los que "salen
 * de la galera" y nadie tiene en la cabeza.
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
import { ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
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
  /** Cuándo se puede pagar de verdad, si el vencimiento cae en día inhábil. */
  efectiva: string | null;
  motivo: string | null;
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
  const [importes, setImportes] = useState<Record<string, string>>({});
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
          efectiva: c.fecha_efectiva ?? null,
          motivo: c.motivo_corrimiento ?? null,
        });
      }
    }
    return out.sort(
      (a, b) => a.fechaOriginal.localeCompare(b.fechaOriginal) || a.banco.localeCompare(b.banco),
    );
  }, [prestamos, mes]);

  const valorFecha = (f: Fila) => fechas[f.cuotaId] ?? f.fechaOriginal;
  const valorImporte = (f: Fila) =>
    importes[f.cuotaId] ?? (f.importeOriginal > 0 ? String(f.importeOriginal) : "");

  const cambios = useMemo(
    () =>
      filas
        .map((f) => {
          const fecha = valorFecha(f);
          const importeTxt = valorImporte(f).trim();
          const importe = importeTxt === "" ? 0 : Number(importeTxt);
          const cambioFecha = fecha !== f.fechaOriginal;
          const cambioImporte = Number.isFinite(importe) && importe !== f.importeOriginal;
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

  /**
   * Las que todavía tienen la fecha que proyectó el sistema y caen en un día en
   * que el banco no opera. Son varias por mes porque el cronograma se arma
   * sumando meses al día original; el banco, en cambio, ya las agendó al hábil
   * siguiente. Correrlas de a una era la mitad del trabajo del mes.
   */
  const aCorrer = useMemo(
    () => filas.filter((f) => f.efectiva && valorFecha(f) === f.fechaOriginal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, fechas],
  );

  const correrTodas = () => {
    setFechas((v) => {
      const next = { ...v };
      for (const f of aCorrer) next[f.cuotaId] = f.efectiva!;
      return next;
    });
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

        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => cambiarMes(-1)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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

        {aCorrer.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#B45309]/40 px-3 py-2">
            <p className="text-[12px] leading-snug text-foreground">
              <span className="font-medium text-[#B45309]">
                {aCorrer.length} {aCorrer.length === 1 ? "cuota cae" : "cuotas caen"} en un día en
                que el banco no opera.
              </span>{" "}
              <span className="text-muted-foreground">
                Es la fecha que proyectó el sistema; el banco suele agendarlas al hábil siguiente.
              </span>
            </p>
            <button
              type="button"
              onClick={correrTodas}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Wand2 size={12} className="text-primary" />
              Correr {aCorrer.length === 1 ? "esa" : "las"} al día hábil
            </button>
          </div>
        )}

        {filas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay cuotas por pagar en {labelMes(mes)}.
          </p>
        ) : (
          <div className="max-h-[52vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Banco</th>
                  <th className="px-2 py-2 text-center font-medium">Cuota</th>
                  <th className="px-2 py-2 text-left font-medium">Vence</th>
                  <th className="py-2 pl-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filas.map((f) => {
                  const fecha = valorFecha(f);
                  const tocada = fecha !== f.fechaOriginal;
                  // El aviso vale para la fecha ORIGINAL; si ya la corrigió a
                  // mano, no tiene sentido seguir sugiriendo.
                  const avisar = !tocada && f.efectiva;
                  return (
                    <tr key={f.cuotaId} className="align-top">
                      <td className="py-2.5 pr-3">
                        <span className="block font-medium text-foreground">{f.banco}</span>
                        {f.identificacion && (
                          <span className="block text-[11px] leading-tight text-muted-foreground">
                            {f.identificacion}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center text-[12px] tabular-nums text-muted-foreground">
                        {f.nro}/{f.cuotasTotal}
                      </td>
                      <td className="px-2 py-2.5">
                        <Input
                          type="date"
                          value={fecha}
                          onChange={(e) =>
                            setFechas((v) => ({ ...v, [f.cuotaId]: e.target.value }))
                          }
                          className={`h-8 w-[9.5rem] ${tocada ? "border-primary/60" : ""}`}
                        />
                        {avisar && (
                          <button
                            type="button"
                            onClick={() =>
                              setFechas((v) => ({ ...v, [f.cuotaId]: f.efectiva! }))
                            }
                            title={`${f.motivo} — el banco no opera ese día`}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#B45309] hover:underline"
                          >
                            {f.motivo} <ArrowRight size={10} /> {fmtFecha(f.efectiva!)}
                          </button>
                        )}
                        {tocada && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            antes {fmtFecha(f.fechaOriginal)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={valorImporte(f)}
                          onChange={(e) =>
                            setImportes((v) => ({ ...v, [f.cuotaId]: e.target.value }))
                          }
                          placeholder="—"
                          className={`h-8 w-[9.5rem] text-right tabular-nums ${
                            valorImporte(f).trim() !== "" &&
                            Number(valorImporte(f)) !== f.importeOriginal
                              ? "border-primary/60"
                              : ""
                          }`}
                        />
                        {f.moneda === "USD" && (
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            en dólares
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
