import { describe, it, expect } from "vitest";
import {
  leerBajas,
  leerMensaje,
  limpiarDescripcion,
  normalizarPatente,
  patentesEn,
  type PersonaTaller,
  type UnidadTaller,
} from "./parseo";

const UNIDADES: UnidadTaller[] = [
  { id: "c1", patente: "AE576DK", tipo: "camion" },
  { id: "c2", patente: "AF112ON", tipo: "camion" },
  { id: "c3", patente: "AG556LU", tipo: "camion" },
  { id: "a1", patente: "ABC123", tipo: "acoplado" },
];

const PERSONAS: PersonaTaller[] = [
  { id: "p1", nombre: "Matías", apellido: "Albornoz" },
  { id: "p2", nombre: "Emilio", apellido: "Ramos" },
  { id: "p3", nombre: "Kevin", apellido: "Jara" },
  // Dos hermanos: el apellido solo no alcanza para elegir.
  { id: "p4", nombre: "Juan", apellido: "Perez" },
  { id: "p5", nombre: "Pedro", apellido: "Perez" },
];

describe("normalizarPatente", () => {
  it("saca guiones, puntos, espacios y mayúsculas", () => {
    expect(normalizarPatente("AE-576-DK")).toBe("AE576DK");
    expect(normalizarPatente("ae 576 dk")).toBe("AE576DK");
    expect(normalizarPatente("AE.576.DK")).toBe("AE576DK");
    expect(normalizarPatente("AE576DK")).toBe("AE576DK");
  });
});

describe("patentesEn", () => {
  it("encuentra el formato Mercosur, escrito de cualquier forma", () => {
    expect(patentesEn("cambio en AE-576-DK hoy").map(normalizarPatente)).toContain("AE576DK");
    expect(patentesEn("unidad af112on").map(normalizarPatente)).toContain("AF112ON");
  });

  it("encuentra también el formato viejo", () => {
    expect(patentesEn("acoplado ABC 123").map(normalizarPatente)).toContain("ABC123");
  });

  it("no confunde un número suelto con una patente", () => {
    expect(patentesEn("cambio de hoja cortada eje n 5")).toEqual([]);
    expect(patentesEn("27 bajas")).toEqual([]);
  });
});

describe("leerBajas", () => {
  it("lee el correlativo del grupo", () => {
    expect(leerBajas("Baja-casco tracción Goodyear kmax\n28 bajas")).toBe(28);
    expect(leerBajas("27 bajas")).toBe(27);
  });

  it("NO confunde 'Baja 2 x línea' con un correlativo", () => {
    // El número va DESPUÉS de la palabra: es una cantidad, no el contador.
    expect(leerBajas("Baja 2 x línea sin precurar")).toBeNull();
  });

  it("sin correlativo devuelve null", () => {
    expect(leerBajas("Refuerzo en balancín")).toBeNull();
  });
});

describe("limpiarDescripcion", () => {
  it("saca los asteriscos que usan de viñeta", () => {
    expect(limpiarDescripcion("*Refuerzo en balancín")).toBe("Refuerzo en balancín");
  });

  it("junta las líneas en una sola frase", () => {
    expect(limpiarDescripcion("Refuerzo en balancín\nSola y Brusa 3 Ejes")).toBe(
      "Refuerzo en balancín. Sola y Brusa 3 Ejes",
    );
  });

  it("descarta las líneas que quedaron vacías", () => {
    expect(limpiarDescripcion("Cambio de hoja\n\n*\n  \nEje 5")).toBe("Cambio de hoja. Eje 5");
  });

  it("no le saca los acentos a lo que va a leer una persona", () => {
    expect(limpiarDescripcion("Refuerzo en balancín")).toContain("í");
  });
});

