import { describe, it, expect, vi, afterEach } from "vitest";
import { desdeVentanaCajaChica, periodoInicial, VENTANA_CAJA_CHICA_DIAS } from "./ventana";

afterEach(() => {
  vi.useRealTimers();
});

describe("desdeVentanaCajaChica", () => {
  it("devuelve el día de hace 30 días", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T15:00:00"));
    expect(desdeVentanaCajaChica()).toBe("2026-06-29");
  });

  it("cruza el cambio de año sin romperse", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-10T09:00:00"));
    expect(desdeVentanaCajaChica()).toBe("2026-12-11");
  });

  it("cubre febrero (mes corto) tomando los mismos 30 días", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00"));
    expect(desdeVentanaCajaChica()).toBe("2026-02-03");
  });

  it("la ventana es de 30 días", () => {
    expect(VENTANA_CAJA_CHICA_DIAS).toBe(30);
  });
});

describe("periodoInicial", () => {
  it("la caja chica abre en la ventana, no en un mes", () => {
    // El bug del 11/08: sin movimientos cargados en agosto, la pantalla abría
    // en julio y lo de hoy no se veía por ningún lado.
    expect(periodoInicial("2026-07-12", "2026-08")).toEqual({ tipo: "ventana" });
  });

  it("la caja general abre en el mes corriente", () => {
    expect(periodoInicial(undefined, "2026-08")).toEqual({ tipo: "mes", mes: "2026-08" });
  });

  it("no depende de que el mes tenga movimientos", () => {
    // Justamente lo que hacía antes: elegir el último mes CON datos.
    expect(periodoInicial(undefined, "2027-01")).toEqual({ tipo: "mes", mes: "2027-01" });
  });
});
