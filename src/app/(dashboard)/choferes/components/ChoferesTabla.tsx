"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  LogOut,
  MapPin,
  MoreVertical,
  Phone,
  RefreshCw,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AvatarPersona from "@/components/ui/AvatarPersona";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { choferSlug } from "@/lib/chofer-slug";
import { getLegajoEstado } from "@/lib/chofer-validation";
import { formatFecha } from "@/lib/utils";
import { logoDeMarca } from "@/components/ui/MarcaLogo";
import EgresarChoferDialog from "./EgresarChoferDialog";
import { useChoferAcciones } from "./useChoferAcciones";
import type { ChoferMotivoEgreso } from "@/domain/rotacion/motivo-egreso";
import {
  DOCS_VACIO,
  ROL_LABEL_SINGULAR,
  rolDe,
  type DocsResumen,
  type OrdenFilter,
} from "../filtros";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila de chofer (DB) con muchos campos; los tipos generados no están disponibles acá
export type ChoferFila = any;

/** Las columnas que ordenan: click en el título = ordenar por eso. */
type ColumnaOrdenable = {
  /** Órdenes que representa, en el orden en que las va rotando el click. */
  ciclo: OrdenFilter[];
};

const ORDENABLES: Record<string, ColumnaOrdenable> = {
  empleado: { ciclo: ["apellido_az", "apellido_za"] },
  ingreso: { ciclo: ["antiguedad_asc", "antiguedad_desc"] },
  documentos: { ciclo: ["documentos"] },
  legajo: { ciclo: ["legajo"] },
};

/**
 * Antigüedad dicha en una sola unidad. En una tabla "3 años 5 meses" ocupa
 * media columna para una precisión que nadie usa al mirar el listado.
 */
function antiguedadCorta(ingresoISO?: string | null): string | null {
  if (!ingresoISO) return null;
  const ingreso = new Date(ingresoISO);
  if (Number.isNaN(ingreso.getTime())) return null;
  const hoy = new Date();
  let meses = (hoy.getFullYear() - ingreso.getFullYear()) * 12 + (hoy.getMonth() - ingreso.getMonth());
  if (hoy.getDate() < ingreso.getDate()) meses -= 1;
  if (meses < 1) return "este mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `${anios} ${anios === 1 ? "año" : "años"}`;
}

