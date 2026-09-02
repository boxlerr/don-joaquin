/**
 * Hoja de estilos del reporte de autoconsumo.
 *
 * Va inline dentro de la página, igual que el legajo y el ranking: la pestaña de
 * impresión no comparte el tema del dashboard, y depender de Tailwind en un
 * documento que termina en papel es pedir sorpresas (modo oscuro, variables CSS
 * que el navegador no resuelve al imprimir, colores que salen grises).
 *
 * **Apaisado y no vertical**, que es la primera decisión de forma: el reporte que
 * manda YPF viene apaisado porque un tablero necesita ancho, y los dos papeles se
 * leen uno al lado del otro. En A4 apaisado con 12 mm de margen quedan 273 × 190
 * mm de tablero, que es lo que reparten las medidas de acá abajo.
 *
 * La identidad es la de Don Joaquín: el logo real arriba, el azul `#0088D1` como
 * único color de estructura, el amarillo sol sólo para la serie de lo cargado.
 * Fondo blanco y líneas de un pelo — nada de bloques pastel ni de cabeceras
 * oscuras: en papel se imprimen como manchas y en pantalla se ven como una plantilla
 * genérica, que es exactamente lo contrario de lo que este papel tiene que parecer.
 */
export const CSS_AUTOCONSUMO = `
  @page { size: A4 landscape; margin: 10mm 12mm; }

  body { background: white !important; }

  .doc {
    font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
    color: #0F172A;
    font-size: 10px;
    line-height: 1.4;
    /* Sin esto Chrome descarta los fondos al imprimir y los gráficos salen en
       blanco: acá el color no es decoración, es la diferencia entre las series. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Membrete ────────────────────────────────────────────────────── */
  .doc .membrete {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
    border-bottom: 2px solid #0088D1; padding-bottom: 7px;
  }
  .doc .membrete img { height: 52px; width: auto; display: block; }
  .doc .membrete .razon { font-size: 9.5px; color: #64748B; margin-top: 4px; }
  .doc .membrete .der { text-align: right; }
  .doc .membrete h1 {
    font-size: 20px; font-weight: 700; margin: 0; letter-spacing: 0.4px;
    text-transform: uppercase; line-height: 1.1;
  }
  .doc .membrete .periodo { font-size: 12px; color: #0088D1; font-weight: 600; margin-top: 1px; }
  .doc .membrete .emitido { font-size: 8.5px; color: #94A3B8; margin-top: 2px; }

  /* ── Banda de cifras ─────────────────────────────────────────────── */
  .doc .kpis {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 8px;
  }
  .doc .kpi { border: 1px solid #E2E8F0; border-left: 3px solid #CBD5E1; padding: 4px 9px 5px; }
  .doc .kpi.eje { border-left-color: #0088D1; }
  .doc .kpi .rot {
    font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.7px; color: #64748B;
    font-weight: 600; white-space: nowrap;
  }
  .doc .kpi .val {
    font-size: 20px; font-weight: 700; line-height: 1.12; margin-top: 1px;
    font-variant-numeric: tabular-nums; letter-spacing: -0.5px;
  }
  .doc .kpi .val .uni { font-size: 10px; font-weight: 600; color: #94A3B8; margin-left: 2px; }
  .doc .kpi .pie { font-size: 8px; color: #94A3B8; margin-top: 1px; }
  .doc .kpi.falta .val { color: #CBD5E1; }
  .doc .kpi .val.baja { color: #0088D1; }
  .doc .kpi .val.sube { color: #B91C1C; }

  /* ── Tablero ─────────────────────────────────────────────────────── */
  .doc .tablero {
    display: grid; grid-template-columns: 63fr 36fr; gap: 6px; margin-top: 7px;
    align-items: start;
  }
  .doc .col { display: flex; flex-direction: column; gap: 6px; }

  .doc .panel { border: 1px solid #E2E8F0; padding: 5px 7px 5px; page-break-inside: avoid; }
  /* El detalle puede tener cien filas: si se lo obliga a entrar entero, se va
     a la hoja siguiente y deja media página en blanco. Éste sí se puede partir:
     la fila de títulos se repite arriba de cada pedazo. */
  .doc .panel.largo { page-break-inside: auto; }
  .doc .panel > h2 {
    font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    color: #334155; margin: 0 0 5px; display: flex; justify-content: space-between;
    align-items: baseline; gap: 10px;
  }
  .doc .panel > h2 .sub {
    font-size: 8px; font-weight: 500; text-transform: none; letter-spacing: 0; color: #94A3B8;
  }
  .doc .leyenda { display: flex; gap: 11px; font-size: 8px; font-weight: 500;
    text-transform: none; letter-spacing: 0; color: #475569; }
  .doc .leyenda i { display: inline-block; width: 9px; height: 2.5px; margin-right: 3px;
    vertical-align: middle; font-style: normal; }

  .doc .grafico, .doc .medidor, .doc .barra-compo { display: block; width: 100%; height: auto; }
  .doc .medidor { max-width: 250px; margin: 0 auto; }

  /* Lo que no hay, dicho con palabras y no con un gráfico vacío. */
  .doc .sin-dato {
    border: 1px dashed #CBD5E1; padding: 10px 12px; text-align: center;
    font-size: 9px; color: #64748B; line-height: 1.5;
  }
  .doc .sin-dato b { color: #334155; display: block; font-size: 9.5px; margin-bottom: 2px; }

  /* ── Tablas ──────────────────────────────────────────────────────── */
  .doc table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .doc th {
    text-align: left; padding: 3px 5px; border-bottom: 1px solid #94A3B8;
    font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B;
    font-weight: 700; white-space: nowrap;
  }
  .doc td { padding: 2.2px 5px; border-bottom: 1px solid #F1F5F9; }
  .doc td.num, .doc th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .doc tr { page-break-inside: avoid; }
  .doc thead { display: table-header-group; }

  /* La cantera manda y el destino cuelga: dos niveles, ni uno más. */
  .doc tr.grupo td { background: #F8FAFC; font-weight: 700; border-bottom: 1px solid #E2E8F0; }
  .doc tr.hija td:first-child { padding-left: 16px; color: #475569; }
  .doc tr.total td {
    border-top: 1.5px solid #0F172A; border-bottom: none; font-weight: 700; padding-top: 4px;
  }
  .doc .apagado { color: #94A3B8; }
  .doc .marca-mixta { color: #B45309; font-weight: 700; }

  /* ── Fila de conciliación ────────────────────────────────────────── */
  .doc .conciliacion { margin-top: 5px; border: 1px solid #E2E8F0; padding: 5px 7px 5px; }
  .doc .conciliacion table td { padding: 3px 5px; font-size: 10px; }
  .doc .conciliacion .fuerte { font-weight: 700; font-size: 11px; }
  .doc .conciliacion .rojo { color: #B91C1C; }
  .doc .conciliacion .azul { color: #0088D1; }

  .doc .nota {
    margin-top: 6px; border-left: 2px solid #0088D1; padding: 5px 9px;
    font-size: 8.5px; color: #475569; line-height: 1.5; background: #F8FAFC;
  }
  .doc .nota b { color: #0F172A; }

  /* ── Hoja de respaldo ────────────────────────────────────────────── */
  .doc .salto { page-break-before: always; padding-top: 2mm; }
  .doc .salto h2.hoja {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px;
    color: #0088D1; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #E2E8F0;
  }
  .doc .dos-cuadros { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }

  @media screen {
    body { background: #EEF2F6 !important; }
    .doc {
      background: white; width: 297mm; box-sizing: border-box;
      margin: 20px auto; padding: 10mm 12mm;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
    }
  }
`;
