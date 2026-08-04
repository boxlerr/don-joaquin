"use client";

// Planilla del mes de administración y taller, pensada como una hoja de cálculo:
// se escribe en la celda, se navega con el teclado, se puede pegar un bloque
// copiado del Excel y se guarda solo. Bárbara viene del Excel; si acá tiene que
// abrir un modal por cada número y apretar "Guardar" fila por fila, el Excel gana.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, History, Loader2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  registrarAumentoAction,
  upsertSueldoAdminMesAction,
  type SueldoAdminEmpleado,
} from "./actions";
import { formatMiles, mesActual, mesCortoLabel, parseNum, pesos, pct1 } from "./formato";

type CampoVar = "comisionLogistica" | "combustible" | "plusYpf" | "sabados";
type CampoEdit = "sueldoBase" | CampoVar;

/** Lo que se está escribiendo, sin guardar (texto crudo, por empleado y campo). */
type Borradores = Record<string, Partial<Record<CampoEdit, string>>>;
/** Lo último que el servidor confirmó, para no depender de un refresh completo. */
type Confirmados = Record<string, Partial<Record<CampoEdit, number>>>;

const VARIABLES: CampoVar[] = ["comisionLogistica", "combustible", "plusYpf", "sabados"];
const COLS: { key: CampoEdit; label: string }[] = [
  { key: "sueldoBase", label: "Sueldo base" },
  { key: "comisionLogistica", label: "Comisión logística" },
  { key: "combustible", label: "Combustible" },
  { key: "plusYpf", label: "Plus YPF" },
  { key: "sabados", label: "Sábados" },
];

const GRUPOS: { rol: SueldoAdminEmpleado["rol"]; label: string; dot: string }[] = [
  { rol: "administrativo", label: "Administración", dot: "bg-blue-500" },
  { rol: "mantenimiento", label: "Taller", dot: "bg-orange-500" },
];

type SortCol = "nombre" | CampoEdit | "aguinaldo" | "total";

// La tabla usa `border-separate`: con `border-collapse` los bordes del thead y
// del tfoot pegajosos se pintan en la capa de la tabla y se van con el scroll.
// Por eso cada borde va en la celda, no en la fila.
const thCls =
  "h-8 px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap bg-muted border-b border-border";
const tdCls = "py-0.5 border-b border-border/50";
const tfCls =
  "px-2 py-1.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap bg-muted border-t border-border";
const kbdCls = "rounded border border-border bg-muted px-1 py-px font-sans text-[10px] font-semibold text-foreground";

// ── Lectura de valores (puras: reciben los mapas, no leen refs) ────────────
const confirmado = (e: SueldoAdminEmpleado, campo: CampoEdit, conf: Confirmados) =>
  conf[e.chofer_id]?.[campo] ?? e[campo];

const textoDe = (e: SueldoAdminEmpleado, campo: CampoEdit, bor: Borradores, conf: Confirmados) => {
  const t = bor[e.chofer_id]?.[campo];
  if (t !== undefined) return t;
  const n = confirmado(e, campo, conf);
  return n ? String(n) : "";
};

/** Los montos negativos se tratan como 0: el server los rechaza igual. */
const valorDe = (e: SueldoAdminEmpleado, campo: CampoEdit, bor: Borradores, conf: Confirmados) => {
  const t = bor[e.chofer_id]?.[campo];
  return t === undefined ? confirmado(e, campo, conf) : Math.max(0, parseNum(t) ?? 0);
};

const esNegativo = (e: SueldoAdminEmpleado, campo: CampoEdit, bor: Borradores) =>
  (parseNum(bor[e.chofer_id]?.[campo] ?? "") ?? 0) < 0;

const totalFila = (e: SueldoAdminEmpleado, bor: Borradores, conf: Confirmados) =>
  COLS.reduce((s, c) => s + valorDe(e, c.key, bor, conf), 0) + (e.aguinaldo ?? 0);

/** Campos con un valor nuevo y válido, listos para mandar al servidor. */
const pendientesDe = (e: SueldoAdminEmpleado, bor: Borradores, conf: Confirmados): CampoEdit[] =>
  COLS.map((c) => c.key).filter((campo) => {
    const t = bor[e.chofer_id]?.[campo];
    if (t === undefined) return false;
    const n = parseNum(t) ?? 0;
    return n >= 0 && n !== confirmado(e, campo, conf);
  });

