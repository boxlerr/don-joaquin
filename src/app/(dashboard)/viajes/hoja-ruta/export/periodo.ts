// Período de la exportación de hojas de ruta.
// ----------------------------------------------------------------------------
// Empezó soportando sólo "el mes que estás viendo". La oficina pidió (31/07/2026)
// poder tirar un rango de fechas, así que la resolución del período se separó del
// route para poder testear los casos de borde: fechas que no existen, rango dado
// vuelta, mes mal escrito.

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type Periodo = {
  desde: string;
  hasta: string;
  /** Va en el nombre del archivo. */
  label: string;
  /** Va en el encabezado de cada hoja del Excel. */
  titulo: string;
};

/** Fecha ISO (YYYY-MM-DD) que además existe en el calendario (descarta 2026-02-31). */
export function esFechaISO(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map((x) => parseInt(x, 10));
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= new Date(y, m, 0).getDate();
}

function ddmmaaaa(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Período a exportar. Tres formas, en orden de prioridad:
 *   ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD  → rango libre
 *   ?mes=total                          → todo el histórico
 *   ?mes=YYYY-MM                        → un mes (forma original, sigue linkeada)
 * Un mes ausente o ilegible cae en el mes actual, como venía haciendo.
 */
export function resolverPeriodo(params: URLSearchParams): Periodo | { error: string } {
  const desde = (params.get("desde") ?? "").trim();
  const hasta = (params.get("hasta") ?? "").trim();

  // Alcanza con que venga una de las dos para tratarlo como rango: si mandaron
  // sólo "desde", exportar el mes entero sería devolver algo que no se pidió.
  if (desde || hasta) {
    if (!esFechaISO(desde) || !esFechaISO(hasta)) {
      return {
        error: "El rango de fechas no es válido. Usá el formato AAAA-MM-DD en 'desde' y 'hasta'.",
      };
    }
    if (desde > hasta) {
      return { error: "La fecha 'desde' es posterior a la de 'hasta'." };
    }
    return {
      desde,
      hasta,
      label: `${desde}_a_${hasta}`,
      titulo: `${ddmmaaaa(desde)} al ${ddmmaaaa(hasta)}`,
    };
  }

  const mesISO = (params.get("mes") ?? "").trim();
  if (mesISO === "total") {
    return {
      desde: "1900-01-01",
      hasta: "2999-12-31",
      label: "historico",
      titulo: "Histórico completo",
    };
  }

  let mes = mesISO;
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    const hoy = new Date();
    mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  }
  const [y, m] = mes.split("-").map((x) => parseInt(x, 10));
  if (m < 1 || m > 12) return { error: "El mes no es válido." };

  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    desde: `${y}-${mm}-01`,
    hasta: `${y}-${mm}-${String(last).padStart(2, "0")}`,
    label: mes,
    titulo: `${MESES[m - 1]} ${y}`,
  };
}

/** Trozo de nombre de archivo sin acentos ni caracteres que rompan el Content-Disposition. */
export function slugArchivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento sueltas que dejó el NFD
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
