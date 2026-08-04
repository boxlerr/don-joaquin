"use client";

// La planilla del mes, pensada como una hoja de cálculo: se escribe en la celda,
// se navega con el teclado, se puede pegar el bloque copiado del Excel y se
// guarda solo. La referencia acá no es otra pantalla del sistema, es el Excel:
// si hay que abrir un modal por cada proveedor, el Excel gana.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Check, Loader2, Plus, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import { upsertCostoCeldaAction, type CostoRepRep } from "./actions";
import { amt, ars, claveProveedor, formatMilesAR, mesLabel, parseNum } from "./formato";

type Campo = "neto_gravado" | "facturado_gravado" | "neto_ng" | "facturado_ng";

const COLS: { key: Campo; label: string; corta: string }[] = [
  { key: "neto_gravado", label: "Neto 21%", corta: "Neto 21%" },
  { key: "facturado_gravado", label: "Facturado 21%", corta: "Fact. 21%" },
  { key: "neto_ng", label: "Neto no gravado", corta: "Neto NG" },
  { key: "facturado_ng", label: "Facturado no gravado", corta: "Fact. NG" },
];

/** Una fila de la planilla: puede existir en la base o ser todavía un renglón vacío. */
type Fila = {
  clave: string;
  proveedor: string;
  id: string | null;
  base: Record<Campo, number>;
  netoGuardado: number;
  facturadoGuardado: number;
  observaciones: string | null;
};

type Borradores = Record<string, Partial<Record<Campo, string>>>;
type Confirmados = Record<string, Partial<Record<Campo, number>>>;

type SortCol = "proveedor" | Campo | "neto" | "facturado";

// La tabla usa `border-separate`: con `border-collapse` los bordes del thead y
// del tfoot pegajosos se pintan en la capa de la tabla y se van con el scroll.
const thCls =
  "h-8 px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap bg-muted border-b border-border";
const tdCls = "py-0.5 border-b border-border/50";
const tfCls =
  "px-2 py-1.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap bg-muted border-t border-border";
const kbdCls =
  "rounded border border-border bg-muted px-1 py-px font-sans text-[10px] font-semibold text-foreground";
const numCls = "text-right font-mono text-[13px] tabular-nums whitespace-nowrap";
// La columna del proveedor queda fija: con el desglose son 9 columnas y sin esto
// uno scrollea sin saber de quién es el número que está mirando.
const fijaTh = "sticky left-0 z-30 bg-muted shadow-[1px_0_0_0_rgba(0,0,0,0.08)]";
const fijaTd = "sticky left-0 z-10 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.08)]";

const CAMPOS_VACIOS: Record<Campo, number> = {
  neto_gravado: 0,
  facturado_gravado: 0,
  neto_ng: 0,
  facturado_ng: 0,
};

/* ── Lectura de valores (puras: reciben los mapas, no leen refs) ─────────── */
const confirmado = (f: Fila, campo: Campo, conf: Confirmados) =>
  conf[f.clave]?.[campo] ?? f.base[campo];

const textoDe = (f: Fila, campo: Campo, bor: Borradores, conf: Confirmados) => {
  const t = bor[f.clave]?.[campo];
  if (t !== undefined) return t;
  const n = confirmado(f, campo, conf);
  return n ? String(n) : "";
};

/** Los negativos son válidos: una nota de crédito resta del mes. */
const valorDe = (f: Fila, campo: Campo, bor: Borradores, conf: Confirmados) => {
  const t = bor[f.clave]?.[campo];
  return t === undefined ? confirmado(f, campo, conf) : parseNum(t) ?? 0;
};

const tocada = (f: Fila, bor: Borradores, conf: Confirmados) =>
  bor[f.clave] !== undefined || conf[f.clave] !== undefined;

/**
 * Totales de la fila. Mientras nadie la toque se muestran los totales tal cual
 * los guardó el contador; en cuanto se edita pasan a ser la suma de las cuatro
 * columnas. Hay filas del Excel donde 21% + NG no llega al total, y mostrar la
 * suma en esas filas haría parecer que la pantalla calcula mal.
 */
