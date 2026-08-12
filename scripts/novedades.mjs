#!/usr/bin/env node
/**
 * Pasa las novedades del mensaje de commit a `src/lib/novedades.ts`.
 *
 * El problema que resuelve: la lista de novedades es a mano (y tiene que
 * seguir siéndolo — un mensaje de commit habla de archivos y de causas, y lo
 * que hay que contarle a quien usa la pantalla es qué puede hacer ahora). Pero
 * "a mano" venía significando "me acuerdo o no me acuerdo", y la mitad de los
 * cambios de la semana del 11/08 salieron a producción sin anunciarse.
 *
 * Así que la frase se sigue escribiendo a mano, pero se escribe UNA vez y en el
 * lugar donde ya estás: el commit.
 *
 *     Novedad: mejora | compliance | Cargá un documento sin buscarlo entre 848 | Tocá "Agregar documento", elegí cuál y de quién. | /compliance
 *
 * Campos, separados por `|`:  tipo | ver | título | detalle? | href?
 *   · tipo  → nuevo | mejora | arreglo
 *   · ver   → el permiso que hace falta para verla: una subsección
 *             (`choferes_vacaciones`), un área (`compliance`) o `todos`.
 *   · resto → lo que se lee en la pantalla.
 *
 * Un commit puede llevar varias líneas `Novedad:`. Si el cambio no se nota
 * (refactor, tests, tipos), se declara explícito con `Novedad: ninguna` y el
 * chequeo deja pasar.
 *
 * A propósito NO valida el código de `ver`: lo valida `tsc` al compilar, contra
 * el catálogo real de secciones y áreas. Duplicar acá esa lista sería tener dos
 * fuentes de verdad, y la copia siempre queda vieja.
 *
 * El flujo, en orden (el trailer recién existe una vez hecho el commit):
 *
 *     git commit -m "..." -m "Novedad: mejora | compliance | ... "
 *     npm run novedades
 *     git commit --amend --no-edit -- src/lib/novedades.ts   # o un commit aparte
 *     git push
 *
 * Uso:
 *   node scripts/novedades.mjs            → escribe lo que falte (idempotente)
 *   node scripts/novedades.mjs --dry      → muestra qué escribiría, sin tocar nada
 *   node scripts/novedades.mjs --check    → falla si hay algo visible sin anunciar
 *   node scripts/novedades.mjs --desde=<ref>
 *   node scripts/novedades.mjs --agregar "mejora | compliance | Título | Detalle | /href"
 *
 * Por defecto mira los commits que todavía no están en `origin/main`: es
 * exactamente lo que estás por subir.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ARCHIVO = "src/lib/novedades.ts";
const MARCADOR = "export const NOVEDADES: Novedad[] = [";
const TIPOS = ["nuevo", "mejora", "arreglo"];

/** Rutas donde un cambio SE NOTA. Tocarlas sin anunciar nada es lo que avisa `--check`. */
const RUTAS_VISIBLES = [/^src\/app\/\(dashboard\)\//, /^src\/components\//];

const args = process.argv.slice(2);
const tieneFlag = (f) => args.includes(f);
/** Acepta las dos formas: `--flag=valor` y `--flag valor`. */
const valorDe = (f) => {
  const pegado = args.find((a) => a.startsWith(`${f}=`));
  if (pegado) return pegado.slice(f.length + 1);
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};

const DRY = tieneFlag("--dry");
const CHECK = tieneFlag("--check");

function git(...params) {
  return execFileSync("git", params, {
    encoding: "utf8",
    // Las fechas en hora de Argentina: la novedad tiene que decir el día que se
    // subió acá, no el que era en UTC.
    env: { ...process.env, TZ: "America/Argentina/Buenos_Aires" },
  }).trim();
}

/** Desde dónde mirar. `origin/main` = lo que falta pushear. */
function rango() {
  const desde = valorDe("--desde");
  if (desde) return `${desde}..HEAD`;
  try {
    git("rev-parse", "--verify", "--quiet", "origin/main");
    return "origin/main..HEAD";
  } catch {
    // Repo recién clonado o sin remoto: los últimos 20 alcanzan de sobra.
    return "HEAD~20..HEAD";
  }
}

const SEP = "\x1f"; // separador de campos, imposible en un mensaje de commit
const FIN = "\x1e"; // separador de commits

function commits() {
  const salida = git(
    "log",
    rango(),
    `--pretty=format:%H${SEP}%ad${SEP}%B${FIN}`,
    "--date=format-local:%Y-%m-%d",
  );
  if (!salida) return [];
  return salida
    .split(FIN)
    .map((bloque) => bloque.trim())
    .filter(Boolean)
    .map((bloque) => {
      const [sha, fecha, cuerpo] = bloque.split(SEP);
      return { sha, fecha, cuerpo: cuerpo ?? "" };
    });
}

/** Archivos que tocó un commit. */
function archivosDe(sha) {
  return git("show", "--name-only", "--pretty=format:", sha).split("\n").filter(Boolean);
}

const LARGO_ID = 44;

function slug(titulo) {
  const base = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= LARGO_ID) return base;
  // Corta en la última palabra entera: un id partido al medio ("…-cad") es
  // ilegible justo cuando hace falta, que es al buscarlo dentro del archivo.
  return base.slice(0, LARGO_ID).replace(/-[^-]*$/, "");
}

