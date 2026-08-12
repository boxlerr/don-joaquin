"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import IlustracionCompliance, { type IlustracionNombre } from "./IlustracionCompliance";
import type { ComplianceEstadoRow, ComplianceNivel } from "../types";
import { esPendienteEstado, type FiltroEstado, type FiltrosCompliance } from "./ComplianceResumen";

/**
 * La columna de la derecha: lo que hay que atender, por dónde entrar y desde
 * cuándo son estos datos.
 *
 * No repite el checklist: cada renglón es un atajo que deja la pantalla
 * filtrada (tocar "7 por vencer" es lo mismo que tocar la tarjeta de arriba).
 * Vive sólo en pantalla ancha — abajo de `xl` la barra lateral de la app ya se
 * come el ancho y las mismas cosas están en las tarjetas y en el filtro
 * "Alcance".
 */

const NIVEL_META: Record<
  ComplianceNivel,
  { label: string; arte: IlustracionNombre; singular: string; plural: string }
> = {
  empresa: { label: "De la empresa", arte: "empresa", singular: "documento", plural: "documentos" },
  unidad: { label: "Por unidad", arte: "unidad", singular: "unidad", plural: "unidades" },
  chofer: { label: "Por chofer", arte: "chofer", singular: "chofer", plural: "choferes" },
};

/**
 * El reloj del navegador, con precisión de un minuto.
 *
 * No puede leerse durante el render del server (ahí no existe el "ahora" del
 * usuario y la hidratación reventaría), así que se lee como una fuente externa:
 * el server devuelve `null` y el navegador el minuto actual, que se reevalúa
 * solo. Redondeado al minuto a propósito: el valor tiene que ser el mismo entre
 * dos renders seguidos o React entra en bucle.
 */
let minutoActual = Math.floor(Date.now() / 60_000);

const relojSuscribir = (avisar: () => void) => {
  const sincronizar = () => {
    const m = Math.floor(Date.now() / 60_000);
    if (m === minutoActual) return;
    minutoActual = m;
    avisar();
  };
  // Al montar: el módulo pudo haberse cargado hace rato (navegación cliente).
  sincronizar();
  const t = setInterval(sincronizar, 20_000);
  return () => clearInterval(t);
};
const relojEnCliente = () => minutoActual;
const relojEnServer = () => null;

