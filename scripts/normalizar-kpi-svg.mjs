/**
 * Deja listos para la pantalla los SVG generados de las tarjetas de Préstamos.
 *
 * Los dibujos salen de un generador de imágenes y vienen con tres cosas que no
 * sirven acá:
 *   · un bloque `<metadata>` de procedencia que pesa más que el dibujo;
 *   · el color de fondo que pidió el prompt, que el generador respeta cuando
 *     tiene ganas (dos de los cinco volvieron con fondo blanco y uno con azul
 *     puro en vez del azul de la marca);
 *   · `preserveAspectRatio="none"`, que deforma el dibujo si la caja no es
 *     exactamente cuadrada.
 *
 * Esto los normaliza: mismo fondo que la paleta del sistema, sin metadata y
 * escalando bien. Es idempotente — se puede correr de nuevo sobre los archivos
 * ya normalizados y no cambia nada.
 *
 *     node scripts/normalizar-kpi-svg.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "prestamos");

/** El fondo de cada placa. Son los mismos tonos que usa el resto del sistema. */
const FONDO = {
  "kpi-manana": "#FEF3E2",
  "kpi-semana": "#E0F2FE",
  "kpi-mes": "#0079BC",
  "kpi-vencidas": "#FDECEC",
  "kpi-al-dia": "#E7F8F1",
};

/** Colores del dibujo que hay que reemplazar (el generador metió su propia placa). */
const REEMPLAZOS = {
  // Vino con una placa rosa fuerte adentro de un fondo blanco: dos rectángulos
  // donde tiene que haber uno solo.
  "kpi-vencidas": [["rgb(254,202,202)", "#FDECEC"]],
};

/** El primer trazo de estos archivos es siempre el rectángulo del lienzo entero. */
const LIENZO = /(<path[^>]*?fill=")([^"]+)("[^>]*?d="M 0 0 L 2048 0 L 2048 2048 L 0 2048 L 0 0 z")/;

let tocados = 0;
for (const [nombre, fondo] of Object.entries(FONDO)) {
  const ruta = join(DIR, `${nombre}.svg`);
  const original = readFileSync(ruta, "utf8");
  let svg = original;

  svg = svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, "");
  svg = svg.replace(LIENZO, (_m, antes, _color, despues) => `${antes}${fondo}${despues}`);
  for (const [de, a] of REEMPLAZOS[nombre] ?? []) svg = svg.split(de).join(a);

  // Sin alto ni ancho fijos manda el CSS; con `meet` el dibujo nunca se estira.
  svg = svg.replace(/\s(width|height)="\d+"/g, "");
  svg = svg.replace(/preserveAspectRatio="none"/, 'preserveAspectRatio="xMidYMid meet"');

  if (svg !== original) {
    writeFileSync(ruta, svg);
    tocados += 1;
  }
  console.log(`${nombre}.svg → fondo ${fondo} (${(svg.length / 1024).toFixed(1)} KB)`);
}
console.log(tocados === 0 ? "Ya estaban normalizados." : `Normalizados: ${tocados}.`);