/** Una línea `Novedad: …` → el objeto que va en la lista. */
function parsear(linea, fecha) {
  const crudo = linea.slice("Novedad:".length).trim();
  if (!crudo || crudo.toLowerCase() === "ninguna") return null;

  const campos = crudo.split("|").map((c) => c.trim());
  const [tipo, ver, titulo, detalle, href] = campos;

  if (!TIPOS.includes(tipo)) {
    throw new Error(
      `Novedad con tipo "${tipo ?? ""}": tiene que ser ${TIPOS.join(", ")}.\n  → ${crudo}`,
    );
  }
  if (!ver) throw new Error(`Novedad sin "ver" (el permiso para verla).\n  → ${crudo}`);
  if (!titulo) throw new Error(`Novedad sin título.\n  → ${crudo}`);

  return {
    id: slug(titulo),
    fecha,
    tipo,
    ver,
    titulo,
    detalle: detalle || undefined,
    href: href || undefined,
  };
}

function novedadesDeCommits() {
  const out = [];
  for (const c of commits()) {
    for (const linea of c.cuerpo.split("\n")) {
      if (!/^\s*Novedad:/i.test(linea)) continue;
      const n = parsear(linea.trim(), c.fecha);
      if (n) out.push(n);
    }
  }
  return out;
}

/** Comillas dobles y barras, que van adentro de un string de TypeScript. */
function texto(valor) {
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function comoCodigo(n) {
  const lineas = [
    "  {",
    `    id: ${texto(n.id)},`,
    `    fecha: ${texto(n.fecha)},`,
    `    tipo: ${texto(n.tipo)},`,
    `    ver: ${texto(n.ver)},`,
    `    titulo: ${texto(n.titulo)},`,
  ];
  if (n.detalle) lineas.push(`    detalle: ${texto(n.detalle)},`);
  if (n.href) lineas.push(`    href: ${texto(n.href)},`);
  lineas.push("  },");
  return lineas.join("\n");
}

function escribir(nuevas) {
  const original = readFileSync(ARCHIVO, "utf8");
  const corte = original.indexOf(MARCADOR);
  if (corte === -1) {
    throw new Error(`No encontré "${MARCADOR}" en ${ARCHIVO}. ¿Cambió el nombre de la lista?`);
  }

  // Idempotente: si el id ya está, no se vuelve a escribir. Correr el script dos
  // veces (o después de un rebase) no puede duplicar renglones.
  const pendientes = nuevas.filter((n) => !original.includes(`id: "${n.id}"`));
  if (pendientes.length === 0) return { escritas: [], yaEstaban: nuevas.length };

  // Las más nuevas arriba, igual que la lista.
  pendientes.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const desde = corte + MARCADOR.length;
  const salida =
    original.slice(0, desde) + "\n" + pendientes.map(comoCodigo).join("\n") + original.slice(desde);

  if (!DRY) writeFileSync(ARCHIVO, salida);
  return { escritas: pendientes, yaEstaban: nuevas.length - pendientes.length };
}

/** ¿Hay commits que se notan y no anuncian nada? */
function faltantes() {
  const out = [];
  for (const c of commits()) {
    if (/^\s*Novedad:/im.test(c.cuerpo)) continue;
    const visibles = archivosDe(c.sha).filter((f) => RUTAS_VISIBLES.some((r) => r.test(f)));
    if (visibles.length > 0) {
      out.push({ sha: c.sha.slice(0, 7), titulo: c.cuerpo.split("\n")[0], archivos: visibles.length });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

try {
  const sueltas = valorDe("--agregar");
  const nuevas = sueltas
    ? [parsear(`Novedad: ${sueltas}`, git("log", "-1", "--date=format-local:%Y-%m-%d", "--pretty=%ad"))].filter(Boolean)
    : novedadesDeCommits();

  if (CHECK) {
    const sin = faltantes();
    if (sin.length === 0) {
      console.log("✓ Todos los commits que se notan anuncian su novedad.");
      process.exit(0);
    }
    console.error(`\n✗ ${sin.length} commit(s) tocan pantallas y no anuncian nada:\n`);
    for (const c of sin) console.error(`  ${c.sha}  ${c.titulo}  (${c.archivos} archivos)`);
    console.error(
      "\nAgregá al mensaje del commit una línea así:\n" +
        "  Novedad: mejora | compliance | Qué se puede hacer ahora | Cómo era antes o dónde está | /compliance\n" +
        "Si el cambio no se nota (tests, tipos, refactor), declaralo:\n" +
        "  Novedad: ninguna\n",
    );
    process.exit(1);
  }

  if (nuevas.length === 0) {
    console.log("No hay novedades para pasar (ningún commit trae la línea `Novedad:`).");
    process.exit(0);
  }

  const { escritas, yaEstaban } = escribir(nuevas);
  if (yaEstaban > 0) console.log(`· ${yaEstaban} ya estaban en la lista.`);
  if (escritas.length === 0) {
    console.log("Nada nuevo que escribir.");
    process.exit(0);
  }
  console.log(`${DRY ? "Escribiría" : "Escribí"} ${escritas.length} novedad(es) en ${ARCHIVO}:\n`);
  for (const n of escritas) console.log(`  [${n.tipo}] ${n.titulo}`);
  if (DRY) console.log("\n(--dry: no se tocó el archivo)");
  else console.log("\nRevisá cómo quedó redactado antes de subirlo.");
} catch (e) {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
}
