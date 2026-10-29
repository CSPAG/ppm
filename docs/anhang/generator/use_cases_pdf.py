import html
from daten import BAUM
from uc_daten import UCS
from uc_texte import TEXTE
E = html.escape
BCNAME = {c[0]: c[1] for m in BAUM for d in m[2] for c in d[2] if len(c) == 5}
AKTIV = [(m[0], c[0], c[1]) for m in BAUM for d in m[2] for c in d[2] if len(c) == 5]
DOK = "Use Cases Projektportfoliomanagement"
nr = [1]
def fuss():
    nr[0] += 1
    return f'<div class="fuss"><div class="links"><img src="csp-assets/signet-punkte.svg" alt="">CSP Solutions · {DOK} · Entwurf</div><div>{nr[0]}</div></div>'
def seite(inhalt, unten='', fuss_=True):
    f = fuss() if fuss_ else ''
    if not fuss_: nr[0] += 1
    return f'<section class="seite{" mit-fuss" if fuss_ else ""}"><div class="inhalt">{inhalt}</div>{unten}{f}</section>'
def titel(a, b, klein=True, kicker=''):
    k = f'<p class="kicker">{kicker}</p>' if kicker else ''
    return f'{k}<h2 class="titel-seite{" klein" if klein else ""}"{" style=\"margin-top:6px\"" if kicker else ""}>{a}<br><span class="grau">{b}</span></h2>'
def kasten(a, b):
    return f'<div class="kasten schieber" style="margin-bottom:64px;padding-top:34px;padding-bottom:36px"><p class="aussage">{a}<br><span class="grau">{b}</span></p></div>'

S = []
# 1 Deckblatt
S.append(f'''<section class="seite">
  <div style="height:430px;flex-shrink:0;padding:56px var(--rand) 0;display:flex;flex-direction:column;align-items:center">
    <img class="logo cover" src="csp-assets/logo-csp-solutions-ink.svg" alt="CSP Solutions">
    <h1 class="titel-cover" style="margin-top:34px">Use<br>Cases<br>PPM</h1>
    <p class="meta" style="margin-top:26px">Kernabläufe und Arbeitsräume · Insel Gruppe · Entwurf<br>26. Oktober 2026 · Intern</p>
  </div>
  {open('symbol.html').read()}
</section>''')

# 2 Prinzip
RAEUME = [("Projekt","Der Projektvertrag als Akte: Kapitel, Status, Gates, Versionen, Berichte. Alles, was Projektleitung und Sponsor tun."),
          ("Portfolio","Liste, Matrix, Funnel und Dashboard je Kategorie A, B, C. Bewerten, priorisieren, ausbalancieren, prüfen."),
          ("Gremium","Sitzungen mit Traktanden, Vorlagen und Entscheiden. Gate-Reviews, Freigaben, Eskalationen."),
          ("Ziele","Handlungsfelder, strategische Ziele und Jahresziele mit Metrik und den Projekten, die darauf einzahlen.")]
karten = ''.join(f'<div class="karte"><p class="zwischentitel">{a}</p><p class="text-klein" style="margin-top:10px">{E(b)}</p><p class="text-klein fett" style="margin-top:8px;color:var(--grau)">{", ".join(u[0] for u in UCS if u[2]==a)}</p></div>' for a,b in RAEUME)
S.append(seite(titel("Abläufe statt Menüs.", "Vier Arbeitsräume.", klein=False) + f'''
  <div class="spalten abstand">
    <p class="text">Der Funktionsbaum ordnet nach Themen. Würde das UI ihm folgen, müsste die Projektleitung für einen einzigen Projektvertrag durch fünf Module springen. Deshalb bündeln die Use Cases Business Cases zu Abläufen, wie sie die Insel Gruppe tatsächlich lebt.</p>
    <p class="text">Jeder Use Case hat einen Heimat-Arbeitsraum, in dem er von Anfang bis Ende läuft. Ein Eingang führt jede Rolle zu ihren anstehenden Aufgaben. Die Administration liegt getrennt davon.</p>
  </div>
  <div class="raster-4 abstand" style="gap:30px var(--luecke)">{karten}</div>
  <p class="text-klein abstand-s">Dazu kommen der <span class="fett">Eingang</span> als Einstieg für alle Rollen und die <span class="fett">Administration</span> mit UC-016 bis UC-018.</p>'''))

