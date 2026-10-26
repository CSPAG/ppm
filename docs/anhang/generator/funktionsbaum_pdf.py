import sys, html
sys.path.insert(0, '/mnt/skills/plugins/csp-solutions:csp-grafiken/scripts')
import csp_grafiken as g
E = html.escape

from daten import BAUM
nbd = sum(len(b[2]) for b in BAUM); nbc = sum(1 for b in BAUM for d in b[2] for c in d[2] if len(c)==5)
nq6 = sum(1 for b in BAUM for d in b[2] for c in d[2] if len(c)==5 and ('Q6' in c[4] or 'Q7' in c[4]))
print(len(BAUM), nbd, nbc, file=sys.stderr)

DOKNAME = "Funktionsbaum Projektportfoliomanagement"
seitenzahl = [1]
def fuss():
    seitenzahl[0] += 1
    return f'<div class="fuss"><div class="links"><img src="csp-assets/signet-punkte.svg" alt="">CSP Solutions · {DOKNAME} · Entwurf</div><div>{seitenzahl[0]}</div></div>'

STREIFEN = '<div class="schieber"></div><div class="band" style="height:96px;background:none;margin-bottom:64px"><div style="height:24px;background:#D5362F"></div><div style="height:24px;background:#FFAE01"></div><div style="height:24px;background:#00C61C"></div><div style="height:24px;background:#0093D3"></div></div>'

# ---------- Übersichtsgrafik ----------
def uebersicht():
    W = 682; tone = g.toene(g.BLAU, 6) + [g.GRAU]
    pill_w = 230; x0 = pill_w + 36; chip_w = W - x0; chip_h = 26; gap = 4; row_gap = 12
    y = 0; teile = []
    for i, (k, name, bds) in enumerate(BAUM):
        n = len(bds); h = n * chip_h + (n - 1) * gap
        ph = max(h, 58); f = tone[i]
        py = y + (h - ph) / 2 if h > ph else y
        cy = y + max(h, ph) / 2
        teile.append(f'<rect x="0" y="{cy-29}" width="{pill_w}" height="58" rx="29" fill="{f}"/>')
        teile.append(g._t(24, cy - 4, k, 12, 800, g.WEISS))
        teile.append(g._t(24, cy + 14, name, 14, 800, g.WEISS))
        teile.append(f'<rect x="{pill_w}" y="{cy-0.75}" width="{x0-pill_w-16}" height="1.5" fill="{g.LINIE}"/>')
        top = y + (max(h, ph) - h) / 2
        if n > 1:
            teile.append(f'<rect x="{x0-16}" y="{top+chip_h/2}" width="1.5" height="{h-chip_h}" fill="{g.LINIE}"/>')
        for j, (bk, bn, bcs) in enumerate(bds):
            yy = top + j * (chip_h + gap)
            teile.append(f'<rect x="{x0-16}" y="{yy+chip_h/2-0.75}" width="16" height="1.5" fill="{g.LINIE}"/>')
            teile.append(f'<rect x="{x0}" y="{yy}" width="{chip_w}" height="{chip_h}" rx="{chip_h/2}" fill="{g.SAND}"/>')
            teile.append(g._t(x0 + 16, yy + 18, bk, 11.5, 800, g.GRAU))
            teile.append(g._t(x0 + 62, yy + 18, bn, 12.5, 700, g.INK))
            teile.append(g._t(x0 + chip_w - 16, yy + 18, f'{sum(1 for c in bcs if len(c)==5)} BC', 11.5, 800, g.GRAU_TITEL, 'end'))
        y += max(h, ph) + row_gap
    return g._svg(W, int(y - row_gap + 2), ''.join(teile), False, 'Funktionsbaum: Business Modules und Business Domains')

# ---------- Seiten ----------
seiten = []
symbol = open('symbol.html').read()
seiten.append(f'''<section class="seite">
  <div style="height:430px;flex-shrink:0;padding:56px var(--rand) 0;display:flex;flex-direction:column;align-items:center">
    <img class="logo cover" src="csp-assets/logo-csp-solutions-ink.svg" alt="CSP Solutions">
    <h1 class="titel-cover" style="margin-top:34px">Projekt-<br>portfolio-<br>management</h1>
    <p class="meta" style="margin-top:26px">Funktionsbaum · Insel Gruppe · Entwurf<br>26. Oktober 2026 · Intern</p>
  </div>
  {symbol}
</section>''')

