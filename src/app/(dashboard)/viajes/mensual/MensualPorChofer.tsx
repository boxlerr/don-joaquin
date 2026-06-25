"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/ui/StatCard";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import {
  getViajesMensualPorChoferAction,
  type ViajesChoferMes,
} from "../actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesActual(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function labelMes(mes: string): string {
  const [year, month] = mes.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "es-AR",
    { month: "long", year: "numeric" },
  );
}

// Pinta el % de utilización con color: verde si va lleno, ámbar si bajo del
// 80%, rojo si bajo del 60%. Sirve como semáforo rápido para Nicolás.
function UtilizacionCell({ pct }: { pct: number | null }) {
  if (pct == null)
    return (
      <span
        className="text-muted-foreground/60"
        title="Sin capacidad de camión cargada para los viajes de este chofer."
      >
        —
      </span>
    );
  const cls =
    pct >= 90 ? "text-[#10B981]" : pct >= 75 ? "text-[#F59E0B]" : "text-red-500";
  return <span className={cls}>{pct.toFixed(0)}%</span>;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function MensualPorChofer() {
  const [mes, setMes] = useState(mesActual);
  const [rows, setRows] = useState<ViajesChoferMes[]>([]);
  const [totales, setTotales] = useState({ viajes: 0, km: 0, tonelaje: 0, flete: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    const res = await getViajesMensualPorChoferAction(m);
    if (res.error) {
      setError(res.error);
    } else {
      setRows(res.data ?? []);
      setTotales(res.totales ?? { viajes: 0, km: 0, tonelaje: 0, flete: 0 });
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
  useEffect(() => { cargar(mes); }, [mes, cargar]);

  return (
    <div className="space-y-6">
      {/* Selector de mes */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-muted-foreground">Mes:</label>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="h-9 px-3 text-sm border border-border rounded-[8px] bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1]"
        />
        <span className="text-sm text-muted-foreground capitalize">{labelMes(mes)}</span>
      </div>

      {/* StatCards de totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Viajes totales"
          value={loading ? "—" : String(totales.viajes)}
          color="brand"
        />
        <StatCard
          label="KM totales"
          value={loading ? "—" : totales.km.toLocaleString("es-AR")}
          sub="km"
          color="success"
        />
        <StatCard
          label="Tonelaje total"
          value={loading ? "—" : totales.tonelaje.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          sub="tn"
          color="warning"
        />
        <StatCard
          label="Flete total"
          value={loading ? "—" : `$ ${totales.flete.toLocaleString("es-AR")}`}
          color="brand"
        />
      </div>

      {/* Tabla por chofer */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {[
                { label: "Chofer", title: undefined },
                { label: "Viajes", title: undefined },
                { label: "KM totales", title: undefined },
                { label: "Tonelaje", title: undefined },
                {
                  label: "Tn/viaje",
                  title:
                    "Promedio de toneladas por viaje cargado (excluye viajes en vacío).",
                },
                {
                  label: "% Cap.",
                  title:
                    "Utilización: Σ toneladas / Σ capacidad del camión asignado a cada viaje. " +
                    "Compara el peso real con el máximo que admite el camión (29 / 35 / 37,5 tn).",
                },
                { label: "Flete", title: undefined },
                { label: "", title: undefined },
              ].map((col) => (
                <TableHead
                  key={col.label || "actions"}
                  title={col.title}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-red-500">
                  {error}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <EmptyTableRow message="Sin viajes registrados para este mes" />
            ) : (
              rows.map((r) => (
                <TableRow key={r.chofer_id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="text-sm font-medium text-foreground">
                    {r.chofer}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-foreground">
                    {r.cantidad_viajes}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {r.km_totales.toLocaleString("es-AR")} km
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {r.tonelaje_total.toLocaleString("es-AR", { maximumFractionDigits: 1 })} tn
                  </TableCell>
                  <TableCell className="text-sm font-mono text-foreground">
                    {r.tonelaje_promedio > 0
                      ? `${r.tonelaje_promedio.toLocaleString("es-AR", { maximumFractionDigits: 1 })} tn`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    <UtilizacionCell pct={r.utilizacion_pct} />
                  </TableCell>
                  <TableCell className="text-sm font-mono text-[#10B981]">
                    $ {r.monto_flete_total.toLocaleString("es-AR")}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/viajes?choferId=${r.chofer_id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      title="Ver viajes de este chofer"
                    >
                      <ExternalLink size={12} />
                      Ver viajes
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Nota al pie */}
      {!loading && rows.length > 0 && (
        <p className="text-xs text-muted-foreground/70">
          Incluye viajes pendientes, en curso y cerrados. Excluye cancelados.
          El flete refleja el monto registrado (puede variar si hay cobros parciales).
          La utilización compara el tonelaje cargado contra la capacidad del camión asignado al viaje.
        </p>
      )}
    </div>
  );
}
