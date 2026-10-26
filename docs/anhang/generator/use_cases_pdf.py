import html
from daten import BAUM
from uc_daten import UCS
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
# ---- UC-003
u3 = U["UC-003"]
S.append(seite(uc_kopf(u3,
  "Eine Phase nähert sich dem Ende. Der nächste Gate-Review ist im Projektvertrag eingeplant (Kap. 7.2); das System legt der Projektleitung eine Gate-Aufgabe in den Eingang.",
  "PL schreibt Projektvertrag und Business Case für die nächste Phase fort und beantwortet die Leitfragen des Gates. UE führt den Quality-Check durch, Sponsor, PL und CTL unterzeichnen. Das zuständige Gremium entscheidet am Gate und gibt damit den Vertrag für die nächste Phase frei: der PRAT, in P0 und P1 bis zur Freigabe von P2 zusätzlich der SNS-VR, bei Kategorie B die GLPA.",
  "Neue Vertragsversion freigegeben und als Baseline gespeichert, Gate-Entscheid mit Datum dokumentiert, Vorhaben in der nächsten Phase, Dashboard aktuell.",
  "Eingang; Projektakte im Gate-Modus mit Vertragskapiteln, Leitfragen und Versionsvergleich; Traktandum im Arbeitsraum Gremium.",
  [("PL","löst aus, schreibt Vertrag und Business Case fort, beantwortet Leitfragen, unterzeichnet"),("UE","führt den Quality-Check durch, stellt das Gate Review Packet bereit"),("SP, CTL","stimmen die Vorlage ab und unterzeichnen"),("PRAT, SNS, GLPA","entscheiden am Gate je nach Phase und Kategorie und geben den Vertrag frei")],
  ["PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).","Vorhaben hat einen freigegebenen Projektvertrag der laufenden Phase.","Ein Gate-Review ist eingeplant (PP.04.05)."])))
S.append(seite(titel("UC-003.", "Standardablauf.", kicker="Use Case · Gate-Übergang") + '<div class="abstand-s">' + ablauf([
 ("1","","PL öffnet die Gate-Aufgabe im Eingang.","System öffnet die Projektakte im Gate-Modus: Leitfragen des Gates je Wertestrom (Nutzen, Projekt, Klinik, ICT, Infrastruktur), die Standard-Lieferergebnisse der Phase und die Kapitel, die für die nächste Phase zu ergänzen sind."),
 ("2","","PL legt eine neue Vertragsversion an.","System übernimmt die freigegebene Version als Entwurf mit neuer Versionsnummer und Phase."),
 ("3","A1, A2","PL ergänzt die Kapitel, etwa Planung, Kosten je Phase, Personal, Risiken, Stakeholder und Kommunikation, und schreibt den Business Case fort.","System speichert und zeigt laufend die Abweichungen zur Baseline."),
 ("4","","PL beantwortet die Leitfragen des Gates.","System speichert die Antworten zur Version."),
 ("5","","PL prüft die Zusammenfassung der Hauptänderungen und ergänzt «Andere».","System erzeugt die Hauptänderungen zu Scope, Zeitplan, Ressourcen/Budget, Annahmen und Key-Risiken aus dem Versionsvergleich."),
 ("6","A3","PL reicht den Vertrag zur Prüfung ein.","System prüft die Pflichtangaben der Phase, setzt den Status «in Prüfung» und legt der UE die Aufgabe Quality-Check in den Eingang."),
 ("7","A4","UE prüft Vollständigkeit und Einhaltung des PM-Handbuchs und bestätigt.","System protokolliert den Quality-Check und legt SP, PL und CTL je eine Unterzeichnungsaufgabe an."),
 ("8","A5","SP, PL und CTL unterzeichnen.","System protokolliert die Unterzeichnung und setzt das Vorhaben auf die Traktandenliste des nächsten Gate-Reviews des zuständigen Gremiums."),
 ("9","","UE stellt das Gate Review Packet spätestens 5 Arbeitstage vor der Sitzung bereit (UC-006).","System stellt das Packet aus Vertrag, Business Case, Leitfragen und Hauptänderungen zusammen."),
 ("10","A6","Das Gremium gibt die nächste Phase und den Vertrag frei; UE erfasst den Entscheid.","System speichert den Entscheid, setzt den Status «abgenommen» und die Version als neue Baseline, wechselt die Phase, aktualisiert das Dashboard und informiert PL und SP."),
]) + '</div>'))
S.append(seite(titel("UC-003.", "Alternativabläufe.", kicker="Use Case · Gate-Übergang") + '<div class="abstand-s">' +
 alt_block("A1","Gate P1–P2",3,"Das Vorhaben will in die Implementierung.",[
   ("A1.1","","System verlangt Personal in FTE und Monaten je Rolle und Phase sowie Kosten P2–P4 statt der Grösse S/M/L."),
   ("A1.2","PL erfasst die Angaben.","System speichert sie im Vertrag und stellt sie der Ressourcen- und Finanzplanung bereit.")],"weiter bei Schritt 4.") +
 alt_block("A2","Gate ab P3",3,"Das Gate betrifft Stabilisierung oder Exit.",[
   ("A2.1","","System zeigt die Projekt-KPIs mit Zielwert und den nachgeführten Ist-Werten (PC.03.03)."),
   ("A2.2","PL und SP erfassen erreichte Werte und Beurteilung.","System speichert die Nutzenprüfung. Beim Exit-Gate P4 weiter in UC-015.")],"weiter bei Schritt 4.") +
 alt_block("A3","Pflichtangaben fehlen",6,"Für die Phase verlangte Angaben sind leer [OFFEN: Pflichtfelder je Phase; das PM-Handbuch (Q8 Anhang 1) nennt nur Lieferergebnisse].",[
   ("A3.1","","System listet die fehlenden Angaben."),("A3.2","PL ergänzt sie.","System prüft erneut.")],"weiter bei Schritt 6.") +
 '</div>'))
