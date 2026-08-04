import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildHojaRutaWorkbook, type ExportChofer } from "./build";

const VIAJE = {
  fecha: "2026-07-31",
  origen: "RAMALLO",
  destino: "PLANTA URIBURU",
  ruta_via: "ruta_5",
  km_con_carga: 300,
  km_vacios: 0,
  capacidad: 29,
  tonelaje: 28.5,
  remito: "210062362",
  material: "Cemento",
  importe: 150000,
  es_vacio: false,
};

const CHOFER: ExportChofer = {
  apellido: "PEREZ",
  nombre: "Juan",
  dni: "20123456",
  cuil: "20-20123456-3",
  telefono: "3364-111111",
  telefonoEmergencia: "3364-222222",
  domicilio: "San Martín 100",
  localidad: "Ramallo",
  provincia: "Buenos Aires",
  fechaIngreso: "2020-03-01",
  tractor: "AF696CR",
  acoplado: "AG556LU",
  viajes: [VIAJE],
};

async function leer(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

describe("buildHojaRutaWorkbook", () => {
  it("una hoja por chofer, con el nombre en el encabezado", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([CHOFER]));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["PEREZ"]);
    expect(wb.getWorksheet("PEREZ")!.getCell(1, 1).value).toBe("PEREZ, JUAN");
  });

  it("el período va a la derecha del encabezado sin tapar el nombre", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([CHOFER], "10/05/2026 al 15/07/2026"));
    const ws = wb.getWorksheet("PEREZ")!;
    expect(ws.getCell(1, 1).value).toBe("PEREZ, JUAN");
    expect(ws.getCell(1, 8).value).toBe("10/05/2026 al 15/07/2026");
  });

  it("sin período el encabezado queda como antes", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([CHOFER]));
    const ws = wb.getWorksheet("PEREZ")!;
    expect(ws.getCell(1, 1).value).toBe("PEREZ, JUAN");
    // A1:L1 sigue siendo UNA sola celda combinada: H1 no tiene contenido propio,
    // devuelve el del nombre. Con período, en cambio, H1 arranca su propio merge.
    expect(ws.getCell(1, 8).value).toBe("PEREZ, JUAN");
  });

  // Los índices son la posición real en la planilla del cliente. Van a mano y no
  // vía COL a propósito: si alguien corre una columna en build.ts, este test tiene
  // que romper (fue justo lo que pasó al agregar RUTA y quedó sin detectar).
  it("los datos del viaje caen en las columnas de la planilla del cliente", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([CHOFER], "Julio 2026"));
    const fila = wb.getWorksheet("PEREZ")!.getRow(6);
    expect(fila.getCell(2).value).toBe("RAMALLO"); // SALE DE
    expect(fila.getCell(3).value).toBe("PLANTA URIBURU"); // LLEGA A
    expect(fila.getCell(4).value).toBe("Ruta 5"); // RUTA
    expect(fila.getCell(5).value).toBe(300); // KM REC
    expect(fila.getCell(6).value).toBe(28.5); // TN COM 29 (capacidad 29)
    expect(fila.getCell(9).value).toBe("210062362"); // REMITO Nº
    expect(fila.getCell(10).value).toBe("Cemento"); // MATERIAL
    expect(fila.getCell(12).value).toBe(150000); // $
  });

  it("el encabezado nombra las columnas en el orden de la planilla", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([CHOFER], "Julio 2026"));
    const hr = wb.getWorksheet("PEREZ")!.getRow(5);
    expect([1, 2, 3, 4, 5, 6, 9, 10, 12].map((c) => hr.getCell(c).value)).toEqual([
      "DIA", "SALE DE", "LLEGA A", "RUTA", "KM REC", "TN COM 29", "REMITO Nº", "MATERIAL", "$",
    ]);
  });

  it("un viaje sin vía deja la celda RUTA vacía, no con guión", async () => {
    const chofer: ExportChofer = { ...CHOFER, viajes: [{ ...VIAJE, ruta_via: null }] };
    const ws = (await leer(await buildHojaRutaWorkbook([chofer], "Julio 2026"))).getWorksheet("PEREZ")!;
    expect(ws.getRow(6).getCell(4).value).toBeNull();
  });

  it("el viaje vacío no suma importe y se marca VACIO", async () => {
    const chofer: ExportChofer = {
      ...CHOFER,
      viajes: [{ ...VIAJE, es_vacio: true, km_con_carga: 0, km_vacios: 120, importe: null }],
    };
    const ws = (await leer(await buildHojaRutaWorkbook([chofer], "Julio 2026"))).getWorksheet("PEREZ")!;
    expect(ws.getRow(6).getCell(9).value).toBe("VACIO"); // REMITO Nº
    expect(ws.getRow(6).getCell(5).value).toBe(120); // el km del tramo vacío va a KM REC
    expect(ws.getRow(6).getCell(11).value).toBeNull(); // y NO se repite en KM VACIOS
  });

  it("un chofer sin viajes en el período igual trae su hoja con encabezado", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([{ ...CHOFER, viajes: [] }], "Mayo 2026"));
    const ws = wb.getWorksheet("PEREZ")!;
    expect(ws.getCell(1, 1).value).toBe("PEREZ, JUAN");
    expect(ws.getCell(1, 8).value).toBe("Mayo 2026");
    expect(ws.getRow(6).getCell(3).value).toBe("TOTALES"); // fila de totales, sin viajes
  });

  it("dos choferes con el mismo apellido no se pisan de hoja", async () => {
    const wb = await leer(
      await buildHojaRutaWorkbook(
        [CHOFER, { ...CHOFER, nombre: "Pedro" }],
        "Julio 2026",
      ),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(["PEREZ", "PEREZ 2"]);
  });

  it("sin choferes avisa el período en vez de un archivo mudo", async () => {
    const wb = await leer(await buildHojaRutaWorkbook([], "10/05/2026 al 15/07/2026"));
    expect(String(wb.getWorksheet("Sin datos")!.getCell("A1").value)).toContain(
      "10/05/2026 al 15/07/2026",
    );
  });
});
