import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guardarraíl: una variable de entorno no puede usarse sin quedar anotada.
 *
 * En Vercel había una `NEXT_PUBLIC_SITE_URL` cargada desde mayo que no la leía
 * nadie en el código (la que se mira se llama `NEXT_PUBLIC_APP_URL`), y del
 * otro lado el README mandaba a copiar un `.env.example` que ni existía. Nada
 * de eso rompe: simplemente el que abre el panel no tiene forma de saber qué
 * hace cada cosa, y edita una variable que no tiene ningún efecto.
 *
 * Este test cruza las dos listas:
 *   1. cada `process.env.X` del código tiene que estar en `.env.example`;
 *   2. cada variable de `.env.example` la tiene que leer alguien.
 *
 * Si rompe, la respuesta casi siempre es anotar la variable nueva en
 * `.env.example` Y en la tabla del README. Si de verdad no corresponde,
 * agregala a LAS_PONE_VERCEL con el motivo escrito.
 */

const RAIZ = process.cwd();
const CARPETAS = ["src", "scripts"];
const EXTENSIONES = new Set([".ts", ".tsx", ".mjs", ".js"]);
const IGNORAR = new Set(["node_modules", ".next", ".git", "dist", "build"]);

/**
 * Variables que el código lee pero NO van en `.env.example`, con el motivo.
 * Las inyecta la plataforma sola: cargarlas a mano es un error.
 */
const LAS_PONE_VERCEL: Record<string, string> = {
  NODE_ENV: "la define Node/Next según el comando (dev, build, test)",
  VERCEL_URL: "la inyecta Vercel: el host del deploy puntual",
  VERCEL_PROJECT_PRODUCTION_URL: "la inyecta Vercel: el dominio de producción",
};

/** `process.env.NOMBRE` — el único acceso que usa el código. */
const RE_USO = /process\.env\.([A-Z][A-Z0-9_]*)/g;
/** `NOMBRE=` al principio del renglón, sin contar los comentados. */
const RE_DOCUMENTADA = /^([A-Z][A-Z0-9_]*)=/gm;

function archivosDeCodigo(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) archivosDeCodigo(completo, acc);
    else if (EXTENSIONES.has(path.extname(entrada.name))) acc.push(completo);
  }
  return acc;
}

/** Todas las variables leídas por el código, con en qué archivo aparecen. */
function variablesUsadas(): Map<string, string[]> {
  const usos = new Map<string, string[]>();
  for (const carpeta of CARPETAS) {
    for (const archivo of archivosDeCodigo(path.join(RAIZ, carpeta))) {
      // El propio test nombra variables como texto de ejemplo; se saltea para
      // no exigirse a sí mismo que estén documentadas.
      if (archivo.endsWith("env-documentado.test.ts")) continue;
      const codigo = fs.readFileSync(archivo, "utf-8");
      for (const m of codigo.matchAll(RE_USO)) {
        const nombre = m[1];
        const rel = path.relative(RAIZ, archivo);
        const lista = usos.get(nombre) ?? [];
        if (!lista.includes(rel)) lista.push(rel);
        usos.set(nombre, lista);
      }
    }
  }
  return usos;
}

function variablesDocumentadas(): Set<string> {
  const ruta = path.join(RAIZ, ".env.example");
  expect(fs.existsSync(ruta), "falta .env.example en la raíz del repo").toBe(true);
  const texto = fs.readFileSync(ruta, "utf-8");
  return new Set([...texto.matchAll(RE_DOCUMENTADA)].map((m) => m[1]));
}

describe("variables de entorno", () => {
  it("todas las que usa el código están en .env.example", () => {
    const usadas = variablesUsadas();
    const documentadas = variablesDocumentadas();

    const sinAnotar = [...usadas.keys()]
      .filter((v) => !documentadas.has(v) && !(v in LAS_PONE_VERCEL))
      .sort()
      .map((v) => `${v} (usada en ${usadas.get(v)!.join(", ")})`);

    expect(
      sinAnotar,
      `Variables usadas por el código y no anotadas en .env.example:\n  ${sinAnotar.join("\n  ")}\n` +
        "Anotalas ahí Y en la tabla de 'Variables de entorno' del README.",
    ).toEqual([]);
  });

  it("todas las de .env.example las lee alguien", () => {
    const usadas = variablesUsadas();
    const documentadas = variablesDocumentadas();

    const muertas = [...documentadas].filter((v) => !usadas.has(v)).sort();

    expect(
      muertas,
      `Variables anotadas en .env.example que no lee nadie: ${muertas.join(", ")}.\n` +
        "O las lee alguien, o sobran: sacalas de .env.example (y del panel de Vercel).",
    ).toEqual([]);
  });

  it("las que inyecta la plataforma tienen el motivo escrito", () => {
    for (const [nombre, motivo] of Object.entries(LAS_PONE_VERCEL)) {
      expect(motivo.length, `${nombre} está exceptuada sin explicar por qué`).toBeGreaterThan(10);
    }
  });
});
