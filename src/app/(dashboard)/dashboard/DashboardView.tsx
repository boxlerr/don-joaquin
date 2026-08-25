import type { ReactNode } from "react";
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
  TriangleAlert,
  Cake,
  Award,
  Settings,
  Unlock,
  Wallet,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { visiblePara } from "@/lib/alertas-visibilidad";
import { getOcultasPorUsuario } from "@/lib/alertas-lecturas";
import { getViajesAction, getAusenciasProximasAction } from "@/app/(dashboard)/viajes/actions";
import { getPremioDelMesAction, getConsumoPeriodoAction } from "@/app/(dashboard)/combustible/actions";
import RecentViajesTable from "./components/RecentViajesTable";
import ChoferList from "./components/ChoferList";
import TarjetaResumen from "./components/TarjetaResumen";
import KpiPeriodo from "./components/KpiPeriodo";
import DashboardHero from "./components/DashboardHero";
import EstadoFlota from "./components/EstadoFlota";
import QuienNoEsta from "./components/QuienNoEsta";
import RendimientoFlota from "./components/RendimientoFlota";
import ConsumoCombustible from "./components/ConsumoCombustible";
import DiaPedidoQuickAction from "./DiaPedidoQuickAction";
import { computeRanking, computeTotalesPeriodo, resolverRango } from "@/app/(dashboard)/choferes/ranking/lib";
import PeriodoSelector from "@/app/(dashboard)/choferes/ranking/PeriodoSelector";
import { alertaHref, categoriaDeAlerta, diasRestantes } from "@/app/(dashboard)/notificaciones/utils";

interface Props {
  /** searchParams ya resueltos por la page (rango del período del resumen). */
  sp: { rango?: string; desde?: string; hasta?: string };
  /** Rótulo chico del encabezado. */
  titulo: string;
  subtitulo: string;
  /** Acción propia de la ruta (el botón de tutorial). */
  accionExtra?: ReactNode;
}

/**
 * Cuerpo del dashboard. Es uno solo para todo el equipo: lo que cambia según
 * quién mire son los importes (ver `conFacturacion` más abajo). Incluye su
 * propio encabezado —el hero con la foto de ruta y el saludo—, así que la page
 * solo le pasa el rótulo y las acciones.
 */