describe("leerMensaje — los mensajes REALES del grupo", () => {
  it("el de Albornoz: descripción, patente y persona, en desorden y con asteriscos", () => {
    const r = leerMensaje(
      "*Refuerzo en balancín\n*AF-112-ON\nSola y Brusa 3 Ejes\n*Albornoz Matías",
      UNIDADES,
      PERSONAS,
    );
    expect(r.unidad?.id).toBe("c2");
    expect(r.persona?.id).toBe("p1");
    expect(r.descripcion).toContain("Refuerzo en balancín");
    expect(r.descripcion).toContain("Sola y Brusa 3 Ejes");
    // Ni la patente ni el nombre quedan repetidos en la descripción.
    expect(r.descripcion).not.toContain("AF-112-ON");
    expect(r.descripcion.toLowerCase()).not.toContain("albornoz");
  });

  it("el de Emilio Ramos: el nombre va PRIMERO y la patente al final", () => {
    const r = leerMensaje(
      "Emilio Ramos\nCambio de hoja cortada Eje n 5\n*AE-576-DK",
      UNIDADES,
      PERSONAS,
    );
    expect(r.unidad?.id).toBe("c1");
    expect(r.persona?.id).toBe("p2");
    expect(r.descripcion).toBe("Cambio de hoja cortada Eje n 5");
  });

  it("la baja de cubierta con su correlativo", () => {
    const r = leerMensaje("Baja-casco tracción Goodyear kmax\n28 bajas", UNIDADES, PERSONAS);
    expect(r.bajas).toBe(28);
    // El correlativo se deja escrito: es como lo anotan ellos.
    expect(r.descripcion).toContain("28 bajas");
  });

  it("un mensaje sin patente ni nombre igual guarda lo que se hizo", () => {
    const r = leerMensaje("Baja 2 x línea sin precurar", UNIDADES, PERSONAS);
    expect(r.unidad).toBeNull();
    expect(r.persona).toBeNull();
    expect(r.bajas).toBeNull();
    expect(r.descripcion).toBe("Baja 2 x línea sin precurar");
  });
});

describe("leerMensaje — los casos donde NO hay que adivinar", () => {
  it("una patente que no está en el sistema se avisa, no se ignora", () => {
    const r = leerMensaje("Cambio de cubierta ZZ-999-ZZ", UNIDADES, PERSONAS);
    expect(r.unidad).toBeNull();
    expect(r.patenteDesconocida).toBe("ZZ999ZZ");
    expect(r.descripcion).toBe("Cambio de cubierta");
  });

  it("un apellido que le corresponde a dos NO elige a ninguno", () => {
    // Preferible que lo completen a mano antes que atribuirle el trabajo al
    // hermano equivocado.
    const r = leerMensaje("Cambio de filtro Perez", UNIDADES, PERSONAS);
    expect(r.persona).toBeNull();
    expect(r.descripcion).toContain("Perez");
  });

  it("con el nombre completo sí elige, aunque el apellido se repita", () => {
    const r = leerMensaje("Cambio de filtro Juan Perez", UNIDADES, PERSONAS);
    expect(r.persona?.id).toBe("p4");
  });

  it("el nombre más largo le gana al más corto", () => {
    const r = leerMensaje("Albornoz Matías cambió la goma", UNIDADES, PERSONAS);
    expect(r.persona?.id).toBe("p1");
  });

  it("sin acentos también encuentra a la persona", () => {
    expect(leerMensaje("trabajo de matias albornoz", UNIDADES, PERSONAS).persona?.id).toBe("p1");
  });

  it("un mensaje vacío no rompe", () => {
    const r = leerMensaje("", UNIDADES, PERSONAS);
    expect(r).toEqual({
      descripcion: "",
      unidad: null,
      patenteDesconocida: null,
      persona: null,
      bajas: null,
    });
  });

  it("sin unidades ni personas cargadas, igual guarda la descripción", () => {
    const r = leerMensaje("Refuerzo en balancín AF-112-ON", [], []);
    expect(r.unidad).toBeNull();
    expect(r.patenteDesconocida).toBe("AF112ON");
    expect(r.descripcion).toBe("Refuerzo en balancín");
  });

  it("la patente pegada al texto también se detecta", () => {
    const r = leerMensaje("cambio en AG556LU", UNIDADES, PERSONAS);
    expect(r.unidad?.id).toBe("c3");
  });

  it("el acoplado con patente vieja se reconoce igual", () => {
    const r = leerMensaje("Luces del acoplado ABC 123", UNIDADES, PERSONAS);
    expect(r.unidad?.id).toBe("a1");
    expect(r.unidad?.tipo).toBe("acoplado");
  });
});
