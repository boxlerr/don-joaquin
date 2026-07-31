/**
 * Hoja de estilos del legajo impreso.
 *
 * Va como <style> inline dentro de la página (mismo patrón que el ranking): la
 * pestaña de impresión no comparte el tema del dashboard, y depender de Tailwind
 * en un documento que termina en papel es pedir sorpresas (dark mode, variables
 * CSS que el navegador no resuelve al imprimir, colores que salen grises).
 *
 * Negro sobre blanco, un solo color de acento y líneas finas. Nada de fondos
 * pastel: en papel se imprimen como manchas grises.
 */
export const CSS_LEGAJO = `
  @page { size: A4 portrait; margin: 12mm 14mm; }

  body { background: white !important; }

  .doc {
    font-family: var(--font-inter), -apple-system, system-ui, sans-serif;
    color: #111;
    max-width: 210mm;
    margin: 0 auto;
    padding: 0 4mm;
    font-size: 11px;
    line-height: 1.45;
  }

  /* ── Encabezado ─────────────────────────────────────────────────── */
  .doc .membrete {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 2px solid #0088D1;
    padding-bottom: 10px;
  }
  .doc .membrete img { height: 38px; width: auto; }
  .doc .membrete .der { text-align: right; font-size: 9px; color: #666; line-height: 1.5; }
  .doc .membrete .tipo {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #111;
  }

  /* ── Ficha de la persona ────────────────────────────────────────── */
  .doc .ficha { display: flex; gap: 14px; align-items: flex-start; margin-top: 14px; }
  .doc .ficha .foto {
    width: 78px; height: 78px; border-radius: 4px; object-fit: cover;
    border: 1px solid #ddd; flex: 0 0 auto; background: #f5f5f5;
  }
  .doc .ficha .sinfoto {
    width: 78px; height: 78px; border-radius: 4px; border: 1px dashed #ccc;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; color: #999; text-align: center; flex: 0 0 auto;
  }
  .doc .ficha h1 { font-size: 19px; font-weight: 700; margin: 0; letter-spacing: -0.2px; }
  .doc .ficha .sub { font-size: 11px; color: #555; margin-top: 2px; }
  .doc .ficha .linea { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 10.5px; }
  .doc .ficha .linea b { font-weight: 600; }

  .doc .estado {
    display: inline-block; padding: 1px 7px; border: 1px solid #ccc; border-radius: 3px;
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #444;
  }
  .doc .estado.activo { border-color: #A7D8B8; color: #1B6E42; }

  /* ── Secciones ──────────────────────────────────────────────────── */
  .doc section { margin-top: 16px; page-break-inside: auto; }
  .doc h2 {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px;
    color: #0088D1; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e3e3e3;
  }
  .doc h2 .cant { color: #999; font-weight: 600; letter-spacing: 0; text-transform: none; }
  .doc .vacio { color: #999; font-style: italic; font-size: 10px; padding: 3px 0; }

  /* Grilla de campos (etiqueta arriba, valor abajo) */
  .doc .campos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px 14px; }
  .doc .campos.c3 { grid-template-columns: repeat(3, 1fr); }
  .doc .campo .et {
    font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; display: block;
  }
  .doc .campo .va { font-size: 11px; color: #111; }
  .doc .campo .va.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .doc .campo .va.falta { color: #aaa; }
  .doc .ancho { grid-column: 1 / -1; }

  /* Tablas */
  .doc table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .doc th, .doc td { padding: 4px 6px; border-bottom: 1px solid #ececec; text-align: left; vertical-align: top; }
  .doc th {
    font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    color: #666; border-bottom: 1px solid #d5d5d5;
  }
  .doc td.num, .doc th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .doc td.ctr, .doc th.ctr { text-align: center; }
  .doc tr { page-break-inside: avoid; }
  .doc thead { display: table-header-group; }
  .doc .apagado { color: #888; }
  .doc .alerta { color: #B91C1C; font-weight: 600; }

  /* KPIs */
  .doc .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .doc .kpi { border: 1px solid #e6e6e6; border-radius: 3px; padding: 6px 8px; }
  .doc .kpi .et { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #888; display: block; }
  .doc .kpi .va { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }

  .doc .nota { font-size: 9.5px; color: #666; margin-top: 4px; }
  .doc .confidencial {
    border: 1px solid #ddd; border-radius: 3px; padding: 2px 6px; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.5px; color: #B91C1C; font-weight: 700;
  }

  .doc footer {
    margin-top: 20px; padding-top: 8px; border-top: 1px solid #e3e3e3;
    font-size: 8.5px; color: #888; display: flex; justify-content: space-between;
  }

  /* Cada bloque grande arranca en página nueva si no entra entero. */
  .doc .salto { page-break-before: always; }

  @media print {
    .doc .no-print { display: none !important; }
    .doc { padding: 0; }
  }
  @media screen {
    body { background: #f5f5f5 !important; }
    .doc {
      background: white;
      margin: 24px auto;
      padding: 16mm 14mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
  }
`;
