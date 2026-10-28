/**
 * Texte des Gate-Modus (UI-08; Kernablauf K2 Schritte 1–4, «Regeln», «Texte»): Anrede «Du» (UX-OF-1), Schweizer Rechtschreibung,
 * Schaltflächen wie im Kernablauf.
 */
export const TG = {
  titel: (gate: string) => `${gate} vorbereiten`,
  version: (nummer: string, phase: string) => `Version ${nummer} für ${phase}`,
  gremium: (kuerzel: string) => `Entscheid: ${kuerzel.toUpperCase()}`,
  viaSns: 'zusätzlich via SNS-VR',
  keinGremium: 'Für dieses Gate ist im Portfolio kein Gremium eingetragen.',
  kapitelBearbeiten: 'Kapitel bearbeiten',
  zusammenfassung: (leit: string, liefer: string, fehlen: number) =>
    `Leitfragen ${leit} · Lieferergebnisse ${liefer} · ${fehlen === 0 ? 'Angaben vollständig' : fehlen === 1 ? '1 Angabe fehlt' : `${fehlen} Angaben fehlen`}`,
  vonGesamt: (n: number, gesamt: number) => `${n} von ${gesamt}`,

  // Entwurf anlegen (K2 Schritt 1, UC-003 Schritt 2)
  keinEntwurf: 'Für das nächste Gate gibt es noch keinen Entwurf.',
  anlegen: (phase: string) => `Entwurf für Phase ${phase} anlegen`,
  anlegenWirkung: (baseline: string, seit: string, neu: string) => `Übernimmt Version ${baseline} (Baseline seit ${seit}) als Entwurf ${neu}.`,
  angelegt: (nummer: string) => `Entwurf ${nummer} angelegt.`,
  nichtMoeglich: 'Ein Entwurf für das Gate ist jetzt nicht möglich: Es gibt einen anderen Entwurf, keine Baseline, oder dir fehlt das Recht.',
  andererEntwurf: (nummer: string) => `Es gibt bereits einen Entwurf (Version ${nummer}) ohne Gate. Nimm die Gate-Vorbereitung nach seinem Abschluss auf.`,

  // Leitfragen (UC-003 Schritt 4)
  leitfragen: 'Leitfragen',
  leitfragenFortschritt: (n: number, gesamt: number) => `Leitfragen ${n} von ${gesamt} beantwortet`,
  keineLeitfragen: 'Für dieses Gate sind im Phasenmodell keine Leitfragen erfasst.',
  antwort: 'Antwort',
  trifftNichtZu: 'Trifft nicht zu',
  begruendung: 'Begründung',
  begruendungFehlt: 'Begründung fehlt: Begründe, warum die Leitfrage nicht zutrifft.',
  gespeichert: 'Gespeichert',
  speichert: 'Speichert …',
  konflikt: 'Die Antwort wurde inzwischen geändert. Lade neu; dein Text bleibt im Feld.',
  neuLaden: 'Neu laden',
  unbeantwortet: (n: number, gesamt: number, je: string) =>
    `Leitfragen: ${n} von ${gesamt} unbeantwortet (${je}). Beantworte sie oder begründe, warum sie nicht zutreffen.`,

  // Lieferergebnisse, Angaben (UC-003 Schritt 1)
  lieferergebnisse: (phase: string) => `Lieferergebnisse der Phase ${phase}`,
  erreicht: (datum: string) => `erreicht ${datum}`,
  offen: 'offen',
  keineErgebnisse: 'Für diese Phase sind keine Standard-Lieferergebnisse erfasst.',
  angaben: 'Angaben für die nächste Phase',
  angabenVollstaendig: 'Alle Pflichtangaben sind erfasst.',
  zurAngabe: (text: string, kapitel: number) => `${text} (Kap. ${kapitel})`,

  // Nutzenprüfung (UC-003 A2)
  nutzen: 'Nutzenprüfung',
  nutzenHinweis: 'Erfasse die erreichten Werte je KPI und deine Beurteilung (Projektleitung und Sponsor).',
  kpi: 'KPI',
  zielwert: 'Zielwert',
  erreichterWert: 'Erreicht',
  bemerkung: 'Bemerkung',
  beurteilung: 'Beurteilung',
  nutzenSpeichern: 'Nutzenprüfung speichern',
  nutzenGespeichert: 'Nutzenprüfung gespeichert.',
  keineKpis: 'Das Projekt hat noch keine KPIs im Register.',

  // Stände (Z8, Z9) und Entscheid (K2 Schritt 10)
  gesperrt: (stand: string) => `Die Version ist ${stand}; Leitfragen und Nutzenprüfung sind nur lesbar.`,
  entscheid: {
    freigegeben: (nummer: string, phase: string) => `Freigegeben: Version ${nummer} ist Baseline. Projekt in Phase ${phase}.`,
    mit_auflagen: 'Mit Auflagen freigegeben: Der Entwurf ist wieder in Arbeit; die Auflagen stehen in deinem Eingang.',
    zurueckgestellt: 'Zurückgestellt: Der Entwurf ist wieder in Arbeit; die Baseline bleibt.',
    abgelehnt: 'Gestoppt: Das Gremium hat das Gate nicht freigegeben. Weiter in der Projektakte › Abschluss.',
  },
} as const;
