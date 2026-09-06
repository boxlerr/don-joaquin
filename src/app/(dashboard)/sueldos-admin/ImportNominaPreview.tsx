"use client";

// Paso de revisión del Excel "IMPORTES SUELDOS <MES>", antes de cargarlo.
//
// La lista tiene 79 personas y 77 cruzan solas contra el legajo. Mostrar las 79
// con su desplegable es pedirle a Bárbara que revise una pantalla entera para
// encontrar los dos renglones que importan, así que por defecto sólo se muestran
// los que necesitan una decisión —los que no cruzaron y los que traen un banco
// distinto del que ya tenía el legajo— y las demás quedan detrás de "ver todas".

import { useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import BancoChip from "@/components/ui/BancoChip";
import MonthPicker from "@/components/ui/MonthPicker";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { NominaImportPreview, NominaPersonaPreview } from "./nomina-tipos";

type Preview = Extract<NominaImportPreview, { ok: true }>;

const pesos = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};

const ROL_LABEL: Record<string, string> = {
  administrativo: "Administración",
  mantenimiento: "Taller",
  chofer: "Chofer",
  fletero: "Fletero",
};

/** Qué le pasa a los datos bancarios del legajo con esta importación. */
function textoBancos(p: NominaPersonaPreview): string | null {
  switch (p.estadoBancos) {
    case "nuevo":
      return "se completa en el legajo";
    case "suma":
      return "se agrega al que ya tenía";
    case "distinto":
      return `el legajo dice ${p.bancosLegajo.join(" y ")}`;
    default:
      return null;
  }
}

export default function ImportNominaPreview({
  preview,
  mes,
  onMesChange,
  asignaciones,
  onAsignacionesChange,
  completarBancos,
  onCompletarBancosChange,
}: {
  preview: Preview;
  /** "YYYY-MM"; vacío mientras no se eligió. */
  mes: string;
  onMesChange: (mes: string) => void;
  asignaciones: Record<string, string>;
  onAsignacionesChange: (v: Record<string, string>) => void;
  completarBancos: boolean;
  onCompletarBancosChange: (v: boolean) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);

  const yaCargado = mes ? preview.mesesCargados.find((m) => m.mes === `${mes}-01`) : undefined;

  const opciones = useMemo(
    () => [
      { id: "", label: "No cargar" },
      ...preview.roster.map((r) => ({
        id: r.id,
        label: r.nombre,
        note: r.estado === "activo" ? ROL_LABEL[r.rol] ?? r.rol : "egresado",
      })),
    ],
    [preview.roster],
  );

  const sinAsignar = preview.personas.filter((p) => !asignaciones[p.etiqueta]);
  const conBancoDistinto = preview.personas.filter(
    (p) => asignaciones[p.etiqueta] && p.estadoBancos === "distinto",
  );
  const aRevisar = new Set([...sinAsignar, ...conBancoDistinto].map((p) => p.etiqueta));
  const visibles = verTodas ? preview.personas : preview.personas.filter((p) => aRevisar.has(p.etiqueta));

  const totalACargar = preview.personas
    .filter((p) => asignaciones[p.etiqueta])
    .reduce((s, p) => s + (p.importe ?? 0), 0);
  const sinCargar = (preview.totales.nominaExcel ?? 0) - totalACargar;

  return (
    <div className="space-y-4">
      {/* Mes: nunca se da por sentado. El Excel no lo dice adentro y equivocarlo
          carga julio arriba de agosto sin que nadie lo note. */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Mes de la nómina</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {preview.mesSugerido
              ? `Del nombre del archivo: ${preview.archivo}`
              : "El nombre del archivo no lo dice — elegilo."}
          </p>
        </div>
        <div className="ml-auto">
          <MonthPicker value={mes} onChange={onMesChange} />
        </div>
      </div>

      {yaCargado && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {mesLabel(yaCargado.mes)} ya está cargado ({yaCargado.pagos} pagos por{" "}
            {pesos(yaCargado.total)}). Si seguís, se reemplaza por lo que dice este archivo.
          </span>
        </div>
      )}

      {/* Totales: lo que dice el Excel contra lo que se va a cargar. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total del Excel", valor: preview.totales.nominaExcel },
          { label: "Se carga", valor: totalACargar },
          { label: "Queda sin cargar", valor: sinCargar, alerta: Math.abs(sinCargar) > 1 },
          { label: "Embargos", valor: preview.totales.embargosACargar },
        ].map((k) => (
          <div key={k.label} className="rounded-md border border-border bg-card px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{k.label}</p>
            <p
              className={`mt-0.5 font-mono text-sm font-semibold ${
                k.alerta ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              }`}
            >
              {pesos(k.valor)}
            </p>
          </div>
        ))}
      </div>

      {/* Reparto por banco: es lo que Bárbara usa para pagar. */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Por banco
        </h4>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {preview.bancos.map((b) => (
                <tr key={b.banco} className="h-9">
                  <td className="px-3 py-1.5">
                    <BancoChip nombre={b.banco} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {b.personas} {b.personas === 1 ? "persona" : "personas"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs text-foreground whitespace-nowrap">
                    {pesos(b.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview.warnings.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {preview.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {/* Personas */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {verTodas ? `Las ${preview.personas.length} personas` : `Para revisar (${visibles.length})`}
          </h4>
          <button
            type="button"
            onClick={() => setVerTodas((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {verTodas ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {verTodas ? "Ver sólo lo que hay que revisar" : `Ver las ${preview.personas.length}`}
          </button>
        </div>

        {visibles.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            Las {preview.personas.length} personas del Excel cruzaron solas contra su legajo y sus
            bancos coinciden. No hay nada que decidir.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {visibles.map((p) => {
              const val = asignaciones[p.etiqueta] ?? "";
              const nota = textoBancos(p);
              return (
                <div key={p.etiqueta} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <div className="w-full min-w-0 sm:w-[15rem]">
                    <p className="truncate text-xs font-medium text-foreground">{p.persona}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.legajo != null && <>legajo {p.legajo} · </>}
                      {pesos(p.importe)}
                      {p.embargo > 0 && <> · embargo {pesos(p.embargo)}</>}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {p.bancos.map((b) => (
                      <span key={b.banco} className="inline-flex items-center gap-1">
                        <BancoChip nombre={b.banco} />
                      </span>
                    ))}
                    {!p.bancos.length && <span className="text-xs text-muted-foreground">sin banco</span>}
                  </div>
                  <div className="w-full sm:w-56 shrink-0">
                    <Combobox
                      options={opciones}
                      value={val}
                      onValueChange={(id) =>
                        onAsignacionesChange({ ...asignaciones, [p.etiqueta]: id })
                      }
                      placeholder="Elegir legajo"
                      emptyMessage="Ningún legajo con ese nombre"
                    />
                  </div>
                  {nota && (
                    <p className="w-full text-[11px] text-muted-foreground sm:pl-[15.5rem]">{nota}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sinAsignar.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {sinAsignar.length === 1 ? "Una persona queda" : `${sinAsignar.length} personas quedan`} sin
            cargar por no tener legajo en el sistema. El resto se carga igual.
          </p>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-foreground">
        <input
          type="checkbox"
          checked={completarBancos}
          onChange={(e) => onCompletarBancosChange(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-primary)]"
        />
        <span>
          Completar en cada legajo en qué banco cobra.
          <span className="block text-muted-foreground">
            Sólo agrega los que faltan; nunca borra un banco que ya estaba cargado.
          </span>
        </span>
      </label>
    </div>
  );
}
