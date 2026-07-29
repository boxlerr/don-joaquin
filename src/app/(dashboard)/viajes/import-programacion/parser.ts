/**
 * Programación de viajes de Loma Negra — el archivo que le llega a Nico.
 *
 * Hoy lo copia a mano en un papel: anota el número de transporte, y cuando le
 * da el viaje a alguien lo subraya y le escribe el nombre del chofer al lado.
 * Esto es exactamente eso, pero en el sistema: los viajes entran sin chofer y
 * después se asignan.
 *
 * El archivo es un Excel. Nico lo llamó "PDF" de memoria pero confirmó que
 * siempre le llega en Excel, así que se lee sólo ése — y si alguien sube un PDF
 * se lo dice con todas las letras en vez de intentar adivinar el layout.
 *
 * Cada etapa es un viaje suelto: así lo pidió. El número de orden queda igual
 * guardado, para poder ver después qué dos viajes eran del mismo circuito.
 */

/** Una etapa del archivo: una fila. */
export type FilaProgramacion = {
  /** Agrupa las etapas de un mismo circuito (ida y vuelta). */
  ordenFlete: string;
  etapa: number;
  /** 210061753 — el identificador real. */
  nroTransporte: string;
  /** 61753 — los últimos cinco dígitos, que es como lo anota Nico. */
  nroCorto: string;
  transPrevio: string | null;
  transPosterior: string | null;
  /** YYYY-MM-DD */
  fecha: string | null;
  /** A111, A109… la planta de esa etapa. */
  centro: string | null;
  claseViaje: string | null;
  /** A dónde va esa etapa. */
  destino: string | null;
  /** Localidad del destino, cuando el archivo la trae. */
  poblacion: string | null;
  material: string | null;
  /** Toneladas, ya convertidas desde los kilos del archivo. */
  toneladas: number | null;
};

export type Formato = "excel" | "pdf" | "desconocido";

/**
 * Qué es el archivo, mirando los bytes y no la extensión: un .xlsx renombrado
 * a .pdf sigue siendo un zip.
 */
export function detectarFormato(bytes: Uint8Array, nombre?: string): Formato {
  const empiezaCon = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  // %PDF
  if (empiezaCon(0x25, 0x50, 0x44, 0x46)) return "pdf";
  // PK.. → zip, que es lo que es un xlsx
  if (empiezaCon(0x50, 0x4b)) return "excel";
  // D0CF11E0 → OLE, el .xls viejo
  if (empiezaCon(0xd0, 0xcf, 0x11, 0xe0)) return "excel";

  // Sin firma reconocible, la extensión es lo único que queda.
  const ext = (nombre ?? "").toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") return "excel";
  return "desconocido";
}

/* ------------------------------------------------------------------ *
 * Normalización de valores
 * ------------------------------------------------------------------ */

