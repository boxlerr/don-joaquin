import type { ChoferDetail } from "@/app/(dashboard)/choferes/[slug]/types";
import type { SueldosHistorial } from "@/app/(dashboard)/choferes/[slug]/actions";
import { formatContactos } from "@/lib/contactos-emergencia";

// ── Helpers de formato ────────────────────────────────────────────────────
// El documento es papel: nada de "—" pelado donde se espera un dato, ni miles
// sin separador.

export const fecha = (s: string | null | undefined): string => {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0]!.split("-");
  return d ? `${d}/${m}/${y}` : s;
};

export const pesos = (n: number | null | undefined): string =>
  n == null ? "—" : `$ ${Math.round(n).toLocaleString("es-AR")}`;

export const num = (n: number | null | undefined, dec = 0): string =>
  n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: dec });

const mesLargo = (iso: string): string => {
  const [y, m] = iso.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[Number(m) - 1] ?? m}-${y!.slice(2)}`;
};

export function Campo({
  et,
  children,
  mono,
  ancho,
}: {
  et: string;
  children?: React.ReactNode;
  mono?: boolean;
  ancho?: boolean;
}) {
  const vacio = children == null || children === "" || children === "—";
  return (
    <div className={`campo${ancho ? " ancho" : ""}`}>
      <span className="et">{et}</span>
      <span className={`va${mono ? " mono" : ""}${vacio ? " falta" : ""}`}>
        {vacio ? "—" : children}
      </span>
    </div>
  );
}

function Seccion({
  titulo,
  cantidad,
  children,
  salto,
  extra,
}: {
  titulo: string;
  cantidad?: number;
  children: React.ReactNode;
  salto?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <section className={salto ? "salto" : undefined}>
      <h2>
        {titulo}
        {cantidad != null && <span className="cant"> · {cantidad}</span>}
        {extra}
      </h2>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="vacio">{children}</p>;
}

// ── Secciones del legajo ──────────────────────────────────────────────────

export function SeccionPersonales({ c }: { c: ChoferDetail }) {
  const rolLabel =
    { chofer: "Chofer", administrativo: "Administración", mantenimiento: "Mantenimiento", fletero: "Fletero (tercerizado)" }[
      c.rol ?? "chofer"
    ] ?? "Chofer";

  return (
    <Seccion titulo="Datos personales y laborales">
      <div className="campos">
        <Campo et="DNI" mono>{c.dni}</Campo>
        <Campo et="CUIL" mono>{c.cuil}</Campo>
        <Campo et="Fecha de nacimiento">{fecha(c.fecha_nacimiento)}</Campo>
        <Campo et="Ciudad de nacimiento">{c.ciudad_nacimiento}</Campo>
        <Campo et="Área / Rol">{rolLabel}</Campo>
        <Campo et="Fecha de ingreso">{fecha(c.fecha_ingreso)}</Campo>
        <Campo et="Alta AFIP">{fecha(c.alta_afip)}</Campo>
        <Campo et="Nº de trámite del DNI" mono>{c.nro_tramite_dni}</Campo>
        <Campo et="Teléfono">{c.telefono}</Campo>
        <Campo et="Email">{c.email}</Campo>
        <Campo et="Localidad">{c.localidad}</Campo>
        <Campo et="Provincia">{c.provincia}</Campo>
        <Campo et="Domicilio" ancho>{c.domicilio}</Campo>
        <Campo et="Contactos de emergencia" ancho>
          {/* Mismo parser que la pantalla: el valor crudo es "tel — nombre | tel — nombre". */}
          {formatContactos(c.telefono_emergencia) || undefined}
        </Campo>
        <Campo et="Banco">{c.banco}</Campo>
        <Campo et="CVU / CBU" mono>{c.cbu}</Campo>
        <Campo et="Alias CBU">{c.alias_cbu}</Campo>
        <Campo et="Período de prueba — fin">{fecha(c.periodo_prueba_fin)}</Campo>
      </div>
      {c.observaciones && (
        <p className="nota">
          <b>Observaciones:</b> {c.observaciones}
        </p>
      )}
    </Seccion>
  );
}

export function SeccionEgreso({ c }: { c: ChoferDetail }) {
  if (c.estado !== "baja") return null;
  return (
    <Seccion titulo="Egreso">
      <div className="campos c3">
        <Campo et="Motivo">{c.motivo_egreso}</Campo>
        <Campo et="Fecha de egreso">{fecha(c.fecha_egreso)}</Campo>
        <Campo et="Tiempo en la empresa">{duracion(c.fecha_ingreso, c.fecha_egreso)}</Campo>
      </div>
    </Seccion>
  );
}

export function SeccionDocumentos({ c }: { c: ChoferDetail }) {
  const docs = c.documentos_vigencia ?? [];
  return (
    <Seccion titulo="Documentación" cantidad={docs.length}>
      {docs.length === 0 ? (
        <Vacio>Sin documentación cargada.</Vacio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Número</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={d.id ?? i}>
                <td>{d.tipo_documento ?? "—"}</td>
                <td className="mono">{d.numero ?? "—"}</td>
                <td>{fecha(d.fecha_emision)}</td>
                <td>{fecha(d.fecha_vencimiento)}</td>
                <td className={d.estado_vigencia === "vencido" ? "alerta" : undefined}>
                  {d.estado_vigencia === "vencido"
                    ? `Vencido${d.dias_restantes != null ? ` hace ${Math.abs(d.dias_restantes)} días` : ""}`
                    : d.estado_vigencia === "por_vencer"
                      ? `Vence en ${d.dias_restantes} días`
                      : d.estado_vigencia === "vigente"
                        ? "Vigente"
                        : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionCamiones({ c }: { c: ChoferDetail }) {
  const hist = c.camiones_historial ?? [];
  return (
    <Seccion titulo="Unidades" cantidad={hist.length}>
      <div className="campos c3">
        <Campo et="Camión actual">
          {c.camion_actual
            ? `${c.camion_actual.patente} · ${[c.camion_actual.marca, c.camion_actual.modelo].filter(Boolean).join(" ")}`
            : undefined}
        </Campo>
      </div>
      {hist.length > 0 && (
        <table style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Patente</th>
              <th>Unidad</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Motivo del cambio</th>
            </tr>
          </thead>
          <tbody>
            {hist.map((h) => (
              <tr key={h.id}>
                <td className="mono">{h.patente}</td>
                <td>{[h.marca, h.modelo].filter(Boolean).join(" ") || "—"}</td>
                <td>{fecha(h.desde)}</td>
                <td>{h.hasta ? fecha(h.hasta) : "actual"}</td>
                <td>{h.motivo_cambio ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionProductividad({ c }: { c: ChoferDetail }) {
  const k = c.productividad_kpis;
  return (
    <Seccion
      titulo="Productividad"
      extra={
        <span className="cant">
          {" "}
          · {fecha(k.periodo_desde)} a {fecha(k.periodo_hasta)}
        </span>
      }
    >
      <div className="kpis">
        <div className="kpi">
          <span className="et">Viajes</span>
          <span className="va">{num(k.viajes_count)}</span>
        </div>
        <div className="kpi">
          <span className="et">KM totales</span>
          <span className="va">{num(k.km_total)}</span>
        </div>
        <div className="kpi">
          <span className="et">% vacíos</span>
          <span className="va">{num(k.pct_vacios, 1)}%</span>
        </div>
        <div className="kpi">
          <span className="et">Toneladas</span>
          <span className="va">{num(k.toneladas, 1)}</span>
        </div>
        <div className="kpi">
          <span className="et">Apercibimientos</span>
          <span className="va">{num(k.apercibimientos_mes)}</span>
        </div>
        <div className="kpi">
          <span className="et">Score</span>
          <span className="va">{k.score ?? "—"}</span>
        </div>
      </div>
      {c.evolucion_6meses?.length > 0 && (
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Mes</th>
              <th className="num">Viajes</th>
              <th className="num">KM</th>
              <th className="num">Toneladas</th>
            </tr>
          </thead>
          <tbody>
            {c.evolucion_6meses.map((m) => (
              <tr key={m.mes}>
                <td>{m.label}</td>
                <td className="num">{num(m.viajes)}</td>
                <td className="num">{num(m.km_total)}</td>
                <td className="num">{num(m.toneladas, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionVacaciones({ c }: { c: ChoferDetail }) {
  const periodos = (c.ausencias ?? []).filter((a) => a.es_vacaciones);
  const tomados = periodos.reduce((acc, p) => acc + p.dias, 0);
  const egresado = c.estado === "baja";

  return (
    <Seccion titulo="Vacaciones" cantidad={periodos.length}>
      {/* A un egresado no se le muestran saldos: dejó de acumular el día que se fue. */}
      {egresado ? (
        <p className="nota">
          Egresado{c.fecha_egreso ? ` el ${fecha(c.fecha_egreso)}` : ""}. No acumula más días. Se tomó{" "}
          {tomados} día{tomados !== 1 ? "s" : ""} en total.
        </p>
      ) : (
        <div className="campos">
          <Campo et="Corresponden">{`${c.vacaciones.dias_correspondientes} días`}</Campo>
          <Campo et="Adeudados año anterior">{`${Math.max(0, c.vacaciones.dias_adeudados)} días`}</Campo>
          <Campo et="Tomados">{`${c.vacaciones.dias_tomados} días`}</Campo>
          <Campo et="Disponibles">{`${c.vacaciones.dias_disponibles} días`}</Campo>
        </div>
      )}

      {periodos.length > 0 && (
        <table style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Desde</th>
              <th>Hasta</th>
              <th className="num">Días</th>
              <th>Descuenta del año</th>
              <th>Autorizó</th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id}>
                <td>{fecha(p.fecha_inicio)}</td>
                <td>{fecha(p.fecha_fin)}</td>
                <td className="num">{p.dias}</td>
                <td>{p.anio_cargo ?? "histórico"}</td>
                <td>{p.autorizado_por_nombre ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionAusencias({ c }: { c: ChoferDetail }) {
  const items = (c.ausencias ?? []).filter((a) => !a.es_vacaciones);
  return (
    <Seccion titulo="Ausencias" cantidad={items.length}>
      {items.length === 0 ? (
        <Vacio>Sin ausencias registradas.</Vacio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th className="num">Días</th>
              <th>Justificada</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.tipo}</td>
                <td>{fecha(a.fecha_inicio)}</td>
                <td>{fecha(a.fecha_fin)}</td>
                <td className="num">{a.dias}</td>
                <td>{a.justificada ? "Sí" : "No"}</td>
                <td>{a.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionLicencias({ c }: { c: ChoferDetail }) {
  const items = c.licencias_medicas ?? [];
  return (
    <Seccion titulo="Licencias médicas" cantidad={items.length}>
      {items.length === 0 ? (
        <Vacio>Sin licencias médicas registradas.</Vacio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Desde</th>
              <th>Hasta</th>
              <th className="num">Días</th>
              <th>Motivo</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id}>
                <td>{fecha(l.fecha_desde)}</td>
                <td>{l.fecha_hasta ? fecha(l.fecha_hasta) : "en curso"}</td>
                <td className="num">{l.dias ?? "—"}</td>
                <td>{l.motivo ?? "—"}</td>
                <td>{l.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionApercibimientos({ c }: { c: ChoferDetail }) {
  const items = c.apercibimientos ?? [];
  const TIPOS: Record<string, string> = {
    apercibimiento: "Apercibimiento",
    multa: "Multa",
    llamado_atencion: "Llamado de atención",
    adelanto: "Adelanto",
  };
  return (
    <Seccion titulo="Apercibimientos y conducta" cantidad={items.length}>
      {items.length === 0 ? (
        <Vacio>Sin apercibimientos registrados.</Vacio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Motivo</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{fecha(a.fecha)}</td>
                <td>{TIPOS[a.tipo] ?? a.tipo}</td>
                <td>{a.categoria_nombre ?? "—"}</td>
                <td>{a.motivo}</td>
                <td>{a.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionRoturas({ c }: { c: ChoferDetail }) {
  const items = c.roturas_detalle ?? [];
  if (items.length === 0) return null;
  return (
    <Seccion titulo="Roturas de gomas" cantidad={items.length}>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Unidad</th>
            <th>Posición</th>
            <th className="num">Cantidad</th>
            <th className="num">Costo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{fecha(r.fecha)}</td>
              <td className="mono">{r.unidad_patente ?? "—"}</td>
              <td>{r.posicion ?? "—"}</td>
              <td className="num">{r.cantidad}</td>
              <td className="num">{r.costo != null ? pesos(r.costo) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Seccion>
  );
}

export function SeccionPrestamos({ c }: { c: ChoferDetail }) {
  const items = c.prestamos ?? [];
  return (
    <Seccion titulo="Préstamos" cantidad={items.length}>
      {items.length === 0 ? (
        <Vacio>Sin préstamos registrados.</Vacio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="num">Monto</th>
              <th className="num">Cuotas</th>
              <th className="num">Saldo pendiente</th>
              <th>Estado</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{fecha(p.fecha)}</td>
                <td className="num">{pesos(p.monto)}</td>
                <td className="num">{p.cuotas}</td>
                <td className="num">{pesos(p.saldo_pendiente)}</td>
                <td>{p.estado}</td>
                <td>{p.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  );
}

export function SeccionViajes({ c }: { c: ChoferDetail }) {
  const items = c.viajes_recientes ?? [];
  return (
    <Seccion titulo="Últimos viajes" cantidad={items.length}>
      {items.length === 0 ? (
        <Vacio>Sin viajes registrados.</Vacio>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código</th>
              <th className="num">KM con carga</th>
              <th className="num">KM vacíos</th>
              <th className="ctr">Facturado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td>{fecha(v.fecha_viaje)}</td>
                <td className="mono">{v.codigo}</td>
                <td className="num">{num(v.km_con_carga)}</td>
                <td className="num">{num(v.km_vacios)}</td>
                <td className="ctr">{v.facturado ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="nota">Se listan los últimos {items.length} viajes cargados.</p>
    </Seccion>
  );
}

export function SeccionSueldos({ sueldos }: { sueldos: SueldosHistorial | null }) {
  if (!sueldos || sueldos.meses.length === 0) return null;
  return (
    <Seccion
      titulo="Sueldos"
      cantidad={sueldos.meses.length}
      extra={<span className="confidencial" style={{ marginLeft: 8 }}>Confidencial</span>}
    >
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th className="num">Básico</th>
            <th className="num">Comisión</th>
            <th className="num">Combustible</th>
            <th className="num">Plus YPF</th>
            <th className="num">Sábados</th>
            <th className="num">Aguinaldo</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {sueldos.meses.map((m) => (
            <tr key={m.mes}>
              <td>{mesLargo(m.mes)}</td>
              <td className="num">{pesos(m.sueldoBase)}</td>
              <td className="num">{pesos(m.comision)}</td>
              <td className="num">{pesos(m.combustible)}</td>
              <td className="num">{pesos(m.plusYpf)}</td>
              <td className="num">{pesos(m.sabados)}</td>
              <td className="num">{pesos(m.aguinaldo)}</td>
              <td className="num">
                <b>{pesos(m.total)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Seccion>
  );
}

// ── Utilidades compartidas ────────────────────────────────────────────────

export function duracion(desde: string | null | undefined, hasta: string | null | undefined): string {
  if (!desde) return "—";
  const ini = new Date(desde + "T00:00:00");
  const fin = hasta ? new Date(hasta + "T00:00:00") : new Date();
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return "—";
  let anios = fin.getFullYear() - ini.getFullYear();
  let meses = fin.getMonth() - ini.getMonth();
  if (fin.getDate() < ini.getDate()) meses -= 1;
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  if (anios <= 0 && meses <= 0) {
    const dias = Math.max(0, Math.floor((fin.getTime() - ini.getTime()) / 86_400_000));
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  const partes: string[] = [];
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  return partes.join(" ");
}