export default async function DashboardView({ sp, titulo, subtitulo, accionExtra }: Props) {
  const supabase = createAdminClient();
  const rangoMes = resolverRango(sp);

  // Quién no está lo ve TODO el equipo: saber con cuántos choferes se cuenta no
  // es un dato reservado, y el que arma la operación no siempre tiene los
  // legajos. Lo que sí depende del permiso es a dónde se puede ir desde ahí.
  // (`getCurrentUser` está memoizado por request — pedirlo antes del Promise.all
  //  no agrega una consulta, el layout ya lo pidió.)
  const currentUser = await getCurrentUser();
  const puedeVerCronograma = currentUser != null && hasSeccion(currentUser, "choferes_vacaciones", "read");
  const puedeVerLegajos = currentUser != null && hasSeccion(currentUser, "choferes", "read");
  // Los importes (facturación del período, $/km y montos por chofer) los ve
  // sólo la dirección. Antes eso era una pantalla aparte —/dashboard/completo—
  // y una entrada más en el menú para un solo número; ahora es el mismo
  // dashboard, que muestra la plata a quien tenga el permiso.
  const conFacturacion = currentUser != null && hasSeccion(currentUser, "dashboard_completo", "read");
  // Misma ventana que la tarjeta de disponibilidad de /viajes.
  const DIAS_DISPONIBILIDAD = 14;

  const [
    viajesSinFacturar,
    saldoMovimientos,
    viaticosPendientes,
    chequesPorVencer,
    docPorVencer,
    totalClientes,
    camionesRes,
    totalChoferes,
    viajesResult,
    premioMes,
    consumoPeriodo,
    ranking,
    totalesPeriodo,
    tiposDocRes,
    camionDocsRes,
    choferDocsRes,
    ausenciasProximas,
  ] = await Promise.all([
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
    // En cartera es SÓLO un recibido sin cobrar. Sin los dos filtros la tarjeta
    // contaba todos los cheques —propios, acreditados, rechazados y anulados—
    // y marcaba 6 cuando en cartera había 2.
    supabase
      .from("cheques")
      .select("*", { count: "exact", head: true })
      .eq("origen", "recibido")
      .eq("estado", "cartera"),
    supabase
      .from("alertas")
      .select("id, tipo, entidad_tipo, entidad_id, severidad", { count: "exact" })
      .eq("estado", "pendiente")
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false }),
    // Solo clientes activos: la tarjeta los rotula "activos" y así se excluye el
    // comodín "Sin asignar (import)" (estado inactivo) y cualquier baja.
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("estado", "activo"),
    // Ya no alcanza con contar: la torta de la flota necesita el estado de cada
    // unidad. Son unas pocas decenas de filas de una sola columna.
    supabase.from("camiones").select("estado", { count: "exact" }),
    supabase.from("choferes").select("rol", { count: "exact" }),
    getViajesAction({ pageSize: 5 }),
    getPremioDelMesAction(),
    getConsumoPeriodoAction(rangoMes.desde, rangoMes.hasta),
    computeRanking(rangoMes),
    computeTotalesPeriodo(rangoMes.desde, rangoMes.hasta),
    supabase
      .from("tipos_documento")
      .select("id, dias_alerta_vencimiento")
      .eq("estado", "activo"),
    supabase.from("camion_documentos").select("tipo_documento_id, fecha_vencimiento"),
    supabase.from("chofer_documentos").select("tipo_documento_id, fecha_vencimiento"),
    getAusenciasProximasAction(DIAS_DISPONIBILIDAD),
  ]);

  // Estado leído/descartado POR USUARIO: las alertas de tabla que ESTE usuario ya
  // marcó leídas/descartó no deben seguir contando como "activas" en el dashboard
  // (coherencia con la campana y /notificaciones, que son per-user).
  const ocultasUsuario = currentUser ? await getOcultasPorUsuario(currentUser.id) : new Set<string>();
  // Y las de secciones confidenciales sólo para quien las tenga: sin este filtro el
  // contador de críticas sumaba las cuotas de préstamo vencidas para cualquiera, y
  // "Resolver alerta" —que apunta a la primera de la lista, ordenada por severidad—
  // podía mandar a /prestamos. No dibujaba el monto, pero delataba que hay uno.
  // Falla cerrado: sin sesión no se cuenta ninguna confidencial.
  const puedeVer = currentUser ? visiblePara(currentUser) : () => false;
  const alertasVisibles = (docPorVencer.data ?? [])
    .filter((a) => !ocultasUsuario.has(a.id))
    .filter(puedeVer);

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

  // Reparto de la flota por estado, para la torta. Los estados posibles son los
  // cuatro de `camiones.estado`; cualquier valor raro cae en "inactivo" para no
  // perder la unidad de la cuenta total.
  const camionesRows = (camionesRes.data ?? []) as { estado: string | null }[];
  const flotaPorEstado = { activo: 0, en_mantenimiento: 0, inactivo: 0, baja: 0 };
  for (const c of camionesRows) {
    const e = c.estado ?? "activo";
    if (e === "activo") flotaPorEstado.activo++;
    else if (e === "en_mantenimiento") flotaPorEstado.en_mantenimiento++;
    else if (e === "baja") flotaPorEstado.baja++;
    else flotaPorEstado.inactivo++;
  }
  const totalCamiones = camionesRows.length;

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
      {/* El hero va FUERA del contenedor con padding: la foto llega a los dos
          bordes de la pantalla y se funde con el fondo del tablero. */}
      <DashboardHero
        nombre={currentUser?.nombre ?? null}
        titulo={titulo}
        subtitulo={subtitulo}
        acciones={
          <>
            {/* Alta rápida del día pedido (turno médico, trámite). Va acá, en la
                primera barra del dashboard, porque el pedido llega por teléfono
                en cualquier momento: si hay que entrar al legajo del chofer a
                buscarlo, no se anota — y hoy no se anota ninguno. */}
            <DiaPedidoQuickAction />
            <PeriodoSelector
              rangoActual={rangoMes.rango}
              desdeActual={rangoMes.desde}
              hastaActual={rangoMes.hasta}
              incluirTotal
              compacto
            />
            {accionExtra}
          </>
        }
      />

      <div className="space-y-5 px-4 pb-8 sm:space-y-6 sm:px-6 sm:pb-10 lg:px-8">
        <KpiPeriodo
          totales={totalesPeriodo}
          periodoLabel={rangoMes.label}
          mostrarFacturacion={conFacturacion}
        />

        {/* Operación: los viajes recién cargados a la izquierda, el estado de la
            flota a la derecha. En celular y tablet van uno debajo del otro: a
            375px no entran lado a lado. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)] xl:col-span-2">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">Últimos viajes</h2>
              </div>
              <a
                href="/viajes"
                className="inline-flex shrink-0 items-center max-md:h-9 text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                Ver todos →
              </a>
            </div>
            <div className="flex flex-1 flex-col bg-gradient-to-b from-card to-muted/10">
              <RecentViajesTable initialViajes={ultimosViajes} mostrarFacturacion={conFacturacion} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <EstadoFlota porEstado={flotaPorEstado} />
            <RendimientoFlota
              kmConCarga={totalesPeriodo.kmConCarga}
              kmVacios={totalesPeriodo.kmVacios}
            />
          </div>
        </div>

        {/* La otra mitad de "con qué cuento hoy": arriba están las unidades en
            servicio, acá los choferes que no están. Va a lo ancho porque las
            personas se leen de a tres por fila y no entran en la columna de la
            derecha. */}
        <QuienNoEsta
          ausencias={ausenciasProximas}
          dias={DIAS_DISPONIBILIDAD}
          puedeVerCronograma={puedeVerCronograma}
          puedeVerLegajos={puedeVerLegajos}
        />

        {/* Tres listas de alto parecido: lo que hay que atender, el podio del
            mes y los que vienen flojos. Antes acá convivían dos listas y un
            gráfico, y el gráfico —mucho más bajo— dejaba un hueco en blanco. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#F59E0B]" />
                <h2 className="text-sm font-bold text-foreground">Alertas activas</h2>
              </div>
              <span className={`text-2xl font-black ${alertCount > 0 ? "text-[#D97706]" : "text-foreground"}`}>
                {alertCount}
              </span>
            </div>
            <div className="flex flex-1 flex-col">
              {alertCount > 0 ? (
                // Desglose por categoría — lista sobria (sin emojis) para no entrar
                // legajo por legajo (pedido explícito del feedback).
                <div className="flex h-full flex-col">
                  <p className="px-4 pb-1 pt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:px-5">
                    Se requiere atención
                  </p>
                  <div className="flex-1 divide-y divide-border/60 px-2 sm:px-3">
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
                            className="flex items-center gap-3 px-2 py-2 transition-colors hover:bg-muted/50"
                            title={`${c.label}: ${c.count} alerta${c.count !== 1 ? "s" : ""}`}
                          >
                            <span
                              className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
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
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 sm:px-5 sm:py-3">
                    <a
                      href={resolverHref}
                      className="inline-flex items-center gap-1 max-md:h-9 text-[13px] font-bold text-[#D97706] transition-colors hover:text-[#B45309]"
                    >
                      Resolver alerta
                      <ChevronRight size={14} />
                    </a>
                    <a
                      href="/notificaciones"
                      className="inline-flex items-center max-md:h-9 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Ver todas →
                    </a>
                  </div>
                </div>
              ) : (
                // Estado "sin alertas": sobrio, sin gradientes chillones.
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-[#10B981]/10 text-[#10B981]">
                    <CheckCircle2 size={22} />
                  </span>
                  <p className="text-sm font-bold text-foreground">Sin alertas activas</p>
                  <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                    Todo bajo control. La documentación y los permisos de camiones y choferes están validados.
                  </p>
                </div>
              )}
            </div>
          </div>

          <ChoferList
            items={topChoferes}
            title="Top 5 del mes"
            subtitle="Mejor score operativo"
            icon={Trophy}
            accent="emerald"
            emptyText="Sin choferes con actividad este mes."
            mostrarFacturacion={conFacturacion}
            conPuesto
          />

          <div className="md:col-span-2 xl:col-span-1">
            <ChoferList
              items={bottomChoferes}
              title="Atención requerida"
              subtitle="5 con score más bajo"
              icon={TriangleAlert}
              accent="rose"
              emptyText="No hay choferes con score bajo este mes."
              mostrarFacturacion={conFacturacion}
            />
          </div>
        </div>

        {/* El gasoil va a lo ancho: con doce meses posibles, las barras necesitan
            el ancho del tablero, y así no queda media tarjeta vacía. */}
        <ConsumoCombustible consumo={consumoPeriodo} mostrarImportes={conFacturacion} />

        {/* Premio del Mes — Eficiencia de combustible. Sobrio, como el resto de
            las tarjetas del dashboard (nada de banner amarillo). */}
        <a
          href="/combustible"
          className="group block rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted/30"
        >
          {/* En celular el detalle (km · cargas) baja de renglón en vez de salirse:
              los tres datos en una sola línea no entran en 343px. */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Trophy size={15} strokeWidth={2.1} />
            </div>
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Premio del mes
            </span>
            {premioMes ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="max-w-full truncate text-sm font-bold text-foreground">
                  {premioMes.chofer}
                </span>
                <span className="shrink-0 text-sm font-semibold text-foreground/80">
                  {premioMes.eficiencia.toFixed(2)}
                  <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">L/100km</span>
                </span>
                {/* Sin `shrink-0`: en 320px este detalle no entraba en el renglón
                    y, al no poder achicarse, se salía de la tarjeta. */}
                <span className="min-w-0 text-[11px] text-muted-foreground">
                  {premioMes.km_recorridos.toLocaleString("es-AR")} km · {premioMes.cargas} cargas
                </span>
              </div>
            ) : (
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                Sin candidatos este mes — cargá 2 gasoiles del mismo camión con chofer.
              </span>
            )}
            <ChevronRight
              size={14}
              className="shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
            />
          </div>
        </a>

        {/* Cierre del tablero: dos pendientes que hay que atender y, abajo, los
            totales del sistema. Todas las fichas son la misma pieza, así la fila
            empareja sola y no quedan huecos. */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-1 shrink-0 rounded-full bg-[#F43F5E]" />
            <h2 className="text-sm font-bold text-foreground">Pendientes</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <TarjetaResumen
              icon={ShieldAlert}
              titulo="Documentación crítica"
              descripcion="Documentos vencidos o que vencen dentro de 7 días"
              valor={String(docCriticos)}
              unidad={docCriticos === 1 ? "alerta crítica" : "alertas críticas"}
              href="/notificaciones?severidad=critica"
              tono="rojo"
              imagen="/dashboard/documentacion.jpg"
              imagenPos="60% center"
              destacada={docCriticos > 0}
            />
            <TarjetaResumen
              icon={Clock}
              titulo="Viajes sin facturar"
              descripcion="Viajes finalizados pendientes de carga de factura"
              valor={(viajesSinFacturar.count ?? 0).toLocaleString("es-AR")}
              unidad={(viajesSinFacturar.count ?? 0) === 1 ? "pendiente" : "pendientes"}
              href="/viajes?filtro=sin_facturar"
              tono="ambar"
              imagen="/dashboard/facturacion.jpg"
              imagenPos="55% center"
              destacada={(viajesSinFacturar.count ?? 0) > 0}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-1 shrink-0 rounded-full bg-primary" />
            <h2 className="text-sm font-bold text-foreground">El sistema en números</h2>
            <span className="text-[11px] text-muted-foreground">Totales, no del período elegido</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <TarjetaResumen
              icon={Truck}
              titulo="Flota de camiones"
              descripcion="Unidades registradas en el sistema"
              valor={String(totalCamiones)}
              unidad="unidades"
              href="/camiones"
              tono="brand"
              imagen="/dashboard/flota-amanecer.jpg"
              imagenPos="40% center"
            />
            <TarjetaResumen
              icon={Users}
              titulo="Personal"
              descripcion="Choferes, administración y taller"
              valor={String(totalChoferes.count ?? 0)}
              unidad="legajos"
              href="/choferes"
              tono="violeta"
              imagen="/dashboard/personal.jpg"
              imagenPos="38% center"
              chips={[
                { label: "Choferes", value: countChofer },
                { label: "Admin.", value: countAdmin },
                { label: "Mant.", value: countMant },
              ]}
            />
            <TarjetaResumen
              icon={Briefcase}
              titulo="Clientes"
              descripcion="Clientes activos registrados"
              valor={String(totalClientes.count ?? 0)}
              unidad="activos"
              href="/clientes"
              tono="verde"
              imagen="/dashboard/clientes.jpg"
              imagenPos="55% center"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <TarjetaResumen
              icon={Receipt}
              titulo="Movimientos de caja"
              valor={(saldoMovimientos.count ?? 0).toLocaleString("es-AR")}
              href="/caja"
              tono="verde"
              tamano="chica"
            />
            <TarjetaResumen
              icon={Route}
              titulo="Viáticos"
              valor={(viaticosPendientes.count ?? 0).toLocaleString("es-AR")}
              href="/caja"
              tono="ambar"
              tamano="chica"
            />
            <TarjetaResumen
              icon={FileText}
              titulo="Cheques en cartera"
              valor={(chequesPorVencer.count ?? 0).toLocaleString("es-AR")}
              href="/cheques"
              tono="rojo"
              tamano="chica"
            />
          </div>
        </section>
      </div>
    </>
  );
}
