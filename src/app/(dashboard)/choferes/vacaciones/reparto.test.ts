import { describe, it, expect } from "vitest";
import { repartirEntreAnios, tramosConFechas, type SaldoAnio } from "./derivar";

const saldo = (anio: number, otorgados: number, usados: number): SaldoAnio => ({
  anio,
  otorgados,
  usados,
  saldo: otorgados - usados,
  observaciones: null,
});

describe("repartirEntreAnios", () => {
  it("si el saldo del año más viejo alcanza, no parte nada", () => {
    const saldos = [saldo(2025, 14, 0), saldo(2026, 14, 0)];
    expect(repartirEntreAnios(saldos, "2026-08-17", 7)).toEqual([{ anio: 2025, dias: 7 }]);
  });

  it("EL CASO DE BÁRBARA: 14 días con 7 de saldo viejo se parten en dos años", () => {
    // 2025 tenía 14 otorgados y 7 ya usados → quedan 7.
    const saldos = [saldo(2025, 14, 7), saldo(2026, 14, 0)];
    expect(repartirEntreAnios(saldos, "2026-08-17", 14)).toEqual([
      { anio: 2025, dias: 7 },
      { anio: 2026, dias: 7 },
    ]);
  });

  it("agota el año viejo antes de tocar el nuevo", () => {
    const saldos = [saldo(2025, 14, 12), saldo(2026, 14, 0)];
    expect(repartirEntreAnios(saldos, "2026-08-17", 10)).toEqual([
      { anio: 2025, dias: 2 },
      { anio: 2026, dias: 8 },
    ]);
  });

  it("un año ya vencido no se toca, aunque tenga saldo", () => {
    // 2024 está fuera de la ventana de un período de 2026: sus días se dan por
    // perdidos y no pueden desaparecer en silencio dentro de una carga nueva.
    const saldos = [saldo(2024, 14, 0), saldo(2025, 14, 0), saldo(2026, 14, 0)];
    expect(repartirEntreAnios(saldos, "2026-08-17", 20)).toEqual([
      { anio: 2025, dias: 14 },
      { anio: 2026, dias: 6 },
    ]);
  });

  it("sin saldo en ningún lado imputa todo al año de la fecha", () => {
    const saldos = [saldo(2025, 14, 14), saldo(2026, 14, 14)];
    expect(repartirEntreAnios(saldos, "2026-08-17", 5)).toEqual([{ anio: 2026, dias: 5 }]);
  });

  it("sin años cargados tampoco se pierde el período", () => {
    expect(repartirEntreAnios([], "2026-08-17", 3)).toEqual([{ anio: 2026, dias: 3 }]);
  });

  it("lo que no entra en ningún saldo se suma al año de la fecha, no se descarta", () => {
    // 2025 tiene 2 y 2026 tiene 3: son 5 y se piden 9. Los 4 que sobran dejan
    // 2026 en negativo, que es lo que la pantalla muestra en rojo.
    const saldos = [saldo(2025, 14, 12), saldo(2026, 14, 11)];
    expect(repartirEntreAnios(saldos, "2026-08-17", 9)).toEqual([
      { anio: 2025, dias: 2 },
      { anio: 2026, dias: 7 },
    ]);
  });

  it("el total repartido siempre es igual a los días pedidos", () => {
    const saldos = [saldo(2025, 14, 9), saldo(2026, 21, 4)];
    for (const dias of [1, 3, 5, 10, 14, 21, 30, 45]) {
      const total = repartirEntreAnios(saldos, "2026-08-17", dias).reduce((a, t) => a + t.dias, 0);
      expect(total).toBe(dias);
    }
  });
});

describe("tramosConFechas", () => {
  it("los tramos van uno atrás del otro, sin huecos ni superposición", () => {
    const tramos = [
      { anio: 2025, dias: 7 },
      { anio: 2026, dias: 7 },
    ];
    expect(tramosConFechas(tramos, "2026-08-17")).toEqual([
      { anio: 2025, dias: 7, inicio: "2026-08-17", fin: "2026-08-23" },
      { anio: 2026, dias: 7, inicio: "2026-08-24", fin: "2026-08-30" },
    ]);
  });

  it("un solo tramo cubre el período entero", () => {
    expect(tramosConFechas([{ anio: 2025, dias: 7 }], "2026-08-17")).toEqual([
      { anio: 2025, dias: 7, inicio: "2026-08-17", fin: "2026-08-23" },
    ]);
  });

  it("cruza el fin de mes y el fin de año sin correrse un día", () => {
    expect(tramosConFechas([{ anio: 2026, dias: 5 }, { anio: 2027, dias: 3 }], "2026-12-29")).toEqual([
      { anio: 2026, dias: 5, inicio: "2026-12-29", fin: "2027-01-02" },
      { anio: 2027, dias: 3, inicio: "2027-01-03", fin: "2027-01-05" },
    ]);
  });
});
