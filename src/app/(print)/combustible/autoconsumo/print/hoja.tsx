import { Fragment } from "react";
import { variacion, type ReporteAutoconsumo } from "@/domain/gasoil/reporte";
import { CSS_AUTOCONSUMO } from "./estilos";
import {
  AZUL,
  ComposicionPorCantera,
  EvolucionAcumulada,
  LitrosPorDia,
  Medidor,
  SOL,
} from "./graficos";

/**
 * La hoja de autoconsumo: todo lo que se ve, sin nada que consulte la base.
 *
 * Está separada de `page.tsx` por el mismo motivo por el que el legajo impreso
 * tiene su `secciones.tsx`: la página se ocupa de los permisos y de traer los
 * datos, y el documento se ocupa de cómo se ve. Además de leerse mejor, así el
 * maquetado se puede revisar con un mes de prueba **sin tocar la base** — que
 * acá es la misma que usa producción.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const n0 = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
const n1 = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${n > 0 ? "+" : ""}${n1(n)} %`;

export function nombreDelMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1]} de ${y}`;
}

/** El renglón chico de una cifra: contra qué se compara. */
function Comparado({
  actual,
  previo,
  mes,
}: {
  actual: number | null;
  previo: number | null;
  mes: string;
}) {
  const v = variacion(actual, previo);
  if (v == null) return <div className="pie">Sin dato del mes anterior</div>;
  return (
    <div className="pie">
      {pct(v)} vs. {MESES[Number(mes.split("-")[1]) - 1]}
    </div>
  );
}

/**
 * El documento entero.
 *
 * Dos reglas lo atraviesan:
 *
 *  * **Lo que falta se muestra como que falta.** Si en el mes no hay ninguna
 *    carga registrada, los litros cargados van con guion y el motivo escrito,
 *    nunca en cero: un cero se lee como "no cargó nada" y sale impreso como un
 *    desvío del −100 % en un papel que se le entrega a un cliente.
 *  * **Ningún gráfico vacío.** Cuando una serie no tiene datos, en su lugar va la
 *    frase que explica por qué. Un eje sin línea no informa nada y encima parece
 *    un error del sistema.
 */
export function HojaAutoconsumo({
  r,
  mes,
  emitido,
}: {
  r: ReporteAutoconsumo;
  mes: string;
  /** El día de emisión, ya escrito. Lo pasa la página para que la hoja sea pura. */
  emitido: string;
}) {
  const mesPrevio = (() => {
    const [y, m] = mes.split("-").map(Number);
    return m === 1 ? `${y! - 1}-12` : `${y}-${String(m! - 1).padStart(2, "0")}`;
  })();

  return (
    <>
      <style>{CSS_AUTOCONSUMO}</style>

      <header className="membrete">
        <div>
          {/* Ruta directa, sin next/image: en impresión el srcset y el lazy
              loading sólo pueden hacer que el logo no llegue a tiempo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Don Joaquín Transporte" />
          <div className="razon">Don Joaquín Hnos. S.R.L. · Transporte de arenas</div>
        </div>
        <div className="der">
          <h1>Autoconsumo</h1>
          <div className="periodo">{nombreDelMes(mes)}</div>
          <div className="emitido">
            Emitido el {emitido}
            {r.esMesEnCurso ? ` · mes en curso, cerrado al día ${r.hastaDia}` : ""}
          </div>
        </div>
      </header>

      <BandaDeCifras r={r} mesPrevio={mesPrevio} />

      {r.totales.vueltas === 0 ? (
        <div className="sin-dato" style={{ marginTop: "8px", padding: "26px" }}>
          <b>No hay ninguna vuelta anotada en {nombreDelMes(mes)}.</b>
          El reporte se arma con lo que se autoriza en Combustible › Autoconsumo: cada vez que a un
          chofer se le dice cuántos litros puede cargar, esa vuelta entra acá.
          {r.totales.litrosCargados != null && (
            <>
              <br />
              <br />
              Cargas del surtidor sí hay: {n0(r.totales.cargas)} por {n0(r.totales.litrosCargados)}{" "}
              litros. Pero sin las vueltas autorizadas no hay contra qué compararlas, así que ese
              total todavía no es un desvío.
            </>
          )}
        </div>
      ) : (
        <>
          <Tablero r={r} />
          <Conciliacion r={r} mes={mes} />
        </>
      )}

      {/* Sin pie explicativo a propósito (Julián, 02/09/2026): la hoja 1 es la que
          se presenta y tiene que leerse de un golpe. La explicación de cómo sale
          cada número no desaparece — vive entera en "Qué está mirando", en la hoja
          de respaldo—, y la razón social y la fecha ya están en el membrete. */}
      {r.totales.vueltas > 0 && <HojaDeRespaldo r={r} mes={mes} />}
    </>
  );
}

