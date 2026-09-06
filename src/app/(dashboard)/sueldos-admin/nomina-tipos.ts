// Tipos del importador de la nómina.
//
// Viven acá y no en `import-nomina-actions.ts` a propósito: en un archivo con
// "use server" cada export tiene que ser una función async, y un `export type`
// rompe — a veces el build y a veces recién en producción, con la pantalla
// cargando para siempre. Ya pasó tres veces en este proyecto.

/** Cómo quedó una persona del Excel contra el legajo del sistema. */
export type NominaPersonaPreview = {
  /** "APELLIDO, Nombre - 148", tal cual lo escribe el Excel. */
  etiqueta: string;
  persona: string;
  legajo: number | null;
  /** Legajo asignado (automático o elegido a mano); "" o null = no cargar. */
  choferId: string | null;
  auto: boolean;
  candidatos: { id: string; nombre: string; puntaje: number }[];
  /** Importe de la lista de la nómina. Null si la celda venía vacía. */
  importe: number | null;
  /** Por qué banco sale cada parte, ya con el nombre canónico del sistema. */
  bancos: { banco: string; importe: number }[];
  /** Lo retenido por embargo en el mes (puede haber más de uno). */
  embargo: number;
  /** Los bancos que hoy tiene cargados el legajo. */
  bancosLegajo: string[];
  /**
   * Qué va a pasar con los datos bancarios del legajo:
   *  - `igual`: ya está cargado lo mismo.
   *  - `nuevo`: el legajo no tenía nada y se completa.
   *  - `suma`: tenía uno y el Excel agrega otro.
   *  - `distinto`: el legajo dice un banco que el Excel no menciona. NO se borra.
   */
  estadoBancos: "igual" | "nuevo" | "suma" | "distinto";
};

export type NominaImportPreview =
  | {
      ok: true;
      archivo: string;
      /** Mes leído del nombre del archivo. Null obliga a elegirlo en la pantalla. */
      mesSugerido: string | null;
      anio: number | null;
      totales: {
        nominaExcel: number | null;
        sueldosExcel: number | null;
        sueldosMasEmbargosExcel: number | null;
        /** Lo que realmente se va a cargar con las asignaciones automáticas. */
        aCargar: number;
        embargosACargar: number;
      };
      bancos: { banco: string; personas: number; total: number; totalExcel: number | null }[];
      personas: NominaPersonaPreview[];
      roster: { id: string; nombre: string; rol: string; estado: string }[];
      /**
       * Meses de nómina ya cargados. Van todos y no sólo el del archivo: el mes
       * se puede cambiar a mano en la pantalla, y hay que poder avisar que se
       * está por reemplazar uno cargado ANTES de reemplazarlo.
       */
      mesesCargados: { mes: string; pagos: number; total: number }[];
      warnings: string[];
    }
  | { ok?: false; error: string };

export type NominaImportResult =
  | {
      ok: true;
      mes: string;
      personas: number;
      pagos: number;
      embargos: number;
      total: number;
      /** Cuentas bancarias agregadas a los legajos. */
      bancosAgregados: number;
      /** Personas del Excel que quedaron sin cargar (sin legajo asignado). */
      omitidos: { etiqueta: string; importe: number | null }[];
      /** Legajos con un banco que el Excel de este mes no menciona. No se tocan. */
      bancosSinConfirmar: { nombre: string; banco: string }[];
    }
  | { ok?: false; error: string };

// ---------------------------------------------------------------------------
// Lectura: la nómina ya cargada
// ---------------------------------------------------------------------------

export type NominaPersonaMes = {
  chofer_id: string;
  nombre: string;
  rol: string;
  /** Cobró el mes pero ya no está en la empresa (pasa con los egresos del mes). */
  egresado: boolean;
  /** Por dónde salió cada parte; `banco` null si el Excel no lo decía. */
  bancos: { banco: string | null; importe: number }[];
  total: number;
  embargo: number;
};

export type NominaMesResumen = {
  mes: string;
  personas: NominaPersonaMes[];
  bancos: { banco: string | null; personas: number; total: number }[];
  total: number;
  totalEmbargos: number;
  /** El total que declaraba el Excel, para poder contrastar. */
  totalExcel: number | null;
  archivo: string | null;
  observaciones: string | null;
  /** Meses que tienen nómina cargada, para saber dónde mirar. */
  mesesCargados: string[];
};
