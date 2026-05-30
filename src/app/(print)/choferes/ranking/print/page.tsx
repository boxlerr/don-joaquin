import { requireArea } from "@/lib/auth";
import { computeRanking, resolverRango } from "@/app/(dashboard)/choferes/ranking/lib";
import PrintTrigger from "./PrintTrigger";

export const dynamic = "force-dynamic";

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default async function RankingPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  await requireArea("logistica", "read");

  const params = await searchParams;
  const periodo = resolverRango(params);
  const ranking = await computeRanking({
    desde: periodo.desde,
    hasta: periodo.hasta,
  });

  const conScore = ranking.filter((r) => r.score !== null);
  const sinActividad = ranking.filter((r) => r.score === null);

  return (
    <div className="print-doc">
      <PrintTrigger />

      <style>{`
        @page { size: A4 landscape; margin: 14mm; }
        body { background: white !important; }
        .print-doc {
          font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
          color: #111;
          padding: 24px;
          max-width: 297mm;
          margin: 0 auto;
        }
        .print-doc h1 { font-size: 20px; font-weight: 700; margin: 0; }
        .print-doc .sub { color: #555; font-size: 12px; margin-top: 4px; }
        .print-doc .meta { color: #777; font-size: 10px; margin-top: 2px; }
        .print-doc table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
        .print-doc th, .print-doc td {
          padding: 6px 8px;
          border-bottom: 1px solid #e5e5e5;
          text-align: left;
        }
        .print-doc th {
          background: #f5f5f5;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #555;
        }
        .print-doc td.num, .print-doc th.num { text-align: right; }
        .print-doc td.ctr, .print-doc th.ctr { text-align: center; }
        .print-doc .score {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 3px;
          font-weight: 600;
          font-size: 10px;
        }
        .print-doc .score-good { background: #ECFDF5; color: #064E3B; }
        .print-doc .score-med  { background: #FFFBEB; color: #78350F; }
        .print-doc .score-bad  { background: #FEF2F2; color: #7F1D1D; }
        .print-doc .score-none { background: #f3f4f6; color: #6b7280; }
        .print-doc .sin-actividad {
          margin-top: 16px;
          padding: 8px;
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 4px;
          font-size: 10px;
          color: #555;
        }
        .print-doc thead { display: table-header-group; }
        .print-doc tr { page-break-inside: avoid; }
        @media print {
          .print-doc .no-print { display: none !important; }
        }
        @media screen {
          body { background: #f5f5f5 !important; }
          .print-doc {
            background: white;
            margin: 24px auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          }
        }
      `}</style>

      <header>
        <h1>Ranking de Choferes — Don Joaquín</h1>
        <p className="sub">Período: {periodo.label}</p>
        <p className="meta">
          {periodo.desde} a {periodo.hasta} · Generado{" "}
          {new Date().toLocaleString("es-AR")}
        </p>
      </header>

      <table>
        <thead>
          <tr>
            <th className="ctr">#</th>
            <th>Chofer</th>
            <th>Localidad</th>
            <th className="ctr">Score</th>
            <th className="num">Viajes</th>
            <th className="num">KM totales</th>
            <th className="num">% Vacíos</th>
            <th className="ctr">Apercib.</th>
            <th className="ctr">Roturas</th>
            <th className="ctr">Licencias</th>
          </tr>
        </thead>
        <tbody>
          {conScore.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", padding: "24px", color: "#777" }}>
                No hay choferes con actividad en este período.
              </td>
            </tr>
          )}
          {conScore.map((r, idx) => {
            const cls =
              r.score !== null && r.score >= 80
                ? "score-good"
                : r.score !== null && r.score >= 60
                  ? "score-med"
                  : "score-bad";
            return (
              <tr key={r.id}>
                <td className="ctr">{idx + 1}</td>
                <td>{r.apellido}, {r.nombre}</td>
                <td>{r.localidad ?? "—"}</td>
                <td className="ctr">
                  <span className={`score ${cls}`}>{r.score}</span>
                </td>
                <td className="num">{r.viajes_count}</td>
                <td className="num">{fmtNum(r.km_total)}</td>
                <td className="num">{r.pct_vacios.toFixed(0)}%</td>
                <td className="ctr">{r.apercibimientos_count}</td>
                <td className="ctr">{r.roturas_count}</td>
                <td className="ctr">{r.licencias_activas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sinActividad.length > 0 && (
        <div className="sin-actividad">
          <strong>{sinActividad.length} choferes sin viajes en el período:</strong>{" "}
          {sinActividad.map((r) => `${r.apellido}, ${r.nombre}`).join(" · ")}
        </div>
      )}
    </div>
  );
}
