"use client";

// Guía de Vacaciones. Mismo patrón que el resto del sistema: pestañas por tema,
// pasos con un mockup al lado y una pista cuando hay algo que se presta a
// confusión. Los ejemplos usan casos reales que aparecieron trabajando.

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import { CalendarRange, Palmtree, Plus, SlidersHorizontal } from "lucide-react";

function MockTarjetaSaldo() {
  return (
    <div className="w-56 overflow-hidden rounded-[6px] border border-border">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-full bg-muted text-[7px] font-bold text-muted-foreground">
            CG
          </span>
          <span className="text-[10px] font-medium text-foreground">Gallastegui, C.</span>
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          63 <span className="text-[7px] font-normal text-muted-foreground">días</span>
        </span>
      </div>
      <p className="flex items-center gap-1 px-3 pt-1 text-[8px] text-[#B91C1C]">
        <span className="inline-block size-1 rounded-full bg-[#B91C1C]" />
        28 vencen el 31/12/2026
      </p>
      <div className="px-3 pb-2 pt-1.5">
        <div className="flex h-1 overflow-hidden rounded-[2px] bg-muted">
          <span className="w-[55%] bg-[#059669]" />
          <span className="w-[45%] bg-[#B91C1C]" />
        </div>
        <div className="mt-1.5 flex justify-between text-[7px] text-muted-foreground">
          <span>35 del 2026</span>
          <span>0 tomados</span>
          <span className="text-[#B91C1C]">28 del 2025</span>
        </div>
      </div>
      <p className="border-t border-border px-3 py-1 text-[7px] text-muted-foreground">
        20 años de antigüedad · Corresponden: 35 días al año
      </p>
    </div>
  );
}

/** El calendario nuevo: una columna por día, con el día de la semana escrito. */
function MockCronograma() {
  const dias = [
    { d: 1, s: "Sáb", finde: true },
    { d: 2, s: "Dom", finde: true },
    { d: 3, s: "Lun" },
    { d: 4, s: "Mar" },
    { d: 5, s: "Mié" },
    { d: 6, s: "Jue", hoy: true },
    { d: 7, s: "Vie" },
    { d: 8, s: "Sáb", finde: true },
  ];
  const filas = [
    { n: "Acosta, P.", desde: 0, largo: 4, color: "#34D399", texto: "#064E3B", label: "1 – 4 ago" },
    { n: "Cejas, N.", desde: 2, largo: 4, color: "#047857", texto: "#ECFDF5", label: "3 – 6 ago" },
    { n: "Grassi, B.", desde: 4, largo: 4, color: "#F59E0B", texto: "#442104", label: "5 – 8 ago" },
  ];
  return (
    <div className="w-64 overflow-hidden rounded-[6px] border border-border">
      <div className="flex border-b border-border">
        <span className="w-16 shrink-0 self-end px-1.5 pb-1 text-[7px] text-muted-foreground">Empleado</span>
        {dias.map((x) => (
          <span
            key={x.d}
            className={`flex-1 border-l border-border/40 py-1 text-center ${x.finde ? "bg-muted/70" : ""} ${x.hoy ? "border-b-2 border-b-primary bg-primary/[0.08]" : ""}`}
          >
            <span
              className={`block text-[6px] leading-none ${x.hoy ? "text-primary" : x.finde ? "text-[#DC2626]/75" : "text-muted-foreground"}`}
            >
              {x.s}
            </span>
            <span
              className={`block text-[8px] font-semibold leading-tight ${x.hoy ? "text-primary" : x.finde ? "text-[#DC2626]" : "text-foreground"}`}
            >
              {x.d}
            </span>
          </span>
        ))}
      </div>
      {filas.map((f) => (
        <div key={f.n} className="flex items-center border-b border-border/60 last:border-b-0">
          <span className="w-16 shrink-0 truncate px-1.5 text-[7px] text-foreground">{f.n}</span>
          <span className="relative flex h-6 flex-1 items-center">
            {dias.map((x) => (
              <span
                key={x.d}
                className={`h-full flex-1 border-l border-border/40 ${x.finde ? "bg-muted/70" : ""} ${x.hoy ? "bg-primary/[0.08]" : ""}`}
              />
            ))}
            <span
              className="absolute flex h-3.5 items-center justify-center rounded-[3px] text-[6px] font-semibold"
              style={{
                backgroundColor: f.color,
                color: f.texto,
                left: `${(f.desde / dias.length) * 100}%`,
                width: `${(f.largo / dias.length) * 100}%`,
              }}
            >
              {f.label}
            </span>
          </span>
        </div>
      ))}
      <p className="px-1.5 py-1 text-[7px] text-muted-foreground">+ 17 empleados más</p>
    </div>
  );
}

