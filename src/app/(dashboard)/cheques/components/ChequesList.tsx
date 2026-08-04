"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Ban,
  Banknote,
  Check,
  FileText,
  Landmark,
  MoreVertical,
  Pencil,
  Send,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { coincideEnAlguno } from "@/lib/texto";
import ChequeTransitionDialog, {
  type Transicion,
} from "./ChequeTransitionDialog";
import EditChequeDialog from "./EditChequeDialog";
import type { BancoOption, LibradorOption } from "./cheque-form-fields";
import { eliminarChequeAction } from "../actions";
import {
  ESTADOS_POR_ORIGEN,
  type ChequeOrigen,
  type ChequeTipo,
} from "../transiciones";
import { describirError } from "../errores";

export type ChequeEstado =
  | "cartera"
  | "depositado"
  | "acreditado"
  | "emitido"
  | "debitado"
  | "entregado"
  | "rechazado"
  | "anulado";

export type ChequeRow = {
  id: string;
  numero: string | null;
  tipo: ChequeTipo;
  origen: ChequeOrigen;
  importe: number;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  librador_nombre: string;
  librador_cuit: string | null;
  concepto: string | null;
  estado: ChequeEstado;
  entregado_a: string | null;
  sucursal_banco: string | null;
  cuenta_corriente: string | null;
  observaciones: string | null;
  banco: { nombre: string } | null;
  cliente: { razon_social: string } | null;
};

/**
 * Primer nivel del listado: de qué lado está el cheque. Los que recibimos son
 * plata a cobrar; los nuestros, plata que sale. Mezclarlos en una sola lista de
 * estados era lo que hacía que un cheque propio no tuviera dónde vivir.
 */
type OrigenTab = ChequeOrigen | "todos";

const ORIGEN_TABS: Array<{ key: OrigenTab; label: string }> = [
  { key: "recibido", label: "Recibidos" },
  { key: "propio", label: "Nuestros" },
  { key: "todos", label: "Todos" },
];

/** Segundo nivel: los estados que tienen sentido para cada lado. */
const ESTADOS_DEL_TAB: Record<OrigenTab, ChequeEstado[]> = {
  recibido: ESTADOS_POR_ORIGEN.recibido,
  propio: ESTADOS_POR_ORIGEN.propio,
  // En "Todos" van los de los dos lados, sin repetir y en orden de circuito.
  todos: [
    "cartera",
    "emitido",
    "entregado",
    "depositado",
    "acreditado",
    "debitado",
    "rechazado",
    "anulado",
  ],
};