export function limpiar(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/** Los últimos 5 dígitos del transporte: es como lo escribe Nico en el papel. */
export function corto(nroTransporte: string): string {
  const soloDigitos = nroTransporte.replace(/\D/g, "");
  return soloDigitos.slice(-5);
}

/**
 * Fecha a YYYY-MM-DD. El Excel puede traerla como texto, como Date o como
 * dd/mm/aaaa; se contemplan las tres.
 *
 * Ojo con el Date: en Excel una fecha es un día sin hora ni zona, y la librería
 * lo materializa a medianoche UTC. Leerlo con getDate() —que es hora local— nos
 * corría todo un día para atrás en Argentina: el archivo decía 28/07 y entraba
 * como 27/07. Por eso se lee en UTC.
 */
export function aFechaISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  const s = limpiar(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd/mm/aaaa o dd-mm-aaaa
  const local = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (local) {
    const [, d, m, y] = local;
    const anio = y!.length === 2 ? `20${y}` : y!;
    return `${anio}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Cantidad a toneladas. El archivo viene en KG; si la unidad dice TN se toma
 * tal cual, y si no dice nada se asume kilos, que es lo que manda Loma.
 */
export function aToneladas(cantidad: unknown, unidad: unknown): number | null {
  const n = Number(limpiar(cantidad).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = limpiar(unidad).toUpperCase();
  if (u.startsWith("TN") || u.startsWith("TON")) return n;
  return n / 1000;
}

/* ------------------------------------------------------------------ *
 * Excel
 * ------------------------------------------------------------------ */

/** Encabezado → clave interna. Se compara sin acentos ni mayúsculas. */
const COLUMNAS: Record<string, keyof FilaProgramacion | "cantidad" | "unidad"> = {
  "id orden flete": "ordenFlete",
  "n etapa": "etapa",
  "n transporte": "nroTransporte",
  "n trans previo": "transPrevio",
  "n trans posterior": "transPosterior",
  "fecha entrega": "fecha",
  centro: "centro",
  "clase de viaje": "claseViaje",
  "destinat mcia": "destino",
  "nombre cliente": "destino",
  poblacion: "poblacion",
  descripcion: "material",
  "ctd de pedido": "cantidad",
  "um venta": "unidad",
};

/** Clave de encabezado: sin acentos, sin puntuación, en minúscula. */
export function claveColumna(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bnro?\b/g, "n")
    .trim();
}

export type FilaCruda = (string | number | Date | null | undefined)[];

/**
 * Filas del Excel → programación. La primera fila es el encabezado y las
 * columnas se buscan por nombre, no por posición: si Loma agrega una columna en
 * el medio, no se rompe.
 */
export function parsearFilasExcel(filas: FilaCruda[]): {
  filas: FilaProgramacion[];
  columnasNoReconocidas: string[];
} {
  if (filas.length === 0) return { filas: [], columnasNoReconocidas: [] };

  const encabezado = filas[0]!.map((c) => claveColumna(limpiar(c)));
  const indice: Partial<Record<string, number>> = {};
  const noReconocidas: string[] = [];
  encabezado.forEach((clave, i) => {
    const destino = COLUMNAS[clave];
    // "Nombre cliente" y "Destinat.mcía." apuntan a lo mismo; gana el primero
    // que aparezca para no pisar el bueno con el de al lado.
    if (destino) {
      if (indice[destino] == null) indice[destino] = i;
    } else if (clave) {
      noReconocidas.push(clave);
    }
  });

  const val = (fila: FilaCruda, clave: string) => {
    const i = indice[clave];
    return i == null ? "" : limpiar(fila[i]);
  };
  const valCrudo = (fila: FilaCruda, clave: string) => {
    const i = indice[clave];
    return i == null ? null : (fila[i] ?? null);
  };

  const out: FilaProgramacion[] = [];
  for (const fila of filas.slice(1)) {
    const nroTransporte = val(fila, "nroTransporte");
    // Sin número de transporte no hay viaje que crear: es la clave de todo.
    if (!nroTransporte) continue;

    out.push({
      ordenFlete: val(fila, "ordenFlete"),
      etapa: Number(val(fila, "etapa")) || 1,
      nroTransporte,
      nroCorto: corto(nroTransporte),
      transPrevio: val(fila, "transPrevio") || null,
      transPosterior: val(fila, "transPosterior") || null,
      fecha: aFechaISO(valCrudo(fila, "fecha")),
      centro: val(fila, "centro") || null,
      claseViaje: val(fila, "claseViaje") || null,
      destino: val(fila, "destino") || null,
      poblacion: val(fila, "poblacion") || null,
      material: val(fila, "material") || null,
      toneladas: aToneladas(valCrudo(fila, "cantidad"), valCrudo(fila, "unidad")),
    });
  }

  return { filas: out, columnasNoReconocidas: [...new Set(noReconocidas)] };
}

/* ------------------------------------------------------------------ *
 * Agrupado en circuitos
 * ------------------------------------------------------------------ */

export type Circuito = {
  ordenFlete: string;
  etapas: FilaProgramacion[];
};

/**
 * Las etapas de un mismo flete, juntas. Cada una se importa como un viaje
 * aparte, pero agruparlas sirve para MOSTRAR el par en la pantalla de preview:
 * es como Nico los tiene en la cabeza (61753 con 61773).
 */
export function agruparEnCircuitos(filas: readonly FilaProgramacion[]): Circuito[] {
  const mapa = new Map<string, FilaProgramacion[]>();
  for (const f of filas) {
    // Sin orden de flete cada fila es su propio circuito.
    const clave = f.ordenFlete || `suelto:${f.nroTransporte}`;
    const arr = mapa.get(clave) ?? [];
    arr.push(f);
    mapa.set(clave, arr);
  }
  return [...mapa.entries()]
    .map(([ordenFlete, etapas]) => ({
      ordenFlete: ordenFlete.startsWith("suelto:") ? "" : ordenFlete,
      etapas: [...etapas].sort((a, b) => a.etapa - b.etapa),
    }))
    .sort((a, b) => {
      const fa = a.etapas[0]?.fecha ?? "";
      const fb = b.etapas[0]?.fecha ?? "";
      return fa.localeCompare(fb) || a.ordenFlete.localeCompare(b.ordenFlete);
    });
}

/**
 * El recorrido que describe un circuito: cada etapa va a un lugar, así que el
 * origen de una es el destino de la anterior. La primera no tiene origen en el
 * archivo — eso lo completa quien carga.
 */
export function tramosDelCircuito(c: Circuito): {
  nroTransporte: string;
  nroCorto: string;
  origen: string | null;
  destino: string | null;
  fecha: string | null;
  material: string | null;
  toneladas: number | null;
}[] {
  return c.etapas.map((e, i) => ({
    nroTransporte: e.nroTransporte,
    nroCorto: e.nroCorto,
    origen: i === 0 ? null : (c.etapas[i - 1]!.destino ?? null),
    destino: e.destino,
    fecha: e.fecha,
    material: e.material,
    toneladas: e.toneladas,
  }));
}
