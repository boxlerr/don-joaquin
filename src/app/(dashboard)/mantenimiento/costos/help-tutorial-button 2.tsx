"use client";

import { BarChart3, ClipboardPaste, FileSpreadsheet, Table2 } from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <HelpTutorialDialog
      title="Costos de repuestos y reparaciones — guía"
      tabs={TABS}
      triggerClassName={triggerClassName}
    />
  );
}

const TABS: TutorialTab[] = [
  {
    id: "cargar",
    label: "Cargar el mes",
    icon: <ClipboardPaste size={14} />,
    steps: [
      {
        title: "Pegá el bloque del Excel",
        description:
          'En "Cargar" copiás las filas de tu planilla y las pegás sobre la primera celda. Los proveedores se reconocen por el nombre, así que no importa el orden, y el que no esté se agrega solo.',
        mockup: <MockPegar />,
        hint: "Arriba te queda una línea que dice cuántos proveedores entraron y si el total coincide con el de tu Excel.",
      },
      {
        title: "O escribís directo en la celda",
        description:
          "Se escribe encima del número y se guarda solo: no hay botón de guardar por fila. Tab pasa a la celda de al lado, Enter baja una fila y Esc deshace lo que escribiste en esa celda.",
        mockup: <MockGrilla />,
      },
      {
        title: "Un mes que todavía no existe",
        description:
          'Elegí el mes en "Mes a cargar", aunque nunca se haya cargado. Si está vacío te trae los proveedores del mes anterior con las celdas en blanco, para que sólo escribas los importes.',
        mockup: <MockMesNuevo />,
        hint: "Un importe en negativo es una nota de crédito y resta del total del mes.",
      },
    ],
  },
  {
    id: "mirar",
    label: "Mirar y comparar",
    icon: <BarChart3 size={14} />,
    steps: [
      {
        title: "El mes, proveedor por proveedor",
        description:
          'En "Ver el mes" tenés el buscador, el orden por columna y cuánto pesa cada proveedor sobre el total. Tocá una fila para ver la historia completa de ese proveedor.',
        mockup: <MockVer />,
      },
      {
        title: "Un mes contra otro",
        description:
          'En "Comparar" cada fila es un proveedor y cada columna un mes. Ahí se ve quién subió, quién dejó de facturar y por qué un mes salió más caro que el anterior.',
        mockup: <MockComparar />,
        hint: "En rojo lo que subió y en verde lo que bajó: es un costo, subir es la mala noticia.",
      },
    ],
  },
  {
    id: "exportar",
    label: "Exportar",
    icon: <FileSpreadsheet size={14} />,
    steps: [
      {
        title: "Bajarlo a Excel",
        description:
          '"Exportar" te baja un Excel con tres hojas: el detalle por proveedor, el total de cada mes y el acumulado de cada proveedor.',
        mockup: <MockExport />,
      },
    ],
  },
];

/* ── Maquetas ─────────────────────────────────────────────────────────────
   Dibujadas a ~440px de ancho, que es lo que mide el panel del tutorial. */

const celda = "px-1.5 py-1 text-[10px] font-mono text-right text-foreground";
const cabecera =
  "px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground bg-muted";

function MockPegar() {
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-dashed border-primary/50 bg-primary/[0.04] p-2">
        <div className="text-[9px] text-muted-foreground mb-1">Copiado de tu Excel</div>
        <div className="font-mono text-[9px] text-foreground/70 leading-relaxed">
          SCANIA ARGENTINA S.A.{"  "}(27.189.147){"  "}(32.898.868)
          <br />
          RUTA SUR TRUCK SA{"  "}(3.740.720){"  "}(4.526.278)
          <br />
          CABOWE S.A.{"  "}(4.123.655){"  "}(4.989.623)
        </div>
      </div>
      <div className="rounded-md border border-border bg-card px-2 py-1.5 text-[10px]">
        Se cargaron <strong>31 proveedores</strong> ·{" "}
        <span className="font-mono">$ 85.593.870</span>{" "}
        <span className="text-[#10B981]">— coincide con el total del Excel</span>
      </div>
    </div>
  );
}