S.append(seite(titel("UC-003.", "Alternativabläufe, Fortsetzung.", kicker="Use Case · Gate-Übergang") + '<div class="abstand-s">' +
 alt_block("A4","Review mit Rückmeldungen",7,"UE stellt Mängel fest.",[
   ("A4.1","UE erfasst Rückmeldungen.","System setzt den Status «in Arbeit» und informiert PL.")],"weiter bei Schritt 3.") +
 alt_block("A5","Freigabe verweigert",8,"SP, PL oder CTL unterzeichnet nicht.",[
   ("A5.1","Rolle erfasst die Begründung.","System setzt den Status «in Arbeit» und informiert PL.")],"weiter bei Schritt 3.") +
 alt_block("A6","Gremium gibt nicht frei",10,"Das Gremium stellt zurück, erteilt Auflagen oder stoppt.",[
   ("A6.1","UE erfasst Entscheid und Auflagen.","System informiert PL und SP; die Baseline bleibt unverändert.")],"bei Auflagen weiter bei Schritt 3; bei Stopp weiter in UC-015.") + '</div>', kasten("Ein Gate, ein Durchgang.","Vertrag, Quality-Check, Unterschrift, Entscheid.")))

# ---- UC-004
u4 = U["UC-004"]
S.append(seite(uc_kopf(u4,
  "Der monatliche Stichtag (25.) naht, oder eine wesentliche Entwicklung verlangt eine Meldung ausserhalb des Rhythmus (Q8 Kap. 8.3, 8.4). Das System legt der Projektleitung eine Berichtsaufgabe in den Eingang.",
  "PL aktualisiert in einem Durchgang Meilensteine, Kostenprognose, Risiken, KPI-Werte und Kommunikationsmassnahmen und gibt Status, Trend, Abweichungen, Abhängigkeiten und anstehende Entscheide ab. Das System erstellt daraus den Statusbericht der Periode.",
  "Statusbericht eingereicht, mit Status, Trend und Vergleich zur Vorperiode; Projektdaten aktualisiert; Dashboard aktuell; Prüfaufgabe bei der UE.",
  "Eingang; Projektakte, Bereich Bericht; Dashboard-Zeile des Vorhabens (Q6 F7).",
  [("PL","löst aus, aktualisiert die Daten, reicht ein"),("UE","erhält den Bericht zur Prüfung (UC-005)"),("SP","wird bei Status «kritisch» informiert; gibt den Bericht nicht frei")],
  ["PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).","Vorhaben ist in Phase P0 bis P3 und hat einen freigegebenen Projektvertrag.","Die Berichtsperiode ist offen."])))