# 3 UC-Liste
def uc_rows(sub):
    r = ''
    for i,n,h,b,a,k,bcs in sub:
        stern = ' <span style="color:var(--akzent)">●</span>' if k else ''
        r += f'<tr><td style="white-space:nowrap">{i}</td><td><span style="font-weight:800;color:var(--ink)">{E(n)}</span>{stern}<br><span class="bcs">{", ".join(bcs)}</span></td><td>{h}{("<br><span style=\"color:var(--grau)\">+ "+b+"</span>") if b else ""}</td><td>{E(a)}</td></tr>'
    return f'<table class="tabelle uc"><thead><tr><th style="width:62px">ID</th><th>Use Case · Business Cases</th><th style="width:96px">Arbeitsraum</th><th style="width:100px">Primär</th></tr></thead><tbody>{r}</tbody></table>'
S.append(seite(titel("Die Use Cases.", "Sechs davon sind Kern.") + f'<div class="abstand">{uc_rows(UCS[:9])}</div><p class="text-klein abstand-s"><span style="color:var(--akzent)">●</span> Kernablauf · Arbeitsraum: Heimat, darunter weitere berührte Räume.</p>'))
S.append(seite(titel("Die Use Cases.", "Fortsetzung.") + f'<div class="abstand">{uc_rows(UCS[9:])}</div>'))

# Traceability
UCI = [u[0][-2:] for u in UCS]
def tr_tab(rows):
    head = ''.join(f'<th class="m">{x}</th>' for x in UCI)
    body = ''
    vor = None
    for bm, bc, name in rows:
        if bm != vor:
            body += f'<tr class="bm"><td colspan="{len(UCI)+1}">BM {bm}</td></tr>'; vor = bm
        cells = ''.join(f'<td class="m">{"●" if bc in u[6] else ""}</td>' for u in UCS)
        body += f'<tr><td class="bc"><b>{bc}</b> {E(name)}</td>{cells}</tr>'
    return f'<table class="matrix"><thead><tr><th class="bc">Business Case · UC-0…</th>{head}</tr></thead><tbody>{body}</tbody></table>'
teile = [AKTIV[:30], AKTIV[30:60], AKTIV[60:]]
S.append(seite(titel("Traceability.", "Kein Business Case allein.") + f'<div class="abstand-s">{tr_tab(teile[0])}</div>'))
S.append(seite(titel("Traceability.", "Fortsetzung.") + f'<div class="abstand-s">{tr_tab(teile[1])}</div>'))
S.append(seite(titel("Traceability.", "Fortsetzung.") + f'<div class="abstand-s">{tr_tab(teile[2])}</div><p class="text-klein abstand-s">{len(AKTIV)} aktive Business Cases, alle durch mindestens einen Use Case realisiert. PP.01.01 entfällt.</p>'))

# UC ausformuliert
MD=[]
def ref(bcs): return ', '.join(f'{b} {E(BCNAME[b])}' for b in bcs)
def punkte(xs): return '<ul class="punkte klein" style="gap:7px">' + ''.join(f'<li style="font-weight:600">{x}</li>' for x in xs) + '</ul>'
def ablauf(rows, alt=False):
    if alt:
        h = '<tr><th style="width:52px">Schritt</th><th style="width:250px">Aktion User</th><th>Systemverhalten</th></tr>'
        b = ''.join(f'<tr><td>{s}</td><td>{u}</td><td>{y}</td></tr>' for s,u,y in rows)
    else:
        MD.append("\n**Standardablauf**\n\n| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |\n|---|---|---|---|\n" + "".join(f"| {a} | {b} | {c} | {d} |\n" for a,b,c,d in rows) + "\n**Alternativablauf**\n")
        h = '<tr><th style="width:44px">Schritt</th><th style="width:52px">Abzw.</th><th style="width:250px">Aktion User</th><th>Systemverhalten</th></tr>'
        b = ''.join(f'<tr><td>{s}</td><td>{a}</td><td>{u}</td><td>{y}</td></tr>' for s,a,u,y in rows)
    return f'<table class="tabelle ab"><thead>{h}</thead><tbody>{b}</tbody></table>'
def alt_block(aid, name, ab, bed, rows, ende):
    MD.append(f"\n**{aid} {name} (ab Schritt {ab}):** Bedingung: {bed}\n\n| Schritt | Aktion User | Systemverhalten |\n|---|---|---|\n" + "".join(f"| {a} | {b} | {c} |\n" for a,b,c in rows) + f"\nEnde: {ende}\n")
    return f'<div class="altb"><p class="zwischentitel" style="font-size:17px">{aid}&ensp;{name} <span class="grau">(ab Schritt {ab})</span></p><p class="text-klein" style="margin:4px 0 8px"><span class="fett">Bedingung:</span> {bed}</p>{ablauf(rows, True)}<p class="text-klein" style="margin-top:6px"><span class="fett">Ende:</span> {ende}</p></div>'

