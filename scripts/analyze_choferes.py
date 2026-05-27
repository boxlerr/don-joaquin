"""Analiza los 9 Excels y produce:
 1. Set canónico de choferes (source of truth = PATENTES MODELOS TN, 67 filas → choferes reales)
 2. Choferes mencionados en cada otra fuente
 3. Inconsistencias (typos, mismatches)
 4. Cobertura por dato (cuántos tienen fecha_ingreso, nacimiento, domicilio, etc)
"""
import pandas as pd
import unicodedata
import re
from pathlib import Path
from collections import defaultdict

DATA = Path(__file__).parent / "data"


def norm(s):
    if pd.isna(s):
        return ""
    s = str(s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[,.]", " ", s)
    s = re.sub(r"\s+", " ", s).strip().upper()
    return s


def apellido_key(s):
    return norm(s).split(" ")[0]


# ============================================================
# 1. PATENTES MODELOS TN  → canonical source
# ============================================================
patentes = pd.read_excel(DATA / "patentes-modelos-tn.xlsx", header=0)
patentes.columns = [str(c).strip() for c in patentes.columns]
# Filter only rows with a chofer name (excluding Transp/Equipo/Acop trailers)
patentes = patentes[patentes["CHOFER"].notna()].copy()
# Drop rows that don't look like chofer names (e.g., "Transp", "Acop", etc.)
non_chofer = patentes["CHOFER"].str.contains(r"Transp|Equipo|Acop", case=False, na=False)
chof_canon = patentes[~non_chofer].copy()
non_chof = patentes[non_chofer].copy()

print(f"PATENTES MODELOS TN:")
print(f"  Total filas con CHOFER no-vacío: {len(patentes)}")
print(f"  Choferes reales: {len(chof_canon)}")
print(f"  Filas tipo Transp/Equipo/Acop (no choferes): {len(non_chof)}")
print(f"  Esos extras: {list(non_chof['CHOFER'].astype(str))}\n")

chof_canon["key"] = chof_canon["CHOFER"].apply(apellido_key)
canon_keys = set(chof_canon["key"])
canon_by_key = {k: v for k, v in zip(chof_canon["key"], chof_canon["CHOFER"])}

# ============================================================
# 2. ANTIGÜEDAD Y EDAD
# ============================================================
ant = pd.read_excel(DATA / "antiguedad-edad.xlsx", sheet_name="ANTIGUEDAD PROMEDIO", header=0)
ant = ant[ant["CHOFER"].notna()]
ant = ant[~ant["CHOFER"].astype(str).str.contains("PROMEDIO", case=False, na=False)]
ant["key"] = ant["CHOFER"].apply(apellido_key)
print(f"ANTIGUEDAD PROMEDIO: {len(ant)} choferes con fecha_ingreso")

nac = pd.read_excel(DATA / "antiguedad-edad.xlsx", sheet_name="Hoja2", header=0)
nac = nac[nac["CHOFERES"].notna()]
nac = nac[~nac["CHOFERES"].astype(str).str.contains("PROMEDIO", case=False, na=False)]
nac["key"] = nac["CHOFERES"].apply(apellido_key)
print(f"NACIMIENTO (Hoja2): {len(nac)} choferes con fecha_nacimiento")

# ============================================================
# 3. DIRECCIONES
# ============================================================
dirs = pd.read_excel(DATA / "direcciones.xlsx", sheet_name="DIRECCIONES ACTUALES", header=0)
dirs = dirs[dirs["NOMBRE"].notna()]
dirs["key"] = dirs["NOMBRE"].apply(apellido_key)
print(f"DIRECCIONES: {len(dirs)} con domicilio")

# ============================================================
# 4. VENC CHOFERES (licencias)
# ============================================================
venc_chof = pd.read_excel(DATA / "venc-choferes.xlsx", header=1)
venc_chof.columns = [str(c).strip() for c in venc_chof.columns]
venc_chof = venc_chof[venc_chof["CHOFER"].notna()]
venc_chof["key"] = venc_chof["CHOFER"].apply(apellido_key)
print(f"VENC CHOFERES (licencias): {len(venc_chof)}")

# ============================================================
# 5. VENC MANUALES
# ============================================================
venc_man_c = pd.read_excel(DATA / "venc-manuales.xlsx", sheet_name="CHOFERES", header=1)
venc_man_c.columns = [str(c).strip() for c in venc_man_c.columns]
first_col = venc_man_c.columns[0]
venc_man_c = venc_man_c[venc_man_c[first_col].notna()]
venc_man_c["key"] = venc_man_c[first_col].apply(apellido_key)
print(f"VENC MANUALES - hoja CHOFERES: {len(venc_man_c)} (C.MUNIC + PSICOF + C.PELIG + C.GENE)")

venc_man_m = pd.read_excel(DATA / "venc-manuales.xlsx", sheet_name="MANUALES", header=0)
fc = venc_man_m.columns[0]
venc_man_m = venc_man_m[venc_man_m[fc].notna()]
venc_man_m["key"] = venc_man_m[fc].apply(apellido_key)
print(f"VENC MANUALES - hoja MANUALES: {len(venc_man_m)}")

# ============================================================
# 6. HOJA DE RUTA
# ============================================================
hr_xl = pd.ExcelFile(DATA / "hoja-de-ruta.xlsx")
hr_sheets = [s for s in hr_xl.sheet_names if s.upper() not in ("TOTALES", "FISCHER", "PABLO FISCHER", "TOTAL", "HOJA DE GASTOS", "HOJA DE GASTOS (2)", "HOJA1")]
print(f"HOJA DE RUTA: {len(hr_sheets)} sheets de choferes (+ {len(hr_xl.sheet_names)-len(hr_sheets)} sheets administrativos)")
print(f"  Sheets: {hr_sheets}")

# ============================================================
# Coverage matrix
# ============================================================
all_keys = canon_keys | set(ant["key"]) | set(nac["key"]) | set(dirs["key"]) | set(venc_chof["key"]) | set(venc_man_c["key"]) | set(venc_man_m["key"])

print(f"\n=== UNIVERSO TOTAL DE APELLIDOS (todas las fuentes): {len(all_keys)} ===")

rows = []
for k in sorted(all_keys):
    rows.append({
        "key": k,
        "patentes": "✓" if k in canon_keys else "",
        "antig": "✓" if k in set(ant["key"]) else "",
        "nac": "✓" if k in set(nac["key"]) else "",
        "dirs": "✓" if k in set(dirs["key"]) else "",
        "lic": "✓" if k in set(venc_chof["key"]) else "",
        "venc_man": "✓" if k in set(venc_man_c["key"]) else "",
        "manual": "✓" if k in set(venc_man_m["key"]) else "",
        "hr": "✓" if any(k == apellido_key(s) for s in hr_sheets) else "",
    })
cov = pd.DataFrame(rows)
cov.to_csv(DATA / "_coverage.csv", index=False)
print("\nCobertura por apellido (CSV en scripts/data/_coverage.csv):")
print(cov.to_string(index=False))

# ============================================================
# Inconsistencies
# ============================================================
print("\n=== INCONSISTENCIAS ===")
print("\n1) En PATENTES (canónico) pero NO en antigüedad:")
for k in sorted(canon_keys - set(ant["key"])):
    print(f"   • {canon_by_key[k]}")

print("\n2) En antigüedad pero NO en PATENTES:")
for k in sorted(set(ant["key"]) - canon_keys):
    r = ant[ant["key"] == k].iloc[0]
    print(f"   • {r['CHOFER']} (ingreso={r.get('INGRESO')})")

print("\n3) En PATENTES pero NO en nacimientos:")
for k in sorted(canon_keys - set(nac["key"])):
    print(f"   • {canon_by_key[k]}")

print("\n4) En nacimientos pero NO en PATENTES:")
for k in sorted(set(nac["key"]) - canon_keys):
    r = nac[nac["key"] == k].iloc[0]
    print(f"   • {r['CHOFERES']}")

print("\n5) En PATENTES pero NO en direcciones:")
for k in sorted(canon_keys - set(dirs["key"])):
    print(f"   • {canon_by_key[k]}")

print("\n6) En direcciones pero NO en PATENTES:")
for k in sorted(set(dirs["key"]) - canon_keys):
    r = dirs[dirs["key"] == k].iloc[0]
    print(f"   • {r['NOMBRE']}")

print("\n7) Apellidos con typos detectados (similar a otro):")
keys_list = sorted(all_keys)
for i, a in enumerate(keys_list):
    for b in keys_list[i+1:]:
        if a == b:
            continue
        # Levenshtein-style: una sola letra distinta o uno empieza con el otro
        if len(a) >= 5 and len(b) >= 5 and a[:5] == b[:5] and a != b:
            print(f"   • {a}  ~  {b}")

print("\n=== HOJA DE RUTA — patentes en cada sheet ===")
for s in hr_sheets:
    df = pd.read_excel(DATA / "hoja-de-ruta.xlsx", sheet_name=s, header=None, nrows=2)
    # Buscar la patente en la primera fila (cells before header row)
    pat = ""
    for col in df.columns:
        v = df.iloc[0, col] if col < len(df.columns) else None
        if isinstance(v, str) and re.search(r"[A-Z]{2,3}\s?\d{3,4}\s?[A-Z]{0,3}", v.upper()):
            pat = v
            break
    print(f"   {s:30s} → patente sheet: {pat!r}")
