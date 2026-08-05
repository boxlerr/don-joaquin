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
// Cuántos días se recuerda por mail un documento YA vencido en el envío diario.
// Pasado ese plazo sigue en la pantalla y en el resumen del lunes, pero deja de
// repetirse todas las mañanas. Los cheques vencidos NO tienen este corte a
// propósito: son plata a cobrar, son pocos, y ahí sí conviene que insistan.
const DIAS_RECORDAR_VENCIDO = 7;
// Ventana de aviso de cheques si el parámetro no está cargado (igual que generarAlertas).
const DIAS_VENTANA_CHEQUE_DEFAULT = 30;

/** Ventana de aviso de cheques configurada en Configuración (`dias_alerta_cheque`). */
async function ventanaCheque(supabase: Supabase): Promise<number> {
  const { data } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", "dias_alerta_cheque")
    .maybeSingle();
  const n = Number(data?.valor);
  return Number.isFinite(n) && n > 0 ? n : DIAS_VENTANA_CHEQUE_DEFAULT;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

function plural(n: number): string {
  return n !== 1 ? "s" : "";
}

/**
 * `soloHitos: true` (el mail de todos los días) recuerda en hitos y no a diario.
 * `false` (el resumen completo del lunes) trae todo lo que está por vencer o
 * vencido, que es de lo que se trata ese correo.
 */
export type OpcionesLive = { soloHitos?: boolean };

/**
 * Alertas de documentos de camión/chofer para el mail, calculadas en vivo.
 * A diferencia de la pantalla (que muestra todo el estado), el mail diario solo
 * recuerda en hitos: 14 y 7 días antes y el día del vencimiento, y después todos
 * los días mientras siga vencido. El texto se arma igual que en la vista.
 */
export async function getDocAlertasLive(
  supabase: Supabase,
  opts: OpcionesLive = {},
): Promise<AlertaLive[]> {
  const soloHitos = opts.soloHitos ?? true;
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
      // El estado del chofer viene para poder descartar a los egresados: un
      // egresado conserva su historial pero no genera novedades nuevas (ver
      // lib/chofer-egreso.ts). Sin esto, la licencia vencida de alguien que se
      // fue seguía reclamando renovación todos los días.
      .select("id, tipo_documento_id, fecha_vencimiento, choferes(nombre, apellido, estado)"),
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
          choferes?: { nombre: string; apellido: string; estado?: string } | null;
        }[]
      | null
      | undefined,
    ambito: "camion" | "chofer",
  ) {
    for (const d of docs ?? []) {
      const tipo = tipoById.get(d.tipo_documento_id);
      if (!tipo || !d.fecha_vencimiento) continue;
      // Egresado: el legajo queda, el reclamo no.
      if (ambito === "chofer" && d.choferes?.estado === "baja") continue;
      const dias = diasRestantes(d.fecha_vencimiento);
      if (dias === null) continue;

      const vencido = dias < 0;
      // Mail diario: hitos (14 / 7 / el día que vence) y los que vencieron en la
      // última semana. Resumen del lunes (`soloHitos: false`): todo lo que está
      // por vencer o vencido, sin importar hace cuánto.
      //
      // El corte de los vencidos existe por volumen: hoy hay 45 documentos
      // vencidos de gente y camiones activos. Repetir esa lista entera cada
      // mañana no la hace más urgente, hace que en una semana nadie abra el
      // correo — y ahí se pierde el aviso del que vence mañana. La lista completa
      // no desaparece: sigue en la pantalla todos los días y en el mail del lunes.
      const esHito = dias === 14 || dias === 7 || dias === 0;
      const vencidoReciente = vencido && Math.abs(dias) <= DIAS_RECORDAR_VENCIDO;
      const entraDiario = esHito || vencidoReciente;
      const entraCompleto = vencido || dias <= 14;
      if (!(soloHitos ? entraDiario : entraCompleto)) continue;

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
 *
 * Igual que los documentos, el mail recuerda en HITOS y no todos los días: al
 * entrar en la ventana configurada, a 7, a 3, mañana, el día que vence, y
 * después todos los días mientras siga vencido sin gestionar. La pantalla y la
 * campana muestran el estado completo igual.
 */
export async function getChequeAlertasLive(
  supabase: Supabase,
  opts: OpcionesLive = {},
): Promise<AlertaLive[]> {
  const soloHitos = opts.soloHitos ?? true;
  const [ventana, { data: cheques }] = await Promise.all([
    ventanaCheque(supabase),
    supabase
      .from("cheques")
      .select("id, librador_nombre, importe, fecha_vencimiento")
      .eq("estado", "cartera")
      .not("fecha_vencimiento", "is", null),
  ]);

  const hitos = new Set([ventana, 7, 3, 1, 0].filter((d) => d <= ventana));

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
    if (!vencido && !(soloHitos ? hitos.has(dias) : dias <= ventana)) continue;

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
