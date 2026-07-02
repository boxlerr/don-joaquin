"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PiggyBank,
  CalendarClock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import AddPrestamoDialog from "./AddPrestamoDialog";
import {
  setCuotaPagadaAction,
  updateCuotaAction,
  deletePrestamoAction,
  type PrestamoRow,
  type CuotaRow,
} from "./actions";

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Lunes de la semana de una fecha (ISO YYYY-MM-DD), como Date local. */
function lunesDe(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y!, m! - 1, d!);
  const dow = (f.getDay() + 6) % 7; // 0 = lunes
  f.setDate(f.getDate() - dow);
  return f;
}

function keySemana(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function labelSemana(lunes: Date): string {
  const fin = new Date(lunes);
  fin.setDate(fin.getDate() + 6);
  const mismoMes = lunes.getMonth() === fin.getMonth();
  return mismoMes
    ? `${lunes.getDate()}–${fin.getDate()} ${MESES_CORTOS[lunes.getMonth()]}`
    : `${lunes.getDate()} ${MESES_CORTOS[lunes.getMonth()]} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
}

export default function PrestamosClient({
  prestamos,
  canWrite,
}: {
  prestamos: PrestamoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editCuota, setEditCuota] = useState<(CuotaRow & { banco: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hoy = new Date().toISOString().slice(0, 10);

  // Todas las cuotas impagas de préstamos activos, ordenadas por vencimiento.
  const cuotasPendientes = useMemo(() => {
    return prestamos
      .filter((p) => p.estado === "activo")
      .flatMap((p) =>
        p.cuotas
          .filter((c) => !c.pagada)
          .map((c) => ({ ...c, banco: p.banco, tasa: p.tasa, cuotas_total: p.cuotas_total })),
      )
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  }, [prestamos]);

  const vencidas = cuotasPendientes.filter((c) => c.fecha_vencimiento < hoy);

  // Carga por semana: la actual + las próximas 7 (lo que pidió Bárbara para
  // decidir en qué semana conviene pagar/financiar).
  const semanas = useMemo(() => {
    const inicio = lunesDe(hoy);
    const buckets: { lunes: Date; total: number; cuotas: number }[] = Array.from(
      { length: 8 },
      (_, i) => {
        const lunes = new Date(inicio);
        lunes.setDate(lunes.getDate() + i * 7);
        return { lunes, total: 0, cuotas: 0 };
      },
    );
    const idxPorKey = new Map(buckets.map((b, i) => [keySemana(b.lunes), i]));
    for (const c of cuotasPendientes) {
      const idx = idxPorKey.get(keySemana(lunesDe(c.fecha_vencimiento)));
      if (idx == null) continue;
      buckets[idx].total += c.importe;
      buckets[idx].cuotas += 1;
    }
    return buckets;
  }, [cuotasPendientes, hoy]);

  const maxSemana = Math.max(1, ...semanas.map((s) => s.total));

  const finDeSemana = (() => {
    const fin = new Date(lunesDe(hoy));
    fin.setDate(fin.getDate() + 6);
    return keySemana(fin);
  })();
  const totalSemana = cuotasPendientes
    .filter((c) => c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= finDeSemana)
    .reduce((s, c) => s + c.importe, 0);
  const mesActual = hoy.slice(0, 7);
  const totalMes = cuotasPendientes
    .filter((c) => c.fecha_vencimiento.slice(0, 7) === mesActual)
    .reduce((s, c) => s + c.importe, 0);

  const togglePagada = (cuotaId: string, pagada: boolean) => {
    setSavingId(cuotaId);
    setError(null);
    startTransition(async () => {
      const res = await setCuotaPagadaAction(cuotaId, pagada);
      setSavingId(null);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const borrarPrestamo = (id: string) => {
    setSavingId(id);
    setError(null);
    startTransition(async () => {
      const res = await deletePrestamoAction(id);
      setSavingId(null);
      setConfirmDelId(null);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-[8px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="hover:underline text-xs">
            Cerrar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={CalendarClock}
          label="A pagar esta semana"
          value={ars(totalSemana)}
          tone="text-foreground"
        />
        <KpiCard
          icon={PiggyBank}
          label={`A pagar en ${MESES_CORTOS[Number(mesActual.slice(5)) - 1]}`}
          value={ars(totalMes)}
          tone="text-[#0088D1]"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Cuotas vencidas sin pagar"
          value={String(vencidas.length)}
          tone={vencidas.length > 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Carga semanal (idea de Bárbara: "la tercera semana de agosto la tengo
            compleja, dejemos los pagos para la primera y la cuarta") */}
        <div className="bg-card border border-border rounded-[8px] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Cuánto hay que pagar por semana
          </h2>
          <div className="space-y-2.5">
            {semanas.map((s, i) => (
              <div key={keySemana(s.lunes)} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {i === 0 ? "Esta semana" : labelSemana(s.lunes)}
                </span>
                <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#0088D1]/80 rounded"
                    style={{ width: `${(s.total / maxSemana) * 100}%` }}
                  />
                </div>
                <span className="w-28 text-right text-sm font-semibold text-foreground tabular-nums">
                  {s.total > 0 ? ars(s.total) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximos vencimientos */}
        <div className="bg-card border border-border rounded-[8px] overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Próximos vencimientos</h2>
          </div>
          {cuotasPendientes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              Sin cuotas pendientes. Cargá un préstamo para empezar.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cuotasPendientes.slice(0, 8).map((c) => {
                const vencida = c.fecha_vencimiento < hoy;
                return (
                  <li key={c.id} className="px-5 py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.banco}{" "}
                        <span className="text-muted-foreground font-normal">
                          — cuota {c.nro}/{c.cuotas_total}
                          {c.tasa != null ? ` · tasa ${c.tasa.toLocaleString("es-AR")}%` : ""}
                        </span>
                      </p>
                      <p className={`text-xs ${vencida ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                        {vencida ? "Venció el " : "Vence el "}
                        {fmtFecha(c.fecha_vencimiento)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                      {ars(c.importe)}
                    </span>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs shrink-0"
                        disabled={savingId === c.id}
                        onClick={() => togglePagada(c.id, true)}
                      >
                        {savingId === c.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Pagada"
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Préstamos */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Préstamos <span className="text-muted-foreground font-normal">({prestamos.length})</span>
          </h2>
          {canWrite && <AddPrestamoDialog />}
        </div>
        {prestamos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <PiggyBank size={22} className="mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">
              Sin préstamos cargados. Empezá con la planilla: banco, importe de cuota, número de
              cuota y tasa.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-semibold">Banco</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tasa</th>
                <th className="px-4 py-2.5 text-right font-semibold">Cuota</th>
                <th className="px-4 py-2.5 text-left font-semibold">Progreso</th>
                <th className="px-4 py-2.5 text-left font-semibold">Próxima cuota</th>
                <th className="px-4 py-2.5 text-right font-semibold">Falta pagar</th>
                {canWrite && <th className="px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {prestamos.map((p) => {
                const abierto = expandedId === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr
                      className="hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(abierto ? null : p.id)}
                      title="Ver cronograma de cuotas"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {p.banco}
                          {p.detalle && (
                            <span className="text-xs text-muted-foreground font-normal">
                              · {p.detalle}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.tasa != null ? `${p.tasa.toLocaleString("es-AR")}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {ars(p.importe_cuota)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(p.pagadas / p.cuotas_total) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {p.pagadas}/{p.cuotas_total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.proxima ? fmtFecha(p.proxima.fecha_vencimiento) : "Cancelado ✅"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        {p.restante > 0 ? ars(p.restante) : "—"}
                      </td>
                      {canWrite && (
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setConfirmDelId(p.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            title="Eliminar préstamo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {confirmDelId === p.id && (
                      <tr className="bg-red-50">
                        <td colSpan={canWrite ? 7 : 6} className="px-4 py-2.5 text-xs text-red-700">
                          <span className="font-semibold">
                            ¿Eliminar el préstamo de {p.banco} con todo su cronograma?
                          </span>
                          <button
                            type="button"
                            disabled={savingId === p.id}
                            onClick={() => borrarPrestamo(p.id)}
                            className="ml-3 px-2 h-6 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                          >
                            Sí, eliminar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelId(null)}
                            className="ml-2 px-2 h-6 rounded border border-red-200 hover:bg-red-100"
                          >
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    )}
                    {abierto && (
                      <tr className="bg-muted/20">
                        <td colSpan={canWrite ? 7 : 6} className="px-5 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
                            {p.cuotas.map((c) => {
                              const vencida = !c.pagada && c.fecha_vencimiento < hoy;
                              return (
                                <div
                                  key={c.id}
                                  className={`rounded-md border px-2 py-1.5 text-xs flex items-center justify-between gap-1.5 ${
                                    c.pagada
                                      ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                                      : vencida
                                        ? "border-red-200 bg-red-50/70 text-red-700"
                                        : "border-border bg-card text-foreground"
                                  }`}
                                >
                                  <label className="flex items-center gap-1.5 cursor-pointer min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={c.pagada}
                                      disabled={!canWrite || savingId === c.id}
                                      onChange={(e) => togglePagada(c.id, e.target.checked)}
                                      className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer shrink-0"
                                      title={c.pagada ? "Marcar como no pagada" : "Marcar como pagada"}
                                    />
                                    <span className="truncate">
                                      <b className="tabular-nums">{c.nro}</b> ·{" "}
                                      {fmtFecha(c.fecha_vencimiento)}
                                    </span>
                                  </label>
                                  {canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => setEditCuota({ ...c, banco: p.banco })}
                                      className="p-0.5 rounded text-muted-foreground/60 hover:text-primary shrink-0"
                                      title={`Editar cuota (${ars(c.importe)})`}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editCuota && (
        <EditarCuotaDialog
          cuota={editCuota}
          onClose={() => setEditCuota(null)}
          onSaved={() => {
            setEditCuota(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof PiggyBank;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[8px] p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon size={14} />
        {label}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** Corrección puntual de una cuota: fecha y/o importe (la planilla manda). */
function EditarCuotaDialog({
  cuota,
  onClose,
  onSaved,
}: {
  cuota: CuotaRow & { banco: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fecha, setFecha] = useState(cuota.fecha_vencimiento);
  const [importe, setImporte] = useState(String(cuota.importe || ""));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateCuotaAction(cuota.id, {
        fecha_vencimiento: fecha,
        importe: importe.trim() === "" ? undefined : Number(importe) || 0,
      });
      if ("error" in res) setError(res.error);
      else onSaved();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            Cuota {cuota.nro} — {cuota.banco}
          </DialogTitle>
          <DialogDescription>
            Corregí la fecha de vencimiento o el importe de esta cuota puntual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cuota-fecha" className="text-xs font-medium text-muted-foreground">
              Fecha de vencimiento
            </Label>
            <Input
              id="cuota-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cuota-importe" className="text-xs font-medium text-muted-foreground">
              Importe $
            </Label>
            <Input
              id="cuota-importe"
              type="number"
              min="0"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="brand" size="sm" onClick={guardar} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