function MockGrilla() {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${cabecera} text-left`}>Proveedor</th>
            <th className={`${cabecera} text-right`}>Neto 21%</th>
            <th className={`${cabecera} text-right`}>Fact. 21%</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/50">
            <td className="px-1.5 py-1 text-[10px] text-foreground">CABOWE S.A.</td>
            <td className={celda}>4.123.655</td>
            <td className={celda}>4.989.623</td>
          </tr>
          <tr className="border-t border-border/50 bg-primary/[0.04]">
            <td className="px-1.5 py-1 text-[10px] text-foreground">RUTA SUR TRUCK SA</td>
            <td className="px-1.5 py-1">
              <span className="block rounded-[3px] border-2 border-primary bg-card px-1 py-0.5 text-[10px] font-mono text-right text-foreground">
                3.740.720
              </span>
            </td>
            <td className={celda}>4.526.278</td>
          </tr>
        </tbody>
      </table>
      <div className="border-t border-border bg-muted px-1.5 py-1 text-[9px] text-muted-foreground">
        Tab · Enter · Esc — se guarda solo
      </div>
    </div>
  );
}

function MockMesNuevo() {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="bg-muted px-2 py-1 text-[9px] text-muted-foreground">
        Abril 2026 está sin cargar. Se trajeron los 31 proveedores de marzo con las celdas vacías.
      </div>
      <table className="w-full">
        <tbody>
          {["INDUSTRIAL ARENAS TANDIL SRL", "METALÚRGICA HERRERA S.A.", "SCANIA ARGENTINA S.A."].map(
            (p) => (
              <tr key={p} className="border-t border-border/50">
                <td className="px-1.5 py-1 text-[10px] text-foreground">
                  {p}
                  <span className="block text-[9px] text-muted-foreground">Sin cargar</span>
                </td>
                <td className="px-1.5 py-1">
                  <span className="block rounded-[3px] border border-border px-1 py-0.5 text-[10px] text-right text-muted-foreground/40">
                    0
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function MockVer() {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${cabecera} text-left`}>Proveedor</th>
            <th className={`${cabecera} text-right`}>Facturado</th>
            <th className={`${cabecera} text-right`}>Participación</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["SCANIA ARGENTINA S.A.", "32.898.868", 38],
            ["CABOWE S.A.", "4.989.623", 6],
            ["PUNTO TRUCK S.A.", "4.674.943", 5],
          ].map(([p, v, pct]) => (
            <tr key={p as string} className="border-t border-border/50">
              <td className="px-1.5 py-1 text-[10px] text-foreground">{p}</td>
              <td className={celda}>$ {v}</td>
              <td className="px-1.5 py-1">
                <span className="flex items-center justify-end gap-1">
                  <span className="h-1 w-10 rounded bg-muted overflow-hidden">
                    <span
                      className="block h-full rounded bg-[#0088D1]"
                      style={{ width: `${pct as number}%` }}
                    />
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">{pct}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockComparar() {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${cabecera} text-left`}>Proveedor</th>
            <th className={`${cabecera} text-right`}>ene</th>
            <th className={`${cabecera} text-right`}>feb</th>
            <th className={`${cabecera} text-right`}>mar</th>
            <th className={`${cabecera} text-right`}>Último</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["SCANIA", "22.240.860", "31.067.023", "32.898.868", "+5,9%", "#EF4444"],
            ["RUTA SUR", "12.901.342", "8.726.979", "4.526.278", "-48,1%", "#10B981"],
          ].map(([p, a, b, c, d, color]) => (
            <tr key={p as string} className="border-t border-border/50">
              <td className="px-1.5 py-1 text-[10px] text-foreground">{p}</td>
              <td className={celda}>{a}</td>
              <td className={celda}>{b}</td>
              <td className={celda}>{c}</td>
              <td className="px-1.5 py-1 text-[10px] font-mono text-right" style={{ color: color as string }}>
                {d}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockExport() {
  return (
    <div className="space-y-1.5">
      {[
        ["Detalle", "una fila por proveedor y mes"],
        ["Por mes", "el total de cada mes"],
        ["Por proveedor", "el acumulado de cada uno"],
      ].map(([hoja, que]) => (
        <div
          key={hoja}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
        >
          <Table2 size={12} className="text-[#10B981] shrink-0" />
          <span className="text-[10px] font-semibold text-foreground">{hoja}</span>
          <span className="text-[9px] text-muted-foreground">{que}</span>
        </div>
      ))}
    </div>
  );
}