const ESTADO_LABEL: Record<ChequeEstado, string> = {
  cartera: "En cartera",
  entregado: "Entregado",
  depositado: "Depositado",
  acreditado: "Acreditado",
  emitido: "Emitido",
  debitado: "Debitado",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

const ESTADO_LABEL_PLURAL: Record<ChequeEstado, string> = {
  cartera: "En cartera",
  entregado: "Entregados",
  depositado: "Depositados",
  acreditado: "Acreditados",
  emitido: "Emitidos",
  debitado: "Debitados",
  rechazado: "Rechazados",
  anulado: "Anulados",
};

/**
 * Pasarle a un tercero un cheque que recibimos es endosarlo; entregar es lo que
 * se hace con uno propio. Es la misma fila de la base, pero la palabra cambia
 * según de qué lado esté, tal como lo planteó Bárbara.
 */
function etiquetaEstado(estado: ChequeEstado, origen: ChequeOrigen): string {
  if (estado === "entregado" && origen === "recibido") return "Endosado";
  return ESTADO_LABEL[estado];
}

function etiquetaEstadoPlural(estado: ChequeEstado, origen: OrigenTab): string {
  if (estado === "entregado" && origen === "recibido") return "Endosados";
  return ESTADO_LABEL_PLURAL[estado];
}

const ESTADO_BADGE: Record<ChequeEstado, string> = {
  cartera: "bg-[#E1F5FE] text-primary",
  entregado: "bg-muted text-muted-foreground",
  depositado: "bg-[#FEF3C7] text-[#B45309]",
  acreditado: "bg-[#DCFCE7] text-[#16A34A]",
  emitido: "bg-[#E1F5FE] text-primary",
  debitado: "bg-[#DCFCE7] text-[#16A34A]",
  rechazado: "bg-[#FEE2E2] text-[#DC2626]",
  anulado: "bg-muted text-muted-foreground/70",
};

type Accion = { key: Transicion; label: string; icon: LucideIcon; destructive?: boolean };

const SIN_ACCIONES: Record<ChequeEstado, Accion[]> = {
  cartera: [],
  entregado: [],
  depositado: [],
  acreditado: [],
  emitido: [],
  debitado: [],
  rechazado: [],
  anulado: [],
};

const ACCIONES_POR_ESTADO: Record<ChequeOrigen, Record<ChequeEstado, Accion[]>> = {
  recibido: {
    ...SIN_ACCIONES,
    cartera: [
      { key: "entregar", label: "Endosar a un tercero", icon: Send },
      { key: "depositar", label: "Depositar en banco", icon: Landmark },
      { key: "rechazar", label: "Marcar como rechazado", icon: XCircle, destructive: true },
      { key: "anular", label: "Anular", icon: Ban, destructive: true },
    ],
    depositado: [
      { key: "acreditar", label: "Marcar como acreditado", icon: Check },
      { key: "rechazar", label: "Marcar como rechazado", icon: XCircle, destructive: true },
    ],
  },
  propio: {
    ...SIN_ACCIONES,
    emitido: [
      { key: "entregar", label: "Registrar entrega", icon: Send },
      { key: "debitar", label: "Marcar como debitado", icon: Banknote },
      { key: "rechazar", label: "Marcar como rechazado", icon: XCircle, destructive: true },
      { key: "anular", label: "Anular", icon: Ban, destructive: true },
    ],
    entregado: [
      { key: "debitar", label: "Marcar como debitado", icon: Banknote },
      { key: "rechazar", label: "Marcar como rechazado", icon: XCircle, destructive: true },
      { key: "anular", label: "Anular", icon: Ban, destructive: true },
    ],
  },
};

/**
 * Filtro de estado del segundo nivel. Lleva el número al lado: saber cuántos
 * hay de cada uno evita el clic a ciegas, y el que está en cero se atenúa en
 * lugar de esconderse, así no parece que el estado no existe.
 */
function FiltroEstado({
  label,
  cantidad,
  activo,
  onClick,
}: {
  label: string;
  cantidad: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      // En celular el chip llega a 36px de alto: abajo de eso el dedo no acierta.
      className={`flex items-center gap-1.5 px-2.5 py-2.5 sm:py-1.5 rounded-[6px] text-[13px] transition-colors whitespace-nowrap ${
        activo
          ? "bg-foreground/[0.07] text-foreground font-semibold"
          : cantidad === 0
            ? "text-muted-foreground/50 hover:bg-muted/50 hover:text-muted-foreground"
            : "text-muted-foreground font-medium hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {label}
      <span className={`tabular-nums ${activo ? "text-foreground/70" : "text-muted-foreground/60"}`}>
        {cantidad}
      </span>
    </button>
  );
}

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
  libradores,
  canWrite,
}: {
  cheques: ChequeRow[];
  bancos: BancoOption[];
  libradores: LibradorOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [origenTab, setOrigenTab] = useState<OrigenTab>("recibido");
  const [estadoFiltro, setEstadoFiltro] = useState<ChequeEstado | "">("");
  const [bancoId, setBancoId] = useState("");
  const [search, setSearch] = useState("");
  const [transicion, setTransicion] = useState<{
    chequeId: string;
    numero: string;
    origen: ChequeOrigen;
    accion: Transicion;
  } | null>(null);
  const [editando, setEditando] = useState<ChequeRow | null>(null);
  const [borrando, setBorrando] = useState<ChequeRow | null>(null);
  const [borrandoLoading, setBorrandoLoading] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);

  const eliminar = async () => {
    if (!borrando) return;
    setBorrandoLoading(true);
    setErrorBorrado(null);
    try {
      const res = await eliminarChequeAction(borrando.id);
      if (res.error) {
        setErrorBorrado(res.error);
      } else {
        setBorrando(null);
        router.refresh();
      }
    } catch (e) {
      setErrorBorrado(describirError(e, "No se pudo borrar el cheque."));
    } finally {
      setBorrandoLoading(false);
    }
  };

  const bancosByNombre = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bancos) map.set(b.nombre, b.id);
    return map;
  }, [bancos]);

  const estadosDelTab = ESTADOS_DEL_TAB[origenTab];

  // Los cheques del lado elegido: es sobre esto que se cuenta cada estado.
  const delOrigen = useMemo(
    () => (origenTab === "todos" ? cheques : cheques.filter((c) => c.origen === origenTab)),
    [cheques, origenTab],
  );

  const cambiarOrigen = (key: OrigenTab) => {
    setOrigenTab(key);
    // El estado elegido puede no existir del otro lado (ej: "En cartera" al
    // pasar a los nuestros): en ese caso se vuelve a mostrar todo.
    setEstadoFiltro((actual) =>
      actual && ESTADOS_DEL_TAB[key].includes(actual) ? actual : "",
    );
  };

  const filtered = useMemo(() => {
    return cheques.filter((c) => {
      if (origenTab !== "todos" && c.origen !== origenTab) return false;
      if (estadoFiltro && c.estado !== estadoFiltro) return false;
      if (bancoId) {
        const id = c.banco ? bancosByNombre.get(c.banco.nombre) : null;
        if (id !== bancoId) return false;
      }
      // Sin acentos: "benitez" tiene que encontrar "Benítez".
      return coincideEnAlguno(
        [c.numero, c.librador_nombre, c.concepto, c.cliente?.razon_social, c.entregado_a],
        search,
      );
    });
  }, [cheques, origenTab, estadoFiltro, bancoId, search, bancosByNombre]);

  const mensajeVacio =
    cheques.length === 0
      ? "Sin cheques registrados"
      : origenTab === "propio" && !cheques.some((c) => c.origen === "propio")
        ? "Todavía no hay cheques nuestros cargados"
        : "Sin cheques para los filtros seleccionados";

  /**
   * El menú de acciones es idéntico en la tabla (desktop) y en las tarjetas
   * (celular): se arma una sola vez para que no queden dos versiones que se
   * desincronicen. Lo mismo con el badge de estado.
   */
  const menuAcciones = (c: ChequeRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Acciones del cheque">
            <MoreVertical size={16} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[230px]">
        <DropdownMenuItem onClick={() => setEditando(c)}>
          <Pencil size={14} />
          Editar datos
        </DropdownMenuItem>
        {ACCIONES_POR_ESTADO[c.origen][c.estado].map((a) => (
          <DropdownMenuItem
            key={a.key}
            variant={a.destructive ? "destructive" : "default"}
            onClick={() =>
              setTransicion({
                chequeId: c.id,
                numero: c.numero ?? "s/n",
                origen: c.origen,
                accion: a.key,
              })
            }
          >
            <a.icon size={14} />
            {a.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            setErrorBorrado(null);
            setBorrando(c);
          }}
        >
          <Trash2 size={14} />
          Borrar cheque
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const badgeEstado = (c: ChequeRow) => (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${ESTADO_BADGE[c.estado]}`}
    >
      {etiquetaEstado(c.estado, c.origen)}
    </span>
  );

  return (
    <>
      <div className="bg-card rounded-[8px] border border-border shadow-sm">
        <div className="flex items-center gap-1 px-3 sm:px-5 pt-3 sm:pt-4 border-b border-border overflow-x-auto">
          {ORIGEN_TABS.map((tab) => {
            const active = tab.key === origenTab;
            const cantidad =
              tab.key === "todos"
                ? cheques.length
                : cheques.filter((c) => c.origen === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => cambiarOrigen(tab.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  active
                    ? "border-[#0088D1] text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground/70">
                  {cantidad}
                </span>
              </button>
            );
          })}
        </div>

        {/* Hasta 9 estados: en celular la tira scrollea sola y avisa que sigue. */}
        <div className="border-b border-border">
          <HorizontalScrollHint className="px-3 sm:px-5 py-2 sm:py-2.5" fadeBg="from-card">
            <div className="flex w-max items-center gap-1.5">
              <FiltroEstado
                label="Todos los estados"
                cantidad={delOrigen.length}
                activo={estadoFiltro === ""}
                onClick={() => setEstadoFiltro("")}
              />
              {estadosDelTab.map((estado) => (
                <FiltroEstado
                  key={estado}
                  label={etiquetaEstadoPlural(estado, origenTab)}
                  cantidad={delOrigen.filter((c) => c.estado === estado).length}
                  activo={estadoFiltro === estado}
                  onClick={() => setEstadoFiltro(estado)}
                />
              ))}
            </div>
          </HorizontalScrollHint>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Listado de Cheques</h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Combobox
              value={bancoId}
              onValueChange={setBancoId}
              options={[
                { id: "", label: `Todos los bancos (${bancos.length})` },
                ...bancos.map((b) => ({ id: b.id, label: b.nombre })),
              ]}
              searchPlaceholder="Buscar banco..."
              triggerClassName="h-9 max-md:h-10 w-full sm:w-56"
            />
            <Input
              type="search"
              placeholder="N° de cheque o librador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 text-sm"
            />
          </div>
        </div>

        {/* CELULAR — la tabla de 9 columnas no entra en 343px y el listado ES la
            pantalla: cada cheque pasa a ser una tarjeta con lo que se mira
            (librador, importe, vencimiento, estado) y el mismo menú de acciones. */}
        <div className="divide-y divide-border md:hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{mensajeVacio}</p>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => canWrite && setEditando(c)}
                className={`px-3 py-3 ${canWrite ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {c.librador_nombre}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      <span className="font-mono">{c.numero ?? "s/n"}</span>
                      {c.banco?.nombre ? ` · ${c.banco.nombre}` : ""}
                      {origenTab === "todos" && c.origen === "propio" ? " · Cheque nuestro" : ""}
                    </p>
                  </div>
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canWrite && menuAcciones(c)}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold text-foreground tabular-nums">
                    ${formatARS(Number(c.importe))}
                  </span>
                  {badgeEstado(c)}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Cobro {formatFecha(c.fecha_vencimiento)}</span>
                  {c.fecha_emision && <span>Emisión {formatFecha(c.fecha_emision)}</span>}
                </div>
                {(c.origen === "propio"
                  ? (c.entregado_a ?? c.concepto)
                  : (c.cliente?.razon_social ?? c.concepto)) && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.origen === "propio" ? "Entregado a: " : "Cliente: "}
                    {c.origen === "propio"
                      ? (c.entregado_a ?? c.concepto)
                      : (c.cliente?.razon_social ?? c.concepto)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <Table className="hidden md:table">
          <TableHeader className="bg-muted/40">
            <TableRow>
              {[
                "Número",
                "Banco",
                "Librador",
                "Importe",
                "Fecha emisión",
                "Fecha cobro",
                origenTab === "propio" ? "Entregado a" : "Cliente / Concepto",
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
              <EmptyTableRow message={mensajeVacio} />
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  onClick={() => canWrite && setEditando(c)}
                  className={canWrite ? "cursor-pointer" : undefined}
                  title={canWrite ? "Abrir el cheque para editarlo" : undefined}
                >
                  <TableCell className="font-mono text-sm text-foreground">
                    {c.numero ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.banco?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {c.librador_nombre}
                    {origenTab === "todos" && c.origen === "propio" && (
                      <span className="block text-xs text-muted-foreground">Cheque nuestro</span>
                    )}
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
                    {c.origen === "propio"
                      ? (c.entregado_a ?? c.concepto ?? "—")
                      : (c.cliente?.razon_social ?? c.concepto ?? "—")}
                  </TableCell>
                  <TableCell>{badgeEstado(c)}</TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canWrite ? (
                      menuAcciones(c)
                    ) : (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {transicion && (
        <ChequeTransitionDialog
          chequeId={transicion.chequeId}
          numero={transicion.numero}
          origen={transicion.origen}
          transicion={transicion.accion}
          open={true}
          onOpenChange={(o) => {
            if (!o) setTransicion(null);
          }}
        />
      )}

      {editando && (
        <EditChequeDialog
          key={editando.id}
          cheque={{
            id: editando.id,
            numero: editando.numero,
            tipo: editando.tipo,
            origen: editando.origen,
            estado: editando.estado,
            librador_nombre: editando.librador_nombre,
            librador_cuit: editando.librador_cuit,
            importe: editando.importe,
            fecha_vencimiento: editando.fecha_vencimiento,
            banco_nombre: editando.banco?.nombre ?? null,
            sucursal_banco: editando.sucursal_banco,
            cuenta_corriente: editando.cuenta_corriente,
            observaciones: editando.observaciones,
          }}
          libradores={libradores}
          bancos={bancos}
          open={true}
          onOpenChange={(o) => {
            if (!o) setEditando(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!borrando}
        onOpenChange={(o) => {
          if (!o) {
            setBorrando(null);
            setErrorBorrado(null);
          }
        }}
        title="Borrar cheque"
        description={
          borrando ? (
            <>
              Se va a borrar el cheque de{" "}
              <strong className="text-foreground">{borrando.librador_nombre}</strong> por{" "}
              <strong className="text-foreground">${formatARS(borrando.importe)}</strong>. Desaparece
              del listado junto con su historial de estados y no se puede deshacer.
              {errorBorrado && (
                <span className="mt-3 block text-destructive">{errorBorrado}</span>
              )}
            </>
          ) : null
        }
        confirmLabel="Borrar"
        onConfirm={eliminar}
        loading={borrandoLoading}
      />
    </>
  );
}
