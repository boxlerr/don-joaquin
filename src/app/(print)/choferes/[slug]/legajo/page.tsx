import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth";
import {
  getChoferDetailAction,
  getChoferSueldosHistorialAction,
  type SueldosHistorial,
} from "@/app/(dashboard)/choferes/[slug]/actions";
import PrintTrigger from "@/app/(print)/_components/PrintTrigger";
import { CSS_LEGAJO } from "./estilos";
import {
  SeccionPersonales,
  SeccionEgreso,
  SeccionDocumentos,
  SeccionCamiones,
  SeccionProductividad,
  SeccionVacaciones,
  SeccionAusencias,
  SeccionLicencias,
  SeccionApercibimientos,
  SeccionRoturas,
  SeccionPrestamos,
  SeccionViajes,
  SeccionSueldos,
  fecha,
  duracion,
} from "./secciones";

export const dynamic = "force-dynamic";

/**
 * Legajo completo del chofer, listo para imprimir o guardar como PDF.
 *
 * Vive en el route group (print), que no tiene el chrome del dashboard: la
 * página es el documento. Como el group no hereda el guard del layout, la auth
 * se pide acá explícitamente.
 *
 * No reusa los componentes de las pestañas a propósito: traen botones, tooltips,
 * estados de edición y tema oscuro, todo cosas que en papel sobran o salen mal.
 */
export default async function LegajoPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sueldos?: string; imprimir?: string }>;
}) {
  await requireSeccion("choferes", "read");

  const { slug } = await params;
  const { sueldos: sueldosParam, imprimir } = await searchParams;
  // `?imprimir=0` muestra el documento sin abrir el diálogo: sirve para revisar
  // cómo quedó el maquetado sin tener que cancelar la impresión cada vez.
  const autoImprimir = imprimir !== "0";

  const chofer = await getChoferDetailAction(slug);
  if (!chofer) notFound();

  // Los sueldos son confidenciales y el PDF puede terminar impreso arriba de un
  // escritorio: van sólo si se piden explícitamente Y el usuario los puede ver.
  let sueldos: SueldosHistorial | null = null;
  if (sueldosParam === "1" && chofer.can_ver_sueldos) {
    const res = await getChoferSueldosHistorialAction(chofer.id);
    if (!("error" in res)) sueldos = res;
  }

  // La foto vive en un bucket privado: `getChoferDetailAction` ya devuelve el
  // link firmado.
  const fotoUrl = chofer.foto_url ?? null;

  const nombreCompleto = `${chofer.apellido}, ${chofer.nombre}`;
  const esBaja = chofer.estado === "baja";
  const generado = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="doc">
      {autoImprimir && (
        <PrintTrigger title={`Legajo - ${nombreCompleto}${chofer.dni ? ` - ${chofer.dni}` : ""}`} />
      )}

      <style>{CSS_LEGAJO}</style>

      <header className="membrete">
        {/* Ruta directa, sin next/image: en impresión el srcset y el lazy loading
            sólo pueden hacer que el logo no llegue a tiempo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-horizontal.png" alt="Don Joaquín Hnos. S.R.L." />
        <div className="der">
          <div className="tipo">Legajo del personal</div>
          <div>Don Joaquín Hnos. S.R.L.</div>
          <div>Generado el {generado}</div>
        </div>
      </header>

      <div className="ficha">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto" src={fotoUrl} alt={nombreCompleto} />
        ) : (
          <div className="sinfoto">Sin foto</div>
        )}
        <div style={{ flex: 1 }}>
          <h1>{nombreCompleto}</h1>
          <div className="sub">
            DNI {chofer.dni ?? "—"} · CUIL {chofer.cuil ?? "—"}
          </div>
          <div className="linea">
            <span className={`estado${chofer.estado === "activo" ? " activo" : ""}`}>
              {esBaja ? "Egresado" : chofer.estado}
            </span>
            <span>
              <b>Ingreso:</b> {fecha(chofer.fecha_ingreso)}
            </span>
            {esBaja ? (
              <span>
                <b>Egreso:</b> {fecha(chofer.fecha_egreso)}
              </span>
            ) : null}
            <span>
              <b>{esBaja ? "Estuvo" : "Antigüedad"}:</b>{" "}
              {duracion(chofer.fecha_ingreso, esBaja ? chofer.fecha_egreso : null)}
            </span>
            {chofer.telefono && (
              <span>
                <b>Tel:</b> {chofer.telefono}
              </span>
            )}
            {chofer.localidad && (
              <span>
                <b>Localidad:</b> {chofer.localidad}
              </span>
            )}
          </div>
        </div>
      </div>

      <SeccionPersonales c={chofer} />
      <SeccionEgreso c={chofer} />
      <SeccionDocumentos c={chofer} />
      <SeccionCamiones c={chofer} />
      <SeccionProductividad c={chofer} />
      <SeccionVacaciones c={chofer} />
      <SeccionAusencias c={chofer} />
      <SeccionLicencias c={chofer} />
      <SeccionApercibimientos c={chofer} />
      <SeccionRoturas c={chofer} />
      <SeccionPrestamos c={chofer} />
      <SeccionViajes c={chofer} />
      <SeccionSueldos sueldos={sueldos} />

      <footer>
        <span>
          Legajo de {nombreCompleto} — Don Joaquín Hnos. S.R.L.
        </span>
        <span>Documento interno · generado el {generado}</span>
      </footer>
    </div>
  );
}
