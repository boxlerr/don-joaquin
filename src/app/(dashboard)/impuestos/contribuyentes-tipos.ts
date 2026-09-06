/**
 * Tipos del ABM de contribuyentes.
 *
 * Viven acá y no en `contribuyentes-actions.ts` porque un módulo `"use server"`
 * sólo puede exportar funciones async: un `export type` ahí adentro pasa el
 * `tsc` y los tests, y después rompe el build o —peor— deja la pantalla
 * cargando para siempre en producción.
 */

/** Un contribuyente visto desde la pantalla que lo administra. */
export type ContribuyenteAdmin = {
  codigo: string;
  nombre: string;
  cuit: string;
  /** `impuestos` (le llega a todo el equipo) o `impuestos_personales` (reservado). */
  columnaAlerta: string;
  /** Cuántos vencimientos tiene agendados. Es lo que decide si se puede borrar. */
  vencimientos: number;
};

export type ContribuyentesAdminData = {
  items: ContribuyenteAdmin[];
  /**
   * Si ve los contribuyentes reservados. Van separados de `puedePersonales`
   * porque son dos niveles distintos de la misma sección: se puede tener
   * permiso para MIRAR el calendario personal y no para tocarlo. Mezclarlos
   * dejaba la lista mostrando los reservados y abajo un cartel diciendo que no
   * se mostraban.
   */
  puedeVerPersonales: boolean;
  /**
   * Si puede crear un contribuyente reservado o tocar los que ya lo son. Sin
   * esto la opción «Personal — reservado» queda apagada en el formulario.
   */
  puedePersonales: boolean;
};

/** Lo que se manda al crear o al editar. El código nunca viaja: no se edita. */
export type ContribuyenteInput = {
  nombre: string;
  cuit: string;
  columnaAlerta: string;
};
