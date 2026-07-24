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
  Cake,
  Award,
  Settings,
  Unlock,
  Wallet,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getOcultasPorUsuario } from "@/lib/alertas-lecturas";
import { getViajesAction } from "@/app/(dashboard)/viajes/actions";
import { getPremioDelMesAction } from "@/app/(dashboard)/combustible/actions";
import RecentViajesTable from "./components/RecentViajesTable";
import TopBottomChoferes from "./components/TopBottomChoferes";
import ResumenMes from "./components/ResumenMes";
import { computeRanking, computeTotalesPeriodo, resolverRango } from "@/app/(dashboard)/choferes/ranking/lib";
import PeriodoSelector from "@/app/(dashboard)/choferes/ranking/PeriodoSelector";
import { alertaHref, categoriaDeAlerta, diasRestantes } from "@/app/(dashboard)/notificaciones/utils";

interface Props {
  /** searchParams ya resueltos por la page (rango del período del resumen). */
  sp: { rango?: string; desde?: string; hasta?: string };
  /**
   * Con `false` (el /dashboard general) no se muestra NINGÚN monto de
   * facturación ni $/km: Bárbara pidió que la plata no esté "servida en
   * bandeja" al entrar. Con `true` (/dashboard/completo, solo dirección)
   * se ven la facturación acumulada y los montos por chofer.
   */
  conFacturacion: boolean;
}

/**
 * Cuerpo del dashboard, compartido entre /dashboard (sin facturación) y
 * /dashboard/completo (con facturación). El PageHeader lo pone cada page,
 * así cada ruta lleva su propio título/banner sin duplicar esta vista.
 */
