/**
 * Plantilla HTML de los emails de alertas.
 *
 * A propósito NO depende del servidor (sin `server-only`, sin Supabase, sin
 * SMTP): recibe todo ya resuelto y devuelve un string. Así se puede renderizar
 * desde un script para previsualizar los diseños sin tocar la base.
 *
 * Identidad: fondo blanco, logo de Don Joaquín, azul de marca #0088D1 y la
 * misma paleta funcional que usa el sistema (ver design.md). Todo va con
 * estilos inline y tablas porque es lo único que respetan los clientes de mail.
 */

export type SeveridadEmail = "critica" | "advertencia" | "info";

export type AlertaEmailView = {
  titulo: string;
  mensaje: string;
  severidad: SeveridadEmail;
  fecha_vencimiento: string | null;
  /** Clave de CATEGORIA_ESTILO (la misma columna de la matriz de notificaciones). */
  categoria: string;
  /** Link ya resuelto a la vista in-app. */
  href: string;
  /**
   * Datos duros de la alerta (importe, banco, cuota, tasa…). Van en una grilla
   * aparte y no enterrados en la prosa: en un aviso de plata, el número tiene
   * que poder leerse sin leer la oración.
   */
  datos?: { label: string; valor: string; destacar?: boolean }[];
};

const SEV_STYLE: Record<SeveridadEmail, { label: string; bg: string; border: string; text: string }> = {
  critica: { label: "Crítica", bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D" },
  advertencia: { label: "Advertencia", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  info: { label: "Info", bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
};

/**
 * Identidad visual por tipo de aviso: cada categoría tiene su color, su ícono y
 * su nombre, así el mail se reconoce de un vistazo antes de leerlo. Las claves
 * son las columnas de la matriz de notificaciones, para que lo que se configura
 * y lo que llega por mail sean la misma cosa.
 *
 * LOS COLORES SALEN DEL MENÚ. Cada categoría toma el color del grupo del sidebar
 * donde vive su pantalla (`GRUPO_COLOR` en lib/areas-ui.ts): cheques, impuestos
 * y préstamos son ámbar porque están bajo FINANZAS; compliance es cyan;
 * cumpleaños y ausencias, verdes de RRHH; documentos y mantenimiento, índigo de
 * FLOTA. Pedido de Julián (27/08/2026): *"los colores, ¿pueden ser más fieles a
 * su sección del sidebar?"*. No es cosmético — es la misma idea que ya seguían
 * las etiquetas de las novedades: el aviso se tiñe como el lugar al que hay que
 * ir. Las que comparten grupo llevan tonos distintos de la misma familia para
 * seguir distinguiéndose entre sí.
 *
 * `bg` y `borde` se derivan del color mezclándolo con blanco (12% y 30%). Van en
 * hex y no en rgba porque el correo también lo lee Outlook.
 */
export const CATEGORIA_ESTILO: Record<
  string,
  { label: string; color: string; bg: string; borde: string; icono: string; cta: string }
> = {
  vencimiento_docs: {
    label: "Documentación",
    color: "#6366F1", bg: "#ECEDFD", borde: "#D0D1FB",
    icono: "📄", cta: "Ver documentación",
  },
  cheques_vencidos: {
    label: "Cheques",
    color: "#D97706", bg: "#FAEFE1", borde: "#F4D6B4",
    icono: "🧾", cta: "Ver cheques",
  },
  viaticos_sin_rendir: {
    label: "Viáticos",
    color: "#EA580C", bg: "#FCEBE2", borde: "#F9CDB6",
    icono: "💵", cta: "Ver viáticos",
  },
  gastos_pendientes: {
    label: "Gastos",
    color: "#CA8A04", bg: "#F9F1E1", borde: "#EFDCB4",
    icono: "🧮", cta: "Ver gastos",
  },
  cambios_caja: {
    label: "Caja",
    color: "#A16207", bg: "#F4ECE1", borde: "#E3D0B5",
    icono: "🏦", cta: "Ver caja",
  },
  nuevo_viaje: {
    label: "Viajes",
    color: "#0088D1", bg: "#E0F1F9", borde: "#B2DBF1",
    icono: "🚚", cta: "Ver viajes",
  },
  vencimiento_compliance: {
    label: "Compliance",
    color: "#0E7490", bg: "#E2EEF2", borde: "#B7D5DE",
    icono: "🛡️", cta: "Ver compliance",
  },
  prestamos_vencimiento: {
    label: "Préstamos",
    color: "#92400E", bg: "#F2E8E2", borde: "#DEC6B7",
    icono: "🏛️", cta: "Ver préstamos",
  },
  impuestos: {
    label: "Impuestos",
    color: "#B45309", bg: "#F6EAE1", borde: "#E8CBB5",
    icono: "🧾", cta: "Ver impuestos",
  },
  impuestos_personales: {
    label: "Impuestos personales",
    color: "#B45309", bg: "#F6EAE1", borde: "#E8CBB5",
    icono: "🧾", cta: "Ver impuestos",
  },
  mantenimiento: {
    label: "Mantenimiento",
    color: "#4338CA", bg: "#E8E7F9", borde: "#C7C3EF",
    icono: "🔧", cta: "Ver mantenimiento",
  },
  rrhh_eventos: {
    label: "Personal",
    color: "#059669", bg: "#E1F2ED", borde: "#B4E0D2",
    icono: "🎂", cta: "Ver personal",
  },
  ausencias_vacaciones: {
    label: "Ausencias y vacaciones",
    color: "#047857", bg: "#E1EFEB", borde: "#B4D6CD",
    icono: "🌴", cta: "Ver ausencias",
  },
  otros_avisos: {
    label: "Otros avisos",
    color: "#475569", bg: "#E9EBED", borde: "#C8CCD2",
    icono: "🔔", cta: "Ver aviso",
  },
};

function estiloDe(categoria: string) {
  return CATEGORIA_ESTILO[categoria] ?? CATEGORIA_ESTILO.otros_avisos!;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatFecha(f: string | null): string {
  if (!f) return "";
  const parts = f.split("-");
  if (parts.length !== 3) return f;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Estado del aviso, en un chip con color propio. Reemplaza al rótulo repetido
 * "CRÍTICA / ADVERTENCIA": lo que hace falta saber de un vistazo no es la
 * severidad abstracta sino CUÁNDO — vencido, hoy, o en cuántos días.
 */
function chipEstado(fecha: string | null, severidad: SeveridadEmail): string {
  const hoyISO = new Date().toISOString().slice(0, 10);

  let texto: string;
  let fondo: string;
  let color: string;
  let borde: string;

  if (!fecha) {
    const sev = SEV_STYLE[severidad];
    texto = sev.label;
    fondo = sev.bg; color = sev.text; borde = sev.border;
  } else {
    const d = diasHasta(fecha);
    if (d < 0) {
      texto = `Venció hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? "s" : ""}`;
      fondo = "#FEE2E2"; color = "#991B1B"; borde = "#FCA5A5";
    } else if (d === 0) {
      texto = "Vence hoy";
      fondo = "#FEE2E2"; color = "#991B1B"; borde = "#FCA5A5";
    } else if (d <= 7) {
      texto = d === 1 ? "Vence mañana" : `En ${d} días`;
      fondo = "#FEF3C7"; color = "#92400E"; borde = "#FDE68A";
    } else {
      texto = `En ${d} días`;
      fondo = "#F1F5F9"; color = "#475569"; borde = "#E2E8F0";
    }
    texto += ` · ${formatFecha(fecha)}`;
    void hoyISO;
  }

  return `<span style="display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.02em;color:${color};background:${fondo};border:1px solid ${borde};border-radius:4px;padding:4px 9px;">${escapeHtml(texto)}</span>`;
}

/** Días desde hoy hasta una fecha ISO (negativo = ya pasó). */
function diasHasta(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const hoy = new Date();
  const a = new Date(y, m - 1, d).getTime();
  const b = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

/** Hacia dónde apunta una cuenta de días: la fecha todavía viene, o ya pasó. */
type SentidoTiempo = "futuro" | "pasado";

/**
 * Presente ↔ pretérito de los verbos que acompañan a una cláusula de días.
 *
 * Es un repertorio cerrado a propósito: estos mensajes no los escribe una
 * persona, los redacta `generarAlertas()` (src/lib/alertas.ts). Lo que no está
 * acá no se conjuga a la fuerza — ver `sincronizarDias`.
 */
const VERBOS_TIEMPO: readonly (readonly [presente: string, pasado: string])[] = [
  ["vence", "venció"],
  ["vencen", "vencieron"],
  ["empieza", "empezó"],
  ["empiezan", "empezaron"],
];

/** El verbo en el tiempo que pide `sentido`, o null si no sabemos conjugarlo. */
function conjugar(verbo: string, sentido: SentidoTiempo): string | null {
  const v = verbo.toLowerCase();
  const par = VERBOS_TIEMPO.find(([presente, pasado]) => v === presente || v === pasado);
  if (!par) return null;
  const destino = sentido === "pasado" ? par[1] : par[0];
  // "Empieza en 3 días" abre la oración: si venía en mayúscula, se conserva.
  return verbo[0] !== verbo[0]!.toLowerCase()
    ? destino[0]!.toUpperCase() + destino.slice(1)
    : destino;
}

/**
 * Cláusula que cuenta días, con el verbo pegado adelante si lo tiene.
 *
 * "quedan" entra como conector porque el aviso de fin de período de prueba dice
 * "le quedan N días para finalizar…" y no caía en ningún patrón: la fila se crea
 * una sola vez (misma clave de dedup en los hitos de 30/15/5), así que a los 15
 * y a los 5 seguía diciendo 30 y contradecía al chip.
 *
 * El `(?! de\b)` evita los saldos: "N días de vacaciones" es una cantidad, no
 * una cuenta regresiva, y reescribirla sería inventar datos.
 */
const RE_CLAUSULA_DIAS = /(?:([^\s.,;:()]+) )?\b(hace|en|quedan) (\d+) días?\b(?! de\b)/gi;

/** Sin `g`: sólo se pregunta si la oración afirma "hoy", no se reemplaza nada. */
const RE_HOY = /\bhoy\b/i;

/**
 * Recalcula contra la fecha real las cuentas de días del texto.
 *
 * El mensaje de una alerta de tabla se escribe UNA vez, el día que se genera, y
 * el dedup impide regenerarla: la cuenta de días queda congelada ahí para
 * siempre. Como el chip de al lado sí se calcula en vivo, el correo terminaba
 * diciendo las dos cosas — "está vencido hace 35 días" arriba y "Venció hace 69
 * días" abajo, en el mismo aviso. Un sistema de alertas que se contradice a sí
 * mismo no lo lee nadie.
 *
 * No alcanza con el numeral: hay que corregir también el SENTIDO. A una alerta
 * ya vencida el texto le seguía prometiendo futuro ("vence en 10 días" al lado
 * de un chip que decía "Venció hace 10 días"), que es peor que el número viejo:
 * afirma un vencimiento que no existe.
 *
 * Dar vuelta el tiempo obliga a conjugar, y conjugar castellano con una regex no
 * se puede en general ("empieza" → "empezó" cambia la raíz). Por eso: los verbos
 * de VERBOS_TIEMPO se conjugan, y con cualquier otro se descarta la ORACIÓN
 * entera y el cuándo lo dice el chip, que se calcula en vivo y siempre está
 * bien. Se descarta la oración y no sólo las dos palabras porque recortar la
 * cláusula sola deja frases rotas ("le quedan para finalizar su período de
 * prueba"): es preferible decir menos que decir mal.
 *
 * Los textos que hablan de otra unidad ("hace más de 3 meses", "lleva 52 horas",
 * "cumple 7 años") no matchean y quedan intactos.
 */
export function sincronizarDias(mensaje: string, fecha: string | null): string {
  if (!fecha) return mensaje;
  const d = diasHasta(fecha);
  const sentido: SentidoTiempo = d < 0 ? "pasado" : "futuro";
  const n = Math.abs(d);
  const dias = `${n} día${n !== 1 ? "s" : ""}`;

  // Se trabaja oración por oración para poder soltar una entera sin tocar el
  // resto. El separador queda en las posiciones impares, así que volver a unir
  // el arreglo reconstruye el original tal cual. El punto sólo corta si le sigue
  // un espacio o el final: si no, "$1.000.000" se partiría en tres.
  const partes = mensaje.split(/([.!?]+(?=\s|$)\s*)/);
  let recortada = false;

  for (let i = 0; i < partes.length; i += 2) {
    const oracion = partes[i];
    if (!oracion) continue;

    let descartar = false;
    const corregida = oracion.replace(
      RE_CLAUSULA_DIAS,
      (todo: string, verbo: string | undefined, conector: string) => {
        const sentidoTexto: SentidoTiempo = conector.toLowerCase() === "hace" ? "pasado" : "futuro";
        // Mismo sentido: con corregir el numeral alcanza, la oración no cambia.
        if (sentidoTexto === sentido) {
          return verbo ? `${verbo} ${conector} ${dias}` : `${conector} ${dias}`;
        }
        const conjugado = verbo ? conjugar(verbo, sentido) : null;
        if (!conjugado) {
          descartar = true;
          return todo;
        }
        return `${conjugado} ${sentido === "pasado" ? "hace" : "en"} ${dias}`;
      },
    );

    // "hoy" es la misma mentira congelada, pero sin número que corregir: la
    // ausencia generada el 13/07 decía "Empieza hoy" y seguía diciéndolo el 5/08.
    // Aparece en las dos formas ("Empieza hoy", "Hoy vence la cuota…"), así que
    // en vez de conjugar a ciegas se suelta la oración y el chip —que se calcula
    // en vivo— dice el cuándo. `d === 0` es el único caso en que "hoy" es cierto.
    if (!descartar && d !== 0 && RE_HOY.test(corregida)) descartar = true;

    if (descartar) {
      partes[i] = "";
      if (i + 1 < partes.length) partes[i + 1] = "";
      recortada = true;
    } else {
      partes[i] = corregida;
    }
  }

  const salida = partes.join("");
  // Al soltar la última oración queda colgando el espacio del separador previo.
  return recortada ? salida.replace(/\s+$/, "") : salida;
}

/**
 * Un aviso dentro de su sección. La categoría ya la dice el encabezado de la
 * sección, así que acá no se repite: queda el título grande, el detalle y el
 * chip de cuándo vence.
 */
function renderAlerta(a: AlertaEmailView): string {
  const est = estiloDe(a.categoria);
  const meta = `<div style="margin-top:11px;">${chipEstado(a.fecha_vencimiento, a.severidad)}</div>`;
  const mensaje = sincronizarDias(a.mensaje, a.fecha_vencimiento);

  // Datos duros en dos columnas: etiqueta arriba, valor abajo. Los destacados
  // (el importe) van más grandes y en el color de la categoría.
  const datos = a.datos?.length
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:12px;border-collapse:collapse;">
         <tr>
           ${a.datos
             .map(
               (d) => `<td style="padding:0 22px 0 0;vertical-align:top;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94A3B8;">${escapeHtml(d.label)}</div>
                  <div style="font-size:${d.destacar ? "17" : "14"}px;font-weight:700;color:${d.destacar ? est.color : "#0F172A"};margin-top:3px;white-space:nowrap;">${escapeHtml(d.valor)}</div>
                </td>`,
             )
             .join("")}
         </tr>
       </table>`
    : "";

  return `
    <tr>
      <td style="padding:18px 0 20px 0;border-bottom:1px solid #EEF2F6;">
        <div style="font-size:17.5px;font-weight:800;color:#0F172A;line-height:1.35;letter-spacing:-.005em;">${escapeHtml(a.titulo)}</div>
        ${mensaje ? `<div style="font-size:14.5px;color:#475569;margin-top:6px;line-height:1.6;">${escapeHtml(mensaje)}</div>` : ""}
        ${datos}
        ${meta}
      </td>
    </tr>`;
}

/**
 * Encabezado de sección: la franja de color de la categoría con su nombre y
 * cuántos avisos trae. Es lo que hace que 48 avisos dejen de ser una lista
 * corrida y pasen a ser seis bloques que se reconocen sin leer.
 */
function renderSeccion(categoria: string, alertas: AlertaEmailView[], base: string): string {
  const est = estiloDe(categoria);
  const n = alertas.length;
  const vencidos = alertas.filter(
    (a) => a.fecha_vencimiento && diasHasta(a.fecha_vencimiento) < 0,
  ).length;

  const subtitulo = vencidos > 0
    ? `<div style="font-size:12.5px;font-weight:700;color:#B91C1C;margin-top:3px;">${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}</div>`
    : "";

  return `
  <tr><td style="padding:30px 0 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
      <tr>
        <td style="background:${est.bg};border-left:4px solid ${est.color};border-radius:0 6px 6px 0;padding:13px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:14px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${est.color};">
                  ${est.icono}&nbsp; ${escapeHtml(est.label)}
                </div>
                ${subtitulo}
              </td>
              <td align="right" style="vertical-align:middle;white-space:nowrap;">
                <span style="font-size:24px;font-weight:800;color:${est.color};line-height:1;">${n}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
      ${alertas.map(renderAlerta).join("")}
      <tr><td style="padding:14px 0 0 0;">
        <a href="${base}" style="font-size:13.5px;font-weight:700;color:${est.color};text-decoration:none;">${escapeHtml(est.cta)} &rarr;</a>
      </td></tr>
    </table>
  </td></tr>`;
}

/**
 * Layout del email: fondo blanco e identidad Don Joaquín. Cuando todas las
 * alertas son de la misma categoría, el encabezado toma el color de esa
 * categoría — así un aviso de préstamos y uno de cheques se distinguen de
 * entrada, sin leer una palabra.
 */
export function renderEmail(opts: {
  baseUrl: string;
  titulo: string;
  intro: string;
  alertas: AlertaEmailView[];
}): string {
  const base = opts.baseUrl;

  const categorias = new Set(opts.alertas.map((a) => a.categoria));
  const unica = categorias.size === 1 ? [...categorias][0]! : null;
  const acento = unica ? (CATEGORIA_ESTILO[unica] ?? null) : null;
  const colorAcento = acento?.color ?? "#0088D1";

  const kicker = acento
    ? `<div style="font-size:11px;font-weight:700;color:${colorAcento};letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(acento.label)}</div>`
    : "";

  // --- Agrupado por categoría ---
  // Cuarenta y ocho avisos en una lista corrida no se leen: no se ve dónde
  // termina compliance y empiezan los cheques. Agrupados, son seis bloques que
  // se reconocen por color antes de leer una palabra. Las secciones con algo
  // vencido van primero, y dentro de eso las más grandes.
  const grupos = new Map<string, AlertaEmailView[]>();
  for (const a of opts.alertas) {
    const arr = grupos.get(a.categoria) ?? [];
    arr.push(a);
    grupos.set(a.categoria, arr);
  }

  const vencidosDe = (as: AlertaEmailView[]) =>
    as.filter((a) => a.fecha_vencimiento && diasHasta(a.fecha_vencimiento) < 0).length;

  const ordenadas = [...grupos.entries()].sort((x, y) => {
    const vx = vencidosDe(x[1]);
    const vy = vencidosDe(y[1]);
    if ((vx > 0) !== (vy > 0)) return vy - vx;
    if (vx !== vy) return vy - vx;
    return y[1].length - x[1].length;
  });

  const totalVencidos = vencidosDe(opts.alertas);

  // Índice: el mapa del correo en seis renglones, para saber qué hay sin
  // scrollear hasta el final.
  const indice =
    ordenadas.length > 1
      ? `<tr><td style="padding:20px 0 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E2E8F0;border-radius:8px;border-collapse:separate;">
            ${ordenadas
              .map(([cat, as], i) => {
                const e = estiloDe(cat);
                const v = vencidosDe(as);
                return `<tr>
                  <td style="padding:11px 16px;${i > 0 ? "border-top:1px solid #F1F5F9;" : ""}">
                    <span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:${e.color};"></span>
                    <span style="font-size:14px;font-weight:700;color:#0F172A;padding-left:9px;">${escapeHtml(e.label)}</span>
                    ${v > 0 ? `<span style="font-size:12.5px;font-weight:700;color:#B91C1C;padding-left:8px;">${v} vencido${v !== 1 ? "s" : ""}</span>` : ""}
                  </td>
                  <td align="right" style="padding:11px 16px;${i > 0 ? "border-top:1px solid #F1F5F9;" : ""}">
                    <span style="font-size:16px;font-weight:800;color:${e.color};">${as.length}</span>
                  </td>
                </tr>`;
              })
              .join("")}
          </table>
        </td></tr>`
      : "";

  const secciones = ordenadas.map(([cat, as]) => renderSeccion(cat, as, `${base}/notificaciones`)).join("");

  const boton = `<tr><td style="padding:32px 0 0 0;border-top:1px solid #E2E8F0;">
         <a href="${base}/notificaciones" style="display:inline-block;background:${colorAcento};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;border-radius:6px;">Ver todo en el sistema</a>
       </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.titulo)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff" style="background:#ffffff;">
    <tr><td align="center" style="padding:28px 12px 36px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;">

        <!-- Membrete -->
        <tr><td style="padding:0 4px 14px 4px;border-bottom:2px solid #0F172A;">
          <img src="${base}/logo-horizontal.png" alt="Don Joaquín" width="180"
               style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:180px;">
        </td></tr>

        <!-- Título -->
        <tr><td style="padding:26px 4px 2px 4px;">
          ${kicker}
          <div style="font-size:26px;font-weight:800;color:#0F172A;line-height:1.2;letter-spacing:-.02em;">${escapeHtml(opts.titulo)}</div>
          <div style="font-size:15px;color:#475569;margin-top:9px;line-height:1.6;">${escapeHtml(opts.intro)}</div>
          ${
            totalVencidos > 0
              ? `<div style="font-size:15px;font-weight:800;color:#B91C1C;margin-top:8px;">${totalVencidos} ${totalVencidos === 1 ? "ya está vencido" : "ya están vencidos"}.</div>`
              : ""
          }
        </td></tr>

        <!-- Índice -->
        ${indice ? `<tr><td style="padding:0 4px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">${indice}</table></td></tr>` : ""}

        <!-- Secciones -->
        <tr><td style="padding:0 4px 0 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${secciones}
            ${boton}
          </table>
        </td></tr>

        <!-- Pie -->
        <tr><td style="padding:26px 4px 0 4px;">
          <div style="border-top:1px solid #E2E8F0;padding-top:14px;">
            <div style="font-size:12px;font-weight:700;color:#0088D1;">Don Joaquín Hnos SRL</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:5px;line-height:1.6;">
              Aviso automático del sistema de gestión. Para dejar de recibir estos correos,
              ajustá tus avisos en <span style="color:#64748B;">Configuración → Notificaciones</span>.
            </div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}


/* ─────────────────────────────────────────────────────────────────────────── *
 *  CIERRE DE CAJA DEL DÍA
 *
 *  Un solo correo, cuando cierra el sistema, con todo lo que entró y salió.
 *
 *  Nació como un aviso por CADA movimiento y duró unas horas: "cada email de
 *  cada movimiento llenaría la bandeja y sería súper molesto" (Julián,
 *  24/08/2026). Es la diferencia entre enterarse y ser notificado — de una caja
 *  que se carga todo el día no hace falta enterarse movimiento por movimiento,
 *  hace falta ver cómo cerró.
 *
 *  Por eso el orden: primero los tres números del día, después con cuánto quedó
 *  cada caja, y recién al final el detalle. El que sólo quiere saber si cuadra
 *  no baja del primer bloque.
 * ─────────────────────────────────────────────────────────────────────────── */

export type MovimientoResumenView = {
  concepto: string;
  /** El tipo tal como se ve en la caja: "Cubiertas", "Cobro a cliente"… */
  tipo: string;
  medio: string;
  /** Quién lo cargó. En un cierre del día es de lo primero que se pregunta. */
  usuario: string | null;
  /** Ya formateado (`10.000,00`). */
  monto: string;
  esIngreso: boolean;
  /** "Caja chica" / "Caja general". Sólo se muestra si el correo trae las dos. */
  caja: string;
};

export type ResumenCajaEmailView = {
  /** El día en prosa: "lunes 24 de agosto". */
  fechaLarga: string;
  /** Todos formateados por el que llama. */
  ingresos: string;
  egresos: string;
  neto: string;
  netoPositivo: boolean;
  /** Cuántos movimientos hubo en el día (todos, no sólo los listados). */
  cantidad: number;
  /** Con cuánto quedó cada caja: [{ label: "Caja chica", monto: "652.722,00" }]. */
  saldos: { label: string; monto: string }[];
  movimientos: MovimientoResumenView[];
  /** Cuántos movimientos del día NO se listan para este destinatario. */
  noListados: number;
  /** true si el correo mezcla las dos cajas (entonces se muestra la columna). */
  mostrarCaja: boolean;
};

function celdaNumero(
  label: string,
  valor: string,
  color: string,
  borde: boolean,
  signo = "",
): string {
  return `<td width="33%" style="padding:14px 12px;${borde ? "border-left:1px solid #E2E8F0;" : ""}vertical-align:top;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748B;">${escapeHtml(label)}</div>
      <div style="font-size:20px;font-weight:800;color:${color};margin-top:5px;white-space:nowrap;">${signo}$ ${escapeHtml(valor)}</div>
    </td>`;
}

export function renderEmailResumenCaja(opts: {
  baseUrl: string;
  resumen: ResumenCajaEmailView;
}): string {
  const base = opts.baseUrl;
  const r = opts.resumen;
  const est = CATEGORIA_ESTILO.cambios_caja!;
  const VERDE = "#059669";
  const ROJO = "#E11D48";

  const numeros = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;border:1px solid #E2E8F0;border-radius:8px;border-collapse:separate;">
      <tr>
        ${celdaNumero("Entró", r.ingresos, VERDE, false)}
        ${celdaNumero("Salió", r.egresos, ROJO, true)}
        <!-- El neto lleva el signo escrito: si el color fuera lo único que
             distingue "quedaron 412 mil" de "faltan 412 mil", el correo se lee
             al revés en cualquier cliente que no respete los colores. -->
        ${celdaNumero("Neto", r.neto, r.netoPositivo ? VERDE : ROJO, true, r.netoPositivo ? "+ " : "− ")}
      </tr>
    </table>`;

  const saldos = r.saldos.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;border-collapse:separate;">
         ${r.saldos
           .map(
             (s) => `<tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;">
                 <span style="font-size:13px;color:#64748B;">Con cuánto quedó la ${escapeHtml(s.label.toLowerCase())}</span>
                 <div style="font-size:20px;font-weight:800;color:#0F172A;margin-top:3px;">$ ${escapeHtml(s.monto)}</div>
               </td></tr>
               <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>`,
           )
           .join("")}
       </table>`
    : "";

  const filas = r.movimientos
    .map(
      (m, i) => `<tr>
        <td style="padding:11px 14px;${i > 0 ? "border-top:1px solid #F1F5F9;" : ""}">
          <div style="font-size:14px;font-weight:700;color:#0F172A;line-height:1.35;">${escapeHtml(m.concepto)}</div>
          <div style="font-size:12px;color:#64748B;margin-top:3px;">${[
            m.tipo,
            m.medio,
            r.mostrarCaja ? m.caja : null,
            m.usuario,
          ]
            .filter(Boolean)
            .map((x) => escapeHtml(String(x)))
            .join(" · ")}</div>
        </td>
        <td align="right" style="padding:11px 14px;${i > 0 ? "border-top:1px solid #F1F5F9;" : ""}white-space:nowrap;font-size:14px;font-weight:800;color:${m.esIngreso ? VERDE : ROJO};">
          ${m.esIngreso ? "+" : "−"} $ ${escapeHtml(m.monto)}
        </td>
      </tr>`,
    )
    .join("");

  const detalle = r.movimientos.length
    ? `<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748B;margin:26px 0 8px 0;">
         ${r.movimientos.length === 1 ? "El movimiento del día" : `Los ${r.movimientos.length} movimientos del día`}
       </div>
       <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E2E8F0;border-radius:8px;border-collapse:separate;">
         ${filas}
       </table>`
    : "";

  // Si al destinatario no le corresponden todos, se dice — así nadie intenta
  // cuadrar la lista contra los totales y cree que faltan movimientos.
  const aclaracion =
    r.noListados > 0
      ? `<div style="font-size:12px;color:#64748B;margin-top:10px;">
           Los totales incluyen ${r.noListados === 1 ? "un movimiento que no se detalla" : `${r.noListados} movimientos que no se detallan`} acá.
         </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cierre de caja</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff" style="background:#ffffff;">
    <tr><td align="center" style="padding:28px 12px 36px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;">

        <tr><td style="padding:0 4px 14px 4px;border-bottom:2px solid #0F172A;">
          <img src="${base}/logo-horizontal.png" alt="Don Joaquín" width="180"
               style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:180px;">
        </td></tr>

        <tr><td style="padding:26px 4px 2px 4px;">
          <div style="font-size:11px;font-weight:700;color:${est.color};letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px;">${est.icono}&nbsp; ${escapeHtml(est.label)}</div>
          <div style="font-size:26px;font-weight:800;color:#0F172A;line-height:1.2;letter-spacing:-.02em;">Cierre de caja</div>
          <div style="font-size:15px;color:#475569;margin-top:9px;line-height:1.6;">
            ${escapeHtml(r.fechaLarga)} — ${r.cantidad === 1 ? "1 movimiento" : `${r.cantidad} movimientos`}.
          </div>
          ${numeros}
          ${saldos}
          ${detalle}
          ${aclaracion}
        </td></tr>

        <tr><td style="padding:26px 4px 0 4px;">
          <a href="${base}/caja" style="display:inline-block;background:${est.color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;border-radius:6px;">Ver la caja</a>
        </td></tr>

        <tr><td style="padding:26px 4px 0 4px;">
          <div style="border-top:1px solid #E2E8F0;padding-top:14px;">
            <div style="font-size:12px;font-weight:700;color:#0088D1;">Don Joaquín Hnos SRL</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:5px;line-height:1.6;">
              Aviso automático del sistema de gestión. Para dejar de recibir estos correos,
              ajustá tus avisos en <span style="color:#64748B;">Configuración → Notificaciones</span>.
            </div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
