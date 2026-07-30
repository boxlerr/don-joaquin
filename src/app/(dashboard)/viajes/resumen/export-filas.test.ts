import { describe, it, expect } from "vitest";
import { filaChofer, filaViaje, filasDetalle, siHay, SIN_CHOFER } from "./export-filas";
import type { ChoferEnDestino, DestinoResumen, ViajeDelResumen } from "./actions";

const viaje = (over: Partial<ViajeDelResumen> = {}): ViajeDelResumen => ({
  id: "v1",
  fecha: "2026-07-29",
  origen: "RAMALLO",
  destino: "LOMASER",
  km: 300,
  kmVacios: 0,
  toneladas: 38,
  remito: "R-1",
  monto: 150000,
  esVacio: false,
  cliente: "LOMA NEGRA CIASA",
  material: "CEMENTO",
  sinChofer: false,
  ...over,
});

const chofer = (over: Partial<ChoferEnDestino> = {}): ChoferEnDestino => ({
  chofer_id: "c1",
  chofer: "Paz, Leonardo",
  rol: "chofer",
  fotoUrl: null,
  camion: "AF541MH",
  camionMarca: "Scania",
  viajes: 1,
  km: 300,
  toneladas: 38,
  ultimo: "2026-07-29",
  detalle: [viaje()],
  ...over,
});

describe("siHay — qué celda va vacía", () => {
  it("EL BUG: un 0 que significa 'no cargado' va vacío, no como 0", () => {
    // Se sumaba un 0 que en pantalla decía "—" y el total quedaba mintiendo con
    // cara de dato.
    expect(siHay(0)).toBeNull();
    expect(siHay(null)).toBeNull();
    expect(siHay(undefined)).toBeNull();
  });
  it("un número real pasa tal cual", () => {
    expect(siHay(38)).toBe(38);
    expect(siHay(0.5)).toBe(0.5);
  });
});

describe("filaViaje", () => {
  it("las toneladas y el importe sin cargar quedan vacíos, como en pantalla", () => {
    const f = filaViaje("LOMASER", "Paz, Leonardo", "AF541MH", viaje({ toneladas: 0, monto: 0 }));
    expect(f[9]).toBeNull(); // toneladas
    expect(f[10]).toBeNull(); // importe
  });

  it("los km sí van con 0: la columna es NOT NULL, el 0 es un dato", () => {
    const f = filaViaje("LOMASER", "Paz, Leonardo", "AF541MH", viaje({ km: 0 }));
    expect(f[8]).toBe(0);
  });

  it("mapea el viaje completo en el orden de las columnas", () => {
    expect(filaViaje("LOMASER", "Paz, Leonardo", "AF541MH", viaje())).toEqual([
      "LOMASER",
      "Paz, Leonardo",
      "AF541MH",
      "29/07/2026",
      "RAMALLO",
      "R-1",
      "CEMENTO",
      "LOMA NEGRA CIASA",
      300,
      38,
      150000,
    ]);
  });

  it("los huecos de texto van con guión, no vacíos, para que se lea la fila", () => {
    const f = filaViaje("LOMASER", "Paz", null, viaje({ origen: null, remito: null, material: null, cliente: null }));
    expect([f[2], f[4], f[5], f[6], f[7]]).toEqual(["—", "—", "—", "—", "—"]);
  });
});

describe("filaChofer", () => {
  it("resume al chofer en ese destino", () => {
    expect(filaChofer(chofer())).toEqual([
      "Paz, Leonardo",
      "AF541MH",
      1,
      38,
      300,
      "29/07/2026",
    ]);
  });
  it("sin camión ni toneladas no inventa ceros", () => {
    const f = filaChofer(chofer({ camion: null, toneladas: 0, km: 0 }));
    expect(f[1]).toBe("—");
    expect(f[3]).toBeNull();
    expect(f[4]).toBeNull();
  });
});

describe("filasDetalle", () => {
  const destinos: DestinoResumen[] = [
    {
      destino: "LOMASER",
      viajes: 2,
      toneladas: 38,
      km: 300,
      choferes: [chofer()],
      sinChofer: 1,
      sinChoferDetalle: [viaje({ id: "v2", sinChofer: true })],
    },
  ];

  it("los viajes sin chofer no se omiten: son trabajo que falta dar", () => {
    const filas = filasDetalle(destinos);
    expect(filas).toHaveLength(2);
    expect(filas[1]![1]).toBe(SIN_CHOFER);
    expect(filas[1]![2]).toBe("—");
  });

  it("un período sin nada devuelve cero filas, no una fila vacía", () => {
    expect(filasDetalle([])).toEqual([]);
  });
});
