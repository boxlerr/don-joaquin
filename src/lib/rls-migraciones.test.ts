import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guardarraíl: una tabla nueva no puede nacer sin RLS.
 *
 * El 20/07 `impuesto_archivos` se creó sin `enable row level security` y quedó
 * abierta a cualquier usuario logueado por REST hasta que Supabase lo avisó por
 * mail un mes después (17/08). El default de Postgres es "sin RLS", así que el
 * olvido no rompe nada ni se nota: sólo lo ve el linter de Supabase.
 *
 * Este test lee las migraciones y exige que cada `create table` de `public`
 * tenga su `alter table ... enable row level security` en alguna migración. Si
 * agregás una tabla y este test rompe, la respuesta casi siempre es prender RLS;
 * si de verdad tiene que quedar abierta, ponela en SIN_RLS_A_PROPOSITO con el
 * motivo escrito.
 */

const DIR_MIGRACIONES = path.join(process.cwd(), "supabase", "migrations");

/** Tablas que pueden vivir sin RLS, con el motivo. Hoy: ninguna. */
const SIN_RLS_A_PROPOSITO: Record<string, string> = {};

/** Saca comillas y el prefijo `public.` para comparar nombres de tabla. */
function normalizar(nombre: string): string {
  return nombre.replace(/"/g, "").replace(/^public\./, "").toLowerCase();
}

/** `create table [if not exists] <tabla>` — sólo las de public. */
const RE_CREATE = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/gi;
/** `alter table [if exists] <tabla> enable row level security` */
const RE_ENABLE_RLS =
  /alter\s+table\s+(?:if\s+exists\s+)?([a-z0-9_."]+)\s+enable\s+row\s+level\s+security/gi;

function leerMigraciones(): { archivo: string; sql: string }[] {
  return fs
    .readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((archivo) => ({
      archivo,
      sql: fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), "utf8"),
    }));
}

describe("RLS en las migraciones", () => {
  const migraciones = leerMigraciones();

  it("hay migraciones para revisar", () => {
    expect(migraciones.length).toBeGreaterThan(0);
  });

  it("toda tabla creada en public tiene enable row level security", () => {
    const creadas = new Map<string, string>(); // tabla → archivo donde se creó
    const conRls = new Set<string>();

    for (const { archivo, sql } of migraciones) {
      for (const m of sql.matchAll(RE_CREATE)) {
        const cruda = m[1].replace(/"/g, "");
        // Tablas de otros schemas (storage, auth) no las maneja este repo.
        if (cruda.includes(".") && !cruda.toLowerCase().startsWith("public.")) continue;
        const tabla = normalizar(cruda);
        if (!creadas.has(tabla)) creadas.set(tabla, archivo);
      }
      for (const m of sql.matchAll(RE_ENABLE_RLS)) conRls.add(normalizar(m[1]));
    }

    const sinRls = [...creadas.entries()]
      .filter(([tabla]) => !conRls.has(tabla) && !(tabla in SIN_RLS_A_PROPOSITO))
      .map(([tabla, archivo]) => `${tabla} (${archivo})`);

    expect(sinRls).toEqual([]);
  });
});
