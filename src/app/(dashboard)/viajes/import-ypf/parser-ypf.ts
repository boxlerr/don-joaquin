import { extractText, getDocumentProxy } from "unpdf";

// ============================================================================
// Parser del PDF quincenal de YPF ("Documento de Medición / DM Joaquín Directa")
//
// 3 hojas:
//   1) Carátula / liquidación: tarifas (precio unitario por tonelada) por ruta
//      "Origen-Destino-Arena granel - Variable", + un "Pago Retroactivo".
//   2) Nivel de cumplimiento + bloques RETROACTIVOS por "Locación" (ADLA6,
//      BDTN12…) con su propia tarifa.
//   3) Detalle DM: una fila por viaje, agrupado en secciones por destino
//      (Añelo / Locación ADLA6 / Locación BDTN12). Cada sección tiene su tarifa.
//
// Cada destino tiene un precio distinto → el importe del viaje se calcula con la
// tarifa de SU sección, no con una sola tarifa global.
// ============================================================================

export type YpfTarifa = {
  ruta: string;
  origen: string;
  destino: string;
  precioUnitario: number;
};

export type YpfViajeRaw = {
  idx: number;
  fechaDescarga: string | null; // ISO YYYY-MM-DD
  remito: string | null;
  origen: string | null;
  destino: string | null;
  choferNombre: string;
  choferCuil: string; // 11 dígitos
  netoTn: number;
  precioUnitario: number | null;
  importe: number | null;
};

export type YpfParseResult = {
  quincenaDesde: string | null;
  quincenaHasta: string | null;
  tarifas: YpfTarifa[];
  viajes: YpfViajeRaw[];
  warnings: string[];
};