seiten.append(f'''<section class="seite mit-fuss">
  <div class="inhalt">
    <h2 class="titel-seite">Worum es geht.<br><span class="grau">Und wo es aufhört.</span></h2>
    <div class="spalten abstand">
      <p class="text">Der Funktionsbaum beschreibt ein System für die Strategieumsetzung und das Projektportfoliomanagement der Insel Gruppe: vom strategischen Ziel über Bewertung und Gates bis zum gemessenen Nutzen, auf drei Portfolioebenen.</p>
      <p class="text">Er folgt der CSP-Methode: Business Modules gruppieren Business Domains, diese gruppieren Business Cases. Jeder Business Case beschreibt, was ein User erreichen will und wie er das mit dem System tut — und woher wir das wissen.</p>
    </div>
    <div class="zahlen abstand">
      <div class="zahl"><span class="wert">{len(BAUM)}</span><span class="was">Business Modules, davon eines für Application Management</span></div>
      <div class="zahl"><span class="wert">{nbd}</span><span class="was">Business Domains</span></div>
      <div class="zahl"><span class="wert">{nbc}</span><span class="was">Business Cases, davon {nq6} aus Unterlagen der Insel Gruppe belegt</span></div>
    </div>
    <div class="spalten abstand">
      <div>
        <p class="label">Gehört dazu</p>
        <ul class="punkte klein">
          <li>Strategische Ziele, Jahresziele, Metriken</li>
          <li>Ideen und Projektverträge</li>
          <li>Bewertung, Priorisierung, Szenarien</li>
          <li>Portfolioentscheide und Roadmap</li>
          <li>Status, Gates, Änderungen, Abschluss</li>
          <li>Finanzen, Risiken, Nutzen, Reporting</li>
          <li>Ressourcen und Kapazitäten</li>
          <li>Drei Portfolioebenen <span class="neben">strategisch, GL, Direktionen</span></li>
        </ul>
      </div>
      <div>
        <p class="label">Umsystem oder ausserhalb</p>
        <ul class="punkte klein">
          <li>Strategiearbeit <span class="neben">Trends, PESTEL-Analyse</span></li>
          <li>Budgetprozess <span class="neben">erhält Input</span></li>
          <li>ERP <span class="neben">Ist-Kosten, noch offen</span></li>
          <li>HR-System <span class="neben">Personal, Abwesenheiten</span></li>
          <li>Operatives Projektmanagement <span class="neben">Aufgaben, Arbeitspakete, Detailplanung</span></li>
        </ul>
      </div>
    </div>
  </div>
  {STREIFEN}
  {fuss()}
</section>''')

QUELLEN = [("Q6","Insel Gruppe, Eckpunkte PPM","9 Folien vom 26.10.2026: F1 Strategieumsetzung, F2 Jahreszyklus, F3 Zielstruktur, F4 Portfolios und Rollen, F5 Projektorganisation, F6 Phasen und Gates, F7 Dashboard, F8–F9 Portfolio-Mockups"),
 ("Q7","Insel Gruppe, Vorlage Projektvertrag","Kopf, Kap. 1–13, Freigabe; Basis ist das PM-Handbuch der Insel Gruppe"),
 ("Q1","Lebenszyklus der Geschäftsobjekte","analytisch"),
 ("Q2","Event-Partitionierung","analytisch"),
 ("Q3","Ziele je Akteur","analytisch"),
 ("Q4","PMI, The Standard for Portfolio Management","Referenzstandard"),
 ("Q5","AXELOS, Management of Portfolios (MoP)","Referenzstandard")]
AKT = [("VR","Verwaltungsrat, Programmauftraggeber"),("CEO","Programmsponsor"),("PRAT","Programmausschuss Transformation (GL)"),("UE","Unternehmensentwicklung, Programmleitung"),("GL","Geschäftsleitung"),("GLPA","Gremium GL-Portfolio [OFFEN]"),("DIR","Gremium Direktionen [OFFEN]"),("AG","Auftraggeber/in"),("SP","Projektsponsor (GL-Mitglied, Direktion)"),("CTL","Clinical Transformation Lead"),("PL","Projektleitung"),("AS","Antragsteller/in"),("FI","Finanzen [OFFEN]"),("RM","Ressourcenmanagement [OFFEN]"),("ADM","Administrator/in")]
q_rows = ''.join(f'<tr><td>{a}</td><td><span style="font-weight:800;color:var(--ink)">{E(b)}</span><br><span style="color:var(--grau)">{E(c)}</span></td></tr>' for a,b,c in QUELLEN)
a_rows = ''.join(f'<tr><td>{a}</td><td>{E(b)}</td></tr>' for a,b in AKT)
seiten.append(f'''<section class="seite mit-fuss">
  <div class="inhalt">
    <h2 class="titel-seite klein">Woher es kommt.<br><span class="grau">Und wer damit arbeitet.</span></h2>
    <div class="abstand" style="display:grid;grid-template-columns:400px 1fr;gap:var(--luecke)">
      <div><p class="label">Quellen</p><table class="tabelle"><tbody>{q_rows}</tbody></table></div>
      <div><p class="label">Akteure</p><table class="tabelle"><tbody>{a_rows}</tbody></table></div>
    </div>
  </div>
  {fuss()}
</section>''')