/** Punto de color del estado. En una tabla de 88 filas, 88 píldoras son ruido. */
function EstadoCelda({ estado }: { estado: string }) {
  const esBaja = estado === "baja";
  const color = estado === "activo" ? "bg-[#22C55E]" : esBaja ? "bg-[#CBD5E1]" : "bg-[#94A3B8]";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-1.5 shrink-0 rounded-full ${color}`} />
      <span className={esBaja ? "text-muted-foreground" : "text-foreground/90"}>
        {esBaja ? "Egresado" : estado === "activo" ? "Activo" : "Inactivo"}
      </span>
    </span>
  );
}

/**
 * Estado de la documentación en dos niveles: arriba lo que hay que hacer algo,
 * abajo el resto. El color va sólo en el número, nunca de fondo.
 */
function DocsCelda({ resumen, esBaja }: { resumen?: DocsResumen; esBaja: boolean }) {
  const r = resumen ?? DOCS_VACIO;

  if (r.total === 0) {
    return (
      <span className={esBaja ? "text-muted-foreground" : "text-[#B45309]"}>
        Sin documentos
      </span>
    );
  }

  // La segunda línea es "lo demás": sólo tiene sentido cuando arriba hay algo
  // urgente. Si está todo al día, arriba ya lo dice y repetirlo abajo era leer
  // dos veces el mismo número.
  const resto: string[] = [];
  if (r.vencidos > 0 || r.porVencer > 0) {
    if (r.vencidos > 0 && r.porVencer > 0) resto.push(`${r.porVencer} por vencer`);
    if (r.alDia > 0) resto.push(`${r.alDia} al día`);
  }

  return (
    <div className="leading-tight">
      {r.vencidos > 0 ? (
        <span className="font-semibold text-[#B91C1C]">
          {r.vencidos} {r.vencidos === 1 ? "vencido" : "vencidos"}
        </span>
      ) : r.porVencer > 0 ? (
        <span className="font-semibold text-[#B45309]">{r.porVencer} por vencer</span>
      ) : (
        <span className="text-muted-foreground">
          {r.total} al día
        </span>
      )}
      {resto.length > 0 && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{resto.join(" · ")}</div>
      )}
    </div>
  );
}

/**
 * Qué falta cargarle al legajo. Bloqueantes primero; los recomendados sólo avisan.
 *
 * `detallado` es para la fila de celular: ahí no hay hover, así que un "+2" sin
 * forma de abrirlo es un dato que no se puede leer. En la tabla de escritorio la
 * columna es angosta y el resto se lee pasando el mouse.
 */
function LegajoCelda({
  chofer,
  esBaja,
  detallado = false,
}: {
  chofer: ChoferFila;
  esBaja: boolean;
  detallado?: boolean;
}) {
  const estado = getLegajoEstado(chofer);
  const enMinuscula = (xs: string[]) => xs.join(", ").toLowerCase();

  if (!estado.completo) {
    const [primero, ...resto] = estado.faltantes;
    return (
      <span
        className="text-[#B91C1C]"
        title={`Falta: ${estado.faltantes.join(", ")}. No puede asignarse a viajes ni a otros movimientos.`}
      >
        {detallado ? (
          <>Falta {enMinuscula(estado.faltantes)}</>
        ) : (
          <>
            Falta {primero?.toLowerCase()}
            {resto.length > 0 && <span className="text-[#B91C1C]/80"> +{resto.length}</span>}
          </>
        )}
      </span>
    );
  }

  if (estado.faltantesRecomendados.length > 0 && !esBaja) {
    return (
      <span
        className="text-muted-foreground"
        title={`Falta: ${estado.faltantesRecomendados.join(", ")}. No bloquea nada.`}
      >
        Falta {estado.faltantesRecomendados.join(" y ").toLowerCase()}
      </span>
    );
  }

  return <span className="text-muted-foreground">Completo</span>;
}

/** Camión asignado: qué maneja, no sólo la patente. */
function CamionCelda({ chofer, esBaja }: { chofer: ChoferFila; esBaja: boolean }) {
  const esChofer = !chofer.rol || chofer.rol === "chofer";
  if (!esChofer) return <span className="text-muted-foreground/80">—</span>;

  const patente: string | null = chofer.camion_patente ?? null;
  const marca: string | null = chofer.camion_marca ?? null;

  if (!patente) {
    // El aviso es sólo para choferes activos: un egresado sin camión es lo esperado.
    const avisar = !esBaja && chofer.estado === "activo";
    return (
      <span className={avisar ? "text-[#B45309]" : "text-muted-foreground/80"}>
        {avisar ? "Sin camión" : "—"}
      </span>
    );
  }

  const logo = logoDeMarca(marca);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- SVG local
        <img
          src={logo}
          alt=""
          title={marca ?? undefined}
          className="h-3.5 max-w-[26px] shrink-0 object-contain"
          loading="lazy"
        />
      )}
      <span className="font-mono text-foreground/90">{patente}</span>
      {marca && marca !== "Sin datos" && (
        <span className="truncate text-muted-foreground/80">· {marca}</span>
      )}
    </span>
  );
}

/**
 * Título de columna que además ordena: un click ordena por esa columna y el
 * siguiente da vuelta el sentido, donde tiene sentido darlo vuelta.
 */
function TituloOrdenable({
  colId,
  orden,
  onOrdenChange,
  children,
}: {
  colId: keyof typeof ORDENABLES;
  orden: OrdenFilter;
  onOrdenChange: (o: OrdenFilter) => void;
  children: React.ReactNode;
}) {
  const { ciclo } = ORDENABLES[colId]!;
  const activo = ciclo.includes(orden);
  const descendente = orden === "apellido_za" || orden === "antiguedad_desc";

  return (
    <button
      type="button"
      onClick={() => {
        const i = ciclo.indexOf(orden);
        onOrdenChange(i === -1 ? ciclo[0]! : ciclo[(i + 1) % ciclo.length]!);
      }}
      className={`inline-flex items-center gap-1 ${activo ? "text-foreground" : "hover:text-foreground"}`}
      title="Ordenar por esta columna"
    >
      {children}
      {activo ? (
        descendente ? (
          <ArrowDown size={11} className="text-primary" />
        ) : (
          <ArrowUp size={11} className="text-primary" />
        )
      ) : (
        // Las columnas que ordenan tienen que verse distintas de las que no.
        <ChevronsUpDown size={11} className="text-muted-foreground/40" />
      )}
    </button>
  );
}

/** Menú de acciones de la fila. Las mismas que tiene la tarjeta. */
function AccionesFila({ chofer }: { chofer: ChoferFila }) {
  const acciones = useChoferAcciones(chofer);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const esBaja = chofer.estado === "baja";
  const fechaEgresoMostrar: string | null =
    chofer.fecha_egreso ?? (chofer.updated_at ? String(chofer.updated_at).slice(0, 10) : null);

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* `render` y no <Link><Button/></Link>: eso deja un <button> adentro de
            un <a>, que es HTML inválido y las herramientas lo marcan. */}
        <Button
          render={<Link href={`/choferes/${choferSlug(chofer)}`} />}
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs font-medium"
        >
          <User size={13} className="mr-1" />
          Ver legajo
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8"
                aria-label={`Acciones de ${chofer.apellido}, ${chofer.nombre}`}
              >
                <MoreVertical size={15} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[230px]">
            <DropdownMenuItem
              render={<Link href={`/viajes?choferId=${chofer.id}`} />}
            >
              <MapPin size={14} />
              Ver viajes asociados
            </DropdownMenuItem>

            {!esBaja && (
              <DropdownMenuItem disabled={acciones.loading} onClick={() => acciones.toggleEstado()}>
                <RefreshCw size={14} />
                {chofer.estado === "activo" ? "Pasar a inactivo" : "Activar"}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {esBaja ? (
              <>
                <DropdownMenuItem disabled={acciones.loading} onClick={() => acciones.reactivar()}>
                  <RotateCcw size={14} />
                  Reactivar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={acciones.abrirEgresar}>
                  <LogOut size={14} />
                  Editar datos de egreso
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={acciones.abrirEgresar}>
                <LogOut size={14} />
                Egresar (pasa al historial)
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              variant="destructive"
              disabled={acciones.loading}
              onClick={() => {
                acciones.setError(null);
                setConfirmDelete(true);
              }}
            >
              <Trash2 size={14} />
              Eliminar del sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {acciones.error && (
        <p className="mt-1 text-right text-[11px] text-[#B91C1C]">{acciones.error}</p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        loading={acciones.loading}
        title={`¿Eliminar a ${chofer.apellido}, ${chofer.nombre}?`}
        description="Se borra el legajo entero y no se puede deshacer. Es para los que se cargaron por error: si la persona ya tiene viajes o documentos, el sistema lo impide y hay que usar “Egresar”."
        confirmLabel="Sí, eliminar"
        onConfirm={async () => {
          if (await acciones.eliminar()) setConfirmDelete(false);
        }}
      />

      <EgresarChoferDialog
        open={acciones.egresarOpen}
        onOpenChange={acciones.setEgresarOpen}
        chofer={{ id: chofer.id, nombre: chofer.nombre, apellido: chofer.apellido }}
        mode={esBaja ? "editar" : "egresar"}
        initial={
          esBaja
            ? {
                motivo: (chofer.motivo_egreso as ChoferMotivoEgreso | null) ?? undefined,
                fecha_egreso: fechaEgresoMostrar ?? undefined,
              }
            : undefined
        }
        onSuccess={acciones.refrescar}
      />
    </>
  );
}

export default function ChoferesTabla({
  choferes,
  docsDe,
  orden,
  onOrdenChange,
  vacioMensaje,
}: {
  choferes: ChoferFila[];
  docsDe: (id: string) => DocsResumen;
  orden: OrdenFilter;
  onOrdenChange: (o: OrdenFilter) => void;
  vacioMensaje: string;
}) {
  // Las fotos vienen ya firmadas desde el servidor (el bucket es privado); acá
  // sólo se indexan por chofer para que cada fila la encuentre sin recorrer.
  const fotoUrls = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choferes) {
      if (c.foto_url) m.set(c.id, c.foto_url);
    }
    return m;
  }, [choferes]);

  const th = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-3";

  /** `aria-sort` va en el `<th>`: es lo único que le dice a un lector de pantalla
   *  por qué columna está ordenada la tabla (la flechita no se anuncia). */
  const ordenDe = (colId: keyof typeof ORDENABLES): "ascending" | "descending" | undefined => {
    if (!ORDENABLES[colId]!.ciclo.includes(orden)) return undefined;
    return orden === "apellido_za" || orden === "antiguedad_desc" ? "descending" : "ascending";
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-xs overflow-hidden">
      {/* Desde lg, la tabla completa. Abajo de eso 9 columnas no se leen ni
          scrolleando: va la fila compacta de más abajo. */}
      <div className="hidden lg:block">
        <Table className="min-w-[1150px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${th} pl-4`} aria-sort={ordenDe("empleado")}>
                <TituloOrdenable colId="empleado" orden={orden} onOrdenChange={onOrdenChange}>Empleado</TituloOrdenable>
              </TableHead>
              <TableHead className={th}>Área</TableHead>
              <TableHead className={th}>Camión</TableHead>
              <TableHead className={th}>Contacto</TableHead>
              <TableHead className={th} aria-sort={ordenDe("ingreso")}>
                <TituloOrdenable colId="ingreso" orden={orden} onOrdenChange={onOrdenChange}>Ingreso</TituloOrdenable>
              </TableHead>
              <TableHead className={th} aria-sort={ordenDe("documentos")}>
                <TituloOrdenable colId="documentos" orden={orden} onOrdenChange={onOrdenChange}>Documentos</TituloOrdenable>
              </TableHead>
              <TableHead className={th} aria-sort={ordenDe("legajo")}>
                <TituloOrdenable colId="legajo" orden={orden} onOrdenChange={onOrdenChange}>Legajo</TituloOrdenable>
              </TableHead>
              <TableHead className={th}>Estado</TableHead>
              <TableHead className={`${th} pr-4 text-right`}>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {choferes.length === 0 ? (
              <EmptyTableRow message={vacioMensaje} />
            ) : (
              choferes.map((c) => {
                const esBaja = c.estado === "baja";
                const nombreCompleto = `${c.apellido}, ${c.nombre}`;
                return (
                  <TableRow key={c.id} className={esBaja ? "opacity-75 hover:opacity-100" : ""}>
                    <TableCell className="py-2.5 pl-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <AvatarPersona
                          name={nombreCompleto}
                          src={fotoUrls.get(c.id) ?? null}
                          rol={c.rol}
                          size={32}
                        />
                        <div className="min-w-0 leading-tight">
                          <Link
                            href={`/choferes/${choferSlug(c)}`}
                            className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {nombreCompleto}
                          </Link>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {c.dni ? `DNI ${c.dni}` : "Sin DNI"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {ROL_LABEL_SINGULAR[rolDe(c)]}
                    </TableCell>

                    <TableCell className="py-2.5 text-xs">
                      <CamionCelda chofer={c} esBaja={esBaja} />
                    </TableCell>

                    <TableCell className="py-2.5 text-xs leading-tight">
                      <div className={c.telefono ? "text-foreground/90" : "text-muted-foreground/80"}>
                        {c.telefono || "Sin teléfono"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {c.localidad || "Sin localidad"}
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5 text-xs leading-tight">
                      {c.fecha_ingreso ? (
                        <>
                          <div className="text-foreground/90">{formatFecha(c.fecha_ingreso)}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {antiguedadCorta(c.fecha_ingreso)}
                          </div>
                        </>
                      ) : (
                        <span className="text-[#B91C1C]">Sin cargar</span>
                      )}
                    </TableCell>

                    <TableCell className="py-2.5 text-xs">
                      <DocsCelda resumen={docsDe(c.id)} esBaja={esBaja} />
                    </TableCell>

                    <TableCell className="py-2.5 text-xs">
                      <LegajoCelda chofer={c} esBaja={esBaja} />
                    </TableCell>

                    <TableCell className="py-2.5 text-xs">
                      <EstadoCelda estado={c.estado} />
                    </TableCell>

                    <TableCell className="py-2.5 pr-4">
                      <AccionesFila chofer={c} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Hasta lg: la misma información en una fila alta, sin scroll horizontal.
          Es más densa que la tarjeta, que es el punto de estar en esta vista. */}
      <div className="divide-y divide-border lg:hidden">
        {choferes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{vacioMensaje}</p>
        ) : (
          choferes.map((c) => {
            const esBaja = c.estado === "baja";
            const nombreCompleto = `${c.apellido}, ${c.nombre}`;
            const docs = docsDe(c.id);
            return (
              <div key={c.id} className={`px-3 py-3 sm:px-4 ${esBaja ? "opacity-75" : ""}`}>
                <div className="flex items-start gap-3">
                  <AvatarPersona
                    name={nombreCompleto}
                    src={fotoUrls.get(c.id) ?? null}
                    rol={c.rol}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/choferes/${choferSlug(c)}`}
                        className="min-w-0 truncate font-semibold text-sm text-foreground hover:text-primary hover:underline"
                      >
                        {nombreCompleto}
                      </Link>
                      <span className="shrink-0 text-[11px]">
                        <EstadoCelda estado={c.estado} />
                      </span>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{c.dni ? `DNI ${c.dni}` : "Sin DNI"}</span>
                      <span aria-hidden>·</span>
                      <span>{ROL_LABEL_SINGULAR[rolDe(c)]}</span>
                      {c.localidad && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={10} />
                            {c.localidad}
                          </span>
                        </>
                      )}
                      {c.telefono && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} />
                            {c.telefono}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <CamionCelda chofer={c} esBaja={esBaja} />
                      <DocsCelda resumen={docs} esBaja={esBaja} />
                      <LegajoCelda chofer={c} esBaja={esBaja} detallado />
                    </div>

                    <div className="mt-2">
                      <AccionesFila chofer={c} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