export default async function DashboardView({ sp, conFacturacion }: Props) {
  const supabase = createAdminClient();
  const rangoMes = resolverRango(sp);

  const [
    viajesPeriodo,
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
    totalesPeriodo,
    tiposDocRes,
    camionDocsRes,
    choferDocsRes,
  ] = await Promise.all([
    // Viajes reales del período elegido (excluye cancelados = soft-delete). Ya no
    // se usa el estado operativo (pendiente/en_curso), que se retiró de la UI.
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .neq("estado", "cancelado")
      .gte("fecha_viaje", rangoMes.desde)
      .lte("fecha_viaje", rangoMes.hasta),
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
    // Solo clientes activos: la tarjeta los rotula "activos" y así se excluye el
    // comodín "Sin asignar (import)" (estado inactivo) y cualquier baja.
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("camiones").select("*", { count: "exact", head: true }),
    supabase.from("choferes").select("rol", { count: "exact" }),
    getViajesAction({ pageSize: 5 }),
    getPremioDelMesAction(),
    computeRanking(rangoMes),
    computeTotalesPeriodo(rangoMes.desde, rangoMes.hasta),
    supabase
      .from("tipos_documento")
      .select("id, dias_alerta_vencimiento")
      .eq("estado", "activo"),
    supabase.from("camion_documentos").select("tipo_documento_id, fecha_vencimiento"),
    supabase.from("chofer_documentos").select("tipo_documento_id, fecha_vencimiento"),
  ]);

  // Estado leído/descartado POR USUARIO: las alertas de tabla que ESTE usuario ya
  // marcó leídas/descartó no deben seguir contando como "activas" en el dashboard
  // (coherencia con la campana y /notificaciones, que son per-user).
  const currentUser = await getCurrentUser();
  const ocultasUsuario = currentUser ? await getOcultasPorUsuario(currentUser.id) : new Set<string>();
  const alertasVisibles = (docPorVencer.data ?? []).filter((a) => !ocultasUsuario.has(a.id));

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
  const otrasCriticas = alertasVisibles.filter(
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
  const dbAlertasOtras = alertasVisibles.filter(
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
  const firstAlert = alertasVisibles[0];
  const resolverHref = firstAlert ? (alertaHref(firstAlert) ?? "/notificaciones") : "/notificaciones";
  // Sin facturación, el monto se anula ANTES de pasar a la tabla (client
  // component): si no, aunque no se renderice, viajaría serializado en el
  // payload y quedaría legible en el código fuente de la página.
  const ultimosViajesRaw = (viajesResult && "data" in viajesResult) ? viajesResult.data : [];
  const ultimosViajes = conFacturacion
    ? ultimosViajesRaw
    : ultimosViajesRaw.map((v) => ({ ...v, monto_flete: null }));

  const conScore = ranking.filter((r) => r.score !== null);
  const topChoferes = conScore.slice(0, 5);
  // Bottom: choferes que no entran en el top, últimos 5 invertidos.
  // Si hay <=5 con actividad, no hay bottom (no tendría sentido repetir).
  const bottomChoferes =
    conScore.length > 5 ? conScore.slice(5).slice(-5).reverse() : [];

  return (
    <>
      <ResumenMes
        totales={totalesPeriodo}
        periodoLabel={rangoMes.label}
        mostrarFacturacion={conFacturacion}
        periodoSelector={
          <PeriodoSelector
            rangoActual={rangoMes.rango}
            desdeActual={rangoMes.desde}
            hastaActual={rangoMes.hasta}
            incluirTotal
          />
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Viajes registrados"
          value={String(viajesPeriodo.count ?? 0)}
          sub="En el período"
          color="brand"
          icon={Truck}
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

      {/* En xl los viajes toman ~71% del ancho: la lista respira y las alertas
          (ícono + etiqueta + número) no necesitan más que eso. */}
      <div className="grid grid-cols-3 xl:grid-cols-7 gap-4">
        <div className="col-span-2 xl:col-span-5 bg-card rounded-[8px] border border-border shadow-sm flex flex-col justify-between overflow-hidden">
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
            <RecentViajesTable initialViajes={ultimosViajes} mostrarFacturacion={conFacturacion} />
          </div>
        </div>

        <div className="xl:col-span-2 bg-card rounded-[8px] border border-border shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#F59E0B]" />
              <h2 className="text-foreground text-sm font-bold">Alertas activas</h2>
            </div>
            <span className={`text-2xl font-black ${alertCount > 0 ? "text-[#D97706]" : "text-foreground"}`}>
              {alertCount}
            </span>
          </div>
          <div className="flex-1 flex flex-col">
            {alertCount > 0 ? (
              // Desglose por categoría — lista sobria (sin emojis) para no entrar
              // legajo por legajo (pedido explícito del feedback).
              <div className="flex flex-col h-full">
                <p className="px-5 pt-3.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Se requiere atención
                </p>
                <div className="px-3 flex-1 divide-y divide-border/60">
                  {(
                    [
                      { id: "documentacion", label: "Documentación", Icon: FileText, count: catCounts.documentacion, warn: true },
                      { id: "personal_prueba", label: "Fin de prueba", Icon: Unlock, count: catCounts.personal_prueba, warn: false },
                      { id: "personal_cumple", label: "Cumpleaños", Icon: Cake, count: catCounts.personal_cumple, warn: false },
                      { id: "personal_aniversario", label: "Aniversarios", Icon: Award, count: catCounts.personal_aniversario, warn: false },
                      { id: "cheques", label: "Cheques", Icon: Wallet, count: catCounts.cheques, warn: false },
                      { id: "viajes", label: "Viajes", Icon: Truck, count: catCounts.viajes, warn: false },
                      { id: "sistema", label: "Sistema", Icon: Settings, count: catCounts.sistema, warn: false },
                    ] as const
                  )
                    .filter((c) => c.count > 0)
                    .map((c) => {
                      // "personal_*" son subcategorías del filtro real "personal".
                      const base = c.id.startsWith("personal_") ? "personal" : c.id;
                      return (
                        <a
                          key={c.id}
                          href={`/notificaciones?categoria=${base}`}
                          className="flex items-center gap-3 px-2 py-2 hover:bg-muted/50 transition-colors"
                          title={`${c.label}: ${c.count} alerta${c.count !== 1 ? "s" : ""}`}
                        >
                          <span
                            className={`flex items-center justify-center size-7 rounded-md shrink-0 ${
                              c.warn ? "bg-[#F59E0B]/12 text-[#D97706]" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <c.Icon size={14} strokeWidth={2} />
                          </span>
                          <span className="flex-1 text-[13px] font-semibold text-foreground">{c.label}</span>
                          <span
                            className={`text-[13px] font-extrabold tabular-nums ${
                              c.warn ? "text-[#D97706]" : "text-foreground"
                            }`}
                          >
                            {c.count}
                          </span>
                        </a>
                      );
                    })}
                </div>
                <div className="mt-auto flex items-center justify-between px-5 py-3 border-t border-border">
                  <a
                    href={resolverHref}
                    className="text-[13px] font-bold text-[#D97706] hover:text-[#B45309] inline-flex items-center gap-1 transition-colors"
                  >
                    Resolver alerta
                    <ChevronRight size={14} />
                  </a>
                  <a
                    href="/notificaciones"
                    className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Ver todas →
                  </a>
                </div>
              </div>
            ) : (
              // Estado "sin alertas": sobrio, sin gradientes chillones.
              <div className="flex flex-col h-full items-center justify-center text-center px-6 py-10 gap-2">
                <span className="flex items-center justify-center size-11 rounded-full bg-[#10B981]/10 text-[#10B981]">
                  <CheckCircle2 size={22} />
                </span>
                <p className="text-foreground text-sm font-bold">Sin alertas activas</p>
                <p className="text-muted-foreground text-xs leading-relaxed max-w-[240px]">
                  Todo bajo control. La documentación y los permisos de camiones y choferes están validados.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <TopBottomChoferes top={topChoferes} bottom={bottomChoferes} mostrarFacturacion={conFacturacion} />

      {/* Premio del Mes — Eficiencia de combustible. Sobrio, como el resto de
          las tarjetas del dashboard (nada de banner amarillo). */}
      <a
        href="/combustible"
        className="block bg-card border border-border rounded-[8px] shadow-sm hover:bg-muted/30 transition-colors group"
      >
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 text-primary shrink-0">
            <Trophy size={15} strokeWidth={2.1} />
          </div>
          <span className="text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider shrink-0">
            Premio del mes
          </span>
          {premioMes ? (
            <div className="flex items-baseline gap-3 flex-1 min-w-0">
              <span className="text-foreground text-sm font-bold truncate">
                {premioMes.chofer}
              </span>
              <span className="text-foreground/80 text-sm font-semibold shrink-0">
                {premioMes.eficiencia.toFixed(2)}
                <span className="text-[10px] font-medium text-muted-foreground ml-0.5">L/100km</span>
              </span>
              <span className="text-muted-foreground text-[11px] shrink-0 hidden sm:inline">
                {premioMes.km_recorridos.toLocaleString("es-AR")} km · {premioMes.cargas} cargas
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs flex-1">
              Sin candidatos este mes — cargá 2 gasoiles del mismo camión con chofer.
            </span>
          )}
          <ChevronRight
            size={14}
            className="text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform shrink-0"
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
          iconColor="text-[#7C3AED]"
          iconBg="bg-[#F3E8FF]"
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
          iconColor="text-[#059669]"
          iconBg="bg-[#ECFDF5]"
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
          iconColor="text-[#E11D48]"
          iconBg="bg-[#FFF1F2]"
          type="clipboard"
        />
        <SummaryCard
          icon={Clock}
          title="Viajes sin facturar"
          description="Viajes finalizados pendientes de carga de factura"
          metric={String(viajesSinFacturar.count ?? 0)}
          metricLabel="pendiente"
          href="/viajes?filtro=sin_facturar"
          iconColor="text-[#D97706]"
          iconBg="bg-[#FEF3C7]"
          type="invoice"
        />
      </div>
    </>
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
      className={`relative overflow-hidden bg-card rounded-[8px] border border-border shadow-sm p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group block ${
        href ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg} shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-sm`}>
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted/60 text-foreground border border-border"
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