function parseArNum(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

function ddmmyyyyToIso(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export async function parseYpfPdf(buffer: Buffer | ArrayBuffer): Promise<YpfParseResult> {
  const bytes = buffer instanceof Buffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text : [text];
  const full = pages.join("\n");
  const warnings: string[] = [];

  // --- Quincena -----------------------------------------------------------
  let quincenaDesde: string | null = null;
  let quincenaHasta: string | null = null;
  const q = full.match(/entre:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*y:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (q) {
    quincenaDesde = ddmmyyyyToIso(q[1]);
    quincenaHasta = ddmmyyyyToIso(q[2]);
  }

  // --- Tarifas (precio unitario por destino) ------------------------------
  const tarifas: YpfTarifa[] = [];
  const seenDest = new Set<string>();
  const addTarifa = (origen: string, destino: string, precio: number) => {
    const d = destino.trim();
    if (!d || !(precio > 0) || seenDest.has(d.toUpperCase())) return;
    seenDest.add(d.toUpperCase());
    tarifas.push({ ruta: `${origen}-${d}`, origen: origen.trim(), destino: d, precioUnitario: precio });
  };

  // Hoja 1: servicios "Origen-Destino-Arena granel - Variable/TOP … <precio>$"
  // (el char class del nombre INCLUYE el guion para no perder el origen).
  const reRate =
    /([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .\/-]*?)-\s*Arena granel\s*-\s*(?:Variable|Variab|TOP)\s+[\d\s.,-]*?(\d{1,3}(?:\.\d{3})*,\d{2})\s*\$/g;
  let m: RegExpExecArray | null;
  while ((m = reRate.exec(full))) {
    const base = m[1].replace(/\s+/g, " ").trim(); // "Ibicuy-Añelo"
    const parts = base.split("-").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    addTarifa(parts.slice(0, -1).join("-"), parts[parts.length - 1], parseArNum(m[2]));
  }

  // Hoja 2: retroactivos "JOAQUIN HNOS <origen> Locación <destino> VARIABLE … <tn> $ <precio>"
  const reRetro =
    /JOAQUIN HNOS\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s+Locaci[oó]n\s+([A-Za-z0-9]+)\s+VARIABLE\s+\d{1,2}\/\d{1,2}\/\d{4}\s+al\s+\d{1,2}\/\d{1,2}\/\d{4}\s+[\d.]*,\d{2}\s*\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  while ((m = reRetro.exec(full))) {
    addTarifa(m[1], m[2], parseArNum(m[3]));
  }
  const tarifaPorDest = new Map<string, number>();
  for (const t of tarifas) tarifaPorDest.set(t.destino.toUpperCase(), t.precioUnitario);

  // --- Detalle (hoja 3) ---------------------------------------------------
  const detail = pages.find((p) => /Detalle DM|Neto en Tn/i.test(p)) ?? full;

  // Origen de la arena (constante en este DM): "Canteras Ibicuy".
  // Exige "Canteras" en plural para no capturar el encabezado "Cantera Producto".
  const origenMatch = detail.match(/Canteras\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+/);
  const origenArena = origenMatch ? origenMatch[0].replace(/\s+/g, " ").trim() : null;

  // Secciones por destino: el detalle va Añelo → Locación ADLA6 → Locación BDTN12.
  const idxADLA6 = detail.includes("Locación ADLA6") ? detail.indexOf("Locación ADLA6") : Infinity;
  const idxBDTN12 = detail.includes("Locación BDTN12") ? detail.indexOf("Locación BDTN12") : Infinity;
  const destinoEn = (pos: number): string =>
    pos < idxADLA6 ? "Añelo" : pos < idxBDTN12 ? "ADLA6" : "BDTN12";

  // Fechas y remitos por posición (carry-forward).
  const fechas: { i: number; iso: string }[] = [];
  for (const mm of detail.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)) {
    const iso = ddmmyyyyToIso(mm[1]);
    if (iso) fechas.push({ i: mm.index ?? 0, iso });
  }
  const remitos: { i: number; v: string }[] = [];
  for (const mm of detail.matchAll(/\b(\d{2,3}\.\d{3})\b/g)) {
    remitos.push({ i: mm.index ?? 0, v: mm[1].replace(".", "") });
  }

  // Viajes (anclados en "Apellido,Nombre - Joaquín Hnos. - <CUIL> - <nº> <neto>").
  const viajes: YpfViajeRaw[] = [];
  const reViaje =
    /([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+\s*,\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ .]*?)\s*-\s*Joaqu[ií]n Hnos\.?\s*-\s*(\d{11})\s*-\s*\d+\s+(\d{1,3}(?:\.\d{3})*,\d{1,2})/g;
  let idx = 0;
  while ((m = reViaje.exec(detail))) {
    const p = m.index;
    const choferNombre = m[1].replace(/\s+/g, " ").replace(/\s+,/, ",").trim();
    const choferCuil = m[2];
    const netoTn = parseArNum(m[3]);

    let fecha: string | null = null;
    for (const f of fechas) if (f.i < p) fecha = f.iso;
    let remito: string | null = null;
    for (const r of remitos) if (r.i < p) remito = r.v;

    const destino = destinoEn(p);
    const precio = tarifaPorDest.get(destino.toUpperCase()) ?? null;
    const importe = precio != null && Number.isFinite(netoTn) ? Math.round(netoTn * precio * 100) / 100 : null;

    viajes.push({
      idx: idx++,
      fechaDescarga: fecha,
      remito,
      origen: origenArena,
      destino,
      choferNombre,
      choferCuil,
      netoTn,
      precioUnitario: precio,
      importe,
    });
  }

  if (tarifas.length === 0) warnings.push("No se detectaron tarifas en el PDF.");
  if (viajes.length === 0) warnings.push("No se detectaron viajes en el detalle del PDF.");
  const sinPrecio = viajes.filter((v) => v.precioUnitario == null).length;
  if (sinPrecio > 0) warnings.push(`${sinPrecio} viaje(s) sin tarifa para su destino — revisar.`);

  // Precios sospechosos: las tarifas reales rondan los 100k/tn. Si una viene
  // por debajo de 1000 es muy probable que el regex haya capturado mal (p.ej.
  // un "1,00" residual). Lo marcamos para que el usuario lo revise antes de
  // confirmar la importación.
  const SOSPECHOSO_MAX = 1000;
  const tarifasSospechosas = tarifas.filter((t) => t.precioUnitario < SOSPECHOSO_MAX);
  if (tarifasSospechosas.length > 0) {
    const detalle = tarifasSospechosas
      .map((t) => `${t.destino} (${t.precioUnitario})`)
      .join(", ");
    warnings.push(
      `Precio unitario sospechosamente bajo en: ${detalle}. Revisar el PDF — ` +
        `las tarifas reales suelen superar los $${SOSPECHOSO_MAX.toLocaleString("es-AR")}/tn.`,
    );
  }

  return { quincenaDesde, quincenaHasta, tarifas, viajes, warnings };
}
