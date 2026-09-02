import type { DiaSerie } from "@/domain/gasoil/reporte";

/**
 * Los gráficos del reporte de autoconsumo, en SVG escrito a mano.
 *
 * Sin recharts y sin ningún componente del dashboard, por el mismo motivo por el
 * que el legajo impreso no reusa las pestañas: una librería de gráficos dibuja
 * del lado del navegador, con tooltips, animaciones y un tema que en la hoja no
 * existe. Si el diálogo de impresión abre antes de que termine de animar, el PDF
 * sale con el gráfico a medio dibujar y nadie se entera hasta verlo impreso.
 *
 * Acá el SVG llega armado desde el servidor: lo que se ve en pantalla es lo
 * mismo que sale en el papel, siempre.
 *
 * Los colores son los de la marca —azul `#0088D1` para lo que corresponde según
 * el cuadro, amarillo sol `#FFB300` para lo que realmente se cargó—, elegidos
 * también para que se distingan impresos en blanco y negro: el azul queda gris
 * oscuro y el amarillo, gris claro.
 */

export const AZUL = "#0088D1";
export const AZUL_HONDO = "#004A99";
export const SOL = "#FFB300";
export const ROJO = "#B91C1C";
const GRIS_LINEA = "#E2E8F0";
const GRIS_TEXTO = "#94A3B8";

const n0 = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

/** Un techo redondo para el eje: 1.532 → 2.000, 48.966 → 50.000. */
function techoLindo(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const paso = [1, 1.5, 2, 2.5, 5, 10].find((p) => max <= p * base) ?? 10;
  return paso * base;
}

/** Los números del eje: los miles se abrevian para que entren sin apretarse. */
function rotuloEje(v: number, techo: number): string {
  if (techo >= 10000) return v === 0 ? "0" : `${(v / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} K`;
  return n0(v);
}

/** Cada cuántos días se escribe el número abajo, para que no se pisen. */
function pasoDeDias(n: number): number {
  if (n <= 10) return 1;
  if (n <= 16) return 2;
  return 5;
}

// ── Evolución acumulada ──────────────────────────────────────────────────────

/**
 * Lo que se autorizó contra lo que se cargó, acumulado día a día.
 *
 * Es el gráfico que contesta la única pregunta que importa del mes: si la
 * diferencia se abrió de golpe un día —una carga que faltó importar— o si viene
 * separándose de a poco, que ya es un problema de consumo.
 */
