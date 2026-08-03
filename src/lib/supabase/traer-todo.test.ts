import { describe, it, expect } from "vitest";
import { traerTodo, traerEnLotes } from "./traer-todo";

/** Simula PostgREST: guarda las filas y responde respetando el rango pedido,
 *  cortando en `tope` como hace el server con max_rows. */
function fakeTabla(filas: number[], tope = 1000) {
  const pedidos: Array<[number, number]> = [];
  const consulta = (desde: number, hasta: number) => {
    pedidos.push([desde, hasta]);
    const fin = Math.min(hasta + 1, desde + tope);
    return Promise.resolve({ data: filas.slice(desde, fin), error: null });
  };
  return { consulta, pedidos };
}

describe("traerTodo", () => {
  it("trae todo cuando entra en una sola página", async () => {
    const { consulta, pedidos } = fakeTabla([1, 2, 3]);
    expect(await traerTodo(consulta)).toEqual([1, 2, 3]);
    expect(pedidos).toHaveLength(1); // no pide una segunda al pedo
  });

  it("junta varias páginas hasta agotar la tabla", async () => {
    const filas = Array.from({ length: 2350 }, (_, i) => i);
    const { consulta, pedidos } = fakeTabla(filas);
    const res = await traerTodo(consulta);
    expect(res).toHaveLength(2350);
    expect(res).toEqual(filas); // en orden y sin repetidos
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("no se queda corto cuando el total es múltiplo exacto del tope", async () => {
    // El borde que rompe los loops ingenuos: 1000 filas devuelven una página
    // llena y hay que preguntar de nuevo para saber que no hay más.
    const filas = Array.from({ length: 2000 }, (_, i) => i);
    const { consulta, pedidos } = fakeTabla(filas);
    expect(await traerTodo(consulta)).toHaveLength(2000);
    expect(pedidos).toHaveLength(3); // 0-999, 1000-1999, y la vacía que confirma
  });

  it("devuelve vacío sin explotar cuando no hay filas", async () => {
    const { consulta } = fakeTabla([]);
    expect(await traerTodo(consulta)).toEqual([]);
  });

  it("falla en vez de devolver datos incompletos", async () => {
    // Lo importante: NO devolver las filas que alcanzó a juntar. Media respuesta
    // se lee como una respuesta entera y ese es justo el bug que evitamos.
    let vuelta = 0;
    const consulta = (desde: number) => {
      vuelta++;
      return Promise.resolve(
        vuelta === 1
          ? { data: Array.from({ length: 1000 }, (_, i) => desde + i), error: null }
          : { data: null, error: { message: "se cayó la conexión" } },
      );
    };
    await expect(traerTodo(consulta, { etiqueta: "viajes" })).rejects.toThrow(/viajes.*se cayó la conexión/);
  });

  it("corta con error si la consulta nunca se agota", async () => {
    // Un orden inestable puede hacer que cada página venga llena para siempre.
    const consulta = (desde: number) =>
      Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => desde + i), error: null });
    await expect(traerTodo(consulta)).rejects.toThrow(/se pasó de/);
  });
});

describe("traerEnLotes", () => {
  it("trocea la lista de valores y junta todos los resultados", async () => {
    const valores = Array.from({ length: 750 }, (_, i) => `remito-${i}`);
    const lotesVistos: number[] = [];
    const res = await traerEnLotes(
      valores,
      (lote) => {
        lotesVistos.push(lote.length);
        return Promise.resolve({ data: lote.map((v) => ({ v })), error: null });
      },
      { tamLote: 300 },
    );
    expect(lotesVistos).toEqual([300, 300, 150]);
    expect(res).toHaveLength(750);
  });

  it("pagina dentro de cada lote", async () => {
    // Un lote de 300 remitos puede matchear más de 1000 filas.
    const res = await traerEnLotes(
      Array.from({ length: 300 }, (_, i) => i),
      (lote, desde, hasta) => {
        const total = 1500;
        const fin = Math.min(hasta + 1, total);
        void lote;
        return Promise.resolve({
          data: desde >= total ? [] : Array.from({ length: fin - desde }, (_, i) => desde + i),
          error: null,
        });
      },
      { tamLote: 300 },
    );
    expect(res).toHaveLength(1500);
  });

  it("no consulta nada si no hay valores", async () => {
    let llamadas = 0;
    const res = await traerEnLotes([], () => {
      llamadas++;
      return Promise.resolve({ data: [], error: null });
    });
    expect(res).toEqual([]);
    expect(llamadas).toBe(0);
  });
});