export default function PlanillaGrid({
  empleados,
  month,
  canWrite,
  facturacionEfectiva,
  facturacionManual,
  onEditarFacturacion,
  onVerAumentos,
  onDatosCambiados,
}: {
  empleados: SueldoAdminEmpleado[];
  /** Mes de la página ("YYYY-MM"); vacío = mes actual. */
  month: string;
  canWrite: boolean;
  facturacionEfectiva: number;
  facturacionManual: number | null;
  onEditarFacturacion: () => void;
  onVerAumentos: (choferId: string, mes: string) => void;
  /** Se llama cuando cambió algo que el servidor tiene que recalcular (aumentos). */
  onDatosCambiados: () => void;
}) {
  const mes = month || mesActual();

  const [borradores, setBorradores] = useState<Borradores>({});
  const [confirmados, setConfirmados] = useState<Confirmados>({});
  const [estado, setEstado] = useState<Record<string, "guardando" | "ok">>({});
  const [error, setError] = useState<string | null>(null);
  const [filaActiva, setFilaActiva] = useState<string | null>(null);

  // Espejo del estado para los caminos asíncronos (debounce, blur, guardado):
  // si leyeran del closure se llevarían valores viejos. Se escriben siempre desde
  // handlers, nunca durante el render.
  const borradoresRef = useRef(borradores);
  const confirmadosRef = useRef(confirmados);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const okTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  // ── Orden y filas ────────────────────────────────────────────────────────
  // Por defecto alfabético: con autoguardado, ordenar por un importe haría saltar
  // la fila que se está editando.
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({ col: "nombre", dir: "asc" });
  const toggleSort = (col: SortCol) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "desc" ? "asc" : "desc" }
        : { col, dir: col === "nombre" ? "asc" : "desc" },
    );
  const flecha = (col: SortCol) =>
    sort.col === col
      ? sort.dir === "desc"
        ? <ArrowDown size={11} />
        : <ArrowUp size={11} />
      : <ArrowUpDown size={11} className="opacity-30" />;

  // El orden se calcula con los valores del servidor (no con lo que se tipea):
  // así las filas no se reacomodan solas mientras se carga.
  const grupos = useMemo(() => {
    const f = sort.dir === "asc" ? 1 : -1;
    return GRUPOS.map((g) => ({
      ...g,
      filas: empleados
        .filter((e) => e.rol === g.rol)
        .sort((a, b) =>
          sort.col === "nombre"
            ? f * a.nombre.localeCompare(b.nombre)
            : f * ((a[sort.col] as number) - (b[sort.col] as number)),
        ),
    })).filter((g) => g.filas.length > 0);
  }, [empleados, sort]);

  const orden = useMemo(() => grupos.flatMap((g) => g.filas), [grupos]);
  const ordenRef = useRef(orden);
  useEffect(() => { ordenRef.current = orden; }, [orden]);
  const indiceDe = useMemo(() => new Map(orden.map((e, i) => [e.chofer_id, i])), [orden]);

  const hayAguinaldo = empleados.some((e) => (e.aguinaldo ?? 0) > 0);
  const nCols = 1 + COLS.length + (hayAguinaldo ? 1 : 0) + 2; // nombre + campos + aguinaldo + total + estado

  // ── Guardado ─────────────────────────────────────────────────────────────
  const marcarOk = useCallback((id: string) => {
    setEstado((s) => ({ ...s, [id]: "ok" }));
    clearTimeout(okTimers.current[id]);
    okTimers.current[id] = setTimeout(
      () => setEstado((s) => { const n = { ...s }; delete n[id]; return n; }),
      1800,
    );
  }, []);

  const guardarFila = useCallback(
    async (e: SueldoAdminEmpleado) => {
      const bor = borradoresRef.current;
      const conf = confirmadosRef.current;
      const campos = pendientesDe(e, bor, conf);
      if (campos.length === 0) return;
      const id = e.chofer_id;

      setEstado((s) => ({ ...s, [id]: "guardando" }));
      setError(null);

      // Se confirma sólo lo que el servidor aceptó: si falla una mitad, la otra
      // igual queda guardada y el borrador que falló se conserva para reintentar.
      const enviados: Partial<Record<CampoEdit, number>> = {};
      let fallo: string | null = null;
      let tocoBase = false;

      if (campos.some((c) => c !== "sueldoBase")) {
        // Van las cuatro variables juntas: el server hace un upsert de la fila.
        const vars = {
          comisionLogistica: valorDe(e, "comisionLogistica", bor, conf),
          combustible: valorDe(e, "combustible", bor, conf),
          plusYpf: valorDe(e, "plusYpf", bor, conf),
          sabados: valorDe(e, "sabados", bor, conf),
        };
        const res = await upsertSueldoAdminMesAction(id, mes, vars);
        if ("error" in res) fallo = res.error;
        else for (const c of VARIABLES) enviados[c] = vars[c];
      }
      if (campos.includes("sueldoBase")) {
        // Cambiar el sueldo base = registrar un aumento vigente desde este mes.
        // Borrar la celda no puede dejar un aumento de $0: eso se hace a mano
        // desde el historial, si no un Supr accidental deja el sueldo en cero.
        const base = valorDe(e, "sueldoBase", bor, conf);
        if (base <= 0) {
          fallo = "para dejar el sueldo base en cero, borrá el aumento desde el historial (⟳)";
        } else {
          const res = await registrarAumentoAction(id, mes, base);
          if ("error" in res) fallo = res.error;
          else { enviados.sueldoBase = base; tocoBase = true; }
        }
      }

      setEstado((s) => { const n = { ...s }; delete n[id]; return n; });
      if (fallo) setError(`${e.nombre}: ${fallo}`);
      if (Object.keys(enviados).length === 0) return;

      const proximosConf: Confirmados = {
        ...confirmadosRef.current,
        [id]: { ...(confirmadosRef.current[id] ?? {}), ...enviados },
      };
      confirmadosRef.current = proximosConf;
      setConfirmados(proximosConf);

      // Se limpian sólo los borradores que siguen coincidiendo con lo guardado;
      // si mientras tanto siguió escribiendo, ese borrador queda y se re-guarda.
      const fila = { ...(borradoresRef.current[id] ?? {}) };
      for (const [campo, n] of Object.entries(enviados) as [CampoEdit, number][]) {
        const t = fila[campo];
        if (t !== undefined && (parseNum(t) ?? 0) === n) delete fila[campo];
      }
      const proximos = { ...borradoresRef.current };
      if (Object.keys(fila).length === 0) delete proximos[id];
      else proximos[id] = fila;
      aplicarBorradores(proximos);

      marcarOk(id);
      if (tocoBase) onDatosCambiados(); // los aumentos los tiene que releer el server
    },
    [mes, marcarOk, aplicarBorradores, onDatosCambiados],
  );

  const guardarYa = useCallback(
    (e: SueldoAdminEmpleado) => {
      clearTimeout(timers.current[e.chofer_id]);
      void guardarFila(e);
    },
    [guardarFila],
  );
  const programarGuardado = useCallback(
    (e: SueldoAdminEmpleado) => {
      clearTimeout(timers.current[e.chofer_id]);
      timers.current[e.chofer_id] = setTimeout(() => void guardarFila(e), 1100);
    },
    [guardarFila],
  );

  const escribir = (
    ev: React.ChangeEvent<HTMLInputElement>,
    e: SueldoAdminEmpleado,
    campo: CampoEdit,
  ) => {
    const el = ev.target;
    // Al reformatear con puntos de miles el cursor se iba al final y editar el
    // medio de un número era imposible. Se cuenta cuántos dígitos había antes
    // del cursor y se lo vuelve a poner después del mismo dígito.
    const digitosAntes = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length;

    aplicarBorradores({
      ...borradoresRef.current,
      [e.chofer_id]: {
        ...(borradoresRef.current[e.chofer_id] ?? {}),
        [campo]: el.value.replace(/\./g, ""),
      },
    });
    programarGuardado(e);

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

  // ── Teclado ──────────────────────────────────────────────────────────────
  const idCelda = (r: number, c: number) => `sueldo-celda-${r}-${c}`;
  const irA = (r: number, c: number) => {
    const el = document.getElementById(idCelda(r, c)) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    el.select();
  };

  const onKeyDown = (
    ev: React.KeyboardEvent<HTMLInputElement>,
    e: SueldoAdminEmpleado,
    r: number,
    c: number,
  ) => {
    const input = ev.currentTarget;
    if (ev.key === "Enter") {
      ev.preventDefault();
      guardarYa(e);
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
      const fila = { ...(proximos[e.chofer_id] ?? {}) };
      delete fila[COLS[c].key];
      if (Object.keys(fila).length === 0) delete proximos[e.chofer_id];
      else proximos[e.chofer_id] = fila;
      aplicarBorradores(proximos);
      clearTimeout(timers.current[e.chofer_id]);
    } else if (ev.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
      // Sólo con el cursor en el borde: adentro de la celda se sigue editando texto.
      if (c > 0) { ev.preventDefault(); irA(r, c - 1); }
    } else if (
      ev.key === "ArrowRight" &&
      input.selectionStart === input.value.length &&
      input.selectionEnd === input.value.length
    ) {
      if (c < COLS.length - 1) { ev.preventDefault(); irA(r, c + 1); }
    }
  };

  const onBlur = (e: SueldoAdminEmpleado) => {
    // Al salir de la fila se guarda ya; entre celdas de la misma fila, no.
    setTimeout(() => {
      const activo = document.activeElement as HTMLElement | null;
      if (activo?.dataset?.fila === e.chofer_id) return;
      setFilaActiva((f) => (f === e.chofer_id ? null : f));
      if (pendientesDe(e, borradoresRef.current, confirmadosRef.current).length > 0) guardarYa(e);
    }, 0);
  };

  // ── Pegar un bloque copiado del Excel ────────────────────────────────────
  const onPaste = (ev: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const txt = ev.clipboardData.getData("text/plain");
    if (!txt || (!txt.includes("\t") && !txt.includes("\n"))) return; // un solo valor: pegado normal
    ev.preventDefault();

    const esNumero = (s: string) => parseNum(s) != null;
    let matriz = txt
      .replace(/\r/g, "")
      .replace(/\n+$/, "")
      .split("\n")
      .map((l) => l.split("\t"));

    // Copiar del Excel casi siempre arrastra el encabezado y la columna de
    // nombres. Se descartan para que los importes caigan en la columna correcta.
    while (matriz.length > 1 && matriz[0].every((celda) => !esNumero(celda))) matriz = matriz.slice(1);
    while (
      matriz[0]?.length > 1 &&
      matriz.some((l) => l[0].trim() !== "") && // una columna vacía sí es un importe en 0
      matriz.every((l) => l.length > 1 && !esNumero(l[0]))
    ) {
      matriz = matriz.map((l) => l.slice(1));
    }

    const filas = ordenRef.current;
    const proximos = { ...borradoresRef.current };
    const tocadas: SueldoAdminEmpleado[] = [];
    matriz.forEach((linea, dr) => {
      const emp = filas[r + dr];
      if (!emp) return;
      let cambio = false;
      linea.forEach((celda, dc) => {
        const col = COLS[c + dc];
        if (!col) return;
        const vacia = celda.replace(/[^\d,.-]/g, "").trim() === "";
        const n = vacia ? 0 : parseNum(celda);
        if (n == null) return; // no era un número: se ignora esa celda
        proximos[emp.chofer_id] = {
          ...(proximos[emp.chofer_id] ?? {}),
          [col.key]: String(Math.max(0, Math.round(n))),
        };
        cambio = true;
      });
      if (cambio) tocadas.push(emp);
    });

    aplicarBorradores(proximos);
    for (const emp of tocadas) guardarYa(emp);
  };

  // ── Totales ──────────────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const porCol: Record<string, number> = { aguinaldo: 0 };
    for (const c of COLS) porCol[c.key] = 0;
    let total = 0;
    for (const e of empleados) {
      for (const c of COLS) porCol[c.key] += valorDe(e, c.key, borradores, confirmados);
      porCol.aguinaldo += e.aguinaldo ?? 0;
      total += totalFila(e, borradores, confirmados);
    }
    const pct = facturacionEfectiva > 0 ? (total / facturacionEfectiva) * 100 : null;
    return { porCol, total, pct };
  }, [empleados, borradores, confirmados, facturacionEfectiva]);

  const guardando = Object.values(estado).some((s) => s === "guardando");
  // Se mira si queda algo distinto de lo guardado, no si hay borradores: reescribir
  // el mismo importe deja un borrador que nunca se manda, y el cartel quedaba fijo.
  const sinGuardar =
    !guardando && empleados.some((e) => pendientesDe(e, borradores, confirmados).length > 0);
  const recienGuardado = !guardando && !sinGuardar && Object.values(estado).some((s) => s === "ok");

  const inputCls = (neg: boolean) =>
    `h-6 w-full rounded-[4px] border bg-transparent px-1.5 text-right font-mono text-[13px] tabular-nums outline-none transition-colors placeholder:text-muted-foreground/40 ${
      neg
        ? "border-destructive/70 text-destructive"
        : "border-transparent text-foreground hover:border-border focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/15"
    }`;

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      {/* Resumen del mes en una sola línea: antes eran tres tarjetas que se comían
          el alto que necesita la planilla para entrar entera en la pantalla. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total del mes</span>
          <span className="font-mono text-base font-bold text-foreground tabular-nums">{pesos(totales.total)}</span>
          <span className="text-[11px] text-muted-foreground">
            {empleados.length} persona{empleados.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Facturación</span>
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">{pesos(facturacionEfectiva)}</span>
          <span className="text-[11px] text-muted-foreground">
            {facturacionManual != null ? "cargada a mano" : "de los viajes del mes"}
          </span>
          {canWrite && (
            <Button variant="ghost" size="icon-xs" aria-label="Editar la facturación del mes" onClick={onEditarFacturacion}>
              <Pencil />
            </Button>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sobre facturación</span>
          <span className="font-mono text-base font-bold text-primary tabular-nums">
            {totales.pct != null ? pct1(totales.pct) : "—"}
          </span>
        </div>
        {canWrite && (
          <div className="ml-auto text-[11px] text-muted-foreground inline-flex items-center gap-1.5 min-w-[7rem] justify-end">
            {guardando ? (
              <><Loader2 size={12} className="animate-spin text-primary" /> Guardando…</>
            ) : sinGuardar ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Sin guardar</>
            ) : recienGuardado ? (
              <><Check size={12} className="text-emerald-600" /> Guardado</>
            ) : null}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/5 border-b border-destructive/20 px-4 py-2">{error}</p>
      )}

      {empleados.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No hay personal de administración o taller activo.
          <span className="block mt-1 text-xs">
            Se cargan desde Personal → Legajos, con rol Administración o Mantenimiento.
          </span>
        </div>
      ) : (
        // Caja con alto propio: el encabezado y la fila de totales quedan fijos y
        // el resto scrollea adentro, sin arrastrar toda la página.
        <div className="overflow-auto max-h-[calc(100dvh-20rem)] min-h-[15rem]">
          <table className="w-full min-w-[860px] caption-bottom text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className={`${thCls} text-left pl-4`}>
                  <button type="button" onClick={() => toggleSort("nombre")}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sort.col === "nombre" ? "text-foreground" : ""}`}>
                    Empleado {flecha("nombre")}
                  </button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className={`${thCls} text-right`}>
                    <button type="button" onClick={() => toggleSort(c.key)}
                      className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${sort.col === c.key ? "text-foreground" : ""}`}>
                      {c.label} {flecha(c.key)}
                    </button>
                  </th>
                ))}
                {hayAguinaldo && (
                  <th className={`${thCls} text-right`}>
                    <button type="button" onClick={() => toggleSort("aguinaldo")}
                      className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${sort.col === "aguinaldo" ? "text-foreground" : ""}`}>
                      Aguinaldo {flecha("aguinaldo")}
                    </button>
                  </th>
                )}
                <th className={`${thCls} text-right`}>
                  <button type="button" onClick={() => toggleSort("total")}
                    className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${sort.col === "total" ? "text-foreground" : ""}`}>
                    Total {flecha("total")}
                  </button>
                </th>
                <th className={`${thCls} w-7`} />
              </tr>
            </thead>

            <tbody>
              {grupos.map((g) => {
                const subtotal = g.filas.reduce((s, e) => s + totalFila(e, borradores, confirmados), 0);
                return (
                  <Fragment key={g.rol}>
                    <tr className="bg-muted/40">
                      <td colSpan={nCols} className="px-4 py-1 border-b border-border/60">
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{g.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {g.filas.length} {g.filas.length === 1 ? "persona" : "personas"} · subtotal{" "}
                            <strong className="font-mono text-foreground tabular-nums">{pesos(subtotal)}</strong>
                          </span>
                        </span>
                      </td>
                    </tr>
                    {g.filas.map((e) => {
                      const r = indiceDe.get(e.chofer_id) ?? 0;
                      const st = estado[e.chofer_id];
                      const activa = filaActiva === e.chofer_id;
                      return (
                        <tr key={e.chofer_id}
                          className={`group/fila transition-colors ${activa ? "bg-primary/[0.04]" : "hover:bg-muted/20"}`}>
                          <td className={`${tdCls} pl-4 pr-2 whitespace-nowrap`}>
                            <span className="text-[13px] font-medium text-foreground">{e.nombre}</span>
                          </td>
                          {COLS.map((c, ci) => (
                            <td key={c.key} className={`${tdCls} px-1.5 relative`}>
                              {canWrite ? (
                                <>
                                  <input
                                    id={idCelda(r, ci)}
                                    data-fila={e.chofer_id}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    aria-label={`${c.label} de ${e.nombre}`}
                                    title={
                                      c.key === "sueldoBase"
                                        ? `Sueldo base vigente en ${mesCortoLabel(mes)}. Si lo cambiás queda registrado como aumento desde ese mes.`
                                        : undefined
                                    }
                                    value={formatMiles(textoDe(e, c.key, borradores, confirmados))}
                                    onFocus={(ev) => { ev.currentTarget.select(); setFilaActiva(e.chofer_id); }}
                                    onChange={(ev) => escribir(ev, e, c.key)}
                                    onKeyDown={(ev) => onKeyDown(ev, e, r, ci)}
                                    onPaste={(ev) => onPaste(ev, r, ci)}
                                    onBlur={() => onBlur(e)}
                                    className={inputCls(esNegativo(e, c.key, borradores))}
                                  />
                                  {c.key === "sueldoBase" && (
                                    <button type="button" tabIndex={-1}
                                      onClick={() => onVerAumentos(e.chofer_id, mes)}
                                      title={`Historial de aumentos de ${e.nombre}`}
                                      className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary opacity-0 group-hover/fila:opacity-100 transition-opacity">
                                      <History size={12} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="block text-right font-mono text-[13px] text-muted-foreground tabular-nums">
                                  {pesos(confirmado(e, c.key, confirmados))}
                                </span>
                              )}
                            </td>
                          ))}
                          {hayAguinaldo && (
                            <td className={`${tdCls} px-2 text-right font-mono text-[13px] text-muted-foreground tabular-nums`}>
                              {e.aguinaldo > 0 ? pesos(e.aguinaldo) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          )}
                          <td className={`${tdCls} px-2 text-right font-mono text-[13px] font-semibold text-foreground tabular-nums whitespace-nowrap`}>
                            {pesos(totalFila(e, borradores, confirmados))}
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
                  </Fragment>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td className={`${tfCls} pl-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground`}>
                  Total
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className={`${tfCls} text-foreground`}>{pesos(totales.porCol[c.key])}</td>
                ))}
                {hayAguinaldo && (
                  <td className={`${tfCls} text-foreground`}>{pesos(totales.porCol.aguinaldo)}</td>
                )}
                <td className={`${tfCls} font-black text-foreground`}>{pesos(totales.total)}</td>
                <td className={`${tfCls} w-7`} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canWrite && empleados.length > 0 && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
          Se escribe directo en la celda y <strong className="text-foreground">se guarda solo</strong>.{" "}
          <kbd className={kbdCls}>Tab</kbd> pasa a la siguiente, <kbd className={kbdCls}>Enter</kbd> baja una fila,{" "}
          <kbd className={kbdCls}>Esc</kbd> deshace la celda. También podés{" "}
          <strong className="text-foreground">copiar un bloque del Excel y pegarlo</strong> sobre la primera celda.
          Cambiar el sueldo base lo registra como aumento desde {mesCortoLabel(mes)}.
        </p>
      )}
    </div>
  );
}