export function EvolucionAcumulada({ serie }: { serie: DiaSerie[] }) {
  const W = 660;
  const H = 190;
  const izq = 50;
  const der = 62;
  const arr = 12;
  const aba = 24;
  const anchoUtil = W - izq - der;
  const altoUtil = H - arr - aba;

  const hayCargas = serie.some((d) => d.acumCargados != null);
  const maxDato = Math.max(
    ...serie.map((d) => Math.max(d.acumTeoricos, d.acumCargados ?? 0)),
    1,
  );
  const techo = techoLindo(maxDato);
  const n = Math.max(serie.length - 1, 1);

  const x = (i: number) => izq + (i / n) * anchoUtil;
  const y = (v: number) => arr + (1 - v / techo) * altoUtil;

  const linea = (valores: number[]) =>
    valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const teoricos = serie.map((d) => d.acumTeoricos);
  const cargados = hayCargas ? serie.map((d) => d.acumCargados ?? 0) : null;
  const areaTeorico = `${linea(teoricos)} L${x(n).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const paso = pasoDeDias(serie.length);
  const ultimo = serie.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="grafico" role="img"
      aria-label="Litros acumulados en el mes: los que corresponden según el cuadro y los que se cargaron.">
      <defs>
        <linearGradient id="degTeorico" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={AZUL} stopOpacity="0.14" />
          <stop offset="100%" stopColor={AZUL} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grilla y eje vertical */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={izq} x2={W - der} y1={y(techo * f)} y2={y(techo * f)}
            stroke={GRIS_LINEA} strokeWidth="1" shapeRendering="crispEdges"
          />
          <text x={izq - 7} y={y(techo * f) + 3.5} textAnchor="end" fontSize="10.5" fill={GRIS_TEXTO}>
            {rotuloEje(techo * f, techo)}
          </text>
        </g>
      ))}

      {/* Días abajo */}
      {serie.map((d, i) =>
        d.dia % paso === 0 || d.dia === 1 ? (
          <text key={d.dia} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill={GRIS_TEXTO}>
            {d.dia}
          </text>
        ) : null,
      )}

      <path d={areaTeorico} fill="url(#degTeorico)" />
      <path d={linea(teoricos)} fill="none" stroke={AZUL} strokeWidth="2.1" strokeLinejoin="round" />
      {cargados && (
        <path d={linea(cargados)} fill="none" stroke={SOL} strokeWidth="2.1" strokeLinejoin="round" />
      )}

      {/* El valor final escrito al lado de cada línea: es el número que se compara. */}
      <circle cx={x(ultimo)} cy={y(teoricos[ultimo]!)} r="2.8" fill={AZUL} />
      <text x={x(ultimo) + 7} y={y(teoricos[ultimo]!) + 3.5} fontSize="11" fontWeight="700" fill={AZUL_HONDO}>
        {n0(teoricos[ultimo]!)}
      </text>
      {cargados && (
        <>
          <circle cx={x(ultimo)} cy={y(cargados[ultimo]!)} r="2.8" fill={SOL} />
          <text x={x(ultimo) + 7} y={y(cargados[ultimo]!) + 3.5} fontSize="11" fontWeight="700" fill="#8A5A00">
            {n0(cargados[ultimo]!)}
          </text>
        </>
      )}
    </svg>
  );
}

// ── Litros por día ───────────────────────────────────────────────────────────

/**
 * El movimiento del mes, día por día. Sirve para ver los días muertos y los
 * picos —que es donde después aparece la carga que no cierra—.
 */
export function LitrosPorDia({ serie }: { serie: DiaSerie[] }) {
  const W = 660;
  const H = 138;
  const izq = 50;
  const der = 10;
  const arr = 10;
  const aba = 22;
  const anchoUtil = W - izq - der;
  const altoUtil = H - arr - aba;

  const hayCargas = serie.some((d) => d.litrosCargados != null);
  const maxDato = Math.max(
    ...serie.map((d) => Math.max(d.litrosTeoricos, d.litrosCargados ?? 0)),
    1,
  );
  const techo = techoLindo(maxDato);
  const grupo = anchoUtil / serie.length;
  // Con dos barras por día se reparte el ancho; con una sola, la barra se queda
  // con todo el grupo menos el aire de los costados. El tope importa en los meses
  // de pocos días: sin él, dos días de datos dibujan dos bloques del ancho de la
  // hoja, que ya no se leen como barras sino como un error de maquetado.
  const ancho = Math.min(
    hayCargas ? Math.max(grupo * 0.34, 1.2) : Math.max(grupo * 0.5, 1.5),
    24,
  );

  const y = (v: number) => arr + (1 - v / techo) * altoUtil;
  const base = y(0);
  const paso = pasoDeDias(serie.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="grafico" role="img"
      aria-label="Litros por día: los que corresponden según el cuadro y los que se cargaron.">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={izq} x2={W - der} y1={y(techo * f)} y2={y(techo * f)}
            stroke={GRIS_LINEA} strokeWidth="1" shapeRendering="crispEdges"
          />
          <text x={izq - 7} y={y(techo * f) + 3.5} textAnchor="end" fontSize="10.5" fill={GRIS_TEXTO}>
            {rotuloEje(techo * f, techo)}
          </text>
        </g>
      ))}

      {serie.map((d, i) => {
        const centro = izq + grupo * (i + 0.5);
        const xT = hayCargas ? centro - ancho - 0.8 : centro - ancho / 2;
        const xC = centro + 0.8;
        return (
          <g key={d.dia}>
            {d.litrosTeoricos > 0 && (
              <rect x={xT} y={y(d.litrosTeoricos)} width={ancho} height={base - y(d.litrosTeoricos)} fill={AZUL} />
            )}
            {hayCargas && (d.litrosCargados ?? 0) > 0 && (
              <rect x={xC} y={y(d.litrosCargados!)} width={ancho} height={base - y(d.litrosCargados!)} fill={SOL} />
            )}
            {(d.dia % paso === 0 || d.dia === 1) && (
              <text x={centro} y={H - 7} textAnchor="middle" fontSize="10.5" fill={GRIS_TEXTO}>
                {d.dia}
              </text>
            )}
          </g>
        );
      })}
      <line x1={izq} x2={W - der} y1={base} y2={base} stroke="#CBD5E1" strokeWidth="1" shapeRendering="crispEdges" />
    </svg>
  );
}

// ── Medidor ──────────────────────────────────────────────────────────────────

const RAD = Math.PI / 180;

function puntoArco(cx: number, cy: number, r: number, gradosDesdeIzq: number) {
  const a = (180 - gradosDesdeIzq) * RAD;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arco(cx: number, cy: number, r: number, desde: number, hasta: number) {
  const a = puntoArco(cx, cy, r, desde);
  const b = puntoArco(cx, cy, r, hasta);
  const grande = hasta - desde > 180 ? 1 : 0;
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${r},${r} 0 ${grande} 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

/**
 * Cuánto se cargó sobre lo que correspondía, en un solo golpe de vista.
 *
 * La escala llega al 150 % y no al 100 %: si un mes se carga de más, la aguja
 * tiene que tener a dónde ir. Pasado el 100 % el arco cambia a rojo, porque ahí
 * ya no es un ahorro sino gasoil que se entregó por encima del cuadro.
 */
export function Medidor({ cargado, teorico }: { cargado: number; teorico: number }) {
  const W = 250;
  const H = 132;
  const cx = W / 2;
  const cy = 112;
  const r = 84;
  const grosor = 17;
  const TOPE = 150;

  const pct = teorico > 0 ? (cargado / teorico) * 100 : 0;
  const gradosDe = (p: number) => Math.min(Math.max(p, 0), TOPE) * (180 / TOPE);
  const hastaAzul = gradosDe(Math.min(pct, 100));
  const hastaRojo = gradosDe(pct);
  const marca = puntoArco(cx, cy, r + grosor / 2 + 3, gradosDe(100));
  const marcaIn = puntoArco(cx, cy, r - grosor / 2 - 3, gradosDe(100));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="medidor" role="img"
      aria-label={`Se cargó el ${pct.toFixed(1)} por ciento de lo que correspondía.`}>
      <path d={arco(cx, cy, r, 0, 180)} fill="none" stroke="#EEF2F6" strokeWidth={grosor} />
      {pct > 100 && (
        <path d={arco(cx, cy, r, hastaAzul, hastaRojo)} fill="none" stroke={ROJO} strokeWidth={grosor} />
      )}
      {hastaAzul > 0.4 && (
        <path d={arco(cx, cy, r, 0, hastaAzul)} fill="none" stroke={AZUL} strokeWidth={grosor} />
      )}

      {/* La marca del 100 %: el punto de referencia contra el que se lee todo. */}
      <line x1={marcaIn.x} y1={marcaIn.y} x2={marca.x} y2={marca.y} stroke="#64748B" strokeWidth="1.4" />
      <text x={marca.x} y={marca.y - 4} textAnchor="middle" fontSize="9.5" fill={GRIS_TEXTO}>
        100 %
      </text>

      <text x={cx} y={cy - 22} textAnchor="middle" fontSize="30" fontWeight="700" fill="#0F172A">
        {pct.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
      </text>
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10.5" fill="#64748B">
        de lo que correspondía
      </text>
    </svg>
  );
}

/** Dónde arranca y cuánto mide cada tramo de la barra apilada. */
function apilar(partes: { nombre: string; litros: number }[], total: number, W: number) {
  const salida: { nombre: string; litros: number; x: number; ancho: number; pct: number }[] = [];
  let corrido = 0;
  for (const p of partes) {
    const ancho = (p.litros / total) * W;
    salida.push({ ...p, x: corrido, ancho, pct: (p.litros / total) * 100 });
    corrido += ancho;
  }
  return salida;
}

/**
 * De dónde salieron los litros del mes, por cantera.
 *
 * Una barra apilada y no una torta: son tres o cuatro canteras y lo que se
 * compara son proporciones largas, no ángulos. En papel además una torta obliga
 * a una referencia aparte; acá el rótulo va escrito adentro de cada tramo.
 */
export function ComposicionPorCantera({
  partes,
}: {
  partes: { nombre: string; litros: number }[];
}) {
  const W = 660;
  const H = 34;
  const total = partes.reduce((a, p) => a + p.litros, 0);
  if (total <= 0) return null;

  // Suficientes tonos para las canteras que hay (3 en el cuadro de Nico) y para
  // un par más sin repetir. Todos de la familia de la marca.
  const TONOS = [AZUL_HONDO, AZUL, "#4FC3F7", "#93C5E8", "#C7DEEF"];

  const tramos = apilar(partes, total, W);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="barra-compo" role="img"
      aria-label="Cuánto aportó cada cantera a los litros del mes.">
      {tramos.map((p, i) => {
        const { x, ancho, pct } = p;
        // El rótulo sólo entra si el tramo es ancho; si no, se lee en la tabla.
        const cabe = ancho > 84;
        return (
          <g key={p.nombre}>
            <rect x={x} y="0" width={Math.max(ancho - 1.5, 0)} height={H} fill={TONOS[i % TONOS.length]} />
            {cabe && (
              <>
                <text x={x + 9} y="14" fontSize="10.5" fontWeight="700" fill="#fff">
                  {p.nombre}
                </text>
                <text x={x + 9} y="27" fontSize="10.5" fill="#fff" fillOpacity="0.85">
                  {n0(p.litros)} L · {pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
