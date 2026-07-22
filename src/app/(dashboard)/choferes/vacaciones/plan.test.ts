import { describe, it, expect } from "vitest";
import { planSugerido, type PlanSemana } from "./plan";

function semanas(n: number, desde = new Date(2026, 7, 3)): PlanSemana[] {
  return Array.from({ length: n }, (_, i) => {
    const s = new Date(desde);
    s.setDate(s.getDate() + i * 7);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: iso(s), end: iso(e) };
  });
}

const u = (id: string, adeudados: number) => ({ chofer_id: id, apellido: id, nombre: "", adeudados });

describe("planSugerido", () => {
  it("ubica a todos sin superar el umbral por semana", () => {
    const sem = semanas(8);
    const plan = planSugerido({
      urgentes: [u("a", 14), u("b", 14), u("c", 7)],
      semanas: sem,
      ocupacion: sem.map(() => 0),
      ocupadoPorChofer: new Set(),
      umbral: 2,
    });
    expect(plan.sinLugar).toHaveLength(0);
    expect(plan.items.reduce((acc, i) => acc + i.dias, 0)).toBe(35);
    // ninguna semana termina con más de 2 personas del plan
    for (const s of sem) {
      const enSemana = plan.items.filter((i) => i.fecha_inicio <= s.end && i.fecha_fin >= s.start).length;
      expect(enSemana).toBeLessThanOrEqual(2);
    }
  });

  it("no pisa semanas donde la persona ya tiene vacaciones", () => {
    const sem = semanas(4);
    const plan = planSugerido({
      urgentes: [u("a", 7)],
      semanas: sem,
      ocupacion: [1, 0, 0, 0],
      ocupadoPorChofer: new Set([`a|${sem[0]!.start}`]),
      umbral: 4,
    });
    expect(plan.items[0]!.fecha_inicio).toBe(sem[1]!.start);
  });

  it("respeta semanas ya llenas y avisa si alguien no entra", () => {
    const sem = semanas(2);
    const plan = planSugerido({
      urgentes: [u("a", 14), u("b", 14)],
      semanas: sem,
      ocupacion: [1, 1], // ya hay 1 de vacaciones en cada semana
      ocupadoPorChofer: new Set(),
      umbral: 2,
    });
    // entra uno solo (ocupa el único lugar libre de ambas semanas)
    expect(plan.items.map((i) => i.chofer_id)).toEqual(["a", "a"].slice(0, plan.items.length));
    expect(plan.sinLugar.map((s) => s.chofer_id)).toContain("b");
  });

  it("un saldo de 21 días sale en bloques (14 + 7)", () => {
    const sem = semanas(6);
    const plan = planSugerido({
      urgentes: [u("a", 21)],
      semanas: sem,
      ocupacion: sem.map(() => 0),
      ocupadoPorChofer: new Set(),
      umbral: 4,
    });
    expect(plan.items.filter((i) => i.chofer_id === "a").reduce((acc, i) => acc + i.dias, 0)).toBe(21);
    expect(plan.items[0]!.dias).toBe(14);
  });
});