/** "hace 2 horas". Se calcula en el navegador: en el server no hay "ahora" del usuario. */
function haceCuanto(iso: string, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card">
      <h2 className="border-b border-border px-3.5 py-2.5 text-[12px] font-semibold text-foreground">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Renglon({
  arte,
  titulo,
  sub,
  onClick,
  activo,
  ariaLabel,
}: {
  arte: IlustracionNombre;
  titulo: React.ReactNode;
  sub: string;
  onClick: () => void;
  activo: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={ariaLabel}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
        activo ? "bg-primary/5" : "hover:bg-muted/40"
      }`}
    >
      <IlustracionCompliance nombre={arte} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-tight text-foreground">{titulo}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-muted-foreground/60" aria-hidden />
    </button>
  );
}

export default function ComplianceRail({
  rows,
  filtros,
  onChange,
  generadoEn,
  onRefrescar,
  refrescando = false,
}: {
  rows: ComplianceEstadoRow[];
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
  /** Momento en que el server armó estos datos (ISO). */
  generadoEn: string;
  onRefrescar: () => void;
  refrescando?: boolean;
}) {
  const c = useMemo(() => {
    const out = {
      vencido: 0,
      por_vencer: 0,
      faltante: 0,
      porNivel: { empresa: 0, unidad: 0, chofer: 0 } as Record<ComplianceNivel, number>,
      entidades: {
        empresa: new Set<string>(),
        unidad: new Set<string>(),
        chofer: new Set<string>(),
      } as Record<ComplianceNivel, Set<string>>,
      pendientesNivel: { empresa: 0, unidad: 0, chofer: 0 } as Record<ComplianceNivel, number>,
    };
    for (const r of rows) {
      if (r.estado === "vencido") out.vencido++;
      else if (r.estado === "por_vencer") out.por_vencer++;
      else if (r.estado === "faltante") out.faltante++;
      out.porNivel[r.nivel]++;
      if (esPendienteEstado(r.estado)) out.pendientesNivel[r.nivel]++;
      out.entidades[r.nivel].add(r.chofer_id ?? r.camion_id ?? "empresa");
    }
    return out;
  }, [rows]);

  const minuto = useSyncExternalStore(relojSuscribir, relojEnCliente, relojEnServer);
  const ahora = minuto === null ? null : minuto * 60_000;

  const irA = (estado: FiltroEstado) =>
    onChange({ ...filtros, estado: filtros.estado === estado ? "todos" : estado, requisito: "todos" });

  const irANivel = (n: ComplianceNivel) =>
    onChange({ ...filtros, nivel: filtros.nivel === n ? "todos" : n });

  return (
    // `sticky` + `self-start`: la columna acompaña el scroll de la lista, que
    // es larga. Con `max-h` y scroll propio no se corta nunca por abajo, aunque
    // la ventana sea baja. El ancho lo pone la grilla del padre.
    <aside className="hidden w-full self-start space-y-3 xl:sticky xl:top-[5.25rem] xl:block xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto xl:overscroll-contain print:hidden">
      <Tarjeta titulo="Qué hay que atender">
        <div className="divide-y divide-border">
          <Renglon
            arte="vencido"
            activo={filtros.estado === "vencido"}
            ariaLabel={`Ver los ${c.vencido} documentos vencidos`}
            titulo={
              <>
                <span className="font-bold tabular-nums">{c.vencido}</span> documentos vencidos
              </>
            }
            sub={c.vencido > 0 ? "Hay que renovarlos ya" : "Ninguno vencido"}
            onClick={() => irA("vencido")}
          />
          <Renglon
            arte="por-vencer"
            activo={filtros.estado === "por_vencer"}
            ariaLabel={`Ver los ${c.por_vencer} documentos por vencer`}
            titulo={
              <>
                <span className="font-bold tabular-nums">{c.por_vencer}</span> por vencer
              </>
            }
            // El preaviso NO son 30 días para todos: lo define cada tipo de
            // documento (90 antecedentes, 60 psicofísico, 30 el resto…).
            sub="Dentro del aviso de cada tipo"
            onClick={() => irA("por_vencer")}
          />
          <Renglon
            arte="sin-cargar"
            activo={filtros.estado === "faltante"}
            ariaLabel={`Ver los ${c.faltante} documentos sin cargar`}
            titulo={
              <>
                <span className="font-bold tabular-nums">{c.faltante}</span> sin cargar
              </>
            }
            sub="Nunca se presentaron"
            onClick={() => irA("faltante")}
          />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Por dónde entrar">
        <div className="divide-y divide-border">
          {(["empresa", "unidad", "chofer"] as const).map((n) => {
            const meta = NIVEL_META[n];
            if (c.porNivel[n] === 0) return null;
            const entidades = c.entidades[n].size;
            const pend = c.pendientesNivel[n];
            return (
              <Renglon
                key={n}
                arte={meta.arte}
                activo={filtros.nivel === n}
                ariaLabel={`Ver los documentos ${meta.label.toLowerCase()}`}
                titulo={
                  <>
                    {meta.label}{" "}
                    <span className="font-bold tabular-nums text-muted-foreground">{c.porNivel[n]}</span>
                  </>
                }
                sub={
                  n === "empresa"
                    ? pend > 0
                      ? `${pend} pendiente${pend === 1 ? "" : "s"}`
                      : "Todo al día"
                    : `${entidades} ${entidades === 1 ? meta.singular : meta.plural}` +
                      (pend > 0 ? ` · ${pend} pendiente${pend === 1 ? "" : "s"}` : "")
                }
                onClick={() => irANivel(n)}
              />
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Estos datos son de">
        <div className="space-y-2 px-3.5 py-3">
          <p className="flex items-center gap-2 text-[12px] text-foreground">
            <IlustracionCompliance nombre="reloj" size={26} />
            {ahora === null ? (
              <span className="text-muted-foreground">Cargando…</span>
            ) : (
              <>
                <span className="font-medium">{haceCuanto(generadoEn, ahora)}</span>
                <span className="text-muted-foreground">
                  ·{" "}
                  {new Date(generadoEn).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onRefrescar}
            disabled={refrescando}
            // La explicación va acá y no en un párrafo de tres renglones: el
            // panel tiene que entrar entero en la pantalla sin scroll propio.
            title="Los vencimientos se calculan al abrir la pantalla. Si alguien cargó algo recién, actualizá para verlo."
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw size={13} className={refrescando ? "animate-spin" : ""} aria-hidden />
            {refrescando ? "Actualizando…" : "Actualizar ahora"}
          </button>
        </div>
      </Tarjeta>
    </aside>
  );
}
