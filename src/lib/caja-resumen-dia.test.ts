import { describe, it, expect } from "vitest";
import {
  movimientosParaDestinatario,
  resumirDia,
  type MovimientoDia,
} from "./caja-resumen-dia";

const BARBARA = "u-barbara"; // admin
const NICO = "u-nico"; // ve el saldo, no es admin
const PAULA = "u-paula"; // operadora
const DIRECCION = new Set([BARBARA, NICO]);

const mov = (m: Partial<MovimientoDia>): MovimientoDia => ({
  tipo: "egreso",
  monto: 1000,
  caja: "diaria",
  concepto: "Un movimiento",
  tipoLabel: "Otro",
  medio: "Efectivo",
  usuario: null,
  privado: null,
  created_by: PAULA,
  ...m,
});

describe("resumirDia", () => {
  it("suma lo que entró y lo que salió, y da el neto", () => {
    const r = resumirDia([
      mov({ tipo: "ingreso", monto: 150000 }),
      mov({ tipo: "egreso", monto: 10000 }),
      mov({ tipo: "egreso", monto: 2400 }),
    ]);
    expect(r.ingresos).toBe(150000);
    expect(r.egresos).toBe(12400);
    expect(r.neto).toBe(137600);
    expect(r.movimientos).toBe(3);
  });

  it("el neto queda negativo cuando salió más de lo que entró", () => {
    const r = resumirDia([mov({ tipo: "ingreso", monto: 1000 }), mov({ tipo: "egreso", monto: 5000 })]);
    expect(r.neto).toBe(-4000);
  });

  it("abre los totales por caja", () => {
    const r = resumirDia([
      mov({ tipo: "ingreso", monto: 150000, caja: "diaria" }),
      mov({ tipo: "egreso", monto: 540000, caja: "grande" }),
    ]);
    expect(r.porCaja.diaria).toMatchObject({ ingresos: 150000, egresos: 0, movimientos: 1 });
    expect(r.porCaja.grande).toMatchObject({ ingresos: 0, egresos: 540000, movimientos: 1 });
  });

  it("una transferencia entre cajas se cancela en el total pero se ve en cada caja", () => {
    // Es plata que se movió de verdad: sacarla del resumen sería esconderla.
    const r = resumirDia([
      mov({ tipo: "egreso", monto: 200000, caja: "diaria", tipoLabel: "Transferencia interna" }),
      mov({ tipo: "ingreso", monto: 200000, caja: "grande", tipoLabel: "Transferencia interna" }),
    ]);
    expect(r.neto).toBe(0);
    expect(r.porCaja.diaria.egresos).toBe(200000);
    expect(r.porCaja.grande.ingresos).toBe(200000);
  });

  it("un día sin movimientos da todo en cero", () => {
    expect(resumirDia([])).toMatchObject({ ingresos: 0, egresos: 0, neto: 0, movimientos: 0 });
  });
});

describe("movimientosParaDestinatario — cada uno ve lo suyo", () => {
  const MOVS = [
    mov({ concepto: "Cobro flete", tipo: "ingreso", monto: 150000 }),
    mov({ concepto: "Retiro dirección", created_by: BARBARA, privado: true }),
    mov({ concepto: "Pago estudio contable", created_by: NICO }), // sin decidir
    mov({ concepto: "Compra en la caja general", caja: "grande" }),
  ];

  it("el administrador ve todo, incluido lo que él mismo tapó", () => {
    const vistos = movimientosParaDestinatario(MOVS, {
      esAdmin: true,
      veCajaGrande: true,
      direccion: DIRECCION,
    });
    expect(vistos).toHaveLength(4);
  });

  it("sin ser admin, lo oculto no se detalla", () => {
    const vistos = movimientosParaDestinatario(MOVS, {
      esAdmin: false,
      veCajaGrande: true,
      direccion: DIRECCION,
    });
    expect(vistos.map((m) => m.concepto)).not.toContain("Retiro dirección");
    // Y lo que nadie decidió, pero cargó alguien que ve el saldo, tampoco.
    expect(vistos.map((m) => m.concepto)).not.toContain("Pago estudio contable");
    expect(vistos.map((m) => m.concepto)).toContain("Cobro flete");
  });

  it("sin la caja general, los movimientos de esa caja no aparecen", () => {
    const vistos = movimientosParaDestinatario(MOVS, {
      esAdmin: true,
      veCajaGrande: false,
      direccion: DIRECCION,
    });
    expect(vistos.map((m) => m.concepto)).not.toContain("Compra en la caja general");
  });

  it("un movimiento marcado a la vista se detalla aunque lo haya cargado dirección", () => {
    const vistos = movimientosParaDestinatario(
      [mov({ concepto: "Aporte de socio", created_by: BARBARA, privado: false })],
      { esAdmin: false, veCajaGrande: false, direccion: DIRECCION },
    );
    expect(vistos).toHaveLength(1);
  });
});
