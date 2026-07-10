import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { getMetricasAction } from "../actions";
import { armarPlanillas, parsearPlanillasParam } from "../export-data";

export const dynamic = "force-dynamic";

// Vista imprimible de las planillas del mes: HTML con estilos de impresión que
// se guarda como PDF desde el diálogo del navegador (el padre las quiere en
// papel). Abre y dispara imprimir solo.

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const money = (n: number, dec = 0) => "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasSeccion(user, "metricas", "read")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get("month") ?? "";
  const data = await getMetricasAction(month);
  const planillas = armarPlanillas(data, parsearPlanillasParam(req.nextUrl.searchParams.get("planilla")));
  const [y, m] = data.mes.split("-");
  const periodo = `${MESES[parseInt(m, 10) - 1]} ${y}`;

  const celda = (v: string | number | null, col: { money?: boolean; dec?: number; align: string }) => {
    if (v == null || v === "") return "<td></td>";
    if (typeof v === "number") {
      const txt = col.money ? money(v, col.dec ?? 0) : v.toLocaleString("es-AR", { maximumFractionDigits: col.dec ?? 0 });
      return `<td class="r">${txt}</td>`;
    }
    return `<td class="${col.align}">${esc(String(v))}</td>`;
  };

  const secciones = planillas
    .map(
      (p) => `
  <section>
    <h2>${esc(p.titulo)} <span>· ${periodo} · Don Joaquín Hnos SRL</span></h2>
    <table>
      <thead><tr>${p.columnas.map((c) => `<th class="${c.align}">${esc(c.header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${p.filas.map((f) => `<tr>${f.map((v, i) => celda(v, p.columnas[i])).join("")}</tr>`).join("\n")}
        ${p.totales.length ? `<tr class="tot">${p.totales.map((v, i) => celda(v, p.columnas[i] ?? { align: "r" })).join("")}</tr>` : ""}
      </tbody>
    </table>
  </section>`,
    )
    .join("\n");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Métricas ${periodo} — Don Joaquín</title>
<style>
  body { font: 11px/1.45 -apple-system, "Segoe UI", sans-serif; color: #111; margin: 24px; }
  h2 { font-size: 15px; margin: 0 0 8px; border-bottom: 2px solid #0088D1; padding-bottom: 4px; }
  h2 span { font-weight: 400; font-size: 11px; color: #555; }
  section { page-break-after: always; }
  section:last-child { page-break-after: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 3px 6px; }
  th { background: #f0f7fc; font-size: 10px; text-transform: uppercase; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .l { text-align: left; }
  tr.tot td { font-weight: 700; background: #f5f5f5; }
  tr:nth-child(even) td { background: #fafcfe; }
  @media print { body { margin: 8mm; } .no-print { display: none; } }
  .no-print { position: fixed; top: 12px; right: 12px; background: #0088D1; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
</style></head><body>
<button class="no-print" onclick="window.print()">Imprimir / guardar PDF</button>
${secciones}
<script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));</script>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
