"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Container,
  ExternalLink,
  Loader2,
  Pencil,
  User,
  X,
} from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  getHistorialChoferesDeCamionAction,
  setAcopladosDeCamionAction,
  type ChoferHistorialDeCamion,
} from "../actions";
import type { Acoplado } from "../types";

/**
 * Panel "Equipo" del detalle del camión: con quién y con qué sale la unidad.
 *
 * Antes el chofer vivía en una solapa aparte que sólo mostraba un nombre — dato
 * que se lee de un vistazo y pertenece a la ficha, no a una pantalla propia.
 * Acá va junto al acoplado, que es lo que Nico necesitaba poder cambiar: "en
 * general van siempre junto, pero a veces cambian solo el acoplado".
 */
export default function CamionEquipoPanel({
  camionId,
  acoplados,
  canWrite = true,
}: {
  camionId: string;
  /** Toda la flota de acoplados, con el camión al que están enganchados hoy. */
  acoplados: Acoplado[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [historial, setHistorial] = useState<ChoferHistorialDeCamion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [verHistorial, setVerHistorial] = useState(false);

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const enganchadosAca = useMemo(
    () => acoplados.filter((a) => a.camion_id_vinculado === camionId),
    [acoplados, camionId],
  );

  const [seleccion, setSeleccion] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar de camión
    setCargando(true);
    getHistorialChoferesDeCamionAction(camionId).then((rows) => {
      if (!cancelado) {
        setHistorial(rows);
        setCargando(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [camionId]);

  const actual = historial.find((h) => h.hasta === null);
  const anteriores = historial.filter((h) => h.hasta !== null);

  const empezarEdicion = () => {
    setSeleccion(enganchadosAca.map((a) => a.id));
    setError(null);
    setOk(null);
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await setAcopladosDeCamionAction(camionId, seleccion);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditando(false);
      setOk(
        res.enganchados === 0 && res.soltados === 0
          ? "No hubo cambios."
          : "Acoplado actualizado.",
      );
      router.refresh();
    } catch {
      setError("No se pudo guardar el cambio de acoplado.");
    } finally {
      setGuardando(false);
    }
  };

  /** Opciones del selector: verde = suelto · ámbar = está en otro camión. */
  const opciones = (excluir: string[]): ComboboxOption[] =>
    acoplados
      .filter((a) => !excluir.includes(a.id))
      .map((a) => {
        const enOtro = !!a.camion_id_vinculado && a.camion_id_vinculado !== camionId;
        return enOtro
          ? { id: a.id, label: a.patente, tone: "busy" as const, note: a.camion_patente ?? undefined }
          : { id: a.id, label: a.patente, tone: "free" as const };
      });

  const patentePorId = useMemo(
    () => new Map(acoplados.map((a) => [a.id, a.patente])),
    [acoplados],
  );

  return (
    <aside className="rounded-lg border border-border bg-muted/25 p-4 space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Equipo
      </h3>

      {/* ── Chofer ────────────────────────────────────────────────────────── */}
      <section className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          Chofer
        </span>
        {cargando ? (
          <div className="flex h-10 items-center text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin text-primary" />
          </div>
        ) : actual ? (
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border">
              <User size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/choferes/${actual.chofer_id}`}
                className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
              >
                {actual.chofer
                  ? `${actual.chofer.apellido}, ${actual.chofer.nombre}`
                  : "Sin nombre"}
                <ExternalLink size={11} className="ml-1 inline align-baseline opacity-60" />
              </Link>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar size={10} />
                Desde {fmt(actual.desde)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">Sin chofer asignado.</p>
        )}
      </section>

      {/* ── Acoplado / semi ───────────────────────────────────────────────── */}
      <section className="space-y-1.5 border-t border-border pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Acoplado / semi
          </span>
          {canWrite && !editando && (
            <button
              type="button"
              onClick={empezarEdicion}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <Pencil size={11} /> Cambiar
            </button>
          )}
        </div>

        {!editando ? (
          enganchadosAca.length > 0 ? (
            <ul className="space-y-1">
              {enganchadosAca.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Container size={13} className="shrink-0 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{a.patente}</span>
                  {a.es_tolva && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      tolva
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">Sin acoplado enganchado.</p>
          )
        ) : (
          <div className="space-y-2">
            {seleccion.map((id, i) => (
              <div key={id} className="flex items-center gap-1.5">
                <Combobox
                  value={id}
                  onValueChange={(v) =>
                    setSeleccion((prev) => prev.map((x, j) => (j === i ? v : x)))
                  }
                  options={opciones(seleccion.filter((_, j) => j !== i))}
                  placeholder="Elegí el acoplado"
                  searchPlaceholder="Buscar patente..."
                  triggerClassName="h-9 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setSeleccion((prev) => prev.filter((_, j) => j !== i))}
                  title={`Soltar ${patentePorId.get(id) ?? "el acoplado"}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <Combobox
              value=""
              onValueChange={(v) => v && setSeleccion((prev) => [...prev, v])}
              options={opciones(seleccion)}
              placeholder="+ Enganchar otro acoplado"
              searchPlaceholder="Buscar patente..."
              triggerClassName="h-9 w-full text-xs"
            />

            <p className="text-[11px] text-muted-foreground">
              Si el acoplado está en otro camión (ámbar), al engancharlo acá se lo suelta
              de aquel. El cambio queda con fecha de hoy y el enganche anterior pasa al
              historial.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={guardar}
                disabled={guardando}
                className="h-8 text-xs"
              >
                {guardando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {guardando ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditando(false)}
                disabled={guardando}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-[11px] text-red-600">{error}</p>}
        {ok && !editando && <p className="text-[11px] text-emerald-700">{ok}</p>}
      </section>

      {/* ── Historial de choferes (plegado) ───────────────────────────────── */}
      {anteriores.length > 0 && (
        <section className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setVerHistorial((v) => !v)}
            className="flex w-full items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${verHistorial ? "rotate-180" : ""}`}
            />
            {verHistorial ? "Ocultar" : "Ver"} choferes anteriores ({anteriores.length})
          </button>
          {verHistorial && (
            <ul className="mt-2 space-y-1.5">
              {anteriores.map((h) => (
                <li key={h.id} className="text-xs">
                  <Link
                    href={`/choferes/${h.chofer_id}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {h.chofer ? `${h.chofer.apellido}, ${h.chofer.nombre}` : "Chofer eliminado"}
                  </Link>
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {fmt(h.desde)}
                    <ArrowRight size={9} className="text-muted-foreground/70" />
                    {h.hasta ? fmt(h.hasta) : "actual"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!cargando && historial.length === 0 && (
        <p className="text-[10px] italic text-muted-foreground/70">
          Los cambios de chofer se registran solos: los choferes rotan unidades cuando
          hay enfermos o reparaciones.
        </p>
      )}
    </aside>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
