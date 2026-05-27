"""Inspeccionar los 9 Excels en scripts/data/ y mostrar conteos + columnas."""
import pandas as pd
from pathlib import Path

DATA = Path(__file__).parent / "data"

files = sorted(DATA.glob("*.xlsx"))
for f in files:
    print("=" * 80)
    print(f"FILE: {f.name}")
    print("=" * 80)
    xl = pd.ExcelFile(f)
    for s in xl.sheet_names:
        df = pd.read_excel(f, sheet_name=s, header=None)
        print(f"\n-- Sheet: {s!r}  ({df.shape[0]} rows x {df.shape[1]} cols)")
        # Print first 5 rows raw
        print(df.head(5).to_string(max_colwidth=40, max_cols=14))
    print()
