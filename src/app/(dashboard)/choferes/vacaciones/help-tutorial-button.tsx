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
        Antigüedad: 20 años · 35 días/año
      </p>
    </div>
  );
}

function MockCronograma() {
  const filas = [
    { n: "Acosta, P.", barra: "left-0 w-[30%]" },
    { n: "Cejas, N.", barra: "left-[10%] w-[25%]" },
    { n: "Grassi, B.", barra: "left-[22%] w-[38%]" },
  ];
  return (
    <div className="space-y-1.5 rounded-[6px] border border-border p-2">
      <div className="flex items-center gap-1 text-[7px]">
        <span className="rounded border border-border px-1 py-0.5 text-muted-foreground">‹</span>
        <span className="font-medium text-foreground">Julio 2026</span>
        <span className="rounded border border-border px-1 py-0.5 text-muted-foreground">›</span>
        <span className="ml-auto rounded border border-primary/50 bg-primary/10 px-1 py-0.5 text-primary">
          Un mes
        </span>
      </div>
      {filas.map((f) => (
        <div key={f.n} className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 truncate text-[7px] text-foreground">{f.n}</span>
          <span className="relative h-2 flex-1 rounded-[2px] bg-muted/60">
            <span className={`absolute top-0 h-2 rounded-[2px] bg-[#10B981] ${f.barra}`} />
          </span>
        </div>
      ))}
      <p className="text-[7px] text-muted-foreground">Jul 8 pers. · 55 días</p>
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

function MockUmbral() {
  return (
    <div className="space-y-2 rounded-[6px] border border-border p-2.5">
      <p className="text-[9px] font-medium text-foreground">Máximo de ausentes por semana</p>
      <div className="flex gap-1">
        <span className="rounded border border-primary/50 bg-primary/10 px-1.5 py-0.5 text-[8px] text-primary">
          % de la flota
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-[8px] text-muted-foreground">
          Número fijo
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[7px] text-muted-foreground">
        {[
          ["Julio", "6"],
          ["Diciembre", "15"],
          ["Enero", "15"],
        ].map(([m, v]) => (
          <span key={m} className="flex items-center gap-1">
            {m}
            <span className="rounded border border-border px-1 font-mono text-foreground">{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const TABS: TutorialTab[] = [
  {
    id: "saldos",
    label: "Saldos",
    icon: <Palmtree size={14} />,
    steps: [
      {
        title: "Cuántos días tiene cada uno",
        description:
          "Cada tarjeta muestra los días que le quedan, cuántos vencen el 31/12 si arrastra saldo del año pasado, y el reparto entre lo que le corresponde de este año, lo ya tomado y lo del año anterior. Clic en la tarjeta y se abre su legajo.",
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
          "La antigüedad define cuántos días le tocan por año (LCT: 14 hasta los 5 años, 21 a los 5, 28 a los 10 y 35 a los 20). Al cruzar uno de esos escalones le empiezan a corresponder más días, y la tarjeta avisa cuántos meses faltan.",
        mockup: <MockTarjetaSaldo />,
        hint: "“Recalcular antigüedad” ajusta de una a todos los que quedaron desfasados de su escalón.",
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
    id: "cronograma",
    label: "Cronograma",
    icon: <CalendarRange size={14} />,
    steps: [
      {
        title: "Quién está afuera y cuándo",
        description:
          "Una fila por persona y una columna por semana. La barra verde es el período y su largo son los días reales. En ámbar, los que tienen viajes asignados justo en esas fechas.",
        mockup: <MockCronograma />,
      },
      {
        title: "Moverse en el tiempo",
        description:
          "Con “Un mes” y las flechas mirás cualquier mes, también los que ya pasaron —que es lo que hace falta para liquidar sueldos a fin de mes—. También hay tiras de 10 semanas, 3 o 6 meses, resto del año o año completo.",
        mockup: <MockCronograma />,
        hint: "El botón “Hoy” aparece sólo cuando estás mirando un período que no incluye el día de hoy.",
      },
      {
        title: "Solo de vacaciones hoy",
        description:
          "Dentro de una ventana conviven los que están afuera ahora y los que ya volvieron. Ese filtro deja únicamente a los que están de vacaciones hoy, que es lo que se necesita para saber con quién no se cuenta.",
        mockup: <MockCronograma />,
      },
      {
        title: "Cargar y mover",
        description:
          "Clic en una celda vacía carga vacaciones para esa persona y esa semana. Un período ya cargado se arrastra de semana en semana, y con clic encima se abre el detalle para editar las fechas, cambiar de qué año descuenta o quitarlo.",
        mockup: <MockCronograma />,
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
          "En el legajo, “Editar días” deja cambiar los días que le corresponden de CUALQUIER año, agregar uno que falte o quitar uno que sobre. Es lo que se usa cuando la carga inicial de la planilla vino con un número mal.",
        mockup: <MockPorAnio />,
        hint: "Un año con vacaciones ya imputadas no se puede quitar: primero hay que cambiar de qué año descuentan esos períodos.",
      },
      {
        title: "El plan sugerido",
        description:
          "Cuando hay gente con días del año pasado por vencer, el sistema arma un cronograma propuesto para liquidarlos antes del 31/12 sin pasarse del máximo de ausentes. Se carga entero con un botón y se rearma solo a medida que cargás.",
        mockup: <MockCronograma />,
      },
    ],
  },
  {
    id: "ajustes",
    label: "Ajustes",
    icon: <SlidersHorizontal size={14} />,
    steps: [
      {
        title: "Máximo de ausentes por semana",
        description:
          "A partir de cuánta gente afuera a la vez la semana se marca en rojo. Puede ser un porcentaje de la flota o un número fijo, y cada mes puede tener el suyo: en diciembre y enero se toman muchos juntos y no es una anomalía.",
        mockup: <MockUmbral />,
        hint: "Es también el tope que respeta el plan sugerido al proponer fechas.",
      },
      {
        title: "Exportar",
        description:
          "Dos formatos: la planilla de siempre (resumen con semáforo, por sector y urgentes), que es la que se comparte, y el detalle completo con saldos, períodos y el cronograma de la ventana que estés mirando.",
        mockup: <MockTarjetaSaldo />,
      },
      {
        title: "Importar la planilla",
        description:
          "“Importar planilla” lee el Excel de vacaciones y muestra sólo las diferencias contra lo que ya está cargado, para revisarlas antes de aplicar. Los nombres que no matchean nunca se importan solos.",
        mockup: <MockPorAnio />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Vacaciones" tabs={TABS} />;
}