seiten.append(f'''<section class="seite mit-fuss">
  <div class="inhalt">
    <h2 class="titel-seite">Der Funktionsbaum.<br><span class="grau">Sieben Module, ein Blick.</span></h2>
    <figure class="abstand" style="margin-left:0;margin-right:0">{uebersicht()}</figure>
    <p class="text-klein abstand-s">BC: Anzahl Business Cases je Domain. Application Management bündelt die Grundlagen, die alle anderen Module nutzen.</p>
  </div>
  {fuss()}
</section>''')

TITEL = {"ZM":("Zielmanagement.","Strategie wird messbar."),
 "DM":("Demand Management.","Aus Bedarf wird Vertrag."),
 "PP":("Portfolioplanung.","Die richtigen Vorhaben wählen."),
 "PS":("Portfoliosteuerung.","Laufende Vorhaben im Griff."),
 "PC":("Portfoliocontrolling.","Geld, Risiko, Nutzen."),
 "RK":("Ressourcen.","Wer macht es, und wann."),
 "AM":("Application Management.","Was alle brauchen.")}

def tabelle(bds):
    rows = ''
    for bk, bn, bcs in bds:
        rows += f'<tr class="bd"><td colspan="4">{bk} {E(bn)}</td></tr>'
        for c in bcs:
            i, n, z, a, h = c[:5]
            if len(c) > 5:
                rows += f'<tr class="weg"><td style="white-space:nowrap">{i}</td><td><span style="font-weight:800;text-decoration:line-through">{E(n)}</span><br>entfällt · {E(z)}</td><td>{E(a)}</td><td class="herl">{E(h)}</td></tr>'
                continue
            rows += f'<tr><td style="white-space:nowrap">{i}</td><td><span style="font-weight:800;color:var(--ink)">{E(n)}</span><br><span style="color:var(--grau)">{E(z)}</span></td><td>{E(a)}</td><td class="herl">{E(h)}</td></tr>'
    return f'<table class="tabelle bc"><thead><tr><th style="width:78px">ID</th><th>Business Case · Ziel</th><th style="width:96px">Akteure</th><th style="width:150px">Herleitung</th></tr></thead><tbody>{rows}</tbody></table>'

KASTEN={
 ("DM",0):("Erst die Idee, dann der Vertrag.","Aufwand erst, wenn es sich lohnt."),
 ("PS",0):("Status ist Pflicht, kein Gefallen.","Fehlende Berichte fallen auf."),
 ("PS",1):("Jede Abweichung braucht einen Entscheid.","Und jedes Vorhaben ein Ende."),
 ("PS",2):("Wer betroffen ist, hört es zuerst.","Und nicht aus der Zeitung."),
 ("PC",1):("Nutzen messen, nicht behaupten.","Auch nach Projektende.")}
def kasten(k, gi):
    t = KASTEN.get((k, gi))
    if not t: return ''
    return f'<div class="kasten schieber" style="margin-bottom:64px;padding-top:34px;padding-bottom:36px"><p class="aussage">{t[0]}<br><span class="grau">{t[1]}</span></p></div>'
MAXZ = 10
def aufteilen(bds, MAXZ=MAXZ):
    seiten_, akt, n = [], [], 0
    for d in bds:
        z = len(d[2])
        if akt and n + z > MAXZ:
            seiten_.append(akt); akt, n = [], 0
        akt.append(d); n += z
    if akt: seiten_.append(akt)
    return seiten_
SPLIT = {k: aufteilen(b, 9 if k=='PS' else MAXZ) for k,_,b in BAUM}
for k, name, bds in BAUM:
    t1, t2 = TITEL[k]
    klein = ' klein' if len(t1) > 20 else ''
    # Aufteilen falls nötig: Parameter split
    gruppen = SPLIT.get(k, [bds]) if 'SPLIT' in globals() else [bds]
    for gi, teil in enumerate(gruppen):
        ttl = f'{t1}<br><span class="grau">{t2}</span>' if gi == 0 else f'{t1}<br><span class="grau">Fortsetzung.</span>'
        seiten.append(f'''<section class="seite mit-fuss">
  <div class="inhalt">
    <p class="kicker">Business Module {k}</p>
    <h2 class="titel-seite klein" style="margin-top:6px">{ttl}</h2>
    <div class="abstand">{tabelle(teil)}</div>
  </div>
  {kasten(k, gi) if sum(len(d[2]) for d in teil) <= 6 else ''}
  {fuss()}
</section>''')

