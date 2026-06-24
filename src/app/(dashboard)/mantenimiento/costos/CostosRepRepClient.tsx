"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Wrench } from "lucide-react";
import AddCostoDialog from "./AddCostoDialog";
import {
  getCostosRepRepAction,
  deleteCostoRepRepAction,
  type CostoRepRep,
  type CostosResumenMes,
} from "./actions";

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function mesLabel(mesISO: string): string {
  // "2026-01-01" -> "Enero 2026"
  const [y, m] = mesISO.split("-");
  const nombre = MESES_ES[Number(m) - 1] ?? m;
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${y}`;
}

export default function CostosRepRepClient({
  meses,
  mesInicial,
  rowsIniciales,
  resumen,
  canWrite,
}: {
  meses: string[];
  mesInicial: string | null;
  rowsIniciales: CostoRepRep[];
  resumen: CostosResumenMes[];
  canWrite: boolean;
}) {
  const [mes, setMes] = useState<string | null>(mesInicial);
  const [rows, setRows] = useState<CostoRepRep[]>(rowsIniciales);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function cambiarMes(nuevo: string | null) {
    setMes(nuevo);
    setLoading(true);
    const data = await getCostosRepRepAction(nuevo);
    setRows(data);
    setLoading(false);
  }

  async function borrar(id: string) {
    setDeletingId(id);
    const res = await deleteCostoRepRepAction(id);
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    setDeletingId(null);
  }

  const totNetoGrav = rows.reduce((a, r) => a + Number(r.neto_gravado), 0);
  const totFactGrav = rows.reduce((a, r) => a + Number(r.facturado_gravado), 0);
  const totNetoNg = rows.reduce((a, r) => a + Number(r.neto_ng), 0);
  const totFactNg = rows.reduce((a, r) => a + Number(r.facturado_ng), 0);
  const totNeto = rows.reduce((a, r) => a + Number(r.neto_total), 0);
  const totFact = rows.reduce((a, r) => a + Number(r.facturado_total), 0);

  return (
    <div className="space-y-4">
      {/* Resumen por mes */}
      {resumen.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {resumen.map((r) => (
            <button
              key={r.mes}
              type="button"
              onClick={() => cambiarMes(r.mes)}
              className={`text-left rounded-xl border p-4 transition-all ${
                mes === r.mes ? "border-[#0088D1] bg-[#E1F5FE]/40" : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <p className="text-xs text-muted-foreground">{mesLabel(r.mes)}</p>
              <p className="text-lg font-bold text-foreground">{ars(r.facturado_total)}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.proveedores} proveedores · neto {ars(r.neto_total)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant={mes === null ? "default" : "outline"} onClick={() => cambiarMes(null)}>
            Todos
          </Button>
          {meses.map((m) => (
            <Button key={m} size="sm" variant={mes === m ? "default" : "outline"} onClick={() => cambiarMes(m)}>
              {mesLabel(m)}
            </Button>
          ))}
        </div>
        {canWrite && (
          <AddCostoDialog mesInicial={mes ? mes.slice(0, 7) : undefined}>
            <Button size="sm">
              <Plus size={14} /> Cargar costo
            </Button>
          </AddCostoDialog>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground p-6 flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Cargando…
          </p>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <Wrench size={22} className="mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">Sin costos cargados para este período.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left font-semibold px-3 py-2">Proveedor</th>
                <th className="text-right font-semibold px-3 py-2">Neto 21%</th>
                <th className="text-right font-semibold px-3 py-2">Fact. 21%</th>
                <th className="text-right font-semibold px-3 py-2">Neto NG</th>
                <th className="text-right font-semibold px-3 py-2">Fact. NG</th>
                <th className="text-right font-semibold px-3 py-2">Neto total</th>
                <th className="text-right font-semibold px-3 py-2">Fact. total</th>
                {canWrite && <th className="px-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-3 py-1.5 text-foreground/90">{r.proveedor.replace(/^Prov\//, "")}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground/80">{r.neto_gravado ? ars(r.neto_gravado) : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground/80">{r.facturado_gravado ? ars(r.facturado_gravado) : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground/80">{r.neto_ng ? ars(r.neto_ng) : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground/80">{r.facturado_ng ? ars(r.facturado_ng) : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-foreground">{ars(r.neto_total)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-foreground">{ars(r.facturado_total)}</td>
                  {canWrite && (
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => borrar(r.id)}
                        disabled={deletingId === r.id}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold text-foreground bg-muted/30">
                <td className="px-3 py-2">Total ({rows.length})</td>
                <td className="px-3 py-2 text-right font-mono">{ars(totNetoGrav)}</td>
                <td className="px-3 py-2 text-right font-mono">{ars(totFactGrav)}</td>
                <td className="px-3 py-2 text-right font-mono">{ars(totNetoNg)}</td>
                <td className="px-3 py-2 text-right font-mono">{ars(totFactNg)}</td>
                <td className="px-3 py-2 text-right font-mono">{ars(totNeto)}</td>
                <td className="px-3 py-2 text-right font-mono">{ars(totFact)}</td>
                {canWrite && <td />}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
