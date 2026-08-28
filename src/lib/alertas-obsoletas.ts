/**
 * Cuándo un aviso que sigue 'pendiente' ya dejó de tener sentido.
 *
 * Es el complemento de `caducaAlPasar` (`lib/alertas-routing.ts`). Aquella
 * responde "¿esto se termina solo cuando pasa la fecha?" — cumpleaños, ausencias.
 * Ésta responde la otra mitad: un documento vencido SÍ se sigue reclamando, pero
 * **hasta que alguien lo renueve**, y eso nunca se estaba mirando. Ana cargó 45
 * documentos el sábado 08/08/2026 y el resumen del lunes le reclamó los mismos
 * 45: la alerta guarda la fecha vieja congelada y nadie la apagaba al renovar.
 * De 108 avisos de Compliance + Documentación, 76 eran de documentos ya al día.
 *
 * Todo lo que decide algo vive acá y es puro, para poder testearlo sin base.
 */

/**
 * ¿El documento se renovó después de que se emitió el aviso?
 *
 * Se compara contra la fecha que la alerta dejó grabada, NO contra hoy: si el
 * carnet se renovó del 10/06/2026 al 03/06/2028, el aviso del 10/06 sobra.
 * Alcanza con que la fecha actual sea posterior — una corrección hacia atrás
 * (se cargó mal y se arregla a una fecha anterior) deja el reclamo en pie,
 * que es lo correcto: ese documento sigue vencido.
 *
 * Las fechas son ISO (YYYY-MM-DD), así que comparar strings alcanza y evita
 * el `new Date()` que en este repo ya corrió un día por UTC más de una vez.
 */
export function documentoRenovado(
  vencAlerta: string | null | undefined,
  vencActual: string | null | undefined,
): boolean {
  if (!vencAlerta || !vencActual) return false;
  return vencActual > vencAlerta;
}

/**
 * Los papeles de compliance NO se renuevan pisando la fila: se carga una nueva.
 *
 * Ahí estaba el agujero que encontró Bárbara (video del 28/08/2026): el panel le
 * decía 4 vencidos de compliance y la pantalla, 0. Uno de esos cuatro era el
 * Certificado de Cobertura — vencía el 06/08, se cargó el nuevo el 07/08 con
 * vencimiento 05/09, y el aviso viejo siguió reclamando para siempre. `documentoRenovado`
 * miraba la MISMA fila que había disparado el aviso, y esa fila nunca cambia.
 *
 * Con documentos de chofer y de camión no pasa: ahí sí se edita la fila (124 y 65
 * filas para 124 y 64 claves; una sola por papel). El certificado es mensual, así
 * que sin esto el reclamo se repetía todos los meses del año.
 *
 * La clave es "de qué papel, de quién": el mismo requisito para la misma unidad,
 * chofer o acoplado — y vacío en los tres cuando el papel es de la empresa.
 */
export type DocCompliance = {
  requisito_id: string;
  chofer_id?: string | null;
  camion_id?: string | null;
  acoplado_id?: string | null;
  fecha_vencimiento?: string | null;
};

export function claveComplianceDoc(d: DocCompliance): string {
  return [d.requisito_id, d.chofer_id ?? "", d.camion_id ?? "", d.acoplado_id ?? ""].join("|");
}

/**
 * El vencimiento más lejano cargado para cada papel — que es el que vale.
 *
 * Es el mismo criterio con el que `v_compliance_estado` arma la pantalla
 * (`order by fecha_vencimiento desc limit 1`), y por eso los dos números
 * terminan diciendo lo mismo.
 */
export function ultimoVencimientoPorClave(docs: DocCompliance[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of docs) {
    if (!d.fecha_vencimiento) continue;
    const k = claveComplianceDoc(d);
    const previo = out.get(k);
    if (!previo || d.fecha_vencimiento > previo) out.set(k, d.fecha_vencimiento);
  }
  return out;
}

/** `compliance:T30` / `form931:T5` y compañía — los preavisos, no el "vencido". */
const RE_PREAVISO_VENCIMIENTO = /^(?:compliance|form931):T\d+$/;

/**
 * ¿Este "vence en N días" quedó atrás porque la fecha ya pasó?
 *
 * Mismo criterio que `preavisoPrestamoPasado`, para compliance y para el F931.
 * Cuando la fecha pasa manda el aviso de vencido; dejar vivo el preaviso hacía
 * que el mismo papel apareciera dos veces y con los dos tiempos verbales a la
 * vez. Le pasaba al F931 de julio: "vence en 5 días" y "venció hace 1 día"
 * conviviendo, los dos en rojo.
 *
 * El de `vencido` no se toca: ése se reclama hasta que se presente.
 */
