"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Wrench, CircleDot, BellRing, Plus, AlertTriangle } from "lucide-react";
import AddServicioDialog from "./AddServicioDialog";
import AddRoturaDialog from "./AddRoturaDialog";
import type { AcopladoOption, CamionOption, ChoferOption, TipoServicioOption } from "../types";
import type {
  ServicioRow,
  RoturaRow,
  RoturaPorChofer,
  AlertaServicio,
} from "../actions";

type Tab = "servicios" | "roturas" | "alertas";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR");
}

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR");
}

function fmtMoneda(n: number | null): string {
  if (n == null) return "—";
  return `$ ${n.toLocaleString("es-AR")}`;
}

export default function MantenimientoClient({
  servicios,
  roturas,
  roturasPorChofer,
  alertas,
  camiones,
  acoplados,
  choferes,
  tiposServicio,
  canWrite,
}: {
  servicios: ServicioRow[];
  roturas: RoturaRow[];
  roturasPorChofer: RoturaPorChofer[];
  alertas: AlertaServicio[];
  camiones: CamionOption[];
  acoplados: AcopladoOption[];
  choferes: ChoferOption[];
  tiposServicio: TipoServicioOption[];
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<Tab>("servicios");

  const totalGomasRotas = roturas.reduce((acc, r) => acc + (r.cantidad ?? 0), 0);
  const alertasVencidas = alertas.filter((a) => a.estado === "vencido").length;

  const chartData = roturasPorChofer.slice(0, 10);

  const tabs: { key: Tab; label: string; icon: typeof Wrench }[] = [
    { key: "servicios", label: "Servicios", icon: Wrench },
    { key: "roturas", label: "Roturas de Gomas", icon: CircleDot },
    { key: "alertas", label: "Alertas Pendientes", icon: BellRing },
  ];

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Mantenimiento"
        description="Servicios, gomería y roturas de la flota — simple y al día"
        action={
          canWrite ? (
            tab === "roturas" ? (
              <AddRoturaDialog camiones={camiones} acoplados={acoplados} choferes={choferes}>
                <Button variant="brand" className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-2">
                  <Plus size={16} strokeWidth={2.5} /> Registrar rotura
                </Button>
              </AddRoturaDialog>
            ) : (
              <AddServicioDialog camiones={camiones} tiposServicio={tiposServicio}>
                <Button variant="brand" className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-2">
                  <Plus size={16} strokeWidth={2.5} /> Cargar servicio
                </Button>
              </AddServicioDialog>
            )
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="SERVICIOS REGISTRADOS" value={String(servicios.length)} sub="Histórico" color="brand" icon={Wrench} variant="dashboard" />
        <StatCard label="GOMAS ROTAS" value={String(totalGomasRotas)} sub={`${roturas.length} eventos`} color="warning" icon={CircleDot} variant="dashboard" />
        <StatCard label="ALERTAS PENDIENTES" value={String(alertas.length)} sub={alertasVencidas > 0 ? `${alertasVencidas} vencidas` : "Próximos services"} color={alertasVencidas > 0 ? "error" : "success"} icon={BellRing} variant="dashboard" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[#0088D1] text-[#0088D1]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "servicios" && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Fecha</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Camión</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Servicio</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Taller</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">KM</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicios.length === 0 ? (
                <EmptyTableRow message="Sin servicios cargados. Cargá el primero con el botón de arriba." />
              ) : (
                servicios.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-6 text-muted-foreground">{fmtFecha(s.fecha)}</TableCell>
                    <TableCell className="font-medium">
                      {s.camion_patente}
                      {s.camion_marca_modelo && <span className="ml-1.5 text-xs text-muted-foreground">{s.camion_marca_modelo}</span>}
                    </TableCell>
                    <TableCell>{s.tipo_servicio_nombre ?? s.descripcion}</TableCell>
                    <TableCell className="text-muted-foreground">{s.taller ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtNum(s.km_odometro)}</TableCell>
                    <TableCell className="text-right pr-6 font-medium">{fmtMoneda(s.costo)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "roturas" && (
        <div className="space-y-6">
          {chartData.length > 0 && (
            <div className="bg-card rounded-[8px] border border-border shadow-sm p-5">
              <h2 className="text-foreground text-sm font-semibold mb-1">Roturas por chofer</h2>
              <p className="text-xs text-muted-foreground mb-4">Gomas rotas en los últimos 6 meses (top 10)</p>
              <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 34)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis type="category" dataKey="chofer" width={140} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                    formatter={(v) => [`${v} gomas`, "Rotas"] as [string, string]}
                  />
                  <Bar dataKey="cantidad" radius={[0, 3, 3, 0]} barSize={20}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="#F59E0B" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Fecha</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unidad</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Posición / notas</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Cantidad</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roturas.length === 0 ? (
                  <EmptyTableRow message="Sin roturas registradas." />
                ) : (
                  roturas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 text-muted-foreground">{fmtFecha(r.fecha)}</TableCell>
                      <TableCell className="font-medium">{r.chofer_nombre ?? <span className="italic text-muted-foreground/60">Sin asignar</span>}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.unidad_patente ? (
                          <span className="inline-flex items-baseline gap-1.5">
                            {r.unidad_tipo && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                {r.unidad_tipo === "camion" ? "Cam" : "Acop"}
                              </span>
                            )}
                            <span className="font-mono text-foreground">{r.unidad_patente}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.posicion ?? r.observaciones ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium text-[#F59E0B]">{r.cantidad}</TableCell>
                      <TableCell className="text-right pr-6 text-muted-foreground">{fmtMoneda(r.costo)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "alertas" && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-foreground text-sm font-semibold">Próximos services</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Camiones con un próximo service cargado que vence pronto (≤30 días o ≤5.000 km).
            </p>
          </div>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Estado</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Camión</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Servicio</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Vence</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Falta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertas.length === 0 ? (
                <EmptyTableRow message="Sin alertas. Cargá un servicio con 'próximo service' para que aparezca acá." />
              ) : (
                alertas.map((a, i) => (
                  <TableRow key={`${a.camion_id}-${a.servicio}-${i}`}>
                    <TableCell className="pl-6">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          a.estado === "vencido"
                            ? "bg-[#EF4444]/10 text-[#EF4444]"
                            : "bg-[#F59E0B]/10 text-[#F59E0B]"
                        }`}
                      >
                        <AlertTriangle size={11} /> {a.estado === "vencido" ? "Vencido" : "Por vencer"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.camion_patente}
                      {a.camion_marca_modelo && <span className="ml-1.5 text-xs text-muted-foreground">{a.camion_marca_modelo}</span>}
                    </TableCell>
                    <TableCell>{a.servicio}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.proximo_service_fecha ? fmtFecha(a.proximo_service_fecha) : ""}
                      {a.proximo_service_km != null && (
                        <span className="ml-1.5 text-xs">{fmtNum(a.proximo_service_km)} km</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6 text-muted-foreground">
                      {a.dias_restantes != null && (
                        <span>{a.dias_restantes < 0 ? `${Math.abs(a.dias_restantes)} d atrás` : `${a.dias_restantes} d`}</span>
                      )}
                      {a.km_restantes != null && (
                        <span className="ml-1.5">{a.km_restantes < 0 ? `${fmtNum(Math.abs(a.km_restantes))} km pasado` : `${fmtNum(a.km_restantes)} km`}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
