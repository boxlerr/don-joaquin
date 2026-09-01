import { requireArea } from "@/lib/auth";
import { getReporteAutoconsumoAction } from "@/app/(dashboard)/combustible/autoconsumo/actions";
import PrintTrigger from "@/app/(print)/_components/PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * El reporte de autoconsumo, con nuestra marca, para presentarle a YPF.
 *
 * Sigue el mismo cuadro que manda YPF —cantera → locación → toneladas → litros
 * teóricos, y el desvío contra lo cargado— porque el que lo recibe ya sabe leer
 * ese formato. Lo que cambia es de qué lado sale: éste lo emitimos nosotros.
 *
 * **Lo que falta se muestra como que falta.** Si en el mes no hay ninguna carga
 * de combustible registrada, los litros cargados van con guion y el motivo
 * escrito, nunca en cero: cero litros cargados es un desvío del −100% y esto es
 * un papel que se le entrega a un cliente.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const n1 = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n0 = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
const n2 = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mesActualAr(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AutoconsumoPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; preview?: string }>;
}) {
  await requireArea("combustible", "read");
  const { mes: mesParam, preview } = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesActualAr();
  const r = await getReporteAutoconsumoAction(mes);

  const [y, m] = mes.split("-").map(Number);
  const nombreMes = `${MESES[(m ?? 1) - 1]} de ${y}`;
  const emitido = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const desvio = r.litrosCargados == null ? null : r.litrosCargados - r.litrosTeoricos;
  const desvioPct =
    desvio == null || r.litrosTeoricos === 0 ? null : (desvio / r.litrosTeoricos) * 100;

  return (
    <div className="print-doc">
      {/* `?preview=1` deja mirar la hoja sin que salte el diálogo de impresión.
          Sirve para revisarla antes de mandarla —es un papel que sale de la
          empresa— y para poder verla desde una automatización, que con el
          diálogo abierto no puede hacer nada. */}
      {preview !== "1" && <PrintTrigger title={`Autoconsumo - ${nombreMes}`} />}

      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        body { background: white !important; }
        .print-doc {
          font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
          color: #111; padding: 24px; max-width: 210mm; margin: 0 auto;
        }
        .print-doc .cab {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 24px; border-bottom: 2px solid #111; padding-bottom: 12px;
        }
        .print-doc .marca { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
        .print-doc .marca span { font-weight: 400; color: #555; }
        .print-doc .razon { font-size: 10px; color: #666; margin-top: 2px; }
        .print-doc h1 { font-size: 15px; font-weight: 700; margin: 0; text-align: right; }
        .print-doc .periodo { font-size: 12px; color: #444; text-align: right; margin-top: 2px; }
        .print-doc .emitido { font-size: 9.5px; color: #888; text-align: right; margin-top: 2px; }

        .print-doc .cifras {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 1px; background: #e5e5e5; border: 1px solid #e5e5e5; margin-top: 18px;
        }
        .print-doc .cifra { background: #fff; padding: 10px 12px; }
        .print-doc .cifra .rot {
          font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #777;
        }
        .print-doc .cifra .val {
          font-size: 19px; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums;
        }
        .print-doc .cifra .pie { font-size: 9px; color: #888; margin-top: 1px; }
        .print-doc .falta .val { color: #999; font-weight: 400; }

        .print-doc h2 {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
          color: #555; margin: 22px 0 6px;
        }
        .print-doc table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        .print-doc th {
          text-align: left; padding: 6px 8px; border-bottom: 1.5px solid #111;
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #555;
        }
        .print-doc td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        .print-doc .num { text-align: right; font-variant-numeric: tabular-nums; }
        .print-doc tr.total td {
          border-top: 1.5px solid #111; border-bottom: none; font-weight: 700; padding-top: 7px;
        }
        .print-doc .nota {
          margin-top: 18px; padding: 9px 11px; border-left: 2px solid #ccc;
          font-size: 9.5px; color: #555; line-height: 1.5;
        }
        .print-doc .pie-doc {
          margin-top: 26px; border-top: 1px solid #e5e5e5; padding-top: 8px;
          font-size: 8.5px; color: #999;
        }
        .print-doc .vacio {
          margin-top: 18px; padding: 20px; border: 1px dashed #ccc;
          text-align: center; font-size: 11px; color: #666;
        }
      `}</style>

      <div className="cab">
        <div>
          <div className="marca">
            DON JOAQUIN <span>Transporte</span>
          </div>
          <div className="razon">Don Joaquín Hnos. S.R.L.</div>
        </div>
        <div>
          <h1>AUTOCONSUMO</h1>
          <div className="periodo">{nombreMes}</div>
          <div className="emitido">Emitido el {emitido}</div>
        </div>
      </div>

      <div className="cifras">
        <div className="cifra">
          <div className="rot">Toneladas movidas</div>
          <div className="val">{n1(r.toneladas)}</div>
        </div>
        <div className="cifra">
          <div className="rot">Litros teóricos</div>
          <div className="val">{n0(r.litrosTeoricos)}</div>
          <div className="pie">Según el rinde de cada tramo</div>
        </div>
        <div className={`cifra${r.litrosCargados == null ? " falta" : ""}`}>
          <div className="rot">Litros cargados</div>
          <div className="val">{r.litrosCargados == null ? "—" : n0(r.litrosCargados)}</div>
          <div className="pie">
            {r.litrosCargados == null
              ? "Sin cargas registradas"
              : `${r.cargasDelMes} cargas`}
          </div>
        </div>
        <div className={`cifra${desvio == null ? " falta" : ""}`}>
          <div className="rot">Desvío</div>
          <div className="val">
            {desvio == null
              ? "—"
              : `${desvio > 0 ? "+" : ""}${n0(desvio)}`}
          </div>
          <div className="pie">
            {desvioPct == null ? "Falta el cargado" : `${n1(desvioPct)} %`}
          </div>
        </div>
      </div>

      <h2>Por cantera y destino</h2>
      {r.lineas.length === 0 ? (
        <div className="vacio">
          No hay ninguna vuelta anotada en {nombreMes}.
          <br />
          El cuadro se arma con lo que se carga en Combustible › Autoconsumo.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Cantera</th>
              <th>Destino</th>
              <th className="num">Vueltas</th>
              <th className="num">Toneladas</th>
              <th className="num">L/Tn</th>
              <th className="num">Litros teóricos</th>
            </tr>
          </thead>
          <tbody>
            {r.lineas.map((l) => (
              <tr key={`${l.cantera}|${l.destino}`}>
                <td>{l.cantera}</td>
                <td>{l.destino}</td>
                <td className="num">{l.vueltas}</td>
                <td className="num">{n1(l.toneladas)}</td>
                <td className="num">{n2(l.litrosPorTonelada)}</td>
                <td className="num">{n0(l.litrosTeoricos)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td />
              <td className="num">{r.lineas.reduce((a, l) => a + l.vueltas, 0)}</td>
              <td className="num">{n1(r.toneladas)}</td>
              <td />
              <td className="num">{n0(r.litrosTeoricos)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {r.litrosCargados == null && (
        <p className="nota">
          <strong>Los litros cargados todavía no están en el sistema.</strong> Sin ese dato no se
          puede calcular el desvío, así que las dos columnas van con guion y no en cero: un cero
          se leería como que no se cargó nada, que es una afirmación distinta. Se completan
          importando el reporte de cargas de YPF desde Combustible › Cargas de gasoil.
        </p>
      )}

      <div className="pie-doc">
        Los litros teóricos salen de multiplicar las toneladas de cada vuelta por el rinde del
        tramo, con el mismo criterio del reporte de autoconsumo de YPF. El rinde de cada tramo
        queda registrado en el sistema junto con cada autorización, así que un cambio posterior no
        modifica lo ya emitido.
      </div>
    </div>
  );
}
