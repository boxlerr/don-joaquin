import * as XLSX from 'xlsx';

export interface ExcelColumn<T> {
  /** Título de la columna que aparecerá en el encabezado del Excel */
  header: string;
  /** Clave del objeto o función para obtener el valor a mostrar */
  key: keyof T | ((item: T) => unknown);
  /** Ancho opcional de la columna (en caracteres) */
  width?: number;
}

export interface ExportExcelOptions<T> {
  /** Nombre base del archivo (sin extensión ni fecha) */
  filename: string;
  /** Arreglo de datos a exportar */
  data: T[];
  /** Configuración de las columnas */
  columns: ExcelColumn<T>[];
  /** Nombre de la hoja de cálculo (por defecto: 'Datos') */
  sheetName?: string;
}

/**
 * Genera y descarga un archivo Excel (.xlsx) a partir de un conjunto de datos genérico.
 * Añade automáticamente la fecha y hora actual al nombre del archivo.
 */
export function exportToExcel<T>({
  filename,
  data,
  columns,
  sheetName = 'Datos',
}: ExportExcelOptions<T>): void {
  // 1. Mapear los datos al formato requerido por xlsx (arreglo de objetos donde las claves son los encabezados)
  const mappedData = data.map((item) => {
    const rowData: Record<string, unknown> = {};
    columns.forEach((col) => {
      const value = typeof col.key === 'function' ? col.key(item) : item[col.key];
      rowData[col.header] = value !== null && value !== undefined ? value : '';
    });
    return rowData;
  });

  // 2. Crear la hoja de cálculo a partir del JSON
  const worksheet = XLSX.utils.json_to_sheet(mappedData);

  // 3. Configurar el ancho de las columnas (auto-ajuste basado en el contenido si no se especifica)
  const colWidths = columns.map((col) => {
    if (col.width) {
      return { wch: col.width };
    }
    // Calcular el ancho máximo basado en el contenido y el encabezado
    let maxLen = col.header.length;
    mappedData.forEach((row) => {
      const val = row[col.header];
      const valLen = val ? String(val).length : 0;
      if (valLen > maxLen) {
        maxLen = valLen;
      }
    });
    // Añadir un padding y limitar entre 10 y 100 caracteres de ancho
    return { wch: Math.min(Math.max(maxLen + 3, 10), 100) };
  });

  worksheet['!cols'] = colWidths;

  // 4. Crear el libro de trabajo y añadir la hoja
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 5. Formatear la fecha y hora para el nombre del archivo (Ej: 2026-05-13_163000)
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS

  const cleanFilename = filename.replace(/\.xlsx$/, '');
  const finalFilename = `${cleanFilename}_${dateStr}_${timeStr}.xlsx`;

  // 6. Descargar el archivo
  XLSX.writeFile(workbook, finalFilename);
}

export const ExcelExportService = {
  exportToExcel,
};