export function preavisoVencimientoPasado(
  entidadTipo: string | null | undefined,
  fechaVencimiento: string | null | undefined,
  hoyIso: string,
): boolean {
  if (!RE_PREAVISO_VENCIMIENTO.test(entidadTipo ?? "")) return false;
  if (!fechaVencimiento) return false;
  return fechaVencimiento < hoyIso;
}

export type ClasePrestamo = "vencido" | "gracia" | "inminente" | "semana";

/**
 * Días de gracia antes de reclamar una cuota como impaga.
 *
 * Sale de cómo trabajan de verdad (audio del 25/08/2026): *"pienso en tildarlos
 * cuando ya los veo descontados en la página… mañana, cuando los veo en el
 * banco que ingresó, ya les saco el tilde"*. El tilde va DESPUÉS del débito, no
 * el día del vencimiento.
 *
 * Sin gracia, el aviso crítico "venció y no figura pagada" salía justo el día
 * en que ella todavía no podía haberla tildado: un reclamo que no puede acertar
 * nunca, y de esos ya sabemos qué pasa — se dejan de leer todos.
 */
export const DIAS_GRACIA_CUOTA = 2;
export type DisparoPrestamo = {
  umbral: string;
  clase: ClasePrestamo;
  severidad: "info" | "advertencia" | "critica";
};

/**
 * El ÚNICO aviso que le corresponde hoy a una cuota impaga.
 *
 * Antes eran tres `if` sueltos con ventanas superpuestas (`dias <= 1` y
 * `dias <= 7` se pisaban), así que la misma cuota entraba como "vencida",
 * "por vencer" y "de esta semana" a la vez. En el mail del 10/08 Santander
 * 45/48 salió cinco veces y se leía "Mañana vence… Venció hace 2 días" en el
 * mismo bloque. Un estado por cuota, el más urgente, y se terminó.
 *
 * El recordatorio semanal sigue anclado al lunes a propósito: mientras la cuota
 * siga impaga vuelve a salir el lunes siguiente con clave nueva. Lo que faltaba
 * era apagar el de la semana anterior (ver `semanalDeSemanaPasada`).
 */
export function disparoPrestamo(dias: number, lunes: string): DisparoPrestamo | null {
  if (dias < -DIAS_GRACIA_CUOTA)
    return { umbral: "vencido", clase: "vencido", severidad: "critica" };
  // Recién vencida: el débito puede estar hecho y todavía no verse en el banco.
  // Se avisa, pero como recordatorio de tildar, no como reclamo.
  if (dias < 0) return { umbral: "gracia", clase: "gracia", severidad: "info" };
  if (dias <= 1) return { umbral: "T1", clase: "inminente", severidad: "advertencia" };
  if (dias <= 7) return { umbral: `S:${lunes}`, clase: "semana", severidad: "info" };
  return null;
}

const RE_SEMANAL = /^prestamo_cuota:S:(\d{4}-\d{2}-\d{2})$/;

/**
 * ¿Este recordatorio semanal es de una semana que ya terminó?
 *
 * El aviso semanal existe para volver a aparecer cada lunes, pero el de la
 * semana pasada no se apagaba: convivían `S:2026-08-03` y `S:2026-08-10` de la
 * misma cuota, y así se acumulaban 48 alertas para 29 cuotas reales.
 */
export function semanalDeSemanaPasada(
  entidadTipo: string | null | undefined,
  lunesActual: string,
): boolean {
  const m = RE_SEMANAL.exec(entidadTipo ?? "");
  return m ? m[1]! < lunesActual : false;
}

/**
 * ¿Este aviso de "va a vencer" quedó atrás porque la cuota ya venció?
 *
 * Cuando la fecha pasa, quien manda es la alerta de vencido. Dejar viva la de
 * preaviso es lo que hacía que el mail prometiera futuro sobre algo ya vencido.
 * La de `vencido` no se toca: se reclama hasta que se pague.
 */
export function preavisoPrestamoPasado(
  entidadTipo: string | null | undefined,
  fechaVencimiento: string | null | undefined,
  hoyIso: string,
): boolean {
  const tipo = entidadTipo ?? "";
  if (!tipo.startsWith("prestamo_cuota:")) return false;
  if (tipo === "prestamo_cuota:vencido") return false;
  if (!fechaVencimiento) return false;
  return fechaVencimiento < hoyIso;
}