def uc_kopf(u, aus, uc_text, res, ui, akteure, vorb):
    i,n,h,b,a,k,bcs = u
    MD.append(f"\n### {i} {n}\n\n**Referenz Funktionsbaum:** {', '.join(x+' '+BCNAME[x] for x in bcs)}\n\n**Arbeitsraum:** {h}\n\n#### Beschreibung\n- **Ausgangslage:** {aus}\n- **Use Case:** {uc_text}\n- **Resultat:** {res}\n- **User Interfaces:** {ui}\n\n#### Beteiligte Akteure\n| Akteur | Rolle im Use Case |\n|---|---|\n" + "".join(f"| {x} | {y} |\n" for x,y in akteure) + "\n#### Vorbedingungen\n" + "".join(f"- {v}\n" for v in vorb) + "\n#### Ablauf\n")
    ak = ''.join(f'<tr><td>{E(x)}</td><td>{E(y)}</td></tr>' for x,y in akteure)
    return titel(f'{i}.', E(n)+'.', kicker=f'Use Case · Arbeitsraum {h}') + f'''
  <p class="text-klein abstand-s"><span class="fett">Referenz Funktionsbaum:</span> {ref(bcs)}</p>
  <p class="label abstand-s" style="margin-bottom:8px">Beschreibung</p>
  <table class="tabelle ab besch"><tbody>
   <tr><td>Ausgangslage</td><td>{aus}</td></tr><tr><td>Use Case</td><td>{uc_text}</td></tr>
   <tr><td>Resultat</td><td>{res}</td></tr><tr><td>User Interfaces</td><td>{ui}</td></tr></tbody></table>
  <div class="spalten abstand-s" style="gap:30px">
   <div><p class="label" style="margin-bottom:8px">Beteiligte Akteure</p><table class="tabelle ab"><tbody>{ak}</tbody></table></div>
   <div><p class="label" style="margin-bottom:8px">Vorbedingungen</p>{punkte(vorb)}</div>
  </div>'''

U = {u[0]: u for u in UCS}
for u in UCS:
    T = TEXTE.get(u[0])
    if not T:
        continue
    i = u[0]
    S.append(seite(uc_kopf(u, T['aus'], T['uc'], T['res'], T['ui'], T['akteure'], T['vorb'])))
    k = kasten(*T['kasten']) if T.get('kasten') else ''
    alts = T['alts']
    S.append(seite(titel(f"{i}.", "Standardablauf.", kicker=f"Use Case · {T['kurz']}") + '<div class="abstand-s">' + ablauf(T['ablauf']) + '</div>',
                   k if T.get('kasten_bei') == 'ablauf' or not alts else ''))
    pos = 0
    for nr_s, anzahl in enumerate(T['seiten']):
        teil = alts[pos:pos + anzahl]; pos += anzahl
        letzte = pos >= len(alts)
        S.append(seite(titel(f"{i}.", "Alternativabläufe." if nr_s == 0 else "Alternativabläufe, Fortsetzung.", kicker=f"Use Case · {T['kurz']}")
                       + '<div class="abstand-s">' + ''.join(alt_block(*a) for a in teil) + '</div>',
                       k if letzte and T.get('kasten_bei') == 'alt' else ''))

# Prüfregeln + offen + Kontakt
REGELN = ["Jeder Kernablauf läuft in seinem Heimat-Arbeitsraum; Übergaben in einen anderen Raum laufen über den Eingang.",
 "Jede wiederkehrende Aufgabe ist aus dem Eingang erreichbar.",
 "Daten werden einmal erfasst: Bericht, Vorlage und Dashboard sind Sichten auf den Projektvertrag.",
 "Ein Prototyp der Kernabläufe wird mit PL, UE und PRAT an realen Fällen getestet."]
