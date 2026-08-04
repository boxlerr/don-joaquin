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
import { Fuel, Trophy, Gauge, DollarSign, TrendingDown, Upload } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import AddGasoilDialog from "../camiones/components/AddGasoilDialog";
import HelpTutorialButton from "./help-tutorial-button";
import {
  getStatsMesAction,
  getRankingEficienciaMesAction,
  getPremioDelMesAction,
  getCargasAction,
} from "./actions";
import CargasTable from "./components/CargasTable";
import MesSelector from "./components/MesSelector";
import ExportCombustibleButton from "./components/ExportCombustibleButton";
import ImportYpfModal from "./components/ImportYpfModal";

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

/** Fondo/borde del podio (1º, 2º y 3º) — compartido entre la tabla y las tarjetas. */
function podiumRowClasses(idx: number): string {
  if (idx === 0) return "bg-amber-500/5 border-l-4 border-l-amber-500 hover:bg-amber-500/10";
  if (idx === 1) return "bg-slate-500/5 border-l-4 border-l-slate-400 hover:bg-slate-500/10";
  if (idx === 2) return "bg-orange-500/5 border-l-4 border-l-orange-400 hover:bg-orange-500/10";
  return "border-l-4 border-l-transparent hover:bg-muted/30";
}

/** Chapita con el número de posición. */
function podiumBadgeClasses(idx: number): string {
  if (idx === 0) return "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-2 ring-amber-100";
  if (idx === 1) return "bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-sm ring-2 ring-slate-100";
  if (idx === 2) return "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm ring-2 ring-orange-100";
  return "bg-muted text-muted-foreground";
}

