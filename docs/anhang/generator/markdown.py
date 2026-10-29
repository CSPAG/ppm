"""Erzeugt Anhang-Markdown und JSON aus daten.py und uc_daten.py.

Aufruf im Ordner generator/:  python3 markdown.py
Die ausformulierten Use Cases stammen aus use_cases_pdf.py (Datei uc_ausformuliert.md);
fehlt sie, wird der bestehende Abschnitt aus ../use-cases.md übernommen.
"""
import json, os, re
from daten import BAUM
from uc_daten import UCS

STAND = "29. Oktober 2026"
HIER = os.path.dirname(os.path.abspath(__file__))
ANHANG = os.path.dirname(HIER)

def aktiv(c): return len(c) == 5
UC_JE_BC = {}
for u in UCS:
    for b in u[6]:
        UC_JE_BC.setdefault(b, []).append(u[0])
BCS = [c for m in BAUM for d in m[2] for c in d[2]]
AKTIV = [(m[0], c) for m in BAUM for d in m[2] for c in d[2] if aktiv(c)]
ENTFALLEN = [c for c in BCS if not aktiv(c)]
n_bd = sum(len(m[2]) for m in BAUM)
belegt = sum(1 for _, c in AKTIV if re.search(r'Q[6-9]', c[4]))
weg = ', '.join(c[0] for c in ENTFALLEN)

# ---- funktionsbaum.md
L = [f"# Funktionsbaum Projektportfoliomanagement (Insel Gruppe)\n",
     f"Entwurf, Stand {STAND}. {len(BAUM)} Business Modules, {n_bd} Business Domains, {len(AKTIV)} aktive Business Cases, "
     f"davon {belegt} aus Kundenunterlagen (Q6–Q9) belegt. Methode, Quellen und Entscheide: siehe [PPM-Master.md](../PPM-Master.md).\n",
     "## Funktionsbaum\n", "```"]
for m in BAUM:
    L.append(f"- BM {m[0]} {m[1]}")
    for d in m[2]:
        L.append(f"  - BD {d[0]} {d[1]}")
        for c in d[2]:
            L.append(f"    - BC {c[0]} {c[1]}" + ("" if aktiv(c) else " — entfällt"))
L += ["```\n", "## Business Cases\n"]
for m in BAUM:
    L += [f"\n### BM {m[0]} {m[1]}\n", "| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |", "|---|---|---|---|---|---|"]
    for d in m[2]:
        L.append(f"| **{d[0]}** | **{d[1]}** | | | | |")
        for c in d[2]:
            if aktiv(c):
                L.append(f"| {c[0]} | {c[1]} | {c[2]} | {c[3]} | {c[4]} | {', '.join(UC_JE_BC.get(c[0], []))} |")
            else:
                L.append(f"| {c[0]} | ~~{c[1]}~~ | entfällt: {c[2]} | {c[3]} | {c[4]} | |")
open(os.path.join(ANHANG, 'funktionsbaum.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

# ---- use-cases.md
alt = open(os.path.join(ANHANG, 'use-cases.md'), encoding='utf-8').read()
aus_md = os.path.join(HIER, 'uc_ausformuliert.md')
if os.path.exists(aus_md):
    kopf = alt[alt.index('## Ausformulierte Use Cases'):]
    kopf = kopf[:kopf.index('\n### ')]
    ausformuliert = kopf + open(aus_md, encoding='utf-8').read()
else:
    ausformuliert = alt[alt.index('## Ausformulierte Use Cases'):].rstrip('\n') + '\n'
L = [f"# Use Cases Projektportfoliomanagement (Insel Gruppe)\n",
     f"Entwurf, Stand {STAND}. Use Cases bündeln Business Cases zu Abläufen; jeder Use Case hat einen Heimat-Arbeitsraum "
     "(Projekt, Portfolio, Gremium, Ziele, Administration). Prinzip siehe [PPM-Master.md](../PPM-Master.md#7-ux-prinzip-arbeitsräume).\n",
     "## Use-Case-Liste\n", "● = Kernablauf\n",
     "| ID | Use Case | Kern | Heimat | berührt | Primärakteur | Business Cases |", "|---|---|---|---|---|---|---|"]
for i, n, h, b, a, k, bcs in UCS:
    L.append(f"| {i} | {n} | {'●' if k else ''} | {h} | {b} | {a} | {', '.join(bcs)} |")
L += ["\n## Traceability-Matrix\n",
      "| Business Case | " + " | ".join(u[0][-2:] for u in UCS) + " |",
      "|---|" + "---|" * len(UCS)]
for _, c in AKTIV:
    L.append(f"| {c[0]} {c[1]} | " + " | ".join('●' if c[0] in u[6] else '' for u in UCS) + " |")
ohne = [c[0] for _, c in AKTIV if c[0] not in UC_JE_BC]
L.append(f"\nAlle {len(AKTIV)} aktiven Business Cases sind durch mindestens einen Use Case realisiert. {weg} entfällt.\n"
         if not ohne else f"\nOhne Use Case: {', '.join(ohne)}. {weg} entfällt.\n")
open(os.path.join(ANHANG, 'use-cases.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n' + ausformuliert)

# ---- JSON
fb = [{"bm": m[0], "name": m[1], "domains": [{"bd": d[0], "name": d[1], "business_cases": [
        {"id": c[0], "name": c[1], "ziel": c[2], "akteure": c[3], "herleitung": c[4],
         "entfaellt": not aktiv(c), "use_cases": UC_JE_BC.get(c[0], []) if aktiv(c) else []}
        for c in d[2]]} for d in m[2]]} for m in BAUM]
uc = [{"id": i, "name": n, "heimat": h, "beruehrt": b, "primaerakteur": a, "kernablauf": k, "business_cases": bcs}
      for i, n, h, b, a, k, bcs in UCS]
for name, obj in (('funktionsbaum.json', fb), ('use-cases.json', uc)):
    open(os.path.join(ANHANG, 'daten', name), 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, indent=1))
print(f"{len(AKTIV)} aktive BCs, {belegt} aus Q6–Q9 belegt, {len(UCS)} Use Cases")
