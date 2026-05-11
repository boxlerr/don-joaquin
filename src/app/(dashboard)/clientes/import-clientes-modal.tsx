"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Upload, X, FileDown, FileSpreadsheet } from "lucide-react";
import { importClientesAction, type ImportClientesState } from "./actions";

const TEMPLATE_HEADERS = [
  "razon_social",
  "nombre_comercial",
  "cuit",
  "condicion_iva",
  "domicilio_fiscal",
  "localidad",
  "provincia",
  "email",
  "telefono",
  "es_multinacional",
  "observaciones",
];

const TEMPLATE_EXAMPLE = [
  "Don Joaquín SA",
  "Don Joaquín",
  "30-12345678-9",
  "responsable_inscripto",
  "Av. Siempre Viva 123",
  "Tres Arroyos",
  "Buenos Aires",
  "ventas@donjoaquin.com",
  "2983-123456",
  "no",
  "Cliente VIP",
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

export default function ImportClientesModal() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, formAction] = useActionState<ImportClientesState, FormData>(
    importClientesAction,
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
        if (!v) reset();
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Importar
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-white rounded-[12px] shadow-2xl border border-[#E2E8F0] transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <div>
              <Dialog.Title className="text-[#0F172A] text-base font-semibold">
                Importar clientes
              </Dialog.Title>
              <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                Subí un archivo .xlsx o .csv con tus clientes. Se insertan los activos.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-7 rounded-full text-[#475569] hover:bg-[#F1F5F9] inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-[#475569]">
                <FileSpreadsheet size={16} className="text-[#0088D1]" />
                <span>¿No tenés un template? Descargá el formato.</span>
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

            <form action={formAction} className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#475569] mb-1 block">
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
                  className="block w-full text-sm text-[#0F172A] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0088D1] file:text-white hover:file:bg-[#0277BD] file:cursor-pointer"
                />
                {fileName && (
                  <p className="text-xs text-[#475569] mt-1">
                    Seleccionado: <span className="font-mono">{fileName}</span>
                  </p>
                )}
              </label>

              {state?.error && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                  {state.error}
                </div>
              )}

              {state?.ok && (
                <ResultPanel state={state} />
              )}

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

function ResultPanel({ state }: { state: NonNullable<ImportClientesState> }) {
  const errs = state.errors ?? [];
  return (
    <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm space-y-2">
      <div className="flex items-center gap-4">
        <span className="text-[#065F46] font-semibold">
          Importados: {state.imported ?? 0}
        </span>
        <span className="text-[#92400E] font-semibold">
          Omitidos: {state.skipped ?? 0}
        </span>
      </div>
      {errs.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-t border-[#E2E8F0] pt-2">
          <ul className="space-y-1 text-xs text-[#7F1D1D]">
            {errs.slice(0, 50).map((e, i) => (
              <li key={i}>
                <span className="font-mono">Fila {e.row}:</span> {e.message}
              </li>
            ))}
            {errs.length > 50 && (
              <li className="text-[#475569] italic">
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