function totalesDe(f: Fila, bor: Borradores, conf: Confirmados) {
  if (!tocada(f, bor, conf)) {
    return { neto: f.netoGuardado, facturado: f.facturadoGuardado, calculado: false };
  }
  const neto = valorDe(f, "neto_gravado", bor, conf) + valorDe(f, "neto_ng", bor, conf);
  const facturado =
    valorDe(f, "facturado_gravado", bor, conf) + valorDe(f, "facturado_ng", bor, conf);
  return { neto, facturado, calculado: true };
}

/** Campos con un valor nuevo distinto del guardado, listos para mandar. */
const pendientesDe = (f: Fila, bor: Borradores, conf: Confirmados): Campo[] =>
  COLS.map((c) => c.key).filter((campo) => {
    const t = bor[f.clave]?.[campo];
    if (t === undefined) return false;
    return (parseNum(t) ?? 0) !== confirmado(f, campo, conf);
  });

export default function CostosGrid({
  mes,
  rows,
  proveedoresPrevios,
  mesPrevio,
  proveedoresConocidos,
  canWrite,
  onCambiaron,
}: {
  /** Mes de la planilla, "YYYY-MM-DD". */
  mes: string;
  rows: CostoRepRep[];
  /** Proveedores del último mes cargado, cuando este mes está vacío. */
  proveedoresPrevios: string[];
  mesPrevio: string | null;
  /** Todos los proveedores del historial, para el alta. */
  proveedoresConocidos: string[];
  canWrite: boolean;
  /** Avisa que cambió algo que el servidor tiene que releer (totales del mes). */
  onCambiaron: () => void;
}) {
  const [borradores, setBorradores] = useState<Borradores>({});
  const [confirmados, setConfirmados] = useState<Confirmados>({});
  const [estado, setEstado] = useState<Record<string, "guardando" | "ok">>({});
  const [error, setError] = useState<string | null>(null);
  const [filaActiva, setFilaActiva] = useState<string | null>(null);
  const [proveedoresExtra, setProveedoresExtra] = useState<string[]>([]);
  const [agregando, setAgregando] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [pegado, setPegado] = useState<
    { filas: number; total: number; control: number | null; otroMes: string | null } | null
  >(null);

  // Espejo del estado para los caminos asíncronos (debounce, blur, guardado): si
  // leyeran del closure se llevarían valores viejos.
  const borradoresRef = useRef(borradores);
  const confirmadosRef = useRef(confirmados);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const okTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const snapshotPegado = useRef<{ borradores: Borradores; extra: string[] } | null>(null);
  const cambiosSinAvisar = useRef(false);

  useEffect(() => {
    const t = timers.current;
    const ok = okTimers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
      Object.values(ok).forEach(clearTimeout);
    };
  }, []);

  const aplicarBorradores = useCallback((next: Borradores) => {
    borradoresRef.current = next;
    setBorradores(next);
  }, []);

  /* ── Filas ─────────────────────────────────────────────────────────────── */
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({
    col: "proveedor",
    dir: "asc",
  });

  // Alfabético por defecto: con autoguardado, ordenar por importe hace saltar la
  // fila que se está editando.
  const filas = useMemo<Fila[]>(() => {
    const base: Fila[] = rows.map((r) => ({
      clave: claveProveedor(r.proveedor),
      proveedor: r.proveedor,
      id: r.id,
      base: {
        neto_gravado: Number(r.neto_gravado),
        facturado_gravado: Number(r.facturado_gravado),
        neto_ng: Number(r.neto_ng),
        facturado_ng: Number(r.facturado_ng),
      },
      netoGuardado: Number(r.neto_total),
      facturadoGuardado: Number(r.facturado_total),
      observaciones: r.observaciones,
    }));
    const yaEstan = new Set(base.map((f) => f.clave));
    // Renglones en blanco: los proveedores del mes anterior cuando este mes está
    // vacío, más los que se agreguen a mano. Desaparecen solos al guardarse.
    for (const p of [...proveedoresPrevios, ...proveedoresExtra]) {
      const clave = claveProveedor(p);
      if (yaEstan.has(clave)) continue;
      yaEstan.add(clave);
      base.push({
        clave,
        proveedor: p,
        id: null,
        base: { ...CAMPOS_VACIOS },
        netoGuardado: 0,
        facturadoGuardado: 0,
        observaciones: null,
      });
    }
    return base;
  }, [rows, proveedoresPrevios, proveedoresExtra]);

  // El orden se calcula con los valores del servidor, no con lo que se tipea.
  const orden = useMemo(() => {
    const f = sort.dir === "asc" ? 1 : -1;
    return [...filas].sort((a, b) => {
      if (sort.col === "proveedor") return f * a.proveedor.localeCompare(b.proveedor, "es");
      if (sort.col === "neto") return f * (a.netoGuardado - b.netoGuardado);
      if (sort.col === "facturado") return f * (a.facturadoGuardado - b.facturadoGuardado);
      return f * (a.base[sort.col] - b.base[sort.col]);
    });
  }, [filas, sort]);

  const ordenRef = useRef(orden);
  useEffect(() => {
    ordenRef.current = orden;
  }, [orden]);
  const indiceDe = useMemo(() => new Map(orden.map((f, i) => [f.clave, i])), [orden]);

  const toggleSort = (col: SortCol) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "desc" ? "asc" : "desc" }
        : { col, dir: col === "proveedor" ? "asc" : "desc" },
    );
  const flecha = (col: SortCol) =>
    sort.col === col ? (
      sort.dir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />
    ) : (
      <ArrowUpDown size={11} className="opacity-30" />
    );

  /* ── Guardado ──────────────────────────────────────────────────────────── */
  const marcarOk = useCallback((clave: string) => {
    setEstado((s) => ({ ...s, [clave]: "ok" }));
    clearTimeout(okTimers.current[clave]);
    okTimers.current[clave] = setTimeout(
      () =>
        setEstado((s) => {
          const n = { ...s };
          delete n[clave];
          return n;
        }),
      1800,
    );
  }, []);

  const guardarFila = useCallback(
    async (f: Fila) => {
      const bor = borradoresRef.current;
      const conf = confirmadosRef.current;
      if (pendientesDe(f, bor, conf).length === 0) return;

      setEstado((s) => ({ ...s, [f.clave]: "guardando" }));
      setError(null);

      const campos = {
        neto_gravado: valorDe(f, "neto_gravado", bor, conf),
        facturado_gravado: valorDe(f, "facturado_gravado", bor, conf),
        neto_ng: valorDe(f, "neto_ng", bor, conf),
        facturado_ng: valorDe(f, "facturado_ng", bor, conf),
      };
      const res = await upsertCostoCeldaAction(mes.slice(0, 7), f.proveedor, campos);

      setEstado((s) => {
        const n = { ...s };
        delete n[f.clave];
        return n;
      });
      if (!res.ok) {
        setError(`${f.proveedor}: ${res.error}`);
        return;
      }

      const proximosConf: Confirmados = {
        ...confirmadosRef.current,
        [f.clave]: { ...(confirmadosRef.current[f.clave] ?? {}), ...campos },
      };
      confirmadosRef.current = proximosConf;
      setConfirmados(proximosConf);

      // Se limpian sólo los borradores que siguen coincidiendo con lo guardado:
      // si mientras tanto se siguió escribiendo, ese borrador queda y se re-guarda.
      const fila = { ...(borradoresRef.current[f.clave] ?? {}) };
      for (const [campo, n] of Object.entries(campos) as [Campo, number][]) {
        const t = fila[campo];
        if (t !== undefined && (parseNum(t) ?? 0) === n) delete fila[campo];
      }
      const proximos = { ...borradoresRef.current };
      if (Object.keys(fila).length === 0) delete proximos[f.clave];
      else proximos[f.clave] = fila;
      aplicarBorradores(proximos);

      marcarOk(f.clave);
      cambiosSinAvisar.current = true;
    },
    [mes, marcarOk, aplicarBorradores],
  );

  const guardarYa = useCallback(
    (f: Fila) => {
      clearTimeout(timers.current[f.clave]);
      void guardarFila(f);
    },
    [guardarFila],
  );
  const programarGuardado = useCallback(
    (f: Fila) => {
      clearTimeout(timers.current[f.clave]);
      timers.current[f.clave] = setTimeout(() => void guardarFila(f), 1100);
    },
    [guardarFila],
  );

  // Los totales del mes los recalcula el servidor: se le avisa cuando la persona
  // deja de escribir, no en cada guardado.
  useEffect(() => {
    const t = setInterval(() => {
      if (!cambiosSinAvisar.current) return;
      cambiosSinAvisar.current = false;
      onCambiaron();
    }, 4000);
    return () => clearInterval(t);
  }, [onCambiaron]);

  const escribir = (ev: React.ChangeEvent<HTMLInputElement>, f: Fila, campo: Campo) => {
    const el = ev.target;
    // Al reformatear con puntos de miles el cursor se iba al final y editar el
    // medio de un número era imposible: se cuenta cuántos dígitos había antes del
    // cursor y se lo vuelve a poner después del mismo dígito.
    const digitosAntes = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length;

    aplicarBorradores({
      ...borradoresRef.current,
      [f.clave]: {
        ...(borradoresRef.current[f.clave] ?? {}),
        // Se sacan los puntos de miles y se conserva la coma decimal.
        [campo]: el.value.replace(/\./g, ""),
      },
    });
    programarGuardado(f);

    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      let d = 0;
      let i = 0;
      while (i < el.value.length && d < digitosAntes) {
        if (/\d/.test(el.value[i])) d++;
        i++;
      }
      el.setSelectionRange(i, i);
    });
  };

  /* ── Teclado ───────────────────────────────────────────────────────────── */
  const idCelda = (r: number, c: number) => `costo-celda-${r}-${c}`;
  const irA = (r: number, c: number) => {
    const el = document.getElementById(idCelda(r, c)) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    el.select();
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>, f: Fila, r: number, c: number) => {
    const input = ev.currentTarget;
    if (ev.key === "Enter") {
      ev.preventDefault();
      guardarYa(f);
      irA(r + (ev.shiftKey ? -1 : 1), c);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      irA(r + 1, c);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      irA(r - 1, c);
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      const proximos = { ...borradoresRef.current };
      const fila = { ...(proximos[f.clave] ?? {}) };
      delete fila[COLS[c].key];
      if (Object.keys(fila).length === 0) delete proximos[f.clave];
      else proximos[f.clave] = fila;
      aplicarBorradores(proximos);
      clearTimeout(timers.current[f.clave]);
    } else if (ev.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
      // Sólo con el cursor en el borde: adentro de la celda se sigue editando texto.
      if (c > 0) {
        ev.preventDefault();
        irA(r, c - 1);
      }
    } else if (
      ev.key === "ArrowRight" &&
      input.selectionStart === input.value.length &&
      input.selectionEnd === input.value.length
    ) {
      if (c < COLS.length - 1) {
        ev.preventDefault();
        irA(r, c + 1);
      }
    }
  };

  const onBlur = (f: Fila) => {
    // Al salir de la fila se guarda ya; entre celdas de la misma fila, no.
    setTimeout(() => {
      const activo = document.activeElement as HTMLElement | null;
      if (activo?.dataset?.fila === f.clave) return;
      setFilaActiva((x) => (x === f.clave ? null : x));
      if (pendientesDe(f, borradoresRef.current, confirmadosRef.current).length > 0) guardarYa(f);
    }, 0);
  };

  /* ── Pegar el bloque copiado del Excel ─────────────────────────────────── */
  const onPaste = (ev: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const txt = ev.clipboardData.getData("text/plain");
    if (!txt || (!txt.includes("\t") && !txt.includes("\n"))) return; // un valor suelto: pegado normal
    ev.preventDefault();

    // El export contable marca los costos entre paréntesis; una línea sin
    // paréntesis es una nota de crédito y va en negativo. Si el bloque no tiene
    // ningún paréntesis se lee como números comunes.
    const contable = /\(\s*[\d.,]+\s*\)/.test(txt);
    const num = (s: string) => (contable ? amt(s) : parseNum(s));

    let matriz = txt
      .replace(/\r/g, "")
      .replace(/\n+$/, "")
      .split("\n")
      .map((l) => l.split("\t"));

    // Encabezados: filas donde ninguna celda (salvo quizá la primera) es un número.
    while (matriz.length > 1 && matriz[0].every((celda) => num(celda) == null)) {
      matriz = matriz.slice(1);
    }

    // Columna de mes al principio ("marzo '26"): se saca, y si trae un mes
    // distinto del que está abierto se avisa — no se corrige solo.
    let otroMes: string | null = null;
    const pareceMes = (s: string) => /^[a-záéíóúñ]+\s*'?\d{2,4}$/i.test(s.trim());
    if (matriz.length > 0 && matriz.every((l) => l.length > 2 && pareceMes(l[0]))) {
      const distinto = matriz.find((l) => {
        const m = l[0].trim().toLowerCase();
        return !mesLabel(mes).toLowerCase().startsWith(m.split(/\s|'/)[0]);
      });
      if (distinto) otroMes = distinto[0].trim();
      matriz = matriz.map((l) => l.slice(1));
    }

    // Fila "Total" del Excel: no se carga, se usa para chequear la suma.
    let control: number | null = null;
    matriz = matriz.filter((l) => {
      if (!/^total$/i.test((l[0] ?? "").trim())) return true;
      for (let i = l.length - 1; i > 0; i--) {
        const v = num(l[i]);
        if (v != null) {
          control = v;
          break;
        }
      }
      return false;
    });

    // ¿Trae la columna de proveedores? Si sí, cada línea se ancla POR NOMBRE y
    // no por la celda donde está el cursor: eso es lo que convierte el pegado en
    // la carga del mes entero.
    const conNombres =
      matriz.length > 0 &&
      matriz.every((l) => l.length > 1 && num(l[0]) == null) &&
      matriz.filter((l) => (l[0] ?? "").trim() !== "").length > matriz.length / 2;

    snapshotPegado.current = { borradores: borradoresRef.current, extra: proveedoresExtra };

    const proximos: Borradores = { ...borradoresRef.current };
    const nuevos: string[] = [];
    const tocadas = new Map<string, Fila>();
    const porClave = new Map(ordenRef.current.map((f) => [f.clave, f]));
    let sumaFacturado = 0;

    matriz.forEach((linea, dr) => {
      let fila: Fila | undefined;
      let desdeCol = 0;

      if (conNombres) {
        const nombre = (linea[0] ?? "").replace(/^\s*Prov\s*\//i, "").replace(/\s+/g, " ").trim();
        if (!nombre) return;
        const clave = claveProveedor(nombre);
        fila = porClave.get(clave);
        if (!fila) {
          fila = {
            clave,
            proveedor: nombre,
            id: null,
            base: { ...CAMPOS_VACIOS },
            netoGuardado: 0,
            facturadoGuardado: 0,
            observaciones: null,
          };
          porClave.set(clave, fila);
          nuevos.push(nombre);
        }
        desdeCol = 0;
      } else {
        fila = ordenRef.current[r + dr];
        desdeCol = c;
      }
      if (!fila) return;

      const valores = conNombres ? linea.slice(1) : linea;
      let cambio = false;
      valores.forEach((celda, dc) => {
        const col = COLS[desdeCol + dc];
        if (!col) return;
        const vacia = celda.replace(/[^\d,.()-]/g, "").trim() === "";
        const n = vacia ? 0 : num(celda);
        if (n == null) return; // no era un número: esa celda se ignora
        proximos[fila!.clave] = { ...(proximos[fila!.clave] ?? {}), [col.key]: String(n) };
        cambio = true;
      });
      if (cambio) {
        tocadas.set(fila.clave, fila);
        const g = proximos[fila.clave]?.facturado_gravado;
        const ng = proximos[fila.clave]?.facturado_ng;
        sumaFacturado += (g ? parseNum(g) ?? 0 : 0) + (ng ? parseNum(ng) ?? 0 : 0);
      }
    });

    if (nuevos.length > 0) setProveedoresExtra((p) => [...p, ...nuevos]);
    aplicarBorradores(proximos);
    for (const f of tocadas.values()) guardarYa(f);
    setPegado({ filas: tocadas.size, total: sumaFacturado, control, otroMes });
  };

  const deshacerPegado = () => {
    const snap = snapshotPegado.current;
    if (!snap) return;
    aplicarBorradores(snap.borradores);
    setProveedoresExtra(snap.extra);
    setPegado(null);
    snapshotPegado.current = null;
    setError(
      "Se deshizo lo pegado en la pantalla. Lo que ya se había guardado sigue en la base: revisá los importes.",
    );
  };

  /* ── Totales ───────────────────────────────────────────────────────────── */
  const totales = useMemo(() => {
    const porCol: Record<Campo, number> = { ...CAMPOS_VACIOS };
    let neto = 0;
    let facturado = 0;
    for (const f of filas) {
      for (const c of COLS) porCol[c.key] += valorDe(f, c.key, borradores, confirmados);
      const t = totalesDe(f, borradores, confirmados);
      neto += t.neto;
      facturado += t.facturado;
    }
    return { porCol, neto, facturado };
  }, [filas, borradores, confirmados]);

  const guardando = Object.values(estado).some((s) => s === "guardando");
  // Se mira si queda algo distinto de lo guardado, no si hay borradores:
  // reescribir el mismo importe deja un borrador que nunca se manda.
  const sinGuardar =
    !guardando && filas.some((f) => pendientesDe(f, borradores, confirmados).length > 0);
  const recienGuardado =
    !guardando && !sinGuardar && Object.values(estado).some((s) => s === "ok");

  const inputCls =
    "h-6 w-full rounded-[4px] border border-transparent bg-transparent px-1.5 text-right font-mono text-[13px] tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 hover:border-border focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/15";

  const agregarProveedor = (nombre: string) => {
    const limpio = nombre.replace(/^\s*Prov\s*\//i, "").replace(/\s+/g, " ").trim();
    if (!limpio) return;
    const clave = claveProveedor(limpio);
    const ya = filas.find((f) => f.clave === clave);
    setAgregando(false);
    setNuevoProveedor("");
    if (!ya) setProveedoresExtra((p) => [...p, limpio]);
    requestAnimationFrame(() => {
      const i = ordenRef.current.findIndex((f) => f.clave === clave);
      if (i >= 0) irA(i, 0);
    });
  };

  const parecido = useMemo(() => {
    const t = nuevoProveedor.trim();
    if (t.length < 3) return null;
    const clave = claveProveedor(t);
    if (filas.some((f) => f.clave === clave)) return null;
    return (
      proveedoresConocidos.find(
        (p) => claveProveedor(p).startsWith(clave) || clave.startsWith(claveProveedor(p)),
      ) ?? null
    );
  }, [nuevoProveedor, filas, proveedoresConocidos]);

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      {/* Resumen del mes en una línea: en tarjetas se come el alto que la
          planilla necesita para entrar entera. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Facturado
          </span>
          <span className="font-mono text-base font-bold text-foreground tabular-nums">
            {ars(totales.facturado)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {filas.length} proveedor{filas.length === 1 ? "" : "es"}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Neto
          </span>
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {ars(totales.neto)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            IVA
          </span>
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {ars(totales.facturado - totales.neto)}
          </span>
        </div>
        {canWrite && (
          <div className="ml-auto text-[11px] text-muted-foreground inline-flex items-center gap-1.5 min-w-[7rem] justify-end">
            {guardando ? (
              <>
                <Loader2 size={12} className="animate-spin text-primary" /> Guardando…
              </>
            ) : sinGuardar ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Sin guardar
              </>
            ) : recienGuardado ? (
              <>
                <Check size={12} className="text-emerald-600" /> Guardado
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Resultado del pegado, con el chequeo contra la fila Total del Excel */}
      {pegado && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs border-b border-border">
          <span className="text-foreground">
            Se cargaron <strong>{pegado.filas}</strong> proveedor{pegado.filas === 1 ? "" : "es"} ·{" "}
            <span className="font-mono tabular-nums">{ars(pegado.total)}</span>
          </span>
          {pegado.control != null &&
            (Math.abs(pegado.control - pegado.total) < 1 ? (
              <span className="text-[#10B981] inline-flex items-center gap-1">
                <Check size={12} /> coincide con el total del Excel
              </span>
            ) : (
              <span className="text-[#F59E0B]">
                el Excel dice{" "}
                <span className="font-mono tabular-nums">{ars(pegado.control)}</span>, difieren{" "}
                <span className="font-mono tabular-nums">
                  {ars(Math.abs(pegado.control - pegado.total))}
                </span>
              </span>
            ))}
          {pegado.otroMes && (
            <span className="text-[#F59E0B]">
              el bloque incluye {pegado.otroMes}; se cargó todo en {mesLabel(mes)}
            </span>
          )}
          <button
            type="button"
            onClick={deshacerPegado}
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Undo2 size={12} /> Deshacer
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border-b border-destructive/20 px-4 py-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar el aviso">
            <X size={13} />
          </button>
        </p>
      )}

      {mesPrevio && rows.length === 0 && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border">
          {mesLabel(mes)} está sin cargar. Se trajeron los {proveedoresPrevios.length} proveedores de{" "}
          {mesLabel(mesPrevio)} con las celdas vacías: escribí los importes o pegá el bloque del Excel.
        </p>
      )}

      {orden.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          {mesLabel(mes)} no tiene costos cargados.
          <span className="block mt-1 text-xs">
            Agregá un proveedor abajo o pegá el bloque del Excel sobre la primera celda.
          </span>
        </div>
      ) : (
        // Caja con alto propio: el encabezado y los totales quedan fijos y el
        // resto scrollea adentro, sin arrastrar toda la página.
        <div className="overflow-auto max-h-[calc(100dvh-22rem)] min-h-[15rem]">
          <table className="w-full min-w-[880px] text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className={`${thCls} ${fijaTh} text-left pl-4 min-w-[13rem]`}>
                  <button
                    type="button"
                    onClick={() => toggleSort("proveedor")}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sort.col === "proveedor" ? "text-foreground" : ""}`}
                  >
                    Proveedor {flecha("proveedor")}
                  </button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className={`${thCls} text-right`}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      title={c.label}
                      className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${sort.col === c.key ? "text-foreground" : ""}`}
                    >
                      {c.corta} {flecha(c.key)}
                    </button>
                  </th>
                ))}
                <th className={`${thCls} text-right`}>
                  <button
                    type="button"
                    onClick={() => toggleSort("neto")}
                    className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${sort.col === "neto" ? "text-foreground" : ""}`}
                  >
                    Neto {flecha("neto")}
                  </button>
                </th>
                <th className={`${thCls} text-right`}>IVA</th>
                <th className={`${thCls} text-right`}>
                  <button
                    type="button"
                    onClick={() => toggleSort("facturado")}
                    className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${sort.col === "facturado" ? "text-foreground" : ""}`}
                  >
                    Facturado {flecha("facturado")}
                  </button>
                </th>
                <th className={`${thCls} w-7`} />
              </tr>
            </thead>

            <tbody>
              {orden.map((f) => {
                const r = indiceDe.get(f.clave) ?? 0;
                const st = estado[f.clave];
                const activa = filaActiva === f.clave;
                const t = totalesDe(f, borradores, confirmados);
                const credito = t.facturado < 0;
                // Filas del Excel donde 21% + NG no llega al total guardado.
                const descuadre =
                  !t.calculado &&
                  (Math.abs(f.base.neto_gravado + f.base.neto_ng - f.netoGuardado) > 0.01 ||
                    Math.abs(
                      f.base.facturado_gravado + f.base.facturado_ng - f.facturadoGuardado,
                    ) > 0.01);
                return (
                  <tr
                    key={f.clave}
                    className={`transition-colors ${activa ? "bg-primary/[0.04]" : "hover:bg-muted/20"}`}
                  >
                    <td className={`${tdCls} ${fijaTd} pl-4 pr-2 min-w-[13rem]`}>
                      <span className="block text-[13px] font-medium text-foreground">
                        {f.proveedor}
                      </span>
                      {f.id === null && (
                        <span className="block text-[11px] text-muted-foreground">Sin cargar</span>
                      )}
                      {credito && (
                        <span className="block text-[11px] text-[#F59E0B]">Nota de crédito</span>
                      )}
                      {descuadre && (
                        <span className="block text-[11px] text-[#F59E0B]">
                          El 21% y el NG no llegan al total
                        </span>
                      )}
                      {f.observaciones && (
                        <span className="block text-[11px] text-muted-foreground">
                          {f.observaciones}
                        </span>
                      )}
                    </td>
                    {COLS.map((c, ci) => (
                      <td key={c.key} className={`${tdCls} px-1.5`}>
                        {canWrite ? (
                          <input
                            id={idCelda(r, ci)}
                            data-fila={f.clave}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`${c.label} de ${f.proveedor}`}
                            value={formatMilesAR(textoDe(f, c.key, borradores, confirmados))}
                            onFocus={(ev) => {
                              ev.currentTarget.select();
                              setFilaActiva(f.clave);
                            }}
                            onChange={(ev) => escribir(ev, f, c.key)}
                            onKeyDown={(ev) => onKeyDown(ev, f, r, ci)}
                            onPaste={(ev) => onPaste(ev, r, ci)}
                            onBlur={() => onBlur(f)}
                            className={inputCls}
                          />
                        ) : (
                          <span className={`block ${numCls} text-muted-foreground`}>
                            {confirmado(f, c.key, confirmados)
                              ? ars(confirmado(f, c.key, confirmados))
                              : "—"}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className={`${tdCls} px-2 ${numCls} text-foreground/80`}>{ars(t.neto)}</td>
                    <td className={`${tdCls} px-2 ${numCls} text-foreground/80`}>
                      {ars(t.facturado - t.neto)}
                    </td>
                    <td
                      className={`${tdCls} px-2 ${numCls} font-semibold ${credito ? "text-[#F59E0B]" : "text-foreground"}`}
                    >
                      {ars(t.facturado)}
                    </td>
                    <td className={`${tdCls} w-7 pr-2 text-center align-middle`}>
                      {st === "guardando" ? (
                        <Loader2 size={12} className="animate-spin text-primary inline" />
                      ) : st === "ok" ? (
                        <Check size={12} className="text-emerald-600 inline" />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td
                  className={`${tfCls} ${fijaTd} !bg-muted z-30 pl-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground`}
                >
                  Total
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className={`${tfCls} text-foreground`}>
                    {ars(totales.porCol[c.key])}
                  </td>
                ))}
                <td className={`${tfCls} text-foreground`}>{ars(totales.neto)}</td>
                <td className={`${tfCls} text-foreground`}>
                  {ars(totales.facturado - totales.neto)}
                </td>
                <td className={`${tfCls} font-black text-foreground`}>{ars(totales.facturado)}</td>
                <td className={`${tfCls} w-7`} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canWrite && (
        <div className="px-4 py-2 border-t border-border space-y-2">
          {agregando ? (
            <div className="max-w-sm space-y-1">
              <PlaceCombobox
                label="Proveedor nuevo"
                name="proveedor-nuevo"
                value={nuevoProveedor}
                onValueChange={setNuevoProveedor}
                onSelect={agregarProveedor}
                options={proveedoresConocidos.map((p) => ({ id: p, label: p }))}
                icon={Building2}
                placeholder="Ej: SCANIA ARGENTINA S.A."
              />
              {parecido && (
                <p className="text-[11px] text-muted-foreground">
                  «{nuevoProveedor.trim()}» se parece a «{parecido}».{" "}
                  <button
                    type="button"
                    onClick={() => agregarProveedor(parecido)}
                    className="text-primary hover:underline"
                  >
                    Usar el existente
                  </button>
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => agregarProveedor(nuevoProveedor)} disabled={!nuevoProveedor.trim()}>
                  Agregar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAgregando(false); setNuevoProveedor(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAgregando(true)}>
              <Plus size={14} /> Agregar proveedor
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground">
            Se escribe directo en la celda y <strong className="text-foreground">se guarda solo</strong>.{" "}
            <kbd className={kbdCls}>Tab</kbd> pasa a la siguiente, <kbd className={kbdCls}>Enter</kbd>{" "}
            baja una fila, <kbd className={kbdCls}>Esc</kbd> deshace la celda. También podés{" "}
            <strong className="text-foreground">copiar el bloque del Excel y pegarlo</strong> sobre la
            primera celda: los proveedores se reconocen por el nombre y los que falten se crean.
          </p>
        </div>
      )}
    </div>
  );
}
