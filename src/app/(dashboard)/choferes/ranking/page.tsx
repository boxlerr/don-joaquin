import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import { Users } from "lucide-react";
import RankingTable from "./RankingTable";

export type RankingChofer = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  viajes_count: number;
  km_total: number;
  pct_vacios: number;
  apercibimientos_total: number;
  apercibimientos_graves: number;
  roturas_count: number;
  licencias_activas: number;
  score: number | null;
};

export default async function RankingChoferes() {
  await requireArea("logistica", "read");
  const supabase = createAdminClient();

  const now = new Date();
  const primerDia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [
    { data: choferes },
    { data: viajes },
    { data: apercibimientos },
    { data: roturas },
    { data: licencias },
  ] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, localidad")
      .eq("estado", "activo")
      .order("apellido"),

    supabase
      .from("viajes")
      .select("chofer_id, km_con_carga, km_vacios")
      .gte("fecha_viaje", primerDia)
      .lte("fecha_viaje", ultimoDia)
      .not("chofer_id", "is", null),

    supabase
      .from("chofer_apercibimientos")
      .select("chofer_id, gravedad")
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia),

    supabase
      .from("roturas_gomas")
      .select("chofer_id")
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia)
      .not("chofer_id", "is", null),

    supabase
      .from("chofer_licencias_medicas")
      .select("chofer_id")
      .lte("fecha_desde", ultimoDia)
      .or(`fecha_hasta.is.null,fecha_hasta.gte.${primerDia}`),
  ]);

  const ranking: RankingChofer[] = (choferes ?? []).map((c) => {
    const cv = (viajes ?? []).filter((v) => v.chofer_id === c.id);
    const ca = (apercibimientos ?? []).filter((a) => a.chofer_id === c.id);
    const cr = (roturas ?? []).filter((r) => r.chofer_id === c.id);
    const cl = (licencias ?? []).filter((l) => l.chofer_id === c.id);

    const km_con_carga = cv.reduce((s, v) => s + (v.km_con_carga ?? 0), 0);
    const km_vacios = cv.reduce((s, v) => s + (v.km_vacios ?? 0), 0);
    const km_total = km_con_carga + km_vacios;
    const pct_vacios = km_total > 0 ? (km_vacios / km_total) * 100 : 0;

    const apercibimientos_graves = ca.filter((a) => a.gravedad === "grave").length;
    const apercibimientos_moderados = ca.filter((a) => a.gravedad === "moderado").length;
    const apercibimientos_leves = ca.filter((a) => a.gravedad === "leve").length;
    const roturas_count = cr.length;
    const licencias_activas = cl.length;

    let score: number | null = null;
    if (cv.length > 0) {
      let s = 100;
      if (pct_vacios > 40) s -= 20;
      else if (pct_vacios > 30) s -= 15;
      else if (pct_vacios > 20) s -= 8;
      s -= apercibimientos_graves * 15;
      s -= apercibimientos_moderados * 8;
      s -= apercibimientos_leves * 3;
      s -= roturas_count * 5;
      if (licencias_activas > 0) s -= 10;
      score = Math.max(0, Math.min(100, s));
    }

    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      localidad: c.localidad,
      viajes_count: cv.length,
      km_total,
      pct_vacios,
      apercibimientos_total: ca.length,
      apercibimientos_graves,
      roturas_count,
      licencias_activas,
      score,
    };
  });

  ranking.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  const periodo = new Date(primerDia + "T12:00:00").toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Ranking de Choferes"
        description={`Período: ${periodo}`}
        action={
          <Link
            href="/choferes"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Users size={14} />
            Ver legajos
          </Link>
        }
      />
      <RankingTable ranking={ranking} />
    </div>
  );
}
