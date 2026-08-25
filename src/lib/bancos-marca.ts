/**
 * Cómo se dibuja cada banco al lado de su nombre.
 *
 * Pedido de Julián (25/08/2026): que el banco se reconozca de un vistazo en la
 * lista de cheques, donde hoy hay 16 bancos distintos y todos se leen igual.
 *
 * **No son los logos de las marcas, y es a propósito.** Un logo ajeno metido en
 * el sistema trae dos problemas que no valen lo que resuelven: son marcas
 * registradas de terceros, y habría que bajar y versionar 16 imágenes que
 * cambian cuando el banco rediseña. Un monograma con el color de la marca da el
 * mismo golpe de vista —el naranja ES Galicia— sin ninguna de las dos cosas.
 *
 * La tabla `bancos` sólo guarda `nombre`, así que el match es por texto
 * normalizado. Un banco que no esté en la lista igual recibe su color, derivado
 * del nombre: siempre el mismo para el mismo banco, nunca dos grises iguales.
 */

import { normalizarTexto } from "@/lib/texto";

export type MarcaBanco = {
  /** Dos o tres letras. Es lo que se lee dentro del cuadradito. */
  sigla: string;
  /** Color de fondo del cuadradito. */
  color: string;
};

/**
 * Los bancos con los que trabajan, por la palabra que los identifica.
 *
 * Se busca por CONTENIDO, no por igualdad: en la base conviven "Banco Nación",
 * "Banco de la Nación Argentina" y "BNA" para el mismo banco, y ninguna forma
 * es más correcta que otra — se carga como viene del cheque.
 */
// Los colores están CORRIDOS de la marca donde hacía falta: Provincia,
// Credicoop y Patagonia usan los tres un verde casi igual, y un color que no
// separa no sirve para nada. Se mantiene la familia, se separa el tono.
const CONOCIDOS: { clave: string; sigla: string; color: string }[] = [
  { clave: "galicia", sigla: "GAL", color: "#F97316" },
  { clave: "nacion", sigla: "BNA", color: "#0E4C92" },
  { clave: "provincia", sigla: "BAP", color: "#00953B" },
  { clave: "santander", sigla: "SAN", color: "#EC0000" },
  { clave: "bbva", sigla: "BBVA", color: "#004481" },
  { clave: "frances", sigla: "BBVA", color: "#004481" },
  { clave: "macro", sigla: "MAC", color: "#0A2F5A" },
  { clave: "credicoop", sigla: "CRE", color: "#7A9E1F" },
  { clave: "supervielle", sigla: "SUP", color: "#A6192E" },
  { clave: "patagonia", sigla: "PAT", color: "#0D7A5F" },
  { clave: "icbc", sigla: "ICBC", color: "#C8102E" },
  { clave: "hsbc", sigla: "HSBC", color: "#DB0011" },
  { clave: "comafi", sigla: "COM", color: "#00539B" },
  { clave: "ciudad", sigla: "CIU", color: "#D6A400" },
  { clave: "hipotecario", sigla: "HIP", color: "#1B3D6D" },
  { clave: "itau", sigla: "ITA", color: "#EC7000" },
  { clave: "bind", sigla: "BIND", color: "#0057A8" },
  { clave: "industrial", sigla: "BIND", color: "#0057A8" },
  { clave: "santa fe", sigla: "BSF", color: "#2A6FAF" },
  { clave: "cordoba", sigla: "BCO", color: "#00847C" },
  { clave: "entre rios", sigla: "BER", color: "#7A1F3D" },
  { clave: "brubank", sigla: "BRU", color: "#5C2D91" },
  { clave: "mercado pago", sigla: "MP", color: "#00B1EA" },
];

/** Paleta del fallback: sobrias y distinguibles entre sí en las dos pieles. */
const FALLBACK = [
  "#475569", "#7C3AED", "#0F766E", "#B45309",
  "#9F1239", "#1D4ED8", "#4D7C0F", "#8B5CF6",
];

/**
 * Color estable para un banco que no está en la lista. El mismo nombre da
 * siempre el mismo color — si dependiera del orden de la lista, el color de un
 * banco cambiaría al dar de alta otro.
 */
function colorDerivado(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length]!;
}

/** Las iniciales de las dos primeras palabras que no sean "banco", "de", "del". */
function siglaDerivada(nombre: string): string {
  const vacias = new Set(["banco", "de", "del", "la", "el", "los", "las", "y", "sa"]);
  const palabras = normalizarTexto(nombre)
    .split(/\s+/)
    .filter((p) => p && !vacias.has(p));
  const base = palabras.length > 0 ? palabras : normalizarTexto(nombre).split(/\s+/).filter(Boolean);
  if (base.length === 0) return "??";
  if (base.length === 1) return base[0]!.slice(0, 3).toUpperCase();
  return (base[0]![0]! + base[1]![0]!).toUpperCase();
}

export function marcaDeBanco(nombre: string | null | undefined): MarcaBanco {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return { sigla: "—", color: "#94A3B8" };

  const norm = normalizarTexto(limpio);
  const conocido = CONOCIDOS.find((b) => norm.includes(b.clave));
  if (conocido) return { sigla: conocido.sigla, color: conocido.color };

  return { sigla: siglaDerivada(limpio), color: colorDerivado(norm) };
}
