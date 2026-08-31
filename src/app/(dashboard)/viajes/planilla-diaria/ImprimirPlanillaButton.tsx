"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { getPlanillaImpresionAction } from "./actions";

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Abre una ventana con la hoja de asignación en el formato de la fotocopia que
 * usan a mano (tabla con bordes: chofer, CUIL, tractor, semi/acop, localidad) y
 * dispara la impresión. Al pie van los equipos que quedaron sin chofer.
 *
 * El teléfono se sacó a pedido de Nico (31/08): venía de la fotocopia original y
 * en la hoja del día no lo usa nadie.
 */
export default function ImprimirPlanillaButton({ fecha }: { fecha: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = async () => {
    setLoading(true);
    setError(null);
    const res = await getPlanillaImpresionAction(fecha);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }

    const filas = res.rows
      .map(
        (r, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(r.nombre)}</td>
        <td class="m">${esc(r.cuil)}</td>
        <td class="m">${esc(r.tractor)}</td>
        <td class="m">${esc(r.acoplado)}</td>
        <td>${esc(r.localidad)}</td>
      </tr>`,
      )
      .join("");

    // Los equipos que quedaron parados. Van al pie y en su propia tabla: es la
    // pregunta que se hace al mirar la hoja ("¿qué unidad queda libre hoy?") y en
    // la lista de choferes no se puede leer, porque un camión sin nadie no aparece.
    const libres = res.sinChofer
      .map(
        (e, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="m">${esc(e.tractor)}</td>
        <td class="m">${esc(e.acoplado)}</td>
      </tr>`,
      )
      .join("");

    const bloqueLibres = res.sinChofer.length
      ? `<div class="libres">
          <h2>Equipos sin chofer asignado (${res.sinChofer.length})</h2>
          <table class="chica">
            <thead><tr><th>#</th><th>Tractor / Chasis</th><th>Semi / Acop.</th></tr></thead>
            <tbody>${libres}</tbody>
          </table>
        </div>`
      : `<p class="nota">Todos los equipos quedaron con chofer asignado.</p>`;

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>Hoja de asignación ${fmtFecha(fecha)}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
        h1 { font-size: 14px; text-align: center; margin: 0 0 2px; letter-spacing: .3px; }
        .sub { font-size: 11px; text-align: center; margin: 0 0 8px; }
        table { border-collapse: collapse; width: 100%; }
        /* 11px: al sacar el teléfono sobró ancho y Nico lo pidió para que el
           resto de los datos se lea más grande. */
        th, td { border: 1px solid #000; padding: 3px 5px; font-size: 11px; line-height: 1.2; }
        th { background: #e3e3e3; font-weight: bold; text-transform: uppercase; }
        td.c { text-align: center; width: 26px; }
        td.m { font-family: "Courier New", monospace; white-space: nowrap; }
        tr:nth-child(even) td { background: #f6f6f6; }
        .libres { margin-top: 10px; page-break-inside: avoid; }
        .libres h2 { font-size: 12px; text-transform: uppercase; margin: 0 0 3px; letter-spacing: .3px; }
        .libres table.chica { width: auto; min-width: 45%; }
        p.nota { font-size: 11px; margin: 10px 0 0; }
        @media print {
          th, tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style></head>
      <body>
        <h1>DON JOAQUÍN HNOS. S.R.L. — HOJA DE ASIGNACIÓN</h1>
        <p class="sub">Fecha: ${fmtFecha(fecha)} · ${res.rows.length} choferes</p>
        <table>
          <thead><tr>
            <th>#</th><th>Chofer</th><th>CUIL</th><th>Tractor / Chasis</th>
            <th>Semi / Acop.</th><th>Localidad</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>
        ${bloqueLibres}
      </body></html>`;

    const w = window.open("", "_blank", "width=980,height=720");
    if (!w) {
      setError("Habilitá las ventanas emergentes para imprimir.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
        Imprimir hoja
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
