"use client";

/**
 * Lo que ya se pagó.
 *
 * La plata pagada siempre estuvo guardada —cada cuota tiene su marca y su
 * importe— pero no se veía en ningún lado: había que abrir préstamo por préstamo
 * y mirar la lista de cuotas. Acá está todo junto, por mes y por año, que es
 * como se mira para atrás.
 *
 * Las cuotas que entraron con la carga inicial de la planilla figuran pagadas
 * pero sin el día exacto, porque la planilla no lo traía. Esa fecha se puede
 * completar acá, y a partir de ahora se guarda sola cuando se marca una cuota
 * como pagada.
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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Save } from "lucide-react";
import { actualizarCuotasAction, type PrestamoRow } from "./actions";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function ars(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Pago = {
  cuotaId: string;
  banco: string;
  identificacion: string;
  nro: number;
  cuotasTotal: number;
  vencimiento: string;
  importe: number;
  moneda: string;
  pagadaEn: string | null;
};

export default function HistorialPagosDialog({
  prestamos,
  canWrite,
  open,
  onOpenChange,
}: {
  prestamos: PrestamoRow[];
  canWrite: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const pagos = useMemo<Pago[]>(() => {
    const out: Pago[] = [];
    for (const p of prestamos) {
      for (const c of p.cuotas) {
        if (!c.pagada) continue;
        out.push({
          cuotaId: c.id,
          banco: p.banco,
          identificacion: p.detalle ?? p.referencia ?? "",
          nro: c.nro,
          cuotasTotal: p.cuotas_total,
          vencimiento: c.fecha_vencimiento,
          importe: c.importe,
          moneda: p.moneda,
          pagadaEn: c.pagada_en,
        });
      }
    }
    return out.sort((a, b) => b.vencimiento.localeCompare(a.vencimiento));
  }, [prestamos]);

  const anios = useMemo(() => {
    const set = new Set(pagos.map((p) => Number(p.vencimiento.slice(0, 4))));
    return [...set].sort((a, b) => b - a);
  }, [pagos]);

  const [anio, setAnio] = useState(anios[0] ?? new Date().getFullYear());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [fechasPago, setFechasPago] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delAnio = useMemo(
    () => pagos.filter((p) => p.vencimiento.startsWith(String(anio))),
    [pagos, anio],
  );

  /** Un renglón por mes con movimiento, del más nuevo al más viejo. */
  const meses = useMemo(() => {
    const map = new Map<string, Pago[]>();
    for (const p of delAnio) {
      const mes = p.vencimiento.slice(0, 7);
      const arr = map.get(mes) ?? [];
      arr.push(p);
      map.set(mes, arr);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mes, items]) => ({
        mes,
        label: `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`,
        items,
        // Los dólares no se suman con los pesos: se muestran aparte.
        totalArs: items.filter((i) => i.moneda !== "USD").reduce((s, i) => s + i.importe, 0),
        totalUsd: items.filter((i) => i.moneda === "USD").reduce((s, i) => s + i.importe, 0),
      }));
  }, [delAnio]);

  const totalAnioArs = meses.reduce((s, m) => s + m.totalArs, 0);
  const totalAnioUsd = meses.reduce((s, m) => s + m.totalUsd, 0);
  const sinFecha = delAnio.filter((p) => !p.pagadaEn && !fechasPago[p.cuotaId]).length;

  const cambios = useMemo(
    () =>
      Object.entries(fechasPago)
        .filter(([id, v]) => {
          const p = pagos.find((x) => x.cuotaId === id);
          return p && v !== (p.pagadaEn ?? "");
        })
        .map(([id, v]) => ({ id, pagada_en: v === "" ? null : v })),
    [fechasPago, pagos],
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
    setFechasPago({});
    router.refresh();
  };

  const idxAnio = anios.indexOf(anio);

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Pagos hechos</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Todo lo que ya se pagó, mes a mes. Clic en un mes para ver el detalle.
          </DialogDescription>
        </DialogHeader>

        {pagos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay cuotas marcadas como pagadas.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idxAnio >= anios.length - 1}
                  onClick={() => setAnio(anios[idxAnio + 1]!)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                  aria-label="Año anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[3.5rem] text-center text-sm font-semibold text-foreground">
                  {anio}
                </span>
                <button
                  type="button"
                  disabled={idxAnio <= 0}
                  onClick={() => setAnio(anios[idxAnio - 1]!)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                  aria-label="Año siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="text-right">
                <span className="block text-sm font-semibold tabular-nums text-foreground">
                  {ars(totalAnioArs)}
                  {totalAnioUsd > 0 && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      + US$ {Math.round(totalAnioUsd).toLocaleString("es-AR")}
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {delAnio.length} cuota{delAnio.length !== 1 ? "s" : ""} pagada
                  {delAnio.length !== 1 ? "s" : ""} en {anio}
                </span>
              </div>
            </div>

            {error && (
              <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
            )}

            {canWrite && sinFecha > 0 && (
              <p className="text-[12px] leading-snug text-muted-foreground">
                {sinFecha} de estas cuotas vinieron de la carga inicial de la planilla y no tienen
                el día exacto de pago. Se puede completar abriendo el mes.
              </p>
            )}

            <div className="max-h-[52vh] space-y-1.5 overflow-y-auto">
              {meses.map((m) => {
                const expandido = abierto === m.mes;
                return (
                  <div key={m.mes} className="rounded-[6px] border border-border">
                    <button
                      type="button"
                      onClick={() => setAbierto(expandido ? null : m.mes)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex items-center gap-2">
                        {expandido ? (
                          <ChevronUp size={13} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={13} className="text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-foreground">{m.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {m.items.length} cuota{m.items.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {m.totalArs > 0 && ars(m.totalArs)}
                        {m.totalUsd > 0 && (
                          <span className={m.totalArs > 0 ? "ml-2 font-normal text-muted-foreground" : ""}>
                            US$ {Math.round(m.totalUsd).toLocaleString("es-AR")}
                          </span>
                        )}
                      </span>
                    </button>

                    {expandido && (
                      <table className="w-full border-t border-border text-sm">
                        <tbody className="divide-y divide-border/60">
                          {[...m.items]
                            .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
                            .map((p) => (
                              <tr key={p.cuotaId}>
                                <td className="py-2 pl-3 pr-2">
                                  <span className="block text-[13px] font-medium text-foreground">
                                    {p.banco}
                                  </span>
                                  {p.identificacion && (
                                    <span className="block text-[11px] leading-tight text-muted-foreground">
                                      {p.identificacion}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center text-[12px] tabular-nums text-muted-foreground">
                                  {p.nro}/{p.cuotasTotal}
                                </td>
                                <td className="px-2 py-2 text-[12px] text-muted-foreground">
                                  vencía el {fmtFecha(p.vencimiento)}
                                </td>
                                <td className="px-2 py-2">
                                  {canWrite ? (
                                    <Input
                                      type="date"
                                      value={fechasPago[p.cuotaId] ?? p.pagadaEn ?? ""}
                                      onChange={(e) =>
                                        setFechasPago((v) => ({
                                          ...v,
                                          [p.cuotaId]: e.target.value,
                                        }))
                                      }
                                      title="Día en que se pagó"
                                      className="h-8 w-[9.5rem]"
                                    />
                                  ) : (
                                    <span className="text-[12px] text-muted-foreground">
                                      {p.pagadaEn ? `pagada el ${fmtFecha(p.pagadaEn)}` : "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pl-2 pr-3 text-right text-[13px] font-medium tabular-nums text-foreground">
                                  {p.moneda === "USD"
                                    ? `US$ ${Math.round(p.importe).toLocaleString("es-AR")}`
                                    : ars(p.importe)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
          {canWrite && cambios.length > 0 && (
            <Button type="button" variant="brand" onClick={guardar} disabled={loading}>
              <Save size={14} />
              {loading
                ? "Guardando…"
                : `Guardar ${cambios.length} fecha${cambios.length !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