function MockVistas() {
  return (
    <div className="space-y-2 rounded-[6px] border border-border p-2.5">
      <div className="flex overflow-hidden rounded-[4px] border border-border">
        {["Calendario", "Semanas", "Año", "Lista"].map((v, i) => (
          <span
            key={v}
            className={`flex-1 px-1 py-1 text-center text-[7px] ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {v}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1 text-[7px]">
        <span className="rounded border border-border px-1 py-0.5 text-muted-foreground">‹</span>
        <span className="font-medium text-foreground">Agosto 2026</span>
        <span className="rounded border border-border px-1 py-0.5 text-muted-foreground">›</span>
        <span className="ml-auto rounded border border-border px-1 py-0.5 text-muted-foreground/50">Hoy</span>
      </div>
      <p className="text-[7px] leading-snug text-muted-foreground">
        Calendario: día por día · Semanas: varios meses · Año: los doce juntos · Lista: en prosa
      </p>
    </div>
  );
}

function MockPorAnio() {
  return (
    <div className="space-y-2 rounded-[6px] border border-border p-2.5">
      <p className="text-[9px] font-medium text-foreground">Días por año</p>
      <div className="flex gap-1.5">
        <span className="rounded-[4px] border border-border bg-muted px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">
          2025: 0 de 7 (usados 7)
        </span>
        <span className="rounded-[4px] border border-[#A7F3D0] px-1.5 py-0.5 font-mono text-[8px] text-[#065F46]">
          2026: 7 de 14 (usados 7)
        </span>
      </div>
      <p className="border-l-2 border-primary/40 pl-2 text-[8px] leading-snug text-muted-foreground">
        del 2025 le tocaban 7 y ya se tomó 7, quedan 0; del 2026 le tocaban 14 y ya se tomó 7,
        quedan 7. En total le quedan 7 días.
      </p>
    </div>
  );
}

function MockFiltros() {
  return (
    <div className="w-48 space-y-1.5 rounded-[6px] border border-border p-2">
      <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[8px] text-primary">
        Filtros <span className="inline-block size-1 rounded-full bg-primary" />
      </span>
      <div className="space-y-1 rounded-[4px] border border-border p-1.5">
        {["Buscar empleado…", "Todos los sectores", "Todos los estados"].map((f) => (
          <span key={f} className="block rounded border border-border px-1 py-0.5 text-[7px] text-muted-foreground">
            {f}
          </span>
        ))}
        <span className="block rounded border border-primary/50 bg-primary/10 px-1 py-0.5 text-[7px] text-primary">
          Solo de vacaciones hoy · 2
        </span>
      </div>
    </div>
  );
}

const TABS: TutorialTab[] = [
  {
    id: "cronograma",
    label: "Cronograma",
    icon: <CalendarRange size={14} />,
    steps: [
      {
        title: "Quién está afuera, día por día",
        description:
          "Una fila por persona y una columna por día, con el día de la semana escrito arriba. La barra lleva sus fechas adentro y su largo son los días reales. Verde: de vacaciones. Verde oscuro: está afuera hoy. Ámbar: tiene viajes asignados justo en esas fechas.",
        mockup: <MockCronograma />,
        hint: "Los sábados y domingos van en gris y los feriados en violeta, así no se confunde un día que nadie trabaja con un problema de cobertura.",
      },
      {
        title: "Cuatro formas de mirar lo mismo",
        description:
          "Calendario y Semanas son la misma grilla con distinto zoom: en Calendario cada columna es un día del mes; en Semanas, una semana, y entran varios meses de una. Lista escribe lo mismo en prosa: cuándo se va cada uno, cuándo vuelve y de qué año descuenta.",
        mockup: <MockVistas />,
      },
      {
        title: "La vista de Año",
        description:
          "Una fila por persona y una columna por mes: cada mes son cinco bloques que se encienden según cuántos días se toma esa persona ese mes. Abajo, cómo se reparte la carga a lo largo del año, qué meses están más cargados y en qué tramos se junta más gente afuera.",
        mockup: <MockVistas />,
        hint: "Se mueve de a un año con las flechas, y las tarjetas de arriba pasan a mostrar el año entero: días programados, tomados, pendientes y cobertura promedio.",
      },
      {
        title: "Moverse en el tiempo",
        description:
          "Las flechas mueven un mes para cada lado, también hacia atrás, que es lo que hace falta para liquidar sueldos a fin de mes. “Hoy” devuelve al mes en curso y queda apagado cuando ya lo estás mirando.",
        mockup: <MockVistas />,
      },
      {
        title: "Cargar y mover",
        description:
          "Clic en un día vacío carga vacaciones para esa persona empezando ese día. Un período ya cargado se arrastra de un día a otro, y con clic encima se abre el detalle para editar las fechas, cambiar de qué año descuenta o quitarlo.",
        mockup: <MockCronograma />,
        hint: "Se muestran los primeros 12; “+ N empleados más” abre el resto. Se ordenan por fecha de salida, así los de arriba son los que se van primero.",
      },
    ],
  },
  {
    id: "saldos",
    label: "Saldos",
    icon: <Palmtree size={14} />,
    steps: [
      {
        title: "Cuántos días tiene cada uno",
        description:
          "Cada tarjeta muestra los días que le quedan, cuántos vencen el 31/12 si arrastra saldo del año pasado, y el reparto entre lo que le corresponde de este año y lo del anterior. Clic en la tarjeta y se abre su legajo.",
        mockup: <MockTarjetaSaldo />,
      },
      {
        title: "“Corresponden” no es lo que le queda",
        description:
          "Corresponden son los días de TODO el año según su antigüedad; disponibles es lo que sobra después de lo que ya se tomó. Por eso alguien puede tener 14 que le corresponden y 7 disponibles. En el legajo la cuenta va escrita año por año.",
        mockup: <MockPorAnio />,
        hint: "El saldo de un año vence el 31/12 del año siguiente: lo anterior a eso ya no cuenta como disponible.",
      },
      {
        title: "Antigüedad y los escalones",
        description:
          "La antigüedad define cuántos días le tocan por año (LCT: 14 hasta los 5 años, 21 a los 5, 28 a los 10 y 35 a los 20). Al cruzar uno de esos escalones le empiezan a corresponder más días, y la tarjeta avisa en qué año pasa y a cuántos días sube.",
        mockup: <MockTarjetaSaldo />,
        hint: "Los días de cada año nuevo se crean solos con el número que corresponde por antigüedad: no hay que recalcular nada a mano.",
      },
      {
        title: "Ordenar y buscar",
        description:
          "Con 78 personas conviene ordenar: por urgencia (primero los que tienen días por vencer), por más días disponibles, por antigüedad o por apellido. Las tres vistas —Tarjetas, Resumen y Por año— muestran lo mismo con distinto nivel de detalle.",
        mockup: <MockTarjetaSaldo />,
      },
    ],
  },
  {
    id: "cargar",
    label: "Cargar",
    icon: <Plus size={14} />,
    steps: [
      {
        title: "Cargar un período",
        description:
          "Elegís el empleado y el rango; abajo se muestra cuántos días son. Si esa persona tiene viajes en esas fechas, aparece el aviso con cuáles, para reasignarlos o mover las vacaciones antes de guardar.",
        mockup: <MockPorAnio />,
        hint: "Se sugieren las semanas con menos gente afuera, así no se junta todo el mundo en la misma.",
      },
      {
        title: "De qué año descuenta",
        description:
          "Cada período se imputa a un año: por defecto al más viejo con saldo, para que no se pierda. Si quedó en el año equivocado, se corrige con un clic en “Saldo 2025” / “Histórico” en el legajo, o desde el detalle del período.",
        mockup: <MockPorAnio />,
        hint: "“Histórico” significa que ese período ya estaba contemplado en la carga inicial y no vuelve a descontar.",
      },
      {
        title: "Corregir los días de un año",
        description:
          "En el legajo, “Editar días” deja cambiar los días que le corresponden de CUALQUIER año, agregar uno que falte o quitar uno que sobre. Es lo que se usa cuando un año quedó cargado con un número equivocado.",
        mockup: <MockPorAnio />,
        hint: "Un año con vacaciones ya imputadas no se puede quitar: primero hay que cambiar de qué año descuentan esos períodos.",
      },
      {
        title: "El plan sugerido",
        description:
          "Cuando hay gente con días del año pasado por vencer, el sistema arma un cronograma propuesto para liquidarlos antes del 31/12, repartido para que no se vayan todos la misma semana. Se carga entero con un botón y se rearma solo a medida que cargás.",
        mockup: <MockCronograma />,
      },
    ],
  },
  {
    id: "filtros",
    label: "Filtros",
    icon: <SlidersHorizontal size={14} />,
    steps: [
      {
        title: "Filtrar a quién estás mirando",
        description:
          "El botón “Filtros” del encabezado junta los cuatro: buscar por nombre, por área, por estado del saldo y “solo de vacaciones hoy”, que deja únicamente a los que están afuera ahora mismo. Valen para el cronograma y para la tabla de saldos a la vez.",
        mockup: <MockFiltros />,
        hint: "El puntito azul al lado de “Filtros” avisa que hay alguno puesto: si ves media planilla, es por ahí.",
      },
      {
        title: "Exportar",
        description:
          "Dos formatos: la planilla de siempre (resumen con semáforo, por sector y urgentes), que es la que se comparte, y el detalle completo con saldos, períodos y el cronograma del rango que estés mirando.",
        mockup: <MockTarjetaSaldo />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Vacaciones" tabs={TABS} />;
}
