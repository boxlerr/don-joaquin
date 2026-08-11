/**
 * Novedades del sistema — lo que se muestra en el pop-up del día.
 *
 * Pedido de Julián (10/08/2026): que además de los vencimientos, el pop-up de la
 * mañana cuente **qué cambió en el sistema**. Antes el equipo se enteraba de que
 * una pantalla había cambiado cuando la abría y no la reconocía, o no se enteraba
 * nunca — que es lo que pasó con la mitad de los arreglos de diseño de esta semana.
 *
 * Es una lista escrita a mano y a propósito. Los mensajes de commit no sirven para
 * mostrarle a Bárbara —hablan de archivos y de causas, no de lo que ella ve— y
 * leer el historial de git en Vercel no se puede: en el server no está el repo.
 * Así que cada vez que se sube algo que se NOTA, se agrega un renglón acá arriba.
 *
 * Reglas para escribir una novedad:
 *  - Contala desde la pantalla, no desde el código: "ahora podés adjuntar el PDF
 *    al renovar un vencimiento", no "se removió la condición esEdicion".
 *  - Una sola línea de título. El detalle es opcional y va abajo, en gris.
 *  - `fecha` es el día que se subió a producción, en ISO.
 */
export type Novedad = {
  /** Día en que salió a producción (YYYY-MM-DD). */
  fecha: string;
  /** Qué cambió, contado desde la pantalla. Una línea. */
  titulo: string;
  /** Opcional: el porqué o el detalle fino. */
  detalle?: string;
  /** Opcional: a dónde llevar si tocan la novedad. */
  href?: string;
};

/** Las más nuevas arriba. Al agregar una, va al principio de la lista. */
export const NOVEDADES: Novedad[] = [
  {
    fecha: "2026-08-11",
    titulo: "Vacaciones: “De vacaciones hoy” vuelve a estar a la vista",
    detalle:
      "Estaba adentro del panel de filtros. Ahora está suelto en la barra con el número al lado, y si no hay nadie lo dice de una.",
    href: "/choferes/vacaciones",
  },
  {
    fecha: "2026-08-11",
    titulo: "Podés registrar un día pedido desde el dashboard",
    detalle:
      "El turno médico, el trámite, el dentista. Se carga en tres campos y te muestra cuántos días lleva pedidos esa persona en el año.",
    href: "/dashboard",
  },
  {
    fecha: "2026-08-11",
    titulo: "SICOP y Secondi ya se cargan y se editan desde la pantalla",
    detalle:
      "Podés dar de alta qué se presenta ante cada organismo, editarlo, darlo de baja, adjuntar los comprobantes (varios y de cualquier tipo) y exportar el checklist a Excel.",
    href: "/compliance",
  },
  {
    fecha: "2026-08-11",
    titulo: "Importar la HOJA DE RUTA ahora avisa qué filas no son del mes",
    detalle:
      "La planilla de junio traía 30 viajes de mayo, marzo y febrero. Entran igual con la fecha que tienen, pero después no salen al filtrar junio: ahora el importador te dice cuáles son y en qué mes quedan antes de confirmar.",
    href: "/viajes",
  },
  {
    fecha: "2026-08-10",
    titulo: "Al renovar un vencimiento de Compliance ya podés adjuntar el documento",
    detalle:
      "Antes editar la fecha no dejaba subir el archivo. Ahora el papel queda guardado junto con la fecha nueva, sin pisar los anteriores.",
    href: "/compliance",
  },
  {
    fecha: "2026-08-10",
    titulo: "Las alertas dejan de reclamar documentos que ya renovaste",
    detalle:
      "Si actualizás un vencimiento o pagás una cuota, el aviso se apaga solo y vuelve a aparecer recién cuando se acerque el vencimiento nuevo.",
    href: "/notificaciones",
  },
  {
    fecha: "2026-08-06",
    titulo: "Vacaciones: se ve y se puede cambiar el tope de gente por semana",
    href: "/vacaciones",
  },
  {
    fecha: "2026-08-06",
    titulo: "Vacaciones: el cronograma muestra qué día arranca cada uno",
    href: "/vacaciones",
  },
  {
    fecha: "2026-08-06",
    titulo: "Planilla diaria y carga rápida: los avisos ya no parecen errores",
    detalle: "Los recuadros de color se leían como si algo hubiera fallado.",
  },
  {
    fecha: "2026-08-06",
    titulo: "Legajos: tarjetas más claras y el mapa de localidades más chico",
    href: "/choferes",
  },
];

/**
 * Las novedades de los últimos `dias` días, de la más nueva a la más vieja.
 *
 * Se corta por ventana y no por cantidad para que el pop-up no quede contando
 * novedades de hace un mes en una semana tranquila. `hoyIso` se pasa siempre
 * (nunca `new Date()` acá adentro): en este repo el server corre en UTC y los
 * cortes por fecha propia ya se corrieron un día más de una vez.
 */
export function novedadesRecientes(hoyIso: string, dias = 10, lista = NOVEDADES): Novedad[] {
  const [y, m, d] = hoyIso.split("-").map(Number);
  if (!y || !m || !d) return [];
  const desde = new Date(Date.UTC(y, m - 1, d));
  desde.setUTCDate(desde.getUTCDate() - dias);
  const desdeIso = desde.toISOString().split("T")[0]!;

  return lista
    .filter((n) => n.fecha >= desdeIso && n.fecha <= hoyIso)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
