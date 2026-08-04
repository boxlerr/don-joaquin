"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ArrowLeft,
} from "lucide-react";
import {
  previewClientesAction,
  commitClientesImportAction,
  type PreviewClientesState,
  type ImportClientesState,
  type ClientePreviewRow,
  type PreviewRowStatus,
} from "./actions";

// Template alineado con el formato nuevo del Excel.
const TEMPLATE_HEADERS = [
  "CLIENTES",
  "RAZON SOCIAL",
  "CUIT",
  "CONDICION DE IVA",
  "DIRECCION",
  "CONTRATO PRINCIPAL",
];

const TEMPLATE_EXAMPLE = [
  "YPF",
  "YPF S.A",
  "30-54668997-9",
  "RI",
  "BV MACACHA GUEMES 515",
  "CAROLINA BARERA",
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template-clientes.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type Step = "upload" | "preview" | "result";

export default function ImportClientesModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewState, previewAction] = useActionState<
    PreviewClientesState,
    FormData
  >(previewClientesAction, null);
  const [commitState, commitAction] = useActionState<
    ImportClientesState,
    FormData
  >(commitClientesImportAction, null);

  // Avanzar a "preview" cuando hay datos cargados; a "result" cuando se commiteó.
  if (previewState?.ok && step === "upload") setStep("preview");
  if (commitState?.ok && step === "preview") setStep("result");

  function reset() {
    setStep("upload");
    setFileName(null);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Importar
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ${
            step === "preview"
              ? "w-[min(960px,calc(100vw-2rem))]"
              : "w-[min(560px,calc(100vw-2rem))]"
          } max-h-[90dvh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95`}
        >
          <div className="flex items-start justify-between gap-2 px-4 sm:px-5 pt-5 pb-3 border-b border-border">
            <div>
              <Dialog.Title className="text-foreground text-base font-semibold">
                Importar clientes
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-xs mt-0.5">
                {step === "upload" &&
                  "Subí un archivo .xlsx o .csv. Vas a poder revisar antes de confirmar."}
                {step === "preview" &&
                  "Revisá las filas: validá los datos detectados y confirmá la importación."}
                {step === "result" && "Importación finalizada."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-9 md:size-7 shrink-0 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto">
            <Stepper step={step} />

            {step === "upload" && (
              <UploadStep
                previewState={previewState}
                previewAction={previewAction}
                fileName={fileName}
                setFileName={setFileName}
                onCancel={() => setOpen(false)}
              />
            )}

            {step === "preview" && previewState?.ok && previewState.rows && (
              <PreviewStep
                rows={previewState.rows}
                summary={previewState.summary!}
                commitAction={commitAction}
                commitState={commitState}
                onBack={() => {
                  setStep("upload");
                  setFileName(null);
                }}
              />
            )}

            {step === "result" && commitState?.ok && (
              <ResultStep
                state={commitState}
                onClose={() => setOpen(false)}
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ============================================================================
// Stepper
// ============================================================================

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Archivo" },
    { id: "preview", label: "Preview" },
    { id: "result", label: "Resultado" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`size-5 rounded-full inline-flex items-center justify-center font-semibold ${
                active
                  ? "bg-[#0088D1] text-white"
                  : done
                  ? "bg-[#10B981] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="w-6 h-px bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================================
// Paso 1 — Upload
// ============================================================================

function UploadStep({
  previewState,
  previewAction,
  fileName,
  setFileName,
  onCancel,
}: {
  previewState: PreviewClientesState;
  previewAction: (formData: FormData) => void;
  fileName: string | null;
  setFileName: (v: string | null) => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <FileSpreadsheet size={16} className="text-primary shrink-0" />
          <span>¿No tenés un template? Descargá el formato nuevo.</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
        >
          <FileDown size={14} />
          Template
        </Button>
      </div>

      <div className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground mb-1">
          Columnas esperadas:
        </p>
        <p>
          <span className="font-mono">CLIENTES</span> · {""}
          <span className="font-mono">RAZON SOCIAL</span> · {""}
          <span className="font-mono">CUIT</span> · {""}
          <span className="font-mono">CONDICION DE IVA</span> · {""}
          <span className="font-mono">DIRECCION</span> · {""}
          <span className="font-mono">CONTRATO PRINCIPAL</span>
        </p>
        <p className="italic">
          Condición IVA acepta: RI, MT, EX, CF, o el nombre completo.
          “Contrato Principal” se carga como contacto principal del cliente.
        </p>
      </div>

      <form action={previewAction} className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">
            Archivo .xlsx / .csv
          </span>
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls,.csv"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0088D1] file:text-white hover:file:bg-[#0277BD] file:cursor-pointer"
          />
          {fileName && (
            <p className="text-xs text-muted-foreground mt-1">
              Seleccionado: <span className="font-mono">{fileName}</span>
            </p>
          )}
        </label>

        {previewState?.error && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
            {previewState.error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <PreviewSubmitButton />
        </div>
      </form>
    </>
  );
}

function PreviewSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="sm" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Analizando..." : "Analizar archivo"}
    </Button>
  );
}

// ============================================================================
// Paso 2 — Preview
// ============================================================================

const STATUS_META: Record<
  PreviewRowStatus,
  { label: string; className: string; icon: React.ComponentType<{ size?: number }> }
> = {
  ok: {
    label: "OK",
    className: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",
    icon: CheckCircle2,
  },
  warning: {
    label: "Advertencia",
    className: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
    icon: AlertTriangle,
  },
  duplicate: {
    label: "Duplicado",
    className: "bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]",
    icon: Copy,
  },
  error: {
    label: "Error",
    className: "bg-[#FEF2F2] text-[#7F1D1D] border-[#FECACA]",
    icon: XCircle,
  },
};

const STATUS_FILTERS: { id: "todos" | PreviewRowStatus; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "ok", label: "OK" },
  { id: "warning", label: "Advertencias" },
  { id: "duplicate", label: "Duplicados" },
  { id: "error", label: "Errores" },
];

function PreviewStep({
  rows,
  summary,
  commitAction,
  commitState,
  onBack,
}: {
  rows: ClientePreviewRow[];
  summary: NonNullable<NonNullable<PreviewClientesState>["summary"]>;
  commitAction: (formData: FormData) => void;
  commitState: ImportClientesState;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<"todos" | PreviewRowStatus>("todos");

  const filtered = useMemo(
    () => (filter === "todos" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard label="Total" value={summary.total} tone="neutral" />
        <SummaryCard
          label="A importar"
          value={summary.importable}
          tone="success"
        />
        <SummaryCard
          label="Duplicados"
          value={summary.duplicates}
          tone="info"
        />
        <SummaryCard label="Con error" value={summary.errors} tone="error" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.id === "todos"
              ? rows.length
              : rows.filter((r) => r.status === f.id).length;
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isActive
                  ? "bg-[#0088D1] text-white border-[#0088D1]"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabla — 8 columnas de control previo a importar: no se recorta ni se
          convierte en tarjetas, scrollea adentro de su caja. */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="max-h-[50vh] sm:max-h-[420px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-semibold w-10">#</th>
                <th className="px-2 py-1.5 font-semibold w-28">Estado</th>
                <th className="px-2 py-1.5 font-semibold">Razón social</th>
                <th className="px-2 py-1.5 font-semibold">Nombre comercial</th>
                <th className="px-2 py-1.5 font-semibold">CUIT</th>
                <th className="px-2 py-1.5 font-semibold">IVA</th>
                <th className="px-2 py-1.5 font-semibold">Dirección</th>
                <th className="px-2 py-1.5 font-semibold">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    No hay filas con este filtro.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <PreviewRow key={r.rowNum} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {commitState?.error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
          {commitState.error}
        </div>
      )}

      <form action={commitAction} className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft size={14} />
          Volver
        </Button>
        <CommitSubmitButton importable={summary.importable} />
      </form>
    </div>
  );
}

function PreviewRow({ row }: { row: ClientePreviewRow }) {
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  const muted = row.status === "duplicate" || row.status === "error";
  return (
    <tr
      className={`border-t border-border ${
        muted ? "bg-muted/30 text-muted-foreground" : ""
      }`}
      title={row.messages.join(" • ")}
    >
      <td className="px-2 py-1.5 font-mono text-muted-foreground">
        {row.rowNum}
      </td>
      <td className="px-2 py-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.className}`}
        >
          <Icon size={10} />
          {meta.label}
        </span>
      </td>
      <td className="px-2 py-1.5 font-medium text-foreground/90">
        {row.data.razon_social ?? <em className="text-[#B91C1C]">—</em>}
      </td>
      <td className="px-2 py-1.5">{row.data.nombre_comercial ?? "—"}</td>
      <td className="px-2 py-1.5 font-mono">{row.data.cuit ?? "—"}</td>
      <td className="px-2 py-1.5">
        <span className="font-mono text-[11px]">{row.data.condicion_iva}</span>
        {row.data.condicion_iva_raw &&
          row.data.condicion_iva_raw.toLowerCase() !==
            row.data.condicion_iva && (
            <span className="text-[10px] text-muted-foreground ml-1">
              (de “{row.data.condicion_iva_raw}”)
            </span>
          )}
      </td>
      <td className="px-2 py-1.5 truncate max-w-[200px]">
        {row.data.domicilio_fiscal ?? "—"}
      </td>
      <td className="px-2 py-1.5">{row.data.contacto_principal ?? "—"}</td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "info" | "error";
}) {
  const toneClass = {
    neutral: "bg-muted/40 text-foreground border-border",
    success: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",
    info: "bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]",
    error: "bg-[#FEF2F2] text-[#7F1D1D] border-[#FECACA]",
  }[tone];
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
        {label}
      </div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

function CommitSubmitButton({ importable }: { importable: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="brand"
      size="sm"
      disabled={pending || importable === 0}
    >
      {pending
        ? "Importando..."
        : `Confirmar importación (${importable})`}
    </Button>
  );
}

// ============================================================================
// Paso 3 — Result
// ============================================================================

function ResultStep({
  state,
  onClose,
}: {
  state: NonNullable<ImportClientesState>;
  onClose: () => void;
}) {
  const errs = state.errors ?? [];
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[#065F46] font-semibold">
            Importados: {state.imported ?? 0}
          </span>
          <span className="text-[#92400E] font-semibold">
            Omitidos: {state.skipped ?? 0}
          </span>
        </div>
        {errs.length > 0 && (
          <div className="max-h-40 overflow-y-auto border-t border-border pt-2">
            <ul className="space-y-1 text-xs text-[#7F1D1D]">
              {errs.slice(0, 50).map((e, i) => (
                <li key={i}>
                  <span className="font-mono">Fila {e.row}:</span> {e.message}
                </li>
              ))}
              {errs.length > 50 && (
                <li className="text-muted-foreground italic">
                  +{errs.length - 50} errores más…
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="w-full sm:w-auto"
          onClick={onClose}
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}