// ── Banda de cifras ──────────────────────────────────────────────────────────

/**
 * Las cinco cifras del mes, arriba de todo.
 *
 * El orden no es decorativo: se lee de izquierda a derecha como la cuenta que
 * hace YPF —cuántas vueltas, cuántas toneladas, cuántos litros le corresponden,
 * cuántos se cargaron y cuánto sobró o faltó—. El desvío va último y con el
 * borde de la marca porque es el número por el que se reclama.
 */
function BandaDeCifras({ r, mesPrevio }: { r: ReporteAutoconsumo; mesPrevio: string }) {
  const t = r.totales;
  const d = r.desvio;

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="rot">Vueltas autorizadas</div>
        <div className="val">{n0(t.vueltas)}</div>
        <Comparado actual={t.vueltas} previo={r.previo?.vueltas ?? null} mes={mesPrevio} />
      </div>

      <div className="kpi">
        <div className="rot">Toneladas movidas</div>
        <div className="val">
          {n1(t.toneladas)}
          <span className="uni">tn</span>
        </div>
        <Comparado actual={t.toneladas} previo={r.previo?.toneladas ?? null} mes={mesPrevio} />
      </div>

      <div className="kpi eje">
        <div className="rot">Litros teóricos</div>
        <div className="val">{n0(t.litrosTeoricos)}</div>
        <div className="pie">
          {r.rindePromedio == null
            ? "Sin toneladas movidas"
            : `${n2(r.rindePromedio)} L por tonelada`}
        </div>
      </div>

      <div className={`kpi${t.litrosCargados == null ? " falta" : ""}`}>
        <div className="rot">Litros cargados</div>
        <div className="val">{t.litrosCargados == null ? "—" : n0(t.litrosCargados)}</div>
        <div className="pie">
          {t.litrosCargados == null
            ? "Sin cargas importadas"
            : `${n0(t.cargas)} ${t.cargas === 1 ? "carga" : "cargas"} en el surtidor`}
        </div>
      </div>

      {/* Sin teórico no hay desvío: el número existiría (los litros cargados) pero
          no significaría lo que dice el rótulo. Va con guion, como todo lo que
          falta. */}
      <div className={`kpi eje${d?.pct == null ? " falta" : ""}`}>
        <div className="rot">Desvío del mes</div>
        <div className={`val${d?.pct == null ? "" : d.litros > 0 ? " sube" : " baja"}`}>
          {d?.pct == null ? "—" : `${d.litros > 0 ? "+" : "−"}${n0(Math.abs(d.litros))}`}
        </div>
        <div className="pie">
          {d == null
            ? "Falta el cargado"
            : d.pct == null
              ? "Sin teórico contra qué medir"
              : `${pct(d.pct)} sobre el teórico`}
        </div>
      </div>
    </div>
  );
}

// ── Tablero ──────────────────────────────────────────────────────────────────

function Tablero({ r }: { r: ReporteAutoconsumo }) {
  const hayCargas = r.totales.litrosCargados != null;

  return (
    <div className="tablero">
      <div className="col">
        <div className="panel">
          <h2>
            <span>Litros acumulados en el mes</span>
            <span className="leyenda">
              <span>
                <i style={{ background: AZUL }} />
                Corresponde según el cuadro
              </span>
              <span className={hayCargas ? "" : "apagado"}>
                <i style={{ background: hayCargas ? SOL : "#CBD5E1" }} />
                Cargado en el surtidor
              </span>
            </span>
          </h2>
          <EvolucionAcumulada serie={r.serie} />
        </div>

        <div className="panel">
          <h2>
            <span>Litros por día</span>
            <span className="sub">
              {r.serie.length === r.dias ? `Los ${r.dias} días del mes` : `Del 1 al ${r.hastaDia}`}
            </span>
          </h2>
          <LitrosPorDia serie={r.serie} />
        </div>

        <div className="panel">
          <h2>
            <span>De dónde salieron los litros</span>
            <span className="sub">Por cantera, sobre el total teórico</span>
          </h2>
          <ComposicionPorCantera
            partes={r.canteras.map((c) => ({ nombre: c.cantera, litros: c.litrosTeoricos }))}
          />
        </div>
      </div>

      <div className="col">
        <div className="panel">
          <h2>
            <span>Cargado sobre lo teórico</span>
          </h2>
          {r.totales.litrosCargados == null ? (
            <div className="sin-dato">
              <b>Todavía no hay cargas de este mes en el sistema.</b>
              Sin ese dato no se puede calcular el desvío, así que va con guion y no en cero: un
              cero se leería como que no se cargó nada, que es una afirmación distinta. Se completa
              importando el reporte de cargas de YPF desde Combustible › Cargas de gasoil.
            </div>
          ) : (
            <Medidor cargado={r.totales.litrosCargados} teorico={r.totales.litrosTeoricos} />
          )}
        </div>

        <div className="panel">
          <h2>
            <span>Por cantera y destino</span>
            <span className="sub">
              {r.lineas.length} {r.lineas.length === 1 ? "tramo" : "tramos"}
            </span>
          </h2>
          <CuadroPorCantera r={r} />
        </div>
      </div>
    </div>
  );
}

