"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { FileText, MoreVertical } from "lucide-react";
import ChequeTransitionDialog, {
  type Transicion,
} from "./ChequeTransitionDialog";

export type ChequeEstado =
  | "cartera"
  | "entregado"
  | "depositado"
  | "acreditado"
  | "rechazado"
  | "anulado";

export type ChequeRow = {
  id: string;
  numero: string;
  importe: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  librador_nombre: string;
  concepto: string | null;
  estado: ChequeEstado;
  banco: { nombre: string } | null;
  cliente: { razon_social: string } | null;
};

type BancoOption = { id: string; nombre: string };

type Tab = {
  label: string;
  match: (estado: ChequeEstado) => boolean;
};

const TABS: Tab[] = [
  { label: "Todos", match: () => true },
  { label: "En cartera", match: (e) => e === "cartera" },
  { label: "Entregados", match: (e) => e === "entregado" },
  { label: "Depositados", match: (e) => e === "depositado" },
  { label: "Acreditados", match: (e) => e === "acreditado" },
  { label: "Rechazados", match: (e) => e === "rechazado" },
  { label: "Anulados", match: (e) => e === "anulado" },
];

const ESTADO_LABEL: Record<ChequeEstado, string> = {
  cartera: "En cartera",
  entregado: "Entregado",
  depositado: "Depositado",
  acreditado: "Acreditado",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

const ESTADO_BADGE: Record<ChequeEstado, string> = {
  cartera: "bg-[#E1F5FE] text-primary",
  entregado: "bg-muted text-muted-foreground",
  depositado: "bg-[#FEF3C7] text-[#B45309]",
  acreditado: "bg-[#DCFCE7] text-[#16A34A]",
  rechazado: "bg-[#FEE2E2] text-[#DC2626]",
  anulado: "bg-muted text-muted-foreground/70",
};

const ACCIONES_POR_ESTADO: Record<ChequeEstado, Array<{ key: Transicion; label: string; destructive?: boolean }>> = {
  cartera: [
    { key: "entregar", label: "Entregar a tercero" },
    { key: "depositar", label: "Depositar en banco" },
    { key: "rechazar", label: "Marcar como rechazado", destructive: true },
    { key: "anular", label: "Anular", destructive: true },
  ],
  depositado: [
    { key: "acreditar", label: "Marcar como acreditado" },
    { key: "rechazar", label: "Marcar como rechazado", destructive: true },
  ],
  entregado: [],
  acreditado: [],
  rechazado: [],
  anulado: [],
};

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export default function ChequesList({
  cheques,
  bancos,
}: {
  cheques: ChequeRow[];
  bancos: BancoOption[];
}) {
  const [tabIndex, setTabIndex] = useState(0);
  const [bancoId, setBancoId] = useState("");
  const [search, setSearch] = useState("");
  const [transicion, setTransicion] = useState<{
    chequeId: string;
    numero: string;
    accion: Transicion;
  } | null>(null);

  const bancosByNombre = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bancos) map.set(b.nombre, b.id);
    return map;
  }, [bancos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchEstado = TABS[tabIndex].match;
    return cheques.filter((c) => {
      if (!matchEstado(c.estado)) return false;
      if (bancoId) {
        const id = c.banco ? bancosByNombre.get(c.banco.nombre) : null;
        if (id !== bancoId) return false;
      }
      if (!q) return true;
      return (
        c.numero.toLowerCase().includes(q) ||
        c.librador_nombre.toLowerCase().includes(q) ||
        (c.concepto ?? "").toLowerCase().includes(q) ||
        (c.cliente?.razon_social ?? "").toLowerCase().includes(q)
      );
    });
  }, [cheques, tabIndex, bancoId, search, bancosByNombre]);

  return (
    <>
      <div className="bg-card rounded-[8px] border border-border shadow-sm">
        <div className="flex items-center gap-1 px-5 pt-4 border-b border-border overflow-x-auto">
          {TABS.map((tab, i) => {
            const active = i === tabIndex;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setTabIndex(i)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  active
                    ? "border-[#0088D1] text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Listado de Cheques</h2>
          </div>
          <div className="flex items-center gap-2">
            <Combobox
              value={bancoId}
              onValueChange={setBancoId}
              options={[
                { id: "", label: `Todos los bancos (${bancos.length})` },
                ...bancos.map((b) => ({ id: b.id, label: b.nombre })),
              ]}
              searchPlaceholder="Buscar banco..."
              triggerClassName="h-9 w-56"
            />
            <Input
              type="search"
              placeholder="N° de cheque o librador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 text-sm"
            />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {[
                "Número",
                "Banco",
                "Librador",
                "Importe",
                "Fecha emisión",
                "Fecha cobro",
                "Cliente / Concepto",
                "Estado",
                "",
              ].map((col, i) => (
                <TableHead
                  key={col || `col-${i}`}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <EmptyTableRow
                message={
                  cheques.length === 0
                    ? "Sin cheques registrados"
                    : "Sin cheques para los filtros seleccionados"
                }
              />
            ) : (
              filtered.map((c) => {
                const acciones = ACCIONES_POR_ESTADO[c.estado];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm text-foreground">
                      {c.numero}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.banco?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {c.librador_nombre}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      ${formatARS(Number(c.importe))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFecha(c.fecha_emision)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFecha(c.fecha_vencimiento)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.cliente?.razon_social ?? c.concepto ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${ESTADO_BADGE[c.estado]}`}
                      >
                        {ESTADO_LABEL[c.estado]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {acciones.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Acciones del cheque"
                              >
                                <MoreVertical size={16} />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="min-w-[200px]">
                            {acciones.map((a) => (
                              <DropdownMenuItem
                                key={a.key}
                                variant={a.destructive ? "destructive" : "default"}
                                onClick={() =>
                                  setTransicion({
                                    chequeId: c.id,
                                    numero: c.numero,
                                    accion: a.key,
                                  })
                                }
                              >
                                {a.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {transicion && (
        <ChequeTransitionDialog
          chequeId={transicion.chequeId}
          numero={transicion.numero}
          transicion={transicion.accion}
          open={true}
          onOpenChange={(o) => {
            if (!o) setTransicion(null);
          }}
        />
      )}
    </>
  );
}
