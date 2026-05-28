import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

const terms = ["gomez", "boxler", "pellandino"];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

async function run() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".xlsx"));
  console.log(`Buscando los términos en ${files.length} archivos Excel...`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      const wb = XLSX.readFile(filePath);
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: null });
        
        rows.forEach((row, idx) => {
          const rowStr = row.map((v: any) => normalize(String(v ?? ""))).join(" ");
          for (const term of terms) {
            if (rowStr.includes(term)) {
              console.log(`[ENCONTRADO] Archivo: ${file} | Hoja: ${sheetName} | Fila ${idx}:`, JSON.stringify(row));
            }
          }
        });
      }
    } catch (e: any) {
      console.error(`Error al leer ${file}:`, e.message);
    }
  }
}

run().catch(console.error);