OFFEN = [("Abkürzungen","Wofür stehen GLPA, DIR, AeD, PFLE, DMS, DRC, «CP» und «Streams»?"),
 ("Auftraggeber und Sponsor","Sind das verschiedene Personen? Was ist die Sponsoren-Koalition?"),
 ("Kategorie B und C","Gelten Projektvertrag, Gates und Quality Review auch für GL- und Direktionsprojekte?"),
 ("Kriterienraster","Welche Kriterien und Gewichte führen zur Kategorie A, B oder C?"),
 ("Zeithorizont","Strategie 2035 (F1) oder Ziele 2030 (F3)? 3–5- oder Dreijahresziele?"),
 ("Finanzen","Kosten je Phase, Budget je Jahr: wie umrechnen? Woher kommen Ist-Kosten?"),
 ("PM-Handbuch","Es ist Basis des Projektvertrags. Können wir es als Quelle erhalten?")]
ANN = ["Strategiearbeit und PESTEL-Analyse liegen ausserhalb des Systems.","Das Transformationsprogramm entspricht dem strategischen Portfolio.","Der Projektvertrag wird als Daten je Projekt geführt; das Dokument entsteht daraus.","Auf Projektebene nur Portfoliorelevantes: Status, Meilensteine, Budget, Risiken, Ressourcen, KPIs, Kommunikation."]
o_html = ''.join(f'<li>{E(a)} <span class="neben">{E(b)}</span></li>' for a,b in OFFEN)
a_html = ''.join(f'<li>{E(a)}</li>' for a in ANN)
PUNKTE = open('/dev/null').read()
seiten.append(f'''<section class="seite">
  <div class="inhalt">
    <h2 class="titel-seite">Was noch offen ist.<br><span class="grau">Und was wir annehmen.</span></h2>
    <div class="abstand" style="display:grid;grid-template-columns:400px 1fr;gap:var(--luecke)">
      <div><p class="label">Offene Punkte</p><ul class="punkte klein" style="gap:11px">{o_html}</ul></div>
      <div><p class="label">Annahmen</p><ul class="punkte klein" style="gap:14px">{a_html}</ul></div>
    </div>
  </div>
  <div class="band schieber" style="height:264px">
    <svg width="794" height="264" viewBox="0 0 794 264" aria-hidden="true">
      <circle cx="0" cy="70" r="41" fill="#D5362F"/><circle cx="132.3" cy="70" r="41" fill="#FFAE01"/><circle cx="264.7" cy="70" r="41" fill="#00C61C"/><circle cx="397" cy="70" r="41" fill="#D5362F"/><circle cx="529.3" cy="70" r="41" fill="#FFAE01"/><circle cx="661.7" cy="70" r="41" fill="#00C61C"/><circle cx="794" cy="70" r="41" fill="#D5362F"/>
      <circle cx="0" cy="194" r="41" fill="#D5362F"/><circle cx="132.3" cy="194" r="41" fill="#FFAE01"/><circle cx="264.7" cy="194" r="41" fill="#00C61C"/><circle cx="397" cy="194" r="41" fill="#D5362F"/><circle cx="529.3" cy="194" r="41" fill="#FFAE01"/><circle cx="661.7" cy="194" r="41" fill="#00C61C"/><circle cx="794" cy="194" r="41" fill="#D5362F"/>
    </svg>
  </div>
  <div class="abschluss">
    <div class="zeile">
      <img class="logo abschluss-logo" src="csp-assets/logo-csp-solutions-weiss.svg" alt="CSP Solutions">
      <div class="kontakt">
        <p class="klein">Dein Kontakt</p>
        <p class="gross">André Hochreutener</p>
        <p class="neben">andre.hochreutener@csp-ag.ch</p>
      </div>
    </div>
    <div class="fussnoten">
      <p>CSP AG · St. Gallen · Basel · Zürich · Bern</p>
      <p>Entwurf. Stand 26. Oktober 2026.</p>
    </div>
  </div>
</section>''')

CSS = '''<style>
.tabelle.bc td{padding:8px 10px 8px 0;font-size:13.5px}
.tabelle.bc tr.weg td,.tabelle.bc tr.weg td span{color:#9c9993 !important}
.tabelle.bc td.herl{font-size:12.5px;color:var(--grau)}
.tabelle.bc tr.bd td{padding-top:18px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grau);border-bottom:1.5px solid var(--linie)}
.tabelle.bc tbody tr.bd:first-child td{padding-top:10px}
figure{margin:0}
</style>'''
pruef = open('pruef.html').read()
out = f'''<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8"><title>CSP Solutions — {DOKNAME}</title>
<link rel="stylesheet" href="csp-assets/csp-doc.css">{CSS}</head>
<body>
{''.join(seiten)}
{pruef}
</body></html>'''
open('funktionsbaum-ppm.html','w').write(out)