OFFEN = [("Pflichtfelder","Welche Angaben des Projektvertrags sind je Phase Pflicht? Das PM-Handbuch nennt nur Lieferergebnisse."),
 ("Abweichung","Ab welcher Schwelle ist eine Abweichung wesentlich? Das PM-Handbuch nennt «Toleranzen» ohne Werte."),
 ("Kategorie B","Gelten Quality-Check und monatliches Dashboard auch für GL-Projekte?"),
 ("Sponsoren-Koalition","Wer gehört dazu? Im Produkt ist sie eine freie Funktion der Projektorganisation (Entscheid 17)."),
 ("SNS-VR","Wie werden Geschäfte in P0 und P1 dem SNS-VR vorgelegt und dessen Entscheide erfasst?")]
reg = ''.join(f'<li>{E(x)}</li>' for x in REGELN)
off = ''.join(f'<li>{E(a)} <span class="neben">{E(b)}</span></li>' for a,b in OFFEN)
S.append(f'''<section class="seite"><div class="inhalt">
  {titel("Prüfregeln.", "Und was noch offen ist.", klein=False)}
  <div class="abstand" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--luecke)">
    <div><p class="label">Prüfregeln für UI und Spezifikation</p><ul class="punkte klein" style="gap:11px">{reg}</ul></div>
    <div><p class="label">Offene Punkte</p><ul class="punkte klein" style="gap:11px">{off}</ul></div>
  </div></div>
  <div class="band schieber" style="height:264px"><svg width="794" height="264" viewBox="0 0 794 264" aria-hidden="true"><circle cx="0.0" cy="70" r="41" fill="#D5362F"/><circle cx="132.3" cy="70" r="41" fill="#FFAE01"/><circle cx="264.6" cy="70" r="41" fill="#00C61C"/><circle cx="396.9" cy="70" r="41" fill="#D5362F"/><circle cx="529.2" cy="70" r="41" fill="#FFAE01"/><circle cx="661.5" cy="70" r="41" fill="#00C61C"/><circle cx="793.8" cy="70" r="41" fill="#D5362F"/><circle cx="0.0" cy="194" r="41" fill="#D5362F"/><circle cx="132.3" cy="194" r="41" fill="#FFAE01"/><circle cx="264.6" cy="194" r="41" fill="#00C61C"/><circle cx="396.9" cy="194" r="41" fill="#D5362F"/><circle cx="529.2" cy="194" r="41" fill="#FFAE01"/><circle cx="661.5" cy="194" r="41" fill="#00C61C"/><circle cx="793.8" cy="194" r="41" fill="#D5362F"/></svg></div>
  <div class="abschluss">
    <div class="zeile">
      <img class="logo abschluss-logo" src="csp-assets/logo-csp-solutions-weiss.svg" alt="CSP Solutions">
      <div class="kontakt"><p class="klein">Dein Kontakt</p><p class="gross">André Hochreutener</p><p class="neben">andre.hochreutener@csp-ag.ch</p></div>
    </div>
    <div class="fussnoten"><p>CSP AG · St. Gallen · Basel · Zürich · Bern</p><p>Entwurf. Stand 26. Oktober 2026. Ergänzt den Funktionsbaum PPM.</p></div>
  </div></section>''')

CSS = '''<style>
figure{margin:0}
.tabelle.uc td{padding:8px 10px 8px 0;font-size:13.5px}
.tabelle.uc .bcs{font-size:11.5px;color:var(--grau);font-weight:600}
.matrix{width:100%;border-collapse:collapse;font-size:12px}
.matrix th{font-size:10px;font-weight:800;color:var(--grau);padding:0 0 6px;border-bottom:1.5px solid var(--ink);text-align:center}
.matrix th.bc{text-align:left}
.matrix td{border-bottom:1px solid var(--linie);padding:3.6px 0;font-weight:600;color:var(--text)}
.matrix td.bc{white-space:nowrap;overflow:hidden;max-width:290px;text-overflow:ellipsis;padding-right:6px}
.matrix td.m,.matrix th.m{width:20px;text-align:center;color:var(--akzent)}
.matrix tr.bm td{font-weight:800;color:var(--grau);font-size:10px;letter-spacing:.06em;padding-top:8px}
.tabelle.ab td{font-size:13px;padding:7px 10px 7px 0}
.tabelle.ab td:first-child{white-space:nowrap}
.tabelle.besch td:first-child{width:118px}
.altb{margin-top:20px}
</style>'''
out = f'<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><title>CSP Solutions — {DOK}</title><link rel="stylesheet" href="csp-assets/csp-doc.css">{CSS}</head><body>{"".join(S)}{open("pruef.html").read()}</body></html>'
open('use-cases-ppm.html','w').write(out)

open('uc_ausformuliert.md','w').write(''.join(MD))
