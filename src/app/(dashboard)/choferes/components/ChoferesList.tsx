"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, ChevronDown, ChevronRight, Archive } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { coincideTerminos } from "@/lib/texto";
import ChoferCard from "./ChoferCard";
import ChoferesTabla from "./ChoferesTabla";
import ChoferesFiltros, { type Vista } from "./ChoferesFiltros";
import {
  DOCS_VACIO,
  QUICK_FILTERS,
  filtrosDesdeUrl,
  ROLES,
  hayFiltros,
  opcionesDe,
  ordenar,
  pasaAvanzados,
  pasaEstado,
  pasaRapido,
  rolDe,
  type ChoferListado,
  type DocsResumen,
  type EstadoFiltros,
  type Opcion,
  type QuickFilter,
  type RolFilter,
} from "../filtros";

const VISTA_KEY = "dj:legajos:vista";

export default function ChoferesList({
  choferes,
  docsPorChofer,
  rapidoInicial,
}: {
  choferes: ChoferListado[];
  /** Resumen de documentación por persona (columna, accesos rápidos y orden por urgencia). */
  docsPorChofer: Record<string, DocsResumen>;
  /**
   * Accesos rápidos pedidos por la URL (`?rapido=vencidos`), para que un aviso
   * abra la pantalla ya filtrada. Se aplica UNA vez, como estado inicial: a
   * partir de ahí manda lo que toque la persona, así tocar un chip no pelea
   * contra la URL que la trajo.
   */
  rapidoInicial?: string;
}) {
  const [filtros, setFiltros] = useState<EstadoFiltros>(() => filtrosDesdeUrl(rapidoInicial));
  const [vista, setVista] = useState<Vista>("tarjetas");
  const [barraAbierta, setBarraAbierta] = useState(true);
  const [historialOpen, setHistorialOpen] = useState(false);

  // La vista elegida se recuerda: quien trabaja con la tabla no tiene que
  // volver a pedirla cada vez que entra. Se lee después de montar para no
  // romper la hidratación (el server no sabe qué eligió cada uno).
  useEffect(() => {
    const guardada = window.localStorage.getItem(VISTA_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de preferencia guardada, una sola vez al montar
    if (guardada === "tabla" || guardada === "tarjetas") setVista(guardada);
  }, []);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    window.localStorage.setItem(VISTA_KEY, v);
  };

  const docsDe = useMemo(() => {
    const m = new Map<string, DocsResumen>(Object.entries(docsPorChofer));
    return (id: string) => m.get(id) ?? DOCS_VACIO;
  }, [docsPorChofer]);

  const conteoPorRol = useMemo(() => {
    const acc = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<RolFilter, number>;
    acc.todos = choferes.length;
    for (const c of choferes) acc[rolDe(c)]++;
    return acc;
  }, [choferes]);

  // La gente del área elegida. Es la base de los accesos rápidos y de las
  // opciones de los filtros avanzados: parada en "Mantenimiento", ofrecer
  // localidades donde no vive ningún mecánico sería ofrecer filtros vacíos.
  const delArea = useMemo(
    () => (filtros.rol === "todos" ? choferes : choferes.filter((c) => rolDe(c) === filtros.rol)),
    [choferes, filtros.rol],
  );

  const conteoRapidos = useMemo(() => {
    const acc = Object.fromEntries(QUICK_FILTERS.map((q) => [q, 0])) as Record<QuickFilter, number>;
    for (const c of delArea) {
      for (const q of QUICK_FILTERS) if (pasaRapido(c, q, docsDe(c.id))) acc[q]++;
    }
    return acc;
  }, [delArea, docsDe]);

  // Las opciones salen del área elegida, PERO lo que ya está filtrando tiene que
  // seguir apareciendo aunque en esta área no viva nadie de esa localidad: si no,
  // el globito dice "1 filtro" y adentro del panel no hay ningún chip prendido —
  // filtrando por algo invisible que no se puede sacar.
  const conSeleccionados = (opciones: Opcion[], elegidos: string[]): Opcion[] => {
    const faltan = elegidos.filter((v) => !opciones.some((o) => o.valor === v));
    return faltan.length === 0
      ? opciones
      : [...opciones, ...faltan.map((valor) => ({ valor, label: valor, n: 0 }))];
  };

  const localidades = useMemo(
    () => conSeleccionados(opcionesDe(delArea, (c) => c.localidad), filtros.avanzados.localidades),
    [delArea, filtros.avanzados.localidades],
  );
  const marcas = useMemo(
    () => conSeleccionados(opcionesDe(delArea, (c) => c.camion_marca), filtros.avanzados.marcas),
    [delArea, filtros.avanzados.marcas],
  );

  const filtrados = useMemo(() => {
    return delArea.filter((c) => {
      if (!pasaEstado(c, filtros.estado)) return false;
      // Los accesos rápidos se acumulan: prender dos angosta, no suma.
      for (const q of filtros.rapidos) if (!pasaRapido(c, q, docsDe(c.id))) return false;
      if (!pasaAvanzados(c, filtros.avanzados)) return false;
      // Se busca por todo lo que está a la vista, incluido el camión: escribir
      // "iveco" tiene que traer a los que manejan un Iveco, y "azul" a los de
      // esa localidad. Cada palabra tiene que estar: "iveco azul" angosta en
      // vez de sumar.
      return coincideTerminos(
        [
          c.apellido,
          c.nombre,
          c.dni,
          c.cuil,
          c.telefono,
          c.localidad,
          c.camion_patente,
          c.camion_marca,
          c.camion_modelo,
        ],
        filtros.query,
      );
    });
  }, [delArea, filtros, docsDe]);

  // Activos = todos los que NO estén dados de baja (incluye "activo" e "inactivo").
  // Egresados = estado "baja". Los mostramos siempre separados al final.
  const activos = useMemo(
    () => ordenar(filtrados.filter((c) => c.estado !== "baja"), filtros.orden, docsDe),
    [filtrados, filtros.orden, docsDe],
  );
  const egresados = useMemo(
    () => ordenar(filtrados.filter((c) => c.estado === "baja"), filtros.orden, docsDe),
    [filtrados, filtros.orden, docsDe],
  );

  const hayResultados = filtrados.length > 0;
  // `hayFiltros` mira TODO, incluidos los avanzados. Recalcularlo a mano acá
  // dejaba afuera localidad/marca/antigüedad, y con uno de esos puesto la
  // pantalla decía "Sin choferes registrados" habiendo 88.
  const sinTocarNada = !hayFiltros(filtros);
  const egresadosDelArea = useMemo(
    () => delArea.filter((c) => c.estado === "baja").length,
    [delArea],
  );

  // Cuando el filtro deja SÓLO egresados, la sección colapsada dejaba la pantalla
  // en blanco con el contador diciendo que había coincidencias.
  const soloEgresados = activos.length === 0 && egresados.length > 0;
  const historialAbierto = historialOpen || soloEgresados;

  const esTabla = vista === "tabla";
  const vacioMensaje = sinTocarNada
    ? "Sin choferes registrados"
    : "Ningún chofer coincide con los filtros";

  return (
    <div className="space-y-4">
      <ChoferesFiltros
        filtros={filtros}
        onChange={setFiltros}
        vista={vista}
        onVistaChange={cambiarVista}
        abierto={barraAbierta}
        onAbiertoChange={setBarraAbierta}
        conteoPorRol={conteoPorRol}
        conteoRapidos={conteoRapidos}
        mostrados={filtrados.length}
        total={conteoPorRol[filtros.rol]}
        localidades={localidades}
        marcas={marcas}
      />

      {!hayResultados ? (
        <div className="bg-card rounded-[8px] border border-border">
          <EmptyState icon={Users} message={vacioMensaje} />
        </div>
      ) : (
        <>
          {activos.length > 0 &&
            (esTabla ? (
              <ChoferesTabla
                choferes={activos}
                docsDe={docsDe}
                orden={filtros.orden}
                onOrdenChange={(o) => setFiltros((f) => ({ ...f, orden: o }))}
                vacioMensaje={vacioMensaje}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                {activos.map((c) => (
                  <ChoferCard key={c.id} chofer={c} />
                ))}
              </div>
            ))}

          {/* Sección egresados — siempre al final, separada y colapsable */}
          {egresados.length > 0 && (
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t-2 border-dashed border-border">
              <button
                type="button"
                onClick={() => setHistorialOpen(!historialAbierto)}
                aria-expanded={historialAbierto}
                className="w-full bg-card rounded-[8px] border border-border px-3 py-3 sm:px-5 sm:py-4 shadow-xs flex items-center justify-between gap-2 sm:gap-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Archive size={16} className="text-muted-foreground shrink-0" />
                  <h2 className="text-foreground text-sm font-semibold">
                    Historial de Choferes Egresados
                  </h2>
                  <span className="text-xs text-muted-foreground sm:ml-1">
                    {egresados.length} {egresados.length === 1 ? "chofer" : "choferes"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {historialAbierto ? "Ocultar" : "Ver"}
                  {historialAbierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {historialAbierto &&
                (esTabla ? (
                  <div className="mt-4 opacity-90">
                    <ChoferesTabla
                      choferes={egresados}
                      docsDe={docsDe}
                      orden={filtros.orden}
                      onOrdenChange={(o) => setFiltros((f) => ({ ...f, orden: o }))}
                      vacioMensaje="Sin choferes egresados"
                    />
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 opacity-90">
                    {egresados.map((c) => (
                      <ChoferCard key={c.id} chofer={c} />
                    ))}
                  </div>
                ))}
            </div>
          )}

          {/* Mensaje cuando no hay egresados pero sí hay totalmente filtrados */}
          {egresados.length === 0 && egresadosDelArea > 0 && sinTocarNada && (
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t-2 border-dashed border-border">
              <div className="text-xs text-muted-foreground text-center py-3">
                Hay {egresadosDelArea}{" "}
                {egresadosDelArea === 1 ? "chofer egresado" : "choferes egresados"} en el
                historial.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
