import { describe, it, expect } from "vitest";
import { proponerTramo, type TramoIda } from "./tramos";

const ida: TramoIda = {
  origen: "OLAVARRIA",
  destino: "CERRITO",
  kmConCarga: "480",
  kmVacios: "0",
};

describe("proponerTramo", () => {
  it("el primer tramo es la vuelta: invierte la ida y se trae su distancia", () => {
    expect(proponerTramo(ida, null)).toEqual({
      origen: "CERRITO",
      destino: "OLAVARRIA",
      kmVacios: "480",
    });
  });

  it("si la ida fue vacía, toma esa distancia", () => {
    const vacia: TramoIda = { ...ida, kmConCarga: "0", kmVacios: "320" };
    expect(proponerTramo(vacia, null).kmVacios).toBe("320");
  });

  it("sin km cargados no inventa una distancia", () => {
    const sinKm: TramoIda = { ...ida, kmConCarga: "0", kmVacios: "0" };
    expect(proponerTramo(sinKm, null).kmVacios).toBe("0");
  });

  it("los tramos siguientes arrancan donde terminó el anterior", () => {
    // El caso de Nico: después de Cerrito→Ramallo, el que sigue sale de Ramallo.
    expect(proponerTramo(ida, "RAMALLO")).toEqual({
      origen: "RAMALLO",
      destino: "",
      kmVacios: "0",
    });
  });

  it("la salida completa de Nico se encadena sola", () => {
    // Olavarría → Cerrito (la ida), Cerrito → Ramallo vacío, Ramallo → Lomaser.
    const t2 = proponerTramo(ida, null);
    expect(t2.origen).toBe("CERRITO");
    // El operador corrige el destino de la vuelta a Ramallo…
    const t3 = proponerTramo(ida, "RAMALLO");
    expect(t3.origen).toBe("RAMALLO");
    expect(t3.destino).toBe("");
  });
});
