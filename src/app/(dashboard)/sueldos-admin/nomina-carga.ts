// Qué filas escribir cuando se importa una nómina.
//
// Vive fuera de la server action a propósito: así la misma decisión —qué pago va
// a qué legajo, qué banco se agrega y qué se deja como está— se puede probar con
// un test y correr desde un script de carga, sin depender de que alguien tenga la
// pantalla abierta. La action queda con lo que sólo ella puede hacer: permisos,
// escritura y auditoría.

import type { NominaParseResult } from "./parser-nomina";

export type PagoNomina = {
  chofer_id: string;
  mes: string;
  concepto: "sueldo" | "embargo";
  banco: string | null;
  importe: number;
  orden: number;
  created_by: string | null;
};

export type CuentaNueva = {
  chofer_id: string;
  banco: string;
  principal: boolean;
  orden: number;
  observaciones: string;
  created_by: string | null;
};

export type CargaNomina = {
  pagos: PagoNomina[];
  /** Personas del Excel sin legajo asignado: sus importes NO se cargan. */
  omitidos: { etiqueta: string; importe: number | null }[];
  /** Cuentas a agregar a los legajos (nunca reemplazan a las que ya están). */
  cuentas: CuentaNueva[];
  /** Legajos con un banco que este Excel no menciona. Se dejan como están. */
  bancosSinConfirmar: { choferId: string; banco: string }[];
};

export function armarCargaNomina(opts: {
  parsed: NominaParseResult;
  mes: string;
  /** Etiqueta del Excel → id del legajo. "" o ausente = no cargar. */
  asignaciones: Record<string, string>;
  /** Bancos que ya tiene cada legajo. */
  bancosPorChofer: Map<string, string[]>;
  /** Lleva el nombre del banco a la grafía que usa el sistema. */
  canon: (banco: string) => string;
  usuarioId: string | null;
  completarBancos: boolean;
}): CargaNomina {
  const { parsed, mes, asignaciones, bancosPorChofer, canon, usuarioId, completarBancos } = opts;

  const pagos: PagoNomina[] = [];
  const omitidos: { etiqueta: string; importe: number | null }[] = [];
  const cuentas: CuentaNueva[] = [];
  const bancosSinConfirmar: { choferId: string; banco: string }[] = [];

  // Bancos que el mes le asigna a cada legajo, con cuánto salió por cada uno.
  const bancosDelMes = new Map<string, { banco: string; importe: number }[]>();
  const cubiertoPorBanco = new Set<string>();

  for (const b of parsed.bloques) {
    let orden = 0;
    for (const f of b.filas) {
      const choferId = asignaciones[f.etiqueta];
      if (!choferId) continue;
      if (b.esEmbargo) {
        pagos.push({
          chofer_id: choferId,
          mes,
          concepto: "embargo",
          banco: null,
          importe: f.importe,
          orden: orden++,
          created_by: usuarioId,
        });
        continue;
      }
      const banco = canon(b.banco ?? "");
      cubiertoPorBanco.add(f.etiqueta);
      pagos.push({
        chofer_id: choferId,
        mes,
        concepto: "sueldo",
        banco,
        importe: f.importe,
        orden: orden++,
        created_by: usuarioId,
      });
      const lista = bancosDelMes.get(choferId) ?? [];
      lista.push({ banco, importe: f.importe });
      bancosDelMes.set(choferId, lista);
    }
  }

  // Quien está en la nómina y en ningún banco entra igual, sin banco: si no, el
  // total cargado no daría el del Excel y nadie sabría por qué falta.
  for (const f of parsed.nomina) {
    const choferId = asignaciones[f.etiqueta];
    if (!choferId) {
      omitidos.push({ etiqueta: f.etiqueta, importe: f.importe });
      continue;
    }
    if (f.importe == null || cubiertoPorBanco.has(f.etiqueta)) continue;
    pagos.push({
      chofer_id: choferId,
      mes,
      concepto: "sueldo",
      banco: null,
      importe: f.importe,
      orden: 0,
      created_by: usuarioId,
    });
  }

  if (completarBancos) {
    for (const [choferId, lista] of bancosDelMes) {
      const yaTiene = new Set((bancosPorChofer.get(choferId) ?? []).map((b) => canon(b).toLowerCase()));
      const tenia = yaTiene.size > 0;
      // El banco donde cobra el grueso queda primero: es el que se espeja en el
      // legajo y el que se abre para pagar.
      const ordenados = [...lista].sort((a, b) => b.importe - a.importe);
      ordenados.forEach((c, i) => {
        // `yaTiene` también junta lo agregado en esta misma vuelta: el Excel
        // puede nombrar a la misma persona dos veces en el mismo banco, y una
        // clave repetida haría fallar el insert entero.
        if (yaTiene.has(c.banco.toLowerCase())) return;
        yaTiene.add(c.banco.toLowerCase());
        cuentas.push({
          chofer_id: choferId,
          banco: c.banco,
          // Sólo se marca principal si el legajo no tenía ninguna cuenta: si ya
          // tenía una marcada, cambiarla acá pisaría una decisión de alguien.
          principal: i === 0 && !tenia,
          orden: i,
          observaciones: `De la nómina de ${mes.slice(0, 7)}`,
          created_by: usuarioId,
        });
      });
      for (const b of bancosPorChofer.get(choferId) ?? []) {
        if (ordenados.some((c) => c.banco.toLowerCase() === canon(b).toLowerCase())) continue;
        bancosSinConfirmar.push({ choferId, banco: b });
      }
    }
  }

  return { pagos, omitidos, cuentas, bancosSinConfirmar };
}
