import { describe, it, expect, beforeEach } from "vitest";
import {
  TTL_DIAS,
  claveBorrador,
  objetoCon,
  listaDe,
  leerBorrador,
  guardarBorrador,
  borrarBorrador,
  limpiarVencidos,
  describirCuando,
} from "./borrador-local";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-08-12T15:30:00").getTime();

type Form = { nombre: string; monto: string; observaciones: string };
const FORM_VACIO: Form = { nombre: "", monto: "", observaciones: "" };

describe("claveBorrador", () => {
  it("mete el usuario en la clave: en una PC compartida el borrador es de quien lo escribió", () => {
    expect(claveBorrador("caja-egreso", "u1")).not.toBe(claveBorrador("caja-egreso", "u2"));
  });

  it("sin usuario no explota", () => {
    expect(claveBorrador("caja-egreso", null)).toContain("anon");
  });
});

describe("objetoCon", () => {
  it("completa contra el vacío los campos que el borrador viejo no tenía", () => {
    const normalizar = objetoCon(FORM_VACIO);
    expect(normalizar({ nombre: "Pérez" })).toEqual({
      nombre: "Pérez",
      monto: "",
      observaciones: "",
    });
  });

  it("descarta lo que no es un objeto", () => {
    const normalizar = objetoCon(FORM_VACIO);
    expect(normalizar("hola")).toBeNull();
    expect(normalizar([1, 2])).toBeNull();
    expect(normalizar(null)).toBeNull();
  });
});

describe("listaDe", () => {
  it("completa cada fila contra la fila vacía", () => {
    const normalizar = listaDe({ origen: "", destino: "", km: "" });
    expect(normalizar([{ origen: "Bahía" }, { destino: "Ibicuy" }])).toEqual([
      { origen: "Bahía", destino: "", km: "" },
      { origen: "", destino: "Ibicuy", km: "" },
    ]);
  });

  it("descarta si no es una lista de objetos", () => {
    const normalizar = listaDe({ origen: "" });
    expect(normalizar({ origen: "Bahía" })).toBeNull();
    expect(normalizar(["Bahía"])).toBeNull();
  });
});

describe("guardar y leer", () => {
  beforeEach(() => localStorage.clear());

  it("lo que se guarda vuelve tal cual", () => {
    const clave = claveBorrador("test", "u1");
    guardarBorrador(clave, { ...FORM_VACIO, nombre: "Pérez" }, AHORA);

    const leido = leerBorrador(clave, objetoCon(FORM_VACIO), AHORA);
    expect(leido?.valor.nombre).toBe("Pérez");
    expect(leido?.ts).toBe(AHORA);
  });

  it("sin borrador devuelve null", () => {
    expect(leerBorrador(claveBorrador("test", "u1"), objetoCon(FORM_VACIO), AHORA)).toBeNull();
  });

  it("un borrador vencido no se ofrece, y además se borra", () => {
    const clave = claveBorrador("test", "u1");
    guardarBorrador(clave, { ...FORM_VACIO, nombre: "Pérez" }, AHORA - (TTL_DIAS + 1) * DIA);

    expect(leerBorrador(clave, objetoCon(FORM_VACIO), AHORA)).toBeNull();
    expect(localStorage.getItem(clave)).toBeNull();
  });

  it("justo dentro del TTL todavía sirve", () => {
    const clave = claveBorrador("test", "u1");
    guardarBorrador(clave, { ...FORM_VACIO, nombre: "Pérez" }, AHORA - (TTL_DIAS * DIA - 1000));

    expect(leerBorrador(clave, objetoCon(FORM_VACIO), AHORA)?.valor.nombre).toBe("Pérez");
  });

  it("un borrador corrupto se descarta sin romper la pantalla", () => {
    const clave = claveBorrador("test", "u1");
    localStorage.setItem(clave, "{esto no es json");

    expect(leerBorrador(clave, objetoCon(FORM_VACIO), AHORA)).toBeNull();
    expect(localStorage.getItem(clave)).toBeNull();
  });

  it("un borrador sin fecha se descarta: no hay forma de saber si venció", () => {
    const clave = claveBorrador("test", "u1");
    localStorage.setItem(clave, JSON.stringify({ valor: { nombre: "Pérez" } }));

    expect(leerBorrador(clave, objetoCon(FORM_VACIO), AHORA)).toBeNull();
  });

  it("si el normalizador lo rechaza, se descarta", () => {
    const clave = claveBorrador("test", "u1");
    guardarBorrador(clave, "un string donde iba un objeto", AHORA);

    expect(leerBorrador(clave, objetoCon(FORM_VACIO), AHORA)).toBeNull();
    expect(localStorage.getItem(clave)).toBeNull();
  });

  it("borrar deja la pantalla limpia", () => {
    const clave = claveBorrador("test", "u1");
    guardarBorrador(clave, FORM_VACIO, AHORA);
    borrarBorrador(clave);
    expect(localStorage.getItem(clave)).toBeNull();
  });
});

describe("limpiarVencidos", () => {
  beforeEach(() => localStorage.clear());

  it("se lleva los vencidos y deja los vigentes", () => {
    guardarBorrador(claveBorrador("viejo", "u1"), FORM_VACIO, AHORA - 30 * DIA);
    guardarBorrador(claveBorrador("nuevo", "u1"), FORM_VACIO, AHORA - 1 * DIA);

    expect(limpiarVencidos(AHORA)).toBe(1);
    expect(localStorage.getItem(claveBorrador("viejo", "u1"))).toBeNull();
    expect(localStorage.getItem(claveBorrador("nuevo", "u1"))).not.toBeNull();
  });

  it("no toca lo que no es un borrador nuestro", () => {
    localStorage.setItem("dj:otra-cosa", "no me toques");
    limpiarVencidos(AHORA);
    expect(localStorage.getItem("dj:otra-cosa")).toBe("no me toques");
  });
});

describe("describirCuando", () => {
  it("distingue hoy, ayer y una fecha", () => {
    expect(describirCuando(AHORA - 2 * 60 * 60 * 1000, AHORA)).toMatch(/^hoy /);
    expect(describirCuando(AHORA - DIA, AHORA)).toMatch(/^ayer /);
    expect(describirCuando(AHORA - 5 * DIA, AHORA)).toMatch(/^07\/08 /);
  });

  it("sin fecha devuelve vacío", () => {
    expect(describirCuando(0, AHORA)).toBe("");
  });
});
