import { describe, it, expect } from "vitest";
import { aplicarEnganches, soltarAcoplado } from "./acoplado-enganche";

/**
 * Base de mentira con lo justo de PostgREST que usa el módulo, más el índice
 * único de "un acoplado, un camión" (`camion_acoplados_una_abierta_por_acoplado`).
 *
 * El índice es el punto del ejercicio: la trampa acá es engancharle a un camión
 * un acoplado que todavía figura en otro, y eso en la base real no falla en el
 * código sino en el insert.
 */
type Fila = {
  id: string;
  camion_id: string;
  acoplado_id: string;
  desde: string;
  hasta: string | null;
};

function fakeDb(filas: Fila[]) {
  let seq = filas.length;
  const db = {
    filas,
    from(tabla: string) {
      if (tabla !== "camion_acoplados") throw new Error(`tabla inesperada: ${tabla}`);
      const filtros: ((f: Fila) => boolean)[] = [];
      const q = {
        select() {
          return q;
        },
        eq(col: keyof Fila, val: string) {
          filtros.push((f) => f[col] === val);
          return q;
        },
        in(col: keyof Fila, vals: string[]) {
          filtros.push((f) => vals.includes(f[col] as string));
          return q;
        },
        is(col: keyof Fila, val: null) {
          filtros.push((f) => f[col] === val);
          return q;
        },
        _match() {
          return db.filas.filter((f) => filtros.every((p) => p(f)));
        },
        maybeSingle() {
          return Promise.resolve({ data: q._match()[0] ?? null });
        },
        then(res: (v: { data: Fila[] }) => unknown) {
          return Promise.resolve({ data: q._match() }).then(res);
        },
        update(patch: Partial<Fila>) {
          const u = {
            eq(col: keyof Fila, val: string) {
              for (const f of db.filas) if (f[col] === val) Object.assign(f, patch);
              return Promise.resolve({ error: null });
            },
          };
          return u;
        },
        delete() {
          const d = {
            eq(col: keyof Fila, val: string) {
              db.filas = db.filas.filter((f) => f[col] !== val);
              return Promise.resolve({ error: null });
            },
          };
          return d;
        },
        insert(nuevas: Omit<Fila, "id">[]) {
          const arr = Array.isArray(nuevas) ? nuevas : [nuevas];
          for (const n of arr) {
            // El índice único parcial de la base.
            const choque = db.filas.find(
              (f) => f.acoplado_id === n.acoplado_id && f.hasta === null,
            );
            if (choque) {
              return Promise.resolve({
                error: { message: "duplicate key camion_acoplados_una_abierta_por_acoplado" },
              });
            }
            db.filas.push({ id: `n${++seq}`, hasta: null, ...n } as Fila);
          }
          return Promise.resolve({ error: null });
        },
      };
      return q;
    },
  };
  return db;
}

const HOY = "2026-09-01";
const abiertas = (db: ReturnType<typeof fakeDb>) =>
  db.filas
    .filter((f) => f.hasta === null)
    .map((f) => `${f.camion_id}:${f.acoplado_id}`)
    .sort();

describe("aplicarEnganches", () => {
  it("no toca nada si el camión ya lleva ese acoplado", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
    ]);
    const res = await aplicarEnganches(db, [{ camion_id: "cam-a", acoplado_id: "ac-1" }], HOY, "u1");

    expect(res.cambios).toEqual([]);
    expect(db.filas).toHaveLength(1);
  });

  it("cierra el enganche viejo con la fecha de hoy y abre el nuevo", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
    ]);
    await aplicarEnganches(db, [{ camion_id: "cam-a", acoplado_id: "ac-2" }], HOY, "u1");

    expect(db.filas.find((f) => f.id === "1")?.hasta).toBe(HOY);
    expect(abiertas(db)).toEqual(["cam-a:ac-2"]);
  });

  it("se lo saca al camión que lo tenía antes de engancharlo acá", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
      { id: "2", camion_id: "cam-b", acoplado_id: "ac-2", desde: "2026-05-28", hasta: null },
    ]);
    // El caso de Nico: el semi de cam-b pasa a cam-a.
    await aplicarEnganches(db, [{ camion_id: "cam-a", acoplado_id: "ac-2" }], HOY, "u1");

    expect(abiertas(db)).toEqual(["cam-a:ac-2"]);
    expect(db.filas.find((f) => f.id === "2")?.hasta).toBe(HOY);
  });

  it("intercambia los semis de dos camiones sin chocar con el índice único", async () => {
    // Sin soltar los dos ANTES de insertar, el primer insert choca.
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
      { id: "2", camion_id: "cam-b", acoplado_id: "ac-2", desde: "2026-05-28", hasta: null },
    ]);
    const res = await aplicarEnganches(
      db,
      [
        { camion_id: "cam-a", acoplado_id: "ac-2" },
        { camion_id: "cam-b", acoplado_id: "ac-1" },
      ],
      HOY,
      "u1",
    );

    expect(res.error).toBeUndefined();
    expect(abiertas(db)).toEqual(["cam-a:ac-2", "cam-b:ac-1"]);
  });

  it("deja al camión sin acoplado cuando se elige — sin semi —", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
    ]);
    await aplicarEnganches(db, [{ camion_id: "cam-a", acoplado_id: null }], HOY, "u1");

    expect(abiertas(db)).toEqual([]);
    expect(db.filas.find((f) => f.id === "1")?.hasta).toBe(HOY);
  });

  it("no toca los camiones que no vienen en la lista", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
      { id: "2", camion_id: "cam-z", acoplado_id: "ac-9", desde: "2026-05-28", hasta: null },
    ]);
    await aplicarEnganches(db, [{ camion_id: "cam-a", acoplado_id: null }], HOY, "u1");

    expect(db.filas.find((f) => f.id === "2")?.hasta).toBeNull();
  });

  it("devuelve el antes y el después de cada movimiento, para la auditoría", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
    ]);
    const res = await aplicarEnganches(db, [{ camion_id: "cam-a", acoplado_id: "ac-2" }], HOY, "u1");

    expect(res.cambios).toEqual([{ camion_id: "cam-a", de: "ac-1", a: "ac-2" }]);
  });
});

describe("soltarAcoplado", () => {
  it("borra el enganche en vez de cerrarlo si se había hecho hoy mismo", async () => {
    // Corregir un error del día no puede dejar escrito un periodo de un día que
    // nunca existió.
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: HOY, hasta: null },
    ]);
    const de = await soltarAcoplado(db, "ac-1", HOY);

    expect(de).toBe("cam-a");
    expect(db.filas).toHaveLength(0);
  });

  it("cierra el enganche si venía de antes: eso sí es historial", async () => {
    const db = fakeDb([
      { id: "1", camion_id: "cam-a", acoplado_id: "ac-1", desde: "2026-05-28", hasta: null },
    ]);
    await soltarAcoplado(db, "ac-1", HOY);

    expect(db.filas[0].hasta).toBe(HOY);
  });

  it("no rompe si el acoplado ya estaba suelto", async () => {
    const db = fakeDb([]);
    expect(await soltarAcoplado(db, "ac-1", HOY)).toBeNull();
  });
});
