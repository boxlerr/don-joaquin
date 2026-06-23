import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import {
  MapPin,
  AlertTriangle,
  Receipt,
  FileText,
  Briefcase,
  Route,
  ShieldAlert,
  Clock,
  Truck,
  Users,
  ChevronRight,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViajesAction } from "@/app/(dashboard)/viajes/actions";
import { getPremioDelMesAction } from "@/app/(dashboard)/combustible/actions";
import RecentViajesTable from "./components/RecentViajesTable";
import TopBottomChoferes from "./components/TopBottomChoferes";
import ResumenMes from "./components/ResumenMes";
import { computeRanking, resolverRango } from "@/app/(dashboard)/choferes/ranking/lib";
import { alertaHref, categoriaDeAlerta, diasRestantes } from "@/app/(dashboard)/notificaciones/utils";
import DashboardHelpButton from "./DashboardHelpButton";

export default async function DashboardPage() {
  const supabase = createAdminClient();
  const rangoMes = resolverRango({});

  const [
    viajesActivos,
    viajesSinFacturar,
    saldoMovimientos,
    viaticosPendientes,
    chequesPorVencer,
    docPorVencer,
    totalClientes,
    totalCamiones,
    totalChoferes,
    viajesResult,
    premioMes,
    ranking,
    tiposDocRes,
    camionDocsRes,
    choferDocsRes,
  ] = await Promise.all([
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .in("estado", ["pendiente", "en_curso"]),
    // Misma definición que el filtro "Sin facturar" del panel de /viajes
    // (excluye vacíos y cancelados) para que el contador coincida con esa vista.
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .eq("facturado", false)
      .eq("es_vacio", false)
      .neq("estado", "cancelado"),
    supabase.from("caja_movimientos").select("*", { count: "exact", head: true }),
    supabase.from("viaticos").select("*", { count: "exact", head: true }),
    supabase.from("cheques").select("*", { count: "exact", head: true }),
    supabase
      .from("alertas")
      .select("id, tipo, entidad_tipo, entidad_id, severidad", { count: "exact" })
      .eq("estado", "pendiente")
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("camiones").select("*", { count: "exact", head: true }),
    supabase.from("choferes").select("rol", { count: "exact" }),
    getViajesAction({ pageSize: 5 }),
    getPremioDelMesAction(),
    computeRanking(rangoMes),
    supabase
      .from("tipos_documento")
      .select("id, dias_alerta_vencimiento")
      .eq("estado", "activo"),
    supabase.from("camion_documentos").select("tipo_documento_id, fecha_vencimiento"),
    supabase.from("chofer_documentos").select("tipo_documento_id, fecha_vencimiento"),
  ]);

  // Vencimientos reales calculados desde los documentos, con la MISMA lógica
  // que /notificaciones (mismo diasRestantes + filtro por tipos activos), para
  // que los totales coincidan. Antes usábamos parsing distinto (Date(string)
  // en UTC + ceil) que daba ±1 día, y caíamos en un default de 30 días para
  // tipos no encontrados — eso inflaba el contador del dashboard contra el de
  // notificaciones.
  const diasAlertaPorTipo = new Map<string, number>();
  for (const t of tiposDocRes.data ?? []) {
    diasAlertaPorTipo.set(t.id, t.dias_alerta_vencimiento);
  }
  // Misma definición que /notificaciones: una alerta es **crítica** cuando el
  // documento está vencido o le quedan <= 7 días. Los que están entre 8 y el
  // `dias_alerta_vencimiento` del tipo cuentan como **advertencia**.
  const DIAS_CRITICO = 7;
  let docVencidos = 0;
  let docProximos = 0;
  let docCriticos = 0;
  for (const d of [...(camionDocsRes.data ?? []), ...(choferDocsRes.data ?? [])]) {
    // Si el tipo no está activo, lo ignoramos (mismo criterio que /notificaciones).
    const diasAlerta = diasAlertaPorTipo.get(d.tipo_documento_id);
    if (diasAlerta == null) continue;
    const diasRest = diasRestantes(d.fecha_vencimiento);
    if (diasRest === null) continue;
    const vencido = diasRest < 0;
    const proximo = !vencido && diasRest <= diasAlerta;
    if (vencido) docVencidos++;
    else if (proximo) docProximos++;
    if (vencido || (proximo && diasRest <= DIAS_CRITICO)) docCriticos++;
  }

  // Sumamos las alertas de la tabla `alertas` con severidad crítica que NO
  // sean de documentos (esas ya se cuentan arriba en vivo). Son cosas como
  // cheques rechazados, compliance, viajes sin cerrar, etc. Esto alinea el
  // conteo con el filtro "Crítica" de /notificaciones.
  const otrasCriticas = (docPorVencer.data ?? []).filter(
    (a) =>
      a.severidad === "critica" &&
      a.tipo !== "vencimiento_doc_camion" &&
      a.tipo !== "vencimiento_doc_chofer",
  ).length;
  docCriticos += otrasCriticas;

  // Desglose del total de personal por rol (chofer / administrativo / mantenimiento).
  // Legacy: registros con rol null se cuentan como "chofer".
  const personalRoles = (totalChoferes.data ?? []) as { rol: string | null }[];
  let countChofer = 0;
  let countAdmin = 0;
  let countMant = 0;
  for (const p of personalRoles) {
    const r = p.rol ?? "chofer";
    if (r === "administrativo") countAdmin++;
    else if (r === "mantenimiento") countMant++;
    else countChofer++;
  }

  // Desglose por categoría (documentación, cheques, viajes, personal, sistema).
  // Para no contar dos veces las alertas de documentos, ignoramos las del tipo
  // `vencimiento_doc_*` de la tabla (mismo criterio que /notificaciones, donde
  // las reemplaza por las calculadas en vivo desde camion_documentos / chofer_documentos).
  const dbAlertasOtras = (docPorVencer.data ?? []).filter(
    (a) => a.tipo !== "vencimiento_doc_camion" && a.tipo !== "vencimiento_doc_chofer",
  );

  const catCounts: Record<string, number> = {
    documentacion: docVencidos + docProximos,
    cheques: 0,
    viajes: 0,
    personal_cumple: 0,
    personal_aniversario: 0,
    personal_prueba: 0,
    sistema: 0,
  };
  for (const a of dbAlertasOtras) {
    const cat = categoriaDeAlerta(a.tipo, a.entidad_tipo);
    if (cat === "personal") {
      // Subdividimos "personal" para que se vean cumple / aniversario / prueba
      // por separado, que es lo que pide explícitamente el feedback.
      if (a.entidad_tipo === "choferes_periodo_prueba") catCounts.personal_prueba++;
      else if (a.entidad_tipo?.endsWith("_aniversario")) catCounts.personal_aniversario++;
      else catCounts.personal_cumple++;
    } else if (cat === "documentacion") {
      // vencimiento_compliance (SICOP/Secondi) cae acá; sumamos al bucket de docs.
      catCounts.documentacion++;
    } else {
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
  }

  const alertCount =
    catCounts.documentacion +
    catCounts.cheques +
    catCounts.viajes +
    catCounts.personal_cumple +
    catCounts.personal_aniversario +
    catCounts.personal_prueba +
    catCounts.sistema;
  const firstAlert = docPorVencer.data?.[0];
  const resolverHref = firstAlert ? (alertaHref(firstAlert) ?? "/notificaciones") : "/notificaciones";
  const ultimosViajes = (viajesResult && "data" in viajesResult) ? viajesResult.data : [];

  const conScore = ranking.filter((r) => r.score !== null);
  const topChoferes = conScore.slice(0, 5);
  // Bottom: choferes que no entran en el top, últimos 5 invertidos.
  // Si hay <=5 con actividad, no hay bottom (no tendría sentido repetir).
  const bottomChoferes =
    conScore.length > 5 ? conScore.slice(5).slice(-5).reverse() : [];

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader
        title="Dashboard"
        description="Resumen operativo y financiero del día"
        action={<DashboardHelpButton />}
      />

      <ResumenMes ranking={ranking} periodoLabel={rangoMes.label} />

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Viajes activos"
          value={String(viajesActivos.count ?? 0)}
          sub="Pendientes y en curso"
          color="brand"
          icon={Briefcase}
          variant="dashboard"
          href="/viajes"
        />
        <StatCard
          label="Movimientos de caja"
          value={String(saldoMovimientos.count ?? 0)}
          sub="Total registrados"
          color="success"
          icon={Receipt}
          variant="dashboard"
          href="/caja"
        />
        <StatCard
          label="Viáticos"
          value={String(viaticosPendientes.count ?? 0)}
          sub="Total registrados"
          color="warning"
          icon={Route}
          variant="dashboard"
          href="/caja"
        />
        <StatCard
          label="Cheques en cartera"
          value={String(chequesPorVencer.count ?? 0)}
          sub="Total registrados"
          color="error"
          icon={FileText}
          variant="dashboard"
          href="/cheques"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              <h2 className="text-foreground text-sm font-bold">Últimos viajes</h2>
            </div>
            <a href="/viajes" className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors">
              Ver todos →
            </a>
          </div>
          <div className="flex-1 bg-gradient-to-b from-card to-muted/10">
            <RecentViajesTable initialViajes={ultimosViajes} />
          </div>
        </div>

        <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#F59E0B]" />
              <h2 className="text-foreground text-sm font-bold">Alertas activas</h2>
            </div>
            <span className={`text-2xl font-black ${alertCount > 0 ? "text-[#D97706] dark:text-amber-300" : "text-foreground"}`}>
              {alertCount}
            </span>
          </div>
          <div className="p-5 flex-1 flex items-center justify-center bg-gradient-to-b from-card to-muted/10">
            {alertCount > 0 ? (
              // Active Alerts Warning Card (Amber Theme) — desglose por categoría
              // para no entrar legajo por legajo (pedido explícito del feedback).
              <div className="w-full bg-gradient-to-br from-[#FFFBEB] to-[#FFFDF5] dark:from-amber-950/40 dark:to-amber-900/20 rounded-[8px] p-4.5 border border-[#FDE68A]/60 dark:border-amber-700/40 shadow-[0_2px_8px_rgba(245,158,11,0.02)] dark:shadow-none flex flex-col justify-between relative overflow-hidden h-full">
                <div className="flex items-start gap-3 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0 mt-1 animate-ping absolute" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0 mt-1 z-10" />
                  <div className="flex flex-col flex-1">
                    <p className="text-[#92400E] dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">Por categoría</p>
                    <p className="text-[#B45309] dark:text-amber-200 text-sm font-bold mt-0.5 leading-snug">
                      Se requiere atención
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "documentacion", label: "Documentación", icon: "📋", count: catCounts.documentacion },
                          { id: "personal_prueba", label: "Fin de prueba", icon: "🔓", count: catCounts.personal_prueba },
                          { id: "personal_cumple", label: "Cumpleaños", icon: "🎂", count: catCounts.personal_cumple },
                          { id: "personal_aniversario", label: "Aniversarios", icon: "🎉", count: catCounts.personal_aniversario },
                          { id: "cheques", label: "Cheques", icon: "💰", count: catCounts.cheques },
                          { id: "viajes", label: "Viajes", icon: "🚚", count: catCounts.viajes },
                          { id: "sistema", label: "Sistema", icon: "⚙️", count: catCounts.sistema },
                        ] as const
                      )
                        .filter((c) => c.count > 0)
                        .map((c) => {
                          // "personal_*" son subcategorías del filtro real "personal";
                          // lo que sí podemos pasar es la categoría base + un hash a
                          // futuro. Por ahora link a /notificaciones?categoria=<base>.
                          const base = c.id.startsWith("personal_") ? "personal" : c.id;
                          return (
                            <a
                              key={c.id}
                              href={`/notificaciones?categoria=${base}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-amber-900/40 border border-[#FCD34D] dark:border-amber-700/50 text-[11px] font-semibold text-[#92400E] dark:text-amber-200 hover:bg-[#FDE68A] dark:hover:bg-amber-900/60 transition-colors"
                              title={`${c.label}: ${c.count} alerta${c.count !== 1 ? "s" : ""}`}
                            >
                              <span aria-hidden>{c.icon}</span>
                              <span>{c.label}</span>
                              <span className="ml-0.5 font-bold tabular-nums">{c.count}</span>
                            </a>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#FDE68A]/40 dark:border-amber-700/30 flex items-center justify-between z-10">
                  <a href={resolverHref} className="text-xs font-bold text-[#D97706] dark:text-amber-300 hover:text-[#92400E] dark:hover:text-amber-200 flex items-center gap-1 transition-colors">
                    Resolver alerta
                    <ChevronRight size={14} />
                  </a>
                  <a
                    href="/notificaciones"
                    className="text-[10px] font-extrabold uppercase tracking-wider text-[#92400E] dark:text-amber-200 hover:underline"
                  >
                    Ver todas →
                  </a>
                </div>

                <svg className="w-16 h-16 text-[#F59E0B]/10 dark:text-amber-300/15 shrink-0 z-0 absolute right-1 bottom-1 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            ) : (
              // Pristine Safe Card (Green Theme)
              <div className="w-full bg-gradient-to-br from-[#ECFDF5] to-[#F0FDF4] dark:from-emerald-950/40 dark:to-emerald-900/20 rounded-[8px] p-4.5 border border-[#A7F3D0]/60 dark:border-emerald-700/40 shadow-[0_2px_8px_rgba(16,185,129,0.02)] dark:shadow-none flex flex-col justify-between relative overflow-hidden h-full">
                <div className="flex items-start gap-3 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0 mt-1 animate-ping absolute" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0 mt-1 z-10" />
                  <div className="flex flex-col">
                    <p className="text-[#064E3B] dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">Flota al día</p>
                    <p className="text-[#047857] dark:text-emerald-200 text-sm font-bold mt-0.5 leading-snug">Sin alertas activas</p>
                    <p className="text-[#047857]/80 dark:text-emerald-200/80 text-[11px] font-semibold mt-1 leading-relaxed">
                      Todo bajo control. La documentación y permisos de camiones y choferes se encuentran validados.
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#A7F3D0]/40 dark:border-emerald-700/30 flex items-center justify-between z-10">
                  <span className="text-xs font-bold text-[#059669] dark:text-emerald-300 flex items-center gap-1">
                    Sistemas seguros
                  </span>
                  <CheckCircle2 size={16} className="text-[#10B981]" />
                </div>

                <svg className="w-16 h-16 text-[#10B981]/8 dark:text-emerald-300/15 shrink-0 z-0 absolute right-1 bottom-1 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      <TopBottomChoferes top={topChoferes} bottom={bottomChoferes} />

      {/* Premio del Mes — Eficiencia de combustible */}
      <a
        href="/combustible"
        className="block bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-700/30 rounded-[8px] hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-600/50 transition-colors group"
      >
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shrink-0">
            <Trophy size={15} className="text-white" />
          </div>
          <span className="text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
            Premio del mes
          </span>
          {premioMes ? (
            <div className="flex items-baseline gap-3 flex-1 min-w-0">
              <span className="text-amber-900 dark:text-amber-100 text-sm font-bold truncate">
                {premioMes.chofer}
              </span>
              <span className="text-amber-800 dark:text-amber-200 text-sm font-semibold shrink-0">
                {premioMes.eficiencia.toFixed(2)}
                <span className="text-[10px] font-medium opacity-80 ml-0.5">L/100km</span>
              </span>
              <span className="text-amber-700/70 dark:text-amber-300/70 text-[11px] shrink-0 hidden sm:inline">
                {premioMes.km_recorridos.toLocaleString("es-AR")} km · {premioMes.cargas} cargas
              </span>
            </div>
          ) : (
            <span className="text-amber-700/80 dark:text-amber-300/80 text-xs flex-1">
              Sin candidatos este mes — cargá 2 gasoiles del mismo camión con chofer.
            </span>
          )}
          <ChevronRight
            size={14}
            className="text-amber-600/60 dark:text-amber-300/60 group-hover:translate-x-0.5 transition-transform shrink-0"
          />
        </div>
      </a>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={Truck}
          title="Flota de camiones"
          metric={String(totalCamiones.count ?? 0)}
          metricLabel="unidades"
          description="Registradas en el sistema"
          href="/camiones"
          type="truck"
        />
        <SummaryCard
          icon={Users}
          title="Personal"
          metric={String(totalChoferes.count ?? 0)}
          metricLabel="legajos"
          description="Choferes, administración y mantenimiento"
          href="/choferes"
          iconColor="text-[#7C3AED] dark:text-violet-300"
          iconBg="bg-[#F3E8FF] dark:bg-violet-500/15"
          type="users"
          breakdown={[
            { label: "Choferes", value: countChofer },
            { label: "Admin.", value: countAdmin },
            { label: "Mant.", value: countMant },
          ]}
        />
        <SummaryCard
          icon={Briefcase}
          title="Clientes"
          metric={String(totalClientes.count ?? 0)}
          metricLabel="activos"
          description="Registrados en el sistema"
          href="/clientes"
          iconColor="text-[#059669] dark:text-emerald-300"
          iconBg="bg-[#ECFDF5] dark:bg-emerald-500/15"
          type="building"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          icon={ShieldAlert}
          title="Documentación crítica"
          description="Documentos vencidos o que vencen dentro de 7 días"
          metric={String(docCriticos)}
          metricLabel={docCriticos === 1 ? "alerta crítica" : "alertas críticas"}
          href="/notificaciones?severidad=critica"
          iconColor="text-[#E11D48] dark:text-rose-300"
          iconBg="bg-[#FFF1F2] dark:bg-rose-500/15"
          type="clipboard"
        />
        <SummaryCard
          icon={Clock}
          title="Viajes sin facturar"
          description="Viajes finalizados pendientes de carga de factura"
          metric={String(viajesSinFacturar.count ?? 0)}
          metricLabel="pendiente"
          href="/viajes?filtro=sin_facturar"
          iconColor="text-[#D97706] dark:text-amber-300"
          iconBg="bg-[#FEF3C7] dark:bg-amber-500/15"
          type="invoice"
        />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: typeof FileText;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  href?: string;
  iconColor?: string;
  iconBg?: string;
  type: "truck" | "users" | "building" | "clipboard" | "invoice";
  /** Desglose opcional mostrado como chips bajo el conteo principal. */
  breakdown?: { label: string; value: number | string }[];
}

function SummaryCard({
  icon: Icon,
  title,
  description,
  metric,
  metricLabel,
  href,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  type,
  breakdown,
}: SummaryCardProps) {
  const CardWrapper = href ? "a" : "div";

  return (
    <CardWrapper
      href={href}
      className={`relative overflow-hidden bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group block ${
        href ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg} shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-sm dark:shadow-none`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm font-bold group-hover:text-primary transition-colors duration-300">
              {title}
            </span>
            <ChevronRight size={16} className="text-muted-foreground/70 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-primary transition-all duration-300" />
          </div>
          <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
            {description}
          </p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-foreground tracking-tight leading-none">
              {metric}
            </span>
            <span className="text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-wider">
              {metricLabel}
            </span>
          </div>
          {breakdown && breakdown.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {breakdown.map((b) => (
                <span
                  key={b.label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted/60 dark:bg-muted/40 text-foreground border border-border"
                >
                  <span className="font-black tabular-nums">{b.value}</span>
                  <span className="text-muted-foreground uppercase tracking-wider">{b.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Silhouette SVGs with responsive themes & optimized opacities */}
      {type === "truck" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-sky-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 8h-2.5V5.5c0-.83-.67-1.5-1.5-1.5H3c-.83 0-1.5.67-1.5 1.5v10c0 .83.67 1.5 1.5 1.5h1.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5h5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5H21c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-.5zm-12 9.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm10 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      )}
      {type === "users" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-purple-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      )}
      {type === "building" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-emerald-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v-2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
        </svg>
      )}
      {type === "clipboard" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-rose-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      )}
      {type === "invoice" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-amber-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      )}
    </CardWrapper>
  );
}