S.append(seite(titel("UC-004.", "Standardablauf.", kicker="Use Case · Monatlich berichten") + '<div class="abstand-s">' + ablauf([
 ("1","A3","PL öffnet die Berichtsaufgabe im Eingang.","System zeigt die Berichtsmaske mit den Werten der Vorperiode: Phase, Abschluss per, nächster Meilenstein, Status, Trend, dazu Meilensteine, Kosten, Risiken und Kommunikation."),
 ("2","A1","PL meldet erreichte Meilensteine und aufdatierte Termine.","System speichert im Meilensteinplan und markiert Abweichungen zur Baseline."),
 ("3","","PL aktualisiert die Kostenprognose.","System zeigt die Prognose gegenüber dem Budget je Phase [OFFEN: Quelle Ist-Kosten]."),
 ("4","","PL aktualisiert Risiken und Massnahmen.","System speichert im Risikoregister des Vorhabens."),
 ("5","","PL meldet erledigte Kommunikationsmassnahmen.","System setzt sie auf erledigt."),
 ("6","","PL erfasst ab der Implementierung die Ist-Werte der Projekt-KPIs.","System speichert sie zum Zielwert."),
 ("7","A2","PL wählt Status (im Plan/kritisch) und Trend, beurteilt die Abweichungen bei Inhalt, Termin, Ressourcen und Budget und erfasst nächsten Meilenstein, Abhängigkeiten und anstehende Entscheide.","System prüft die Pflichtangaben des Berichts."),
 ("8","","PL reicht den Bericht ein.","System speichert den Bericht als Stand der Periode, aktualisiert das Dashboard und legt der UE die Prüfaufgabe an; die UE konsolidiert bis Monatsende (UC-005)."),
]) + '</div>', kasten("Einmal erfassen, überall sehen.","Der Bericht ist eine Sicht auf die Projektdaten.")))
S.append(seite(titel("UC-004.", "Alternativabläufe.", kicker="Use Case · Monatlich berichten") + '<div class="abstand-s">' +
 alt_block("A1","Wesentliche Abweichung",2,"Termine, Kosten oder Umfang weichen wesentlich vom Projektvertrag ab [OFFEN: Schwelle].",[
   ("A1.1","","System weist darauf hin, dass eine Änderung am Projektvertrag zu beantragen ist."),
   ("A1.2","PL startet den Änderungsantrag (UC-007) oder eine Eskalation (UC-006).","System verknüpft Antrag bzw. Eskalation mit dem Bericht.")],"weiter bei Schritt 3.") +
 alt_block("A2","Status «kritisch»",7,"PL wählt den Status «kritisch».",[
   ("A2.1","","System verlangt Begründung und Massnahme."),
   ("A2.2","PL erfasst beides und hält fest, ob ein Entscheid des PRAT nötig ist.","System markiert das Vorhaben im Dashboard, informiert SP und UE und legt bei Entscheidbedarf eine Eskalation an (PS.03.03, UC-006).")],"weiter bei Schritt 8.") +
 alt_block("A3","Frist verpasst",1,"Bis zum 25. ist kein Bericht eingereicht.",[
   ("A3.1","","System erinnert PL und zeigt der UE den fehlenden Bericht (PS.01.03).")],"weiter bei Schritt 1.") + '</div>'))