/**
 * El cuadro con el que se cruza el reporte de ellos: cantera arriba, destinos
 * colgando y el subtotal en la fila de la cantera. Es la misma jerarquía que usa
 * YPF ("Proveedor Arena" → "Locación"), a propósito: los dos papeles se leen uno
 * al lado del otro y las filas tienen que aparearse a ojo.
 */
function CuadroPorCantera({ r }: { r: ReporteAutoconsumo }) {
  const total = r.totales.litrosTeoricos;

  return (
    <table>
      <thead>
        <tr>
          <th>Cantera / destino</th>
          <th className="num">Vueltas</th>
          <th className="num">Toneladas</th>
          <th className="num">L/tn</th>
          <th className="num">Litros teóricos</th>
        </tr>
      </thead>
      <tbody>
        {r.canteras.map((c) => (
          <Fragment key={c.cantera}>
            <tr className="grupo">
              <td>{c.cantera}</td>
              <td className="num">{n0(c.vueltas)}</td>
              <td className="num">{n1(c.toneladas)}</td>
              <td className="num apagado">—</td>
              <td className="num">{n0(c.litrosTeoricos)}</td>
            </tr>
            {c.destinos.map((l) => (
              <tr className="hija" key={`${c.cantera}|${l.destino}`}>
                <td>{l.destino}</td>
                <td className="num">{n0(l.vueltas)}</td>
                <td className="num">{n1(l.toneladas)}</td>
                <td className="num">
                  {n2(l.litrosPorTonelada)}
                  {l.rindeMixto ? <span className="marca-mixta"> *</span> : null}
                </td>
                <td className="num">{n0(l.litrosTeoricos)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
        <tr className="total">
          <td>Total</td>
          <td className="num">{n0(r.totales.vueltas)}</td>
          <td className="num">{n1(r.totales.toneladas)}</td>
          <td className="num">{r.rindePromedio == null ? "—" : n2(r.rindePromedio)}</td>
          <td className="num">{n0(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Conciliación ─────────────────────────────────────────────────────────────

/**
 * La fila que se compara contra la de ellos.
 *
 * El reporte de YPF termina en una tabla de una sola fila por transportista, con
 * teóricos, cargados y desvío. Ésta la reproduce con los mismos nombres para que
 * cruzar los dos papeles sea apoyar uno al lado del otro, no rehacer la cuenta.
 */
function Conciliacion({ r, mes }: { r: ReporteAutoconsumo; mes: string }) {
  const d = r.desvio;
  const t = r.totales;

  return (
    <div className="conciliacion">
      <h2
        style={{
          fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.8px", color: "#334155", margin: "0 0 4px",
        }}
      >
        Conciliación — {nombreDelMes(mes)}
      </h2>
      <table>
        <thead>
          <tr>
            <th>Transportista</th>
            <th className="num">Toneladas</th>
            <th className="num">Litros teóricos</th>
            <th className="num">Litros cargados</th>
            <th className="num">Desvío</th>
            <th className="num">% Desvío</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="fuerte">Don Joaquín Hnos. S.R.L.</td>
            <td className="num fuerte">{n1(t.toneladas)}</td>
            <td className="num fuerte">{n0(t.litrosTeoricos)}</td>
            <td className={`num fuerte${t.litrosCargados == null ? " apagado" : ""}`}>
              {t.litrosCargados == null ? "—" : n0(t.litrosCargados)}
            </td>
            <td className={`num fuerte${d?.pct == null ? " apagado" : d.litros > 0 ? " rojo" : " azul"}`}>
              {d?.pct == null ? "—" : `${d.litros > 0 ? "+" : "−"}${n0(Math.abs(d.litros))}`}
            </td>
            <td className={`num fuerte${d?.pct == null ? " apagado" : d.pct > 0 ? " rojo" : " azul"}`}>
              {d?.pct == null ? "—" : pct(d.pct)}
            </td>
            <td className="apagado">
              {d == null
                ? "Faltan las cargas del mes para conciliar"
                : d.pct == null
                  ? "No hay vueltas autorizadas contra las que conciliar"
                  : d.litros > 0
                    ? "Se cargó por encima de lo autorizado"
                    : "Se cargó dentro de lo autorizado"}
            </td>
          </tr>
        </tbody>
      </table>
      {r.hayRindeMixto && (
        <div className="nota">
          <b>* Ese tramo tiene dos rindes distintos en el mes.</b> Se cambió el cuadro mientras el
          mes estaba abierto y cada vuelta guardó el suyo, así que el L/tn que se muestra es el
          promedio ponderado y no un coeficiente que se haya aplicado parejo. El detalle vuelta por
          vuelta está en la hoja de respaldo.
        </div>
      )}
    </div>
  );
}

// ── Hoja de respaldo ─────────────────────────────────────────────────────────

/**
 * La segunda hoja: de dónde sale cada número de la primera.
 *
 * Va aparte y no al pie porque cumple otra función. La hoja 1 es la que se
 * presenta; ésta es la que se saca cuando alguien pregunta "¿y ese litro de
 * dónde salió?" — el corte por chofer, que del lado de YPF no existe, y el
 * detalle vuelta por vuelta.
 */
function HojaDeRespaldo({ r, mes }: { r: ReporteAutoconsumo; mes: string }) {
  return (
    <section className="salto">
      <h2 className="hoja">Respaldo del mes — {nombreDelMes(mes)}</h2>

      <div className="dos-cuadros">
        <div className="panel">
          <h2>
            <span>Por chofer</span>
            <span className="sub">
              {r.choferes.length} {r.choferes.length === 1 ? "persona" : "personas"}
            </span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Chofer</th>
                <th className="num">Vueltas</th>
                <th className="num">Toneladas</th>
                <th className="num">L/tn</th>
                <th className="num">Litros teóricos</th>
              </tr>
            </thead>
            <tbody>
              {r.choferes.map((c) => (
                <tr key={c.chofer}>
                  <td>{c.chofer}</td>
                  <td className="num">{n0(c.vueltas)}</td>
                  <td className="num">{n1(c.toneladas)}</td>
                  <td className="num">{n2(c.litrosPorTonelada)}</td>
                  <td className="num">{n0(c.litrosTeoricos)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="num">{n0(r.totales.vueltas)}</td>
                <td className="num">{n1(r.totales.toneladas)}</td>
                <td className="num">{r.rindePromedio == null ? "—" : n2(r.rindePromedio)}</td>
                <td className="num">{n0(r.totales.litrosTeoricos)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>
            <span>Qué está mirando</span>
          </h2>
          <div style={{ fontSize: "9px", color: "#475569", lineHeight: 1.65 }}>
            <p style={{ margin: "0 0 6px" }}>
              <b>Litros teóricos</b> son los que le corresponden a cada vuelta según el cuadro de
              rindes: toneladas cargadas × litros por tonelada del tramo. Es la misma cuenta con la
              que YPF liquida el autoconsumo — verificada contra su reporte de agosto de 2026, donde
              IBICUY → LAJE9 dio 19.961 L sobre 742,6 tn, o sea 26,88 L/tn, igual que el cuadro.
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <b>Litros cargados</b> son los que efectivamente salieron del surtidor, tomados de las
              cargas de gasoil del mes. Cuando el mes no tiene ninguna carga importada, la columna
              va con guion: en cero diría que no se cargó nada, que es otra cosa.
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <b>El desvío</b> es cargado menos teórico. Negativo significa que se cargó menos de lo
              que correspondía; positivo, que se entregó gasoil por encima del cuadro.
            </p>
            <p style={{ margin: 0 }}>
              <b>El rinde queda congelado</b> en cada autorización. Si el cuadro cambia mañana, este
              reporte sigue diciendo lo mismo que el día que se emitió.
            </p>
          </div>
        </div>
      </div>

      <div className="panel largo" style={{ marginTop: "8px" }}>
        <h2>
          <span>Detalle de las vueltas autorizadas</span>
          <span className="sub">
            {r.totales.vueltas} {r.totales.vueltas === 1 ? "vuelta" : "vueltas"}
          </span>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Chofer</th>
              <th>Cantera</th>
              <th>Destino</th>
              <th className="num">Toneladas</th>
              <th className="num">L/tn</th>
              <th className="num">Litros</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {r.autorizaciones.map((a) => (
              <tr key={a.id}>
                <td>{a.fecha.split("-").reverse().join("/")}</td>
                <td className="apagado">{a.hora}</td>
                <td>{a.chofer ?? <span className="apagado">Sin chofer</span>}</td>
                <td>{a.cantera}</td>
                <td>{a.destino}</td>
                <td className="num">{n1(a.toneladas)}</td>
                <td className="num">{n2(a.litrosPorTonelada)}</td>
                <td className="num">{n1(a.litros)}</td>
                <td className="apagado">{a.observaciones ?? ""}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={5}>Total</td>
              <td className="num">{n1(r.totales.toneladas)}</td>
              <td className="num">{r.rindePromedio == null ? "—" : n2(r.rindePromedio)}</td>
              <td className="num">{n0(r.totales.litrosTeoricos)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