export default async function CombustiblePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; choferId?: string; sort?: string; month?: string }>;
}) {
  const user = await requireArea("combustible", "read");
  const canWrite = hasArea(user, "combustible", "write");
  const supabase = createAdminClient();

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 0;
  const choferId = resolvedParams.choferId || "";
  const sort = resolvedParams.sort || "fecha_desc";
  const month = resolvedParams.month || "";

  const [stats, ranking, premio, cargas, { data: camiones }, { data: choferes }] = await Promise.all([
    getStatsMesAction(month),
    getRankingEficienciaMesAction(month),
    getPremioDelMesAction(month),
    getCargasAction({ page, choferId, sortBy: sort, month }),
    supabase
      .from("camiones")
      .select(
        "id, patente, marca, modelo, ano, capacidad_tn, tipo_camion, estado, tercerizacion_estado, es_tolva, km_actual, chofer_actual_id"
      )
      .eq("estado", "activo")
      .order("patente"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .neq("estado", "baja")
      .order("apellido"),
  ]);

  let periodLabel = "del mes en curso";
  if (month) {
    const MONTH_NAMES = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const [yStr, mStr] = month.split("-");
    const mIdx = parseInt(mStr, 10) - 1;
    const year = parseInt(yStr, 10);
    if (mIdx >= 0 && mIdx < 12) {
      periodLabel = `de ${MONTH_NAMES[mIdx]} ${year}`;
    }
  }

  const topRanking = ranking.slice(0, 10);

  // Mismo vacío para la tabla (desktop) y para las tarjetas (celular).
  const rankingVacio = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
        <Trophy size={20} />
      </div>
      <div className="max-w-md text-center">
        <p className="text-foreground text-sm font-bold">Sin datos de eficiencia este mes</p>
        <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
          Cargá al menos 2 gasoiles de un mismo camión con un chofer asignado para comenzar a ver el ranking de rendimiento.
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Combustible & Gasoil"
        description={`Carga, eficiencia y ranking de choferes ${periodLabel}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MesSelector currentMonth={month} />
            <ExportCombustibleButton month={month} />
            {canWrite && (
              <ImportYpfModal>
                <Button variant="outline" size="sm">
                  <Upload size={14} />
                  Importar YPF
                </Button>
              </ImportYpfModal>
            )}
            <HelpTutorialButton />
            {canWrite && (
              <AddGasoilDialog camiones={camiones ?? []}>
                <Button variant="brand" size="default">
                  <Fuel size={14} />
                  Cargar gasoil
                </Button>
              </AddGasoilDialog>
            )}
          </div>
        }
      />

      {/* Stats del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Cargas del mes"
          value={String(stats.cargasTotales)}
          sub={`${stats.cargasConChofer} con chofer asignado`}
          color="brand"
          icon={Fuel}
          variant="dashboard"
        />
        <StatCard
          label="Litros totales"
          value={formatNum(stats.litrosTotales, 0)}
          sub="Mes en curso"
          color="warning"
          icon={Gauge}
          variant="dashboard"
        />
        <StatCard
          label="Importe total"
          value={`$ ${formatARS(stats.importeTotal)}`}
          sub={
            stats.precioPromedioLitro != null
              ? `Promedio $ ${formatARS(stats.precioPromedioLitro)} por litro`
              : "Mes en curso"
          }
          color="error"
          icon={DollarSign}
          variant="dashboard"
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
          variant="dashboard"
        />
      </div>

      {/* Premio del Mes */}
      <div className="bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent border border-amber-500/20 rounded-[12px] p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(245,158,11,0.03)] backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:border-amber-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shrink-0 shadow-md">
              <Trophy size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <span className="text-amber-600 text-[10px] font-extrabold uppercase tracking-wider block">
                Premio de Eficiencia
              </span>
              <h3 className="text-amber-900 text-sm font-bold">
                Chofer destacado del mes
              </h3>
            </div>
          </div>
          
          <div className="min-w-0 flex-1 border-t sm:border-t-0 sm:border-l border-amber-500/20 pt-3 sm:pt-0 sm:pl-4 flex items-center justify-between gap-4">
            {premio ? (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 min-w-0">
                <span className="text-amber-950 text-base font-extrabold">
                  {premio.chofer}
                </span>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-amber-800 text-sm font-black bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {premio.eficiencia.toFixed(2)}
                    <span className="text-[10px] font-bold ml-0.5">L/100km</span>
                  </span>
                  <span className="text-amber-700/60 text-xs font-semibold">
                    ({formatNum(premio.km_recorridos)} km · {formatNum(premio.litros_totales, 0)} L · {premio.cargas} cargas)
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-amber-800/80 text-xs leading-relaxed max-w-lg">
                No hay candidatos suficientes para el premio este mes. 
                <span className="block text-[11px] text-amber-700/60 mt-0.5">
                  Requisito: cargar gasoil al menos 2 veces para un mismo camión con chofer asignado.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy size={16} className="text-primary shrink-0" />
            <h2 className="text-foreground text-sm font-semibold">Ranking de eficiencia — mes en curso</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Menor L/100km = más eficiente
          </p>
        </div>

        {/* Celular: cada chofer del ranking es una tarjeta (la tabla de 8
            columnas no entra en 375px y el ranking es el corazón de la página). */}
        <div className="md:hidden divide-y divide-border">
          {topRanking.length === 0 ? (
            <div className="py-12 px-4">{rankingVacio}</div>
          ) : (
            topRanking.map((r, idx) => (
              <div key={r.chofer_id} className={`flex items-start gap-3 p-3.5 ${podiumRowClasses(idx)}`}>
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${podiumBadgeClasses(idx)}`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {r.chofer}
                    </span>
                    <span className="shrink-0 rounded-md border border-primary/10 bg-primary/5 px-2 py-0.5 font-mono text-sm font-black text-primary">
                      {r.eficiencia.toFixed(2)}
                      <span className="ml-0.5 font-sans text-[10px] font-semibold">L/100km</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{formatNum(r.km_recorridos)} km</span>
                    <span className="font-mono">{formatNum(r.litros_totales, 0)} L</span>
                    <span>{r.cargas} {r.cargas === 1 ? "carga" : "cargas"}</span>
                    {r.precio_litro != null && (
                      <span className="font-mono">${formatARS(r.precio_litro)} / L</span>
                    )}
                    <span className="font-mono font-semibold text-foreground">
                      ${formatARS(r.importe_total)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Table className="hidden md:table min-w-[880px]">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-12 pl-6">#</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">L/100km</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">KM recorridos</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Litros</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Cargas</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">$ / L</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topRanking.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  {rankingVacio}
                </TableCell>
              </TableRow>
            ) : (
              topRanking.map((r, idx) => {
                return (
                  <TableRow key={r.chofer_id} className={`transition-colors duration-200 ${podiumRowClasses(idx)}`}>
                    <TableCell className="pl-6 py-3.5 font-bold">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${podiumBadgeClasses(idx)}`}>
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{r.chofer}</span>
                        {idx === 0 && (
                          <Trophy size={14} className="text-amber-500 animate-bounce" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-primary py-3.5 text-sm">
                      <span className="bg-primary/5 text-primary border border-primary/10 px-2.5 py-0.5 rounded-md font-mono">
                        {r.eficiencia.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground py-3.5 font-mono">
                      {formatNum(r.km_recorridos)} km
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground py-3.5 font-mono">
                      {formatNum(r.litros_totales, 0)} L
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground py-3.5 font-semibold">
                      <span className="bg-muted px-2 py-0.5 rounded text-[11px] text-muted-foreground">
                        {r.cargas} {r.cargas === 1 ? "carga" : "cargas"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground py-3.5 font-mono">
                      {r.precio_litro != null ? `$${formatARS(r.precio_litro)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right pr-6 text-muted-foreground py-3.5 font-mono font-medium">
                      ${formatARS(r.importe_total)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cargas recientes */}
      <CargasTable
        cargas={cargas.data}
        count={cargas.count}
        choferes={(choferes ?? []) as { id: string; nombre: string; apellido: string }[]}
        currentPage={page}
        currentChoferId={choferId}
        currentSortBy={sort}
        canWrite={canWrite}
      />
    </div>
  );
}
