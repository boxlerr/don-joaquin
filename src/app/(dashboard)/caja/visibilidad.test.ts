import { describe, it, expect } from "vitest";
import { clausulaVisibilidad, filtrarMovimientosVisibles, veLosOcultos } from "./visibilidad";

// Los mismos datos que siembra scripts/seed-caja-demo.ts.
const BARBARA = "u-barbara"; // admin → dirección
const NICO = "u-nico"; // caja_saldo por override → dirección
const PAULA = "u-paula"; // operadora
const LUCAS = "u-lucas"; // operador

const DIRECCION = new Set([BARBARA, NICO]);

const MOVIMIENTOS = [
  { concepto: "Cobro flete Loma Negra - remito 4471", created_by: PAULA, privado: null },
  { concepto: "Viático Ruta 5 - salida 06:00", created_by: PAULA, privado: null },
  { concepto: "Gomería - reparación cubierta", created_by: LUCAS, privado: null },
  { concepto: "Rendición vuelto viático - Ruta 22", created_by: LUCAS, privado: null },
  { concepto: "Repuestos - filtros de aceite", created_by: PAULA, privado: null },
  { concepto: "Viático YPF Bahía - salida 14:00", created_by: LUCAS, privado: null },
  { concepto: "Retiro dirección", created_by: BARBARA, privado: null },
  { concepto: "Cobro cuenta corriente - transferencia recibida", created_by: BARBARA, privado: null },
  { concepto: "Pago estudio contable", created_by: NICO, privado: null },
  { concepto: "Ajuste de caja - conciliación banco", created_by: BARBARA, privado: null },
];

describe("filtrarMovimientosVisibles — sin marca (regla por autor)", () => {
  it("deja fuera de la caja chica lo que cargó dirección", () => {
    const visibles = filtrarMovimientosVisibles(MOVIMIENTOS, DIRECCION);
    expect(visibles).toHaveLength(6);
    expect(visibles.map((m) => m.concepto)).not.toContain("Retiro dirección");
    expect(visibles.map((m) => m.concepto)).not.toContain("Pago estudio contable");
  });

  it("muestra lo que cargó el personal operativo", () => {
    const visibles = filtrarMovimientosVisibles(MOVIMIENTOS, DIRECCION);
    expect(visibles.map((m) => m.concepto)).toContain("Gomería - reparación cubierta");
  });

  it("conserva los movimientos sin autor (importados o viejos)", () => {
    const conHuerfano = [...MOVIMIENTOS, { concepto: "Saldo inicial", created_by: null, privado: null }];
    const visibles = filtrarMovimientosVisibles(conHuerfano, DIRECCION);
    expect(visibles.map((m) => m.concepto)).toContain("Saldo inicial");
  });

  it("sin dirección configurada no filtra nada", () => {
    const visibles = filtrarMovimientosVisibles(MOVIMIENTOS, new Set<string>());
    expect(visibles).toHaveLength(MOVIMIENTOS.length);
  });
});

describe("filtrarMovimientosVisibles — con la marca de privacidad", () => {
  it("oculta lo marcado privado", () => {
    const movs = [{ concepto: "Retiro", created_by: BARBARA, privado: true }];
    expect(filtrarMovimientosVisibles(movs, DIRECCION)).toHaveLength(0);
  });

  it("muestra lo que dirección marcó público, aunque lo haya cargado ella", () => {
    const movs = [{ concepto: "Cobro que el operador debe ver", created_by: BARBARA, privado: false }];
    const visibles = filtrarMovimientosVisibles(movs, DIRECCION);
    expect(visibles.map((m) => m.concepto)).toEqual(["Cobro que el operador debe ver"]);
  });

  it("oculta un movimiento marcado privado aunque lo haya cargado un operador", () => {
    const movs = [{ concepto: "Egreso sensible", created_by: PAULA, privado: true }];
    expect(filtrarMovimientosVisibles(movs, DIRECCION)).toHaveLength(0);
  });

  it("el filtro no depende de quién mira: al autor también se le oculta", () => {
    // La caja chica es igual para todos, así dirección comprueba qué ve el
    // personal. Lo oculto vive solo en la caja general.
    const movs = [{ concepto: "Retiro", created_by: BARBARA, privado: true }];
    expect(filtrarMovimientosVisibles(movs, DIRECCION)).toHaveLength(0);
  });
});

describe("clausulaVisibilidad", () => {
  it("combina la marca con la regla por autor", () => {
    expect(clausulaVisibilidad(DIRECCION)).toBe(
      `privado.is.false,` +
        `and(privado.is.null,created_by.not.in.(${BARBARA},${NICO})),` +
        `and(privado.is.null,created_by.is.null)`,
    );
  });

  it("sin nadie a quien ocultarle por autor, solo respeta la marca", () => {
    expect(clausulaVisibilidad(new Set<string>())).toBe("privado.is.false,privado.is.null");
  });
});

describe("veLosOcultos — quién ve lo que el admin tapó", () => {
  it("sólo el administrador, y sólo en la caja general", () => {
    expect(veLosOcultos("general", true)).toBe(true);
  });

  it("tener la caja general no alcanza si no sos admin", () => {
    // Nicolás y Alejandro tienen `caja_grande`: entran a la general, pero lo
    // tapado sigue tapado. Si no, ocultar sería cambiar de solapa.
    expect(veLosOcultos("general", false)).toBe(false);
  });

  it("la caja chica no muestra lo oculto ni al administrador", () => {
    // Es la vista con la que dirección comprueba qué está viendo el personal:
    // si le mostrara de más, dejaría de servir para eso.
    expect(veLosOcultos("chica", true)).toBe(false);
    expect(veLosOcultos("chica", false)).toBe(false);
  });
});