# ---- UC-006
u6 = U["UC-006"]
S.append(seite(uc_kopf(u6,
  "Die monatliche PRAT-Sitzung steht an. Das konsolidierte Dashboard des Vormonats ist final (UC-005). Eingeplante Gate-Reviews (PP.04.05), gemeldete Eskalationen (PS.03.03) und Änderungsanträge (UC-007) liegen als Traktandenvorschläge im Arbeitsraum Gremium.",
  "UE stellt die Traktandenliste zusammen, prüft die Unterlagen und versendet sie spätestens 5 Arbeitstage vor der Sitzung. In der Sitzung berichtet die Programmleitung über das Portfolio, die eingeladenen Projekte stellen ihre Geschäfte vor, der PRAT entscheidet. UE erfasst die Entscheide und versendet das Protokoll innert 2–3 Arbeitstagen.",
  "Entscheide je Traktandum erfasst und mit den Vorhaben verknüpft; Phasen, Baselines, Meilensteine und Dashboard nachgeführt; Auflagen als Aufgaben bei den Verantwortlichen; Protokoll versendet.",
  "Eingang; Arbeitsraum Gremium mit Sitzung, Traktandenliste, Unterlagen und Entscheidmaske; Portfolio-Dashboard und Risikolage aus dem Arbeitsraum Portfolio.",
  [("UE","bereitet vor, versendet Unterlagen, berichtet als Programmleitung, erfasst Entscheide, versendet das Protokoll"),("PRAT","berät und entscheidet"),("PL, CTL","stellen das Geschäft ihres Vorhabens vor"),("SP","hat die Vorlage vorab abgestimmt, vertritt das Vorhaben")],
  ["UE ist angemeldet und für das Gremium PRAT berechtigt (AM.01.02).","Der Sitzungstermin ist im Gremium erfasst (AM.02.04).","Das Dashboard des Vormonats ist final (UC-005)."])))
S.append(seite(titel("UC-006.", "Standardablauf.", kicker="Use Case · PRAT-Sitzung") + '<div class="abstand-s">' + ablauf([
 ("1","","UE öffnet die Aufgabe «Sitzung vorbereiten» im Eingang.","System öffnet die Sitzung im Arbeitsraum Gremium mit Traktandenvorschlägen: Portfoliobericht, eingeplante Gate-Reviews, anstehende Meilensteinabnahmen, Eskalationen, Änderungen mit Wirkung auf Scope, Budget oder Ressourcen, Priorisierungs- und Szenarioentscheide."),
 ("2","A1","UE stellt die Traktandenliste zusammen und lädt je Geschäft PL, CTL und SP ein.","System legt die Traktanden mit Zeitbedarf an, für ein Gate-Review rund 35 Minuten (Präsentation 20, Diskussion 10, Entscheid 5), und informiert die Eingeladenen."),
 ("3","A2","UE prüft je Traktandum, ob die Unterlagen vollständig sind und den Quality-Check bestanden haben (UC-003).","System zeigt je Traktandum den Stand der Unterlagen."),
 ("4","","UE stellt den Portfoliobericht zusammen.","System erzeugt ihn aus dem Dashboard: Gesamtstatus, Status und Trend je Vorhaben, Risikolage, Abhängigkeiten, Eskalationen, anstehende Meilensteine, Freigaben und Abnahmen."),
 ("5","","UE versendet die Unterlagen spätestens 5 Arbeitstage vor der Sitzung.","System stellt Traktandenliste, Portfoliobericht und Gate Review Packets den PRAT-Mitgliedern im Arbeitsraum Gremium bereit und protokolliert den Versand."),
 ("6","","In der Sitzung berichtet UE über das Portfolio.","System zeigt Dashboard und Risikolage des Portfolios."),
 ("7","A3, A4","Je Traktandum stellen PL und CTL das Geschäft vor, der PRAT berät und entscheidet, UE erfasst den Entscheid mit Begründung.","System speichert den Entscheid am Traktandum und am Vorhaben und löst die Folgeschritte aus: Gate freigegeben (UC-003), Meilenstein abgenommen, Änderung freigegeben (UC-007), Eskalation erledigt, Priorisierung festgehalten, Vorhaben sistiert oder abgebrochen (UC-015)."),
 ("8","","UE schliesst die Sitzung.","System erzeugt den Protokollentwurf aus Traktanden und Entscheiden und aktualisiert das Dashboard."),
 ("9","","UE bereinigt das Protokoll und versendet es innert 2–3 Arbeitstagen.","System versendet es an den PRAT und die Beteiligten und schlägt nicht behandelte Traktanden für die nächste Sitzung vor."),
]) + '</div>'))
S.append(seite(titel("UC-006.", "Alternativabläufe.", kicker="Use Case · PRAT-Sitzung") + '<div class="abstand-s">' +
 alt_block("A1","Geschäft über den SNS-VR",2,"Ein Vorhaben in P0 oder P1 legt einen relevanten Meilenstein oder ein Gate bis zur Freigabe von P2 vor.",[
   ("A1.1","","System markiert das Traktandum «via SNS-VR»."),
   ("A1.2","UE erfasst in Schritt 7 die Stellungnahme des PRAT.","System legt das Geschäft dem SNS-VR vor; der Entscheid gilt erst mit dem SNS-VR [OFFEN: Ablauf und Erfassung im SNS-VR].")],"weiter bei Schritt 3.") +
 alt_block("A2","Unterlagen fehlen",3,"Das Gate Review Packet liegt 5 Arbeitstage vor der Sitzung nicht vor oder hat den Quality-Check nicht bestanden.",[
   ("A2.1","UE verschiebt das Traktandum auf die nächste Sitzung.","System informiert PL und SP und plant das Traktandum neu ein.")],"weiter bei Schritt 3 mit dem nächsten Traktandum.") +
 '</div>'))
