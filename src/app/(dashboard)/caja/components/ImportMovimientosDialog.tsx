"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Upload, X, FileDown, FileSpreadsheet } from "lucide-react";
import {
  importMovimientosCajaAction,
  type ImportMovimientosState,
} from "../actions";

const TEMPLATE_HEADERS = [
  "fecha",
  "tipo",
  "categoria",
  "concepto",
  "monto",
  "medio",
  "observaciones",
];

const TEMPLATE_EXAMPLES: string[][] = [
  [
    "2026-05-14",
    "ingreso",
    "cobro_cliente",
    "Cobro flete granos",
    "150000",
    "transferencia",
    "Factura 0001-00012345",
  ],
  [
    "2026-05-14",
    "egreso",
    "gasto_operativo",
    "Carga de combustible",
    "80000",
    "efectivo",
    "",
  ],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template-movimientos-caja.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ImportMovimientosDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, formAction] = useActionState<ImportMovimientosState, FormData>(
    importMovimientosCajaAction,
    null,
  );

  function reset() {
    setFileName(null);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          reset();
          if (state?.ok) {
            window.dispatchEvent(new CustomEvent("caja:refresh"));
            router.refresh();
          }
        }
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Importar
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
            <div>
              <Dialog.Title className="text-foreground text-base font-semibold">
                Importar movimientos de caja
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-xs mt-0.5">
                Subí un .xlsx o .csv con uno o varios movimientos. Se insertan en la caja general.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-7 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet size={16} className="text-primary" />
                <span>¿No tenés el formato? Descargá el template.</span>
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

            <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-[#1E293B]">Columnas esperadas:</p>
              <p>
                <span className="font-mono">fecha</span> (yyyy-mm-dd o dd/mm/yyyy),{" "}
                <span className="font-mono">tipo</span> (ingreso/egreso),{" "}
                <span className="font-mono">categoria</span>,{" "}
                <span className="font-mono">concepto</span>,{" "}
                <span className="font-mono">monto</span>,{" "}
                <span className="font-mono">medio</span> (efectivo/transferencia/cheque/otro),{" "}
                <span className="font-mono">observaciones</span> (opcional).
              </p>
            </div>

            <form action={formAction} className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Archivo .xlsx / .csv
                </span>
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  onChange={(e) =>
                    setFileName(e.target.files?.[0]?.name ?? null)
                  }
                  className="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0088D1] file:text-white hover:file:bg-[#0277BD] file:cursor-pointer"
                />
                {fileName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Seleccionado: <span className="font-mono">{fileName}</span>
                  </p>
                )}
              </label>

              {state?.error && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                  {state.error}
                </div>
              )}

              {state?.ok && <ResultPanel state={state} />}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  {state?.ok ? "Cerrar" : "Cancelar"}
                </Button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultPanel({ state }: { state: NonNullable<ImportMovimientosState> }) {
  const errs = state.errors ?? [];
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
      <div className="flex items-center gap-4">
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
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="sm" disabled={pending}>
      {pending ? "Importando..." : "Importar"}
    </Button>
  );
}
