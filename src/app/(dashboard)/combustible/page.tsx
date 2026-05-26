import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Fuel, Trophy, Gauge, DollarSign, TrendingDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import AddGasoilDialog from "../camiones/components/AddGasoilDialog";
import {
  getStatsMesAction,
  getRankingEficienciaMesAction,
  getPremioDelMesAction,
  getCargasAction,
} from "./actions";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNum(n: number, decimals = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default async function CombustiblePage() {
  const user = await requireArea("combustible", "read");
  const canWrite = hasArea(user, "combustible", "write");
  const supabase = createAdminClient();

  const [stats, ranking, premio, cargas, { data: camiones }] = await Promise.all([
    getStatsMesAction(),
    getRankingEficienciaMesAction(),
    getPremioDelMesAction(),
    getCargasAction({ page: 0 }),
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo, ano, capacidad_tn, tipo_camion, estado")
      .eq("estado", "activo")
      .order("patente"),
  ]);

  const topRanking = ranking.slice(0, 10);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Combustible & Gasoil"
        description="Carga, eficiencia y ranking de choferes del mes en curso"
        action={
          canWrite ? (
            <AddGasoilDialog camiones={camiones ?? []}>
              <Button variant="brand" size="default">
                <Fuel size={14} />
                Cargar gasoil
              </Button>
            </AddGasoilDialog>
          ) : null
        }
      />

      {/* Stats del mes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cargas del mes"
          value={String(stats.cargasTotales)}
          sub={`${stats.cargasConChofer} con chofer asignado`}
          color="brand"
          icon={Fuel}
        />
        <StatCard
          label="Litros totales"
          value={formatNum(stats.litrosTotales, 0)}
          sub="Mes en curso"
          color="warning"
          icon={Gauge}
        />
        <StatCard
          label="Importe total"
          value={`$ ${formatARS(stats.importeTotal)}`}
          sub="Mes en curso"
          color="error"
          icon={DollarSign}
        />
        <StatCard
          label="Eficiencia promedio"
          value={
            stats.eficienciaPromedio != null
              ? `${stats.eficienciaPromedio.toFixed(2)} L/100km`
              : "—"
          }
          sub={stats.eficienciaPromedio != null ? "Flota global" : "Sin datos suficientes"}
          color="success"
          icon={TrendingDown}
        />
      </div>

      {/* Premio del Mes */}
      <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-700/30 rounded-[8px]">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shrink-0">
            <Trophy size={15} className="text-white" />
          </div>
          <span className="text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
            Premio del mes
          </span>
          {premio ? (
            <div className="flex items-baseline gap-3 flex-1 min-w-0">
              <span className="text-amber-900 dark:text-amber-100 text-sm font-bold truncate">
                {premio.chofer}
              </span>
              <span className="text-amber-800 dark:text-amber-200 text-sm font-semibold shrink-0">
                {premio.eficiencia.toFixed(2)}
                <span className="text-[10px] font-medium opacity-80 ml-0.5">L/100km</span>
              </span>
              <span className="text-amber-700/70 dark:text-amber-300/70 text-[11px] shrink-0 hidden sm:inline">
                {formatNum(premio.km_recorridos)} km · {formatNum(premio.litros_totales, 0)} L · {premio.cargas} cargas
              </span>
            </div>
          ) : (
            <span className="text-amber-700/80 dark:text-amber-300/80 text-xs flex-1">
              Sin candidatos este mes — cargá 2 gasoiles del mismo camión con chofer.
            </span>
          )}
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Ranking de eficiencia — mes en curso</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Menor L/100km = más eficiente
          </p>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-12 pl-6">#</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">L/100km</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">KM recorridos</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Litros</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Cargas</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topRanking.length === 0 ? (
              <EmptyTableRow message="Sin datos de eficiencia suficientes este mes. Cargá al menos 2 gasoiles de un mismo camión con chofer asignado." />
            ) : (
              topRanking.map((r, idx) => (
                <TableRow key={r.chofer_id}>
                  <TableCell className="pl-6 font-bold text-muted-foreground">
                    {idx === 0 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300">
                        <Trophy size={12} />
                      </span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{r.chofer}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {r.eficiencia.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNum(r.km_recorridos)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNum(r.litros_totales, 0)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.cargas}
                  </TableCell>
                  <TableCell className="text-right pr-6 text-muted-foreground">
                    ${formatARS(r.importe_total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cargas recientes */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Fuel size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">
              Cargas recientes
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">{cargas.count} en total</p>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Fecha</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Camión</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estación</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">KM</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Litros</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargas.data.length === 0 ? (
              <EmptyTableRow message="Sin cargas registradas" />
            ) : (
              cargas.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6 text-muted-foreground">
                    {new Date(c.fecha).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {c.camion_patente}
                    {c.camion_marca_modelo && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {c.camion_marca_modelo}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.chofer ?? <span className="italic text-muted-foreground/60">Sin asignar</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.estacion ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNum(c.km_odometro)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNum(c.litros, 2)} L
                  </TableCell>
                  <TableCell className="text-right pr-6 font-medium">
                    ${formatARS(c.importe_total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
