"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { Wrench, CircleDot, BellRing, AlertTriangle, Pencil, Trash2, BarChart3 } from "lucide-react";
import AddServicioDialog from "./AddServicioDialog";
import AddRoturaDialog, { tipoRoturaLabel } from "./AddRoturaDialog";
import HelpTutorialButton from "../help-tutorial-button";
import type { AcopladoOption, CamionOption, ChoferOption, TipoServicioOption } from "../types";
import {
  deleteServicioAction,
  deleteRoturaAction,
  type ServicioRow,
  type RoturaRow,
  type RoturaPorChofer,
  type AlertaServicio,
  type ReporteUnidadMant,
} from "../actions";

type Tab = "servicios" | "roturas" | "alertas" | "reportes";

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
  reportePorUnidad,
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
  reportePorUnidad: ReporteUnidadMant[];
  camiones: CamionOption[];
  acoplados: AcopladoOption[];
  choferes: ChoferOption[];
  tiposServicio: TipoServicioOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("servicios");

  // Edición
  const [editServicio, setEditServicio] = useState<ServicioRow | null>(null);
  const [editRotura, setEditRotura] = useState<RoturaRow | null>(null);
  // Borrado (confirmación)
  const [confirmDel, setConfirmDel] = useState<{ tipo: "servicio" | "rotura"; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    setDelError(null);
    try {
      const res = confirmDel.tipo === "servicio"
        ? await deleteServicioAction(confirmDel.id)
        : await deleteRoturaAction(confirmDel.id);
      if (res.error) {
        setDelError(res.error);
      } else {
        setConfirmDel(null);
        router.refresh();
      }
    } catch {
      setDelError("Ocurrió un error inesperado.");
    } finally {
      setDeleting(false);
    }
  };

  const totalGomasRotas = roturas.reduce((acc, r) => acc + (r.cantidad ?? 0), 0);
  const alertasVencidas = alertas.filter((a) => a.estado === "vencido").length;

  const chartData = roturasPorChofer.slice(0, 10);
  const tallerChartData = reportePorUnidad
    .filter((u) => u.visitas_taller > 0)
    .slice(0, 10)
    .map((u) => ({ unidad: u.unidad_patente, visitas: u.visitas_taller }));

  const tabs: { key: Tab; label: string; icon: typeof Wrench }[] = [
    { key: "servicios", label: "Servicios", icon: Wrench },
    { key: "roturas", label: "Roturas", icon: CircleDot },
    { key: "alertas", label: "Alertas Pendientes", icon: BellRing },
    { key: "reportes", label: "Reportes", icon: BarChart3 },
  ];

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Mantenimiento"
        description="Servicios, gomería y roturas de la flota — simple y al día"
        action={
          <div className="flex items-center gap-2">
            <HelpTutorialButton />
            {canWrite && (
              <>
              <AddServicioDialog camiones={camiones} acoplados={acoplados} tiposServicio={tiposServicio}>
                <Button
                  variant="brand"
                  className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-2 shadow-sm"
                  title="Service preventivo, reparación o gomería programada"
                >
                  <Wrench size={15} strokeWidth={2.5} /> Cargar servicio
                </Button>
              </AddServicioDialog>
              <AddRoturaDialog camiones={camiones} acoplados={acoplados} choferes={choferes}>
                <Button
                  variant="brand"
                  className="bg-[#F59E0B] hover:bg-[#D97706] text-white gap-2 shadow-sm"
                  title="Cualquier rotura no programada (goma, guardabarros, espejo, etc.)"
                >
                  <CircleDot size={15} strokeWidth={2.5} /> Registrar rotura
                </Button>
              </AddRoturaDialog>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="SERVICIOS REGISTRADOS" value={String(servicios.length)} sub="Histórico" color="brand" icon={Wrench} variant="dashboard" />
        <StatCard label="ROTURAS" value={String(totalGomasRotas)} sub={`${roturas.length} eventos`} color="warning" icon={CircleDot} variant="dashboard" />
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
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unidad</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Servicio</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Taller</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">KM</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Costo</TableHead>
                {canWrite && <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6 w-20">Acciones</TableHead>}
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
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          {s.unidad_tipo === "camion" ? "Cam" : "Acop"}
                        </span>
                        <span className="font-mono">{s.unidad_patente}</span>
                      </span>
                      {s.unidad_marca_modelo && <span className="ml-1.5 text-xs text-muted-foreground">{s.unidad_marca_modelo}</span>}
                    </TableCell>
                    <TableCell>{s.tipo_servicio_nombre ?? s.descripcion}</TableCell>
                    <TableCell className="text-muted-foreground">{s.taller ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{s.unidad_tipo === "acoplado" ? "—" : fmtNum(s.km_odometro)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoneda(s.costo)}</TableCell>
                    {canWrite && (
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditServicio(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDel({ tipo: "servicio", id: s.id, label: `${s.tipo_servicio_nombre ?? s.descripcion} — ${s.unidad_patente}` })} className="p-1.5 rounded hover:bg-[#EF4444]/10 text-muted-foreground hover:text-[#EF4444]" title="Borrar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TableCell>
                    )}
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
              <p className="text-xs text-muted-foreground mb-4">Roturas en los últimos 6 meses (top 10)</p>
              <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 34)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis type="category" dataKey="chofer" width={140} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                    formatter={(v) => [`${v} roturas`, "Rotas"] as [string, string]}
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
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Qué rompió</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unidad</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Detalle</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Cantidad</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Costo</TableHead>
                  {canWrite && <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6 w-20">Acciones</TableHead>}
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
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-[#F59E0B]/10 text-[#B45309] dark:text-amber-300 px-2 py-0.5 text-[11px] font-semibold">
                          {tipoRoturaLabel(r.tipo)}
                        </span>
                      </TableCell>
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
                      <TableCell className="text-right text-muted-foreground">{fmtMoneda(r.costo)}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditRotura(r)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setConfirmDel({ tipo: "rotura", id: r.id, label: `Rotura ${r.unidad_patente ?? r.chofer_nombre ?? ""}` })} className="p-1.5 rounded hover:bg-[#EF4444]/10 text-muted-foreground hover:text-[#EF4444]" title="Borrar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </TableCell>
                      )}
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
              Unidades con un próximo service cargado que vence pronto (≤30 días o ≤5.000 km).
            </p>
          </div>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Estado</TableHead>
                <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unidad</TableHead>
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
                  <TableRow key={`${a.unidad_id}-${a.servicio}-${i}`}>
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
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          {a.unidad_tipo === "camion" ? "Cam" : "Acop"}
                        </span>
                        <span className="font-mono">{a.unidad_patente}</span>
                      </span>
                      {a.unidad_marca_modelo && <span className="ml-1.5 text-xs text-muted-foreground">{a.unidad_marca_modelo}</span>}
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

      {tab === "reportes" && (
        <div className="space-y-6">
          <div className="bg-card rounded-[8px] border border-border shadow-sm p-5">
            <h2 className="text-foreground text-sm font-semibold mb-1">Visitas a taller por unidad</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Reparaciones y gomería en los últimos 6 meses (top 10). Misma métrica que penaliza el ranking de choferes.
            </p>
            {tallerChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sin visitas a taller registradas en el período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, tallerChartData.length * 34)}>
                <BarChart data={tallerChartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis type="category" dataKey="unidad" width={110} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                    formatter={(v) => [`${v} visitas`, "Taller"] as [string, string]}
                  />
                  <Bar dataKey="visitas" radius={[0, 3, 3, 0]} barSize={20}>
                    {tallerChartData.map((_, i) => (
                      <Cell key={i} fill="#0088D1" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-foreground text-sm font-semibold">Mantenimiento por unidad</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Acumulado de los últimos 6 meses.</p>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Unidad</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Visitas a taller</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Servicios</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Costo total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportePorUnidad.length === 0 ? (
                  <EmptyTableRow message="Sin mantenimientos en el período." />
                ) : (
                  reportePorUnidad.map((u) => (
                    <TableRow key={`${u.unidad_tipo}-${u.unidad_patente}`}>
                      <TableCell className="pl-6 font-medium">
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            {u.unidad_tipo === "camion" ? "Cam" : "Acop"}
                          </span>
                          <span className="font-mono">{u.unidad_patente}</span>
                        </span>
                        {u.unidad_marca_modelo && <span className="ml-1.5 text-xs text-muted-foreground">{u.unidad_marca_modelo}</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium text-[#0088D1]">{u.visitas_taller}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{u.servicios_total}</TableCell>
                      <TableCell className="text-right pr-6 font-medium">{fmtMoneda(u.costo_total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Diálogos de edición (controlados) */}
      {editServicio && (
        <AddServicioDialog
          camiones={camiones}
          acoplados={acoplados}
          tiposServicio={tiposServicio}
          editing={editServicio}
          open={!!editServicio}
          onOpenChange={(v) => { if (!v) setEditServicio(null); }}
        />
      )}
      {editRotura && (
        <AddRoturaDialog
          camiones={camiones}
          acoplados={acoplados}
          choferes={choferes}
          editing={editRotura}
          open={!!editRotura}
          onOpenChange={(v) => { if (!v) setEditRotura(null); }}
        />
      )}

      {/* Confirmación de borrado */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) { setConfirmDel(null); setDelError(null); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg">¿Borrar registro?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {confirmDel?.label}. Esta acción no se puede deshacer.
              {confirmDel?.tipo === "servicio" && " Si tenía un gasto asociado en Caja, también se elimina."}
            </DialogDescription>
          </DialogHeader>
          {delError && <InlineFeedback variant="error" message={delError} onDismiss={() => setDelError(null)} autoHideMs={0} />}
          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)} disabled={deleting} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-[#EF4444] hover:bg-[#DC2626] text-white">
              {deleting ? "Borrando..." : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
