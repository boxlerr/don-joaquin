import "server-only";
import type { Database } from "@/types/database";
import { diasRestantes } from "@/app/(dashboard)/notificaciones/utils";

/**
 * Cálculo EN VIVO de las alertas de documentos y cheques desde su fuente real
 * (camion_documentos / chofer_documentos / cheques), no desde la tabla `alertas`.
 *
 * Motivo: esas alertas se insertan una sola vez y su `mensaje`/`severidad` quedan
 * congelados (el dedup impide regenerarlas y la generación ni mira los ya vencidos).
 * La UI de /notificaciones ya las recalcula así (por eso DOC_LIVE se excluye de la
 * tabla en toda la app). Este helper lleva el mismo criterio al email, para que un
 * documento que "vence en 3 días" escale solo a "vence hoy" y "vencido hace N".
 *
 * Mantener el criterio de documentos en sync con app/(dashboard)/notificaciones/page.tsx.
 */

type AlertaTipo = Database["public"]["Enums"]["alerta_tipo"];
type Severidad = Database["public"]["Enums"]["alerta_severidad"];

export type AlertaLive = {
  id: string;
  tipo: AlertaTipo;
  titulo: string;
  mensaje: string;
  severidad: Severidad;
  fecha_vencimiento: string | null;
  entidad_tipo: string | null;
};

// Umbral crítico (mismo que la vista): dentro de estos días o ya vencido → crítica.
const DIAS_CRITICO = 7;
// Ventana de aviso de cheques en cartera (igual que el default de generarAlertas).
const DIAS_VENTANA_CHEQUE = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

function plural(n: number): string {
  return n !== 1 ? "s" : "";
}

/**
 * Alertas de documentos de camión/chofer para el mail, calculadas en vivo.
 * A diferencia de la pantalla (que muestra todo el estado), el mail solo recuerda
 * en hitos: 14 y 7 días antes y el día del vencimiento, y después todos los días
 * mientras siga vencido. El texto se arma igual que en la vista.
 */
export async function getDocAlertasLive(supabase: Supabase): Promise<AlertaLive[]> {
  const [{ data: tiposDoc }, { data: camionDocs }, { data: choferDocs }] = await Promise.all([
    supabase
      .from("tipos_documento")
      .select("id, nombre")
      .eq("estado", "activo"),
    supabase
      .from("camion_documentos")
      .select("id, tipo_documento_id, fecha_vencimiento, camiones(patente)"),
    supabase
      .from("chofer_documentos")
      .select("id, tipo_documento_id, fecha_vencimiento, choferes(nombre, apellido)"),
  ]);

  const tipoById = new Map(
    ((tiposDoc ?? []) as { id: string; nombre: string }[]).map((t) => [t.id, t]),
  );

  const out: AlertaLive[] = [];

  function procesar(
    docs:
      | {
          id: string;
          tipo_documento_id: string;
          fecha_vencimiento: string | null;
          camiones?: { patente: string } | null;
          choferes?: { nombre: string; apellido: string } | null;
        }[]
      | null
      | undefined,
    ambito: "camion" | "chofer",
  ) {
    for (const d of docs ?? []) {
      const tipo = tipoById.get(d.tipo_documento_id);
      if (!tipo || !d.fecha_vencimiento) continue;
      const dias = diasRestantes(d.fecha_vencimiento);
      if (dias === null) continue;

      const vencido = dias < 0;
      // El mail recuerda documentos en hitos: 14 y 7 días antes y el día del
      // vencimiento; una vez vencido, sigue avisando todos los días. Los días
      // intermedios no generan correo (la pantalla in-app muestra el estado igual).
      const esHito = dias === 14 || dias === 7 || dias === 0;
      if (!vencido && !esHito) continue;

      const entidad =
        ambito === "camion"
          ? d.camiones?.patente ?? "Camión"
          : d.choferes
            ? `${d.choferes.apellido} ${d.choferes.nombre}`
            : "Chofer";

      out.push({
        id: `docvenc-${d.id}`,
        tipo: ambito === "camion" ? "vencimiento_doc_camion" : "vencimiento_doc_chofer",
        severidad: vencido || dias <= DIAS_CRITICO ? "critica" : "advertencia",
        titulo: `${tipo.nombre} — ${entidad}`,
        mensaje: vencido
          ? `${tipo.nombre} venció hace ${Math.abs(dias)} día${plural(Math.abs(dias))}.`
          : dias === 0
            ? `${tipo.nombre} vence hoy.`
            : `${tipo.nombre} vence en ${dias} día${plural(dias)}.`,
        fecha_vencimiento: d.fecha_vencimiento,
        entidad_tipo: ambito === "camion" ? "camion_documentos" : "chofer_documentos",
      });
    }
  }

  procesar(camionDocs, "camion");
  procesar(choferDocs, "chofer");
  return out;
}

/**
 * Alertas de cheques en cartera próximos a vencer o vencidos, en vivo. Escala a
 * "vencido" (la generación original solo miraba los que aún no habían vencido).
 */
export async function getChequeAlertasLive(supabase: Supabase): Promise<AlertaLive[]> {
  const { data: cheques } = await supabase
    .from("cheques")
    .select("id, librador_nombre, importe, fecha_vencimiento")
    .eq("estado", "cartera")
    .not("fecha_vencimiento", "is", null);

  const out: AlertaLive[] = [];
  for (const c of (cheques ?? []) as {
    id: string;
    librador_nombre: string;
    importe: number;
    fecha_vencimiento: string;
  }[]) {
    const dias = diasRestantes(c.fecha_vencimiento);
    if (dias === null) continue;

    const vencido = dias < 0;
    const proximo = !vencido && dias <= DIAS_VENTANA_CHEQUE;
    if (!vencido && !proximo) continue;

    const importeLabel = `$${Number(c.importe).toLocaleString("es-AR")}`;

    out.push({
      id: `chequevenc-${c.id}`,
      tipo: "vencimiento_cheque",
      severidad: vencido || dias <= DIAS_CRITICO ? "critica" : "advertencia",
      titulo: vencido
        ? `Cheque vencido — ${c.librador_nombre}`
        : `Cheque próximo a vencer — ${c.librador_nombre}`,
      mensaje: vencido
        ? `Cheque de ${importeLabel} de ${c.librador_nombre} venció hace ${Math.abs(dias)} día${plural(Math.abs(dias))}.`
        : dias === 0
          ? `Cheque de ${importeLabel} de ${c.librador_nombre} vence hoy.`
          : `Cheque de ${importeLabel} de ${c.librador_nombre} vence en ${dias} día${plural(dias)}.`,
      fecha_vencimiento: c.fecha_vencimiento,
      entidad_tipo: "cheques",
    });
  }
  return out;
}