S.append(seite(titel("UC-006.", "Alternativabläufe, Fortsetzung.", kicker="Use Case · PRAT-Sitzung") + '<div class="abstand-s">' +
 alt_block("A3","Zurückgestellt oder mit Auflagen",7,"Der PRAT stellt das Geschäft zurück oder entscheidet mit Auflagen.",[
   ("A3.1","UE erfasst die Auflagen mit Termin und Verantwortlichen.","System legt die Auflagen als Aufgaben in den Eingang der Verantwortlichen und plant das Traktandum für eine Folgesitzung ein.")],"weiter bei Schritt 7 mit dem nächsten Traktandum.") +
 alt_block("A4","Weiterleitung an den VR",7,"Der PRAT stellt besonderen Entscheidungs- oder Eskalationsbedarf fest.",[
   ("A4.1","UE erfasst die Weiterleitung an den VR.","System markiert das Geschäft und nimmt es in das nächste Quartalsreporting an den VR auf (UC-012) [OFFEN: Weiterleitung auch ausserhalb des Quartalsrhythmus?].")],"weiter bei Schritt 7 mit dem nächsten Traktandum.") +
 '</div>', kasten("Eine Sitzung, ein Durchgang.","Traktanden, Unterlagen, Entscheide, Protokoll.")))

# Prüfregeln + offen + Kontakt
REGELN = ["Jeder Kernablauf läuft in seinem Heimat-Arbeitsraum; Übergaben in einen anderen Raum laufen über den Eingang.",
 "Jede wiederkehrende Aufgabe ist aus dem Eingang erreichbar.",
 "Daten werden einmal erfasst: Bericht, Vorlage und Dashboard sind Sichten auf den Projektvertrag.",
 "Ein Prototyp der Kernabläufe wird mit PL, UE und PRAT an realen Fällen getestet."]
OFFEN = [("Pflichtfelder","Welche Angaben des Projektvertrags sind je Phase Pflicht? Das PM-Handbuch nennt nur Lieferergebnisse."),
 ("Abweichung","Ab welcher Schwelle ist eine Abweichung wesentlich? Das PM-Handbuch nennt «Toleranzen» ohne Werte."),
 ("Kategorie B","Gelten Quality-Check und monatliches Dashboard auch für GL-Projekte?"),
 ("Sponsoren-Koalition","Wer gehört dazu? Sie entscheidet Konflikte zwischen PL und CTL."),
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
