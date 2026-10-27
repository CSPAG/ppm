/**
 * Beschreibung der Kapitel 1–13 für die Arbeitsfläche (Vorlage Projektvertrag Q7; Schemas `Kapitel1` … `Kapitel13` der
 * API): Felder mit Bezeichnung, Art und Hilfe. Die Schlüssel sind die Felder der API und damit die Sprungziele der
 * Pflichtangaben (K2-4). Leere Einträge einer Liste entstehen mit `neu`.
 */
export type Art = 'text' | 'kurz' | 'auswahl' | 'datum' | 'monat' | 'zahl' | 'betrag' | 'person' | 'projekt' | 'rolle' | 'ziel' | 'jahresziel';

export interface Spalte { key: string; label: string; art: Art; optionen?: readonly [string, string][]; optional?: boolean; max?: number }
export interface Feld {
  key: string;
  label: string;
  art: 'text' | 'liste' | 'termine' | 'ziel' | 'jahresziel' | 'handlungsfeld';
  hilfe?: string;
  optional?: boolean;
  /** Liste: Spalten und leerer Eintrag. */
  spalten?: readonly Spalte[];
  neu?: () => Record<string, unknown>;
  /** Bezeichnung eines Eintrags («Risiko»). */
  eintrag?: string;
}

const PHASEN: [string, string][] = [['P0', 'P0 Initialisierung'], ['P1', 'P1 Konzept & Planung'], ['P2', 'P2 Implementierung'], ['P3', 'P3 Stabilisierung & Monitoring'], ['P4', 'P4 Abschluss']];
const STUFEN: [string, string][] = [['hoch', 'hoch'], ['mittel', 'mittel'], ['tief', 'tief']];
const text = (key: string, label: string, hilfe?: string): Feld => ({ key, label, art: 'text', hilfe, optional: true });

export const KAPITEL: readonly { nr: number; titel: string; felder: readonly Feld[] }[] = [
  { nr: 1, titel: 'Ausgangslage / Problembeschreibung', felder: [
    text('ausgangslage', 'Ausgangslage'),
    text('problemstellung', 'Problemstellung', 'Welche Problemstellung adressiert das Projekt?'),
    text('ohneProjekt', 'Ohne das Projekt', 'Was geschieht, wenn das Projekt nicht durchgeführt wird?'),
    text('vorprojekte', 'Vorprojekte und Initiativen', 'Frühere Vorhaben in derselben Thematik und ihr Bezug zu diesem Projekt.'),
    text('rahmenbedingungen', 'Vorgaben und Rahmenbedingungen'),
  ] },
  { nr: 2, titel: 'Strategiebezug', felder: [
    { key: 'strategischesZielId', label: 'Strategisches Ziel', art: 'ziel', hilfe: 'Zur Erfüllung welches strategischen Ziels trägt das Projekt bei? Das Handlungsfeld folgt dem Ziel.' },
    { key: 'jahreszielId', label: 'Jahresziel', art: 'jahresziel', optional: true },
    { key: 'handlungsfeldId', label: 'Handlungsfeld', art: 'handlungsfeld' },
    text('beitrag', 'Beitrag zum Ziel'),
  ] },
  { nr: 3, titel: 'Ziele und Nutzenbeitrag', felder: [
    text('ziele', 'Ziele'),
    text('nutzen', 'Nutzenbeitrag', 'Qualitativ und quantitativ.'),
    text('businessCase', 'Business Case', 'Nutzen mit Verweis auf Beilagen; die Kosten je Phase stehen in Kapitel 9 (Struktur offen, K21).'),
    { key: 'kpis', label: 'Projekt-KPIs', art: 'liste', eintrag: 'KPI', spalten: [
      { key: 'art', label: 'Art', art: 'auswahl', optionen: [['klinisch', 'klinisch'], ['nicht_klinisch', 'nicht klinisch'], ['projekt', 'Projekt']] },
      { key: 'text', label: 'KPI', art: 'kurz', max: 500 },
      { key: 'einheit', label: 'Einheit', art: 'kurz', optional: true, max: 50 },
      { key: 'zielwert', label: 'Zielwert', art: 'kurz', optional: true, max: 200 },
    ], neu: () => ({ registerId: null, art: 'projekt', text: '', einheit: '', zielwert: '' }) },
  ] },
  { nr: 4, titel: 'Lösungsansatz', felder: [text('loesungsansatz', 'Lösungsansatz'), text('annahmen', 'Annahmen')] },
  { nr: 5, titel: 'Abgrenzung', felder: [text('bearbeitet', 'Im Projekt bearbeitet'), text('nichtBearbeitet', 'Nicht bearbeitet')] },
  { nr: 6, titel: 'Abhängigkeiten von anderen Projekten / Schnittstellen', felder: [
    { key: 'abhaengigkeiten', label: 'Abhängigkeiten', art: 'liste', eintrag: 'Abhängigkeit', hilfe: 'Die Abhängigkeit erscheint nach der Freigabe auch beim anderen Projekt.', spalten: [
      { key: 'zuProjektId', label: 'Projekt', art: 'projekt' },
      { key: 'text', label: 'Abhängigkeit', art: 'kurz', max: 1000 },
      { key: 'ansprechperson', label: 'Ansprechperson', art: 'kurz', optional: true, max: 200 },
    ], neu: () => ({ registerId: null, zuProjektId: '', text: '', ansprechperson: '' }) },
    text('schnittstellen', 'Weitere Schnittstellen'),
  ] },
  { nr: 7, titel: 'Projektplanung und Lieferergebnisse', felder: [
    text('vorgehen', 'Tätigkeiten je Phase'),
    { key: 'meilensteine', label: 'Lieferergebnisse und Meilensteine', art: 'liste', eintrag: 'Eintrag', spalten: [
      { key: 'phase', label: 'Phase', art: 'auswahl', optionen: PHASEN },
      { key: 'art', label: 'Art', art: 'auswahl', optionen: [['lieferergebnis', 'Lieferergebnis'], ['meilenstein', 'Meilenstein']] },
      { key: 'text', label: 'Bezeichnung', art: 'kurz', max: 500 },
      { key: 'termin', label: 'Termin', art: 'datum', optional: true },
    ], neu: () => ({ registerId: null, phase: 'P1', art: 'meilenstein', text: '', termin: null }) },
    { key: 'termine', label: 'Zusammenfassung Projektplanung', art: 'termine' },
  ] },
  { nr: 8, titel: 'Projektstruktur und Organisation', felder: [
    { key: 'mitglieder', label: 'Rollen im Projekt', art: 'liste', eintrag: 'Rolle', hilfe: 'Sponsor, Projektleitung und CTL je höchstens eine Person; die Sponsoren-Koalition ist eine Liste (A-04).', spalten: [
      { key: 'funktion', label: 'Rolle', art: 'auswahl', optionen: [['sp', 'Sponsor'], ['koalition', 'Sponsoren-Koalition'], ['pl', 'Projektleitung'], ['ctl', 'Clinical Transformation Lead (CTL)'], ['kt', 'Kernteam']] },
      { key: 'personId', label: 'Person', art: 'person' },
      { key: 'akv', label: 'AKV und Verpflichtung', art: 'kurz', optional: true, max: 2000 },
    ], neu: () => ({ personId: '', funktion: 'kt', akv: '' }) },
  ] },
  { nr: 9, titel: 'Ressourcen', felder: [
    { key: 'kosten', label: 'Kosten je Phase', art: 'liste', eintrag: 'Kostenposition', spalten: [
      { key: 'phase', label: 'Phase', art: 'auswahl', optionen: PHASEN },
      { key: 'art', label: 'Art', art: 'auswahl', optionen: [['capex', 'CAPEX'], ['opex', 'OPEX']] },
      { key: 'text', label: 'Position', art: 'kurz', max: 500 },
      { key: 'lieferant', label: 'Lieferant', art: 'kurz', optional: true, max: 200 },
      { key: 'offerte', label: 'Offerte', art: 'kurz', optional: true, max: 200 },
      { key: 'betrag', label: 'Betrag CHF', art: 'betrag', optional: true },
    ], neu: () => ({ registerId: null, phase: 'P1', art: 'capex', text: '', lieferant: '', offerte: '', betrag: null }) },
    { key: 'personal', label: 'Personal', art: 'liste', eintrag: 'Rolle', hilfe: 'Bis zum Gate P1–P2 genügt die Grösse S/M/L; danach braucht es FTE mit Monat von und bis je Rolle und Phase.', spalten: [
      { key: 'phase', label: 'Phase', art: 'auswahl', optionen: PHASEN },
      { key: 'rolle', label: 'Rolle', art: 'rolle' },
      { key: 'groesse', label: 'Grösse', art: 'auswahl', optionen: [['S', 'S'], ['M', 'M'], ['L', 'L']], optional: true },
      { key: 'fte', label: 'FTE', art: 'zahl', optional: true },
      { key: 'vonMonat', label: 'von', art: 'monat', optional: true },
      { key: 'bisMonat', label: 'bis', art: 'monat', optional: true },
    ], neu: () => ({ registerId: null, phase: 'P1', rolle: '', groesse: 'M', fte: null, vonMonat: null, bisMonat: null, bemerkung: '' }) },
  ] },
  { nr: 10, titel: 'Risiko-Management', felder: [
    { key: 'risiken', label: 'Risiken', art: 'liste', eintrag: 'Risiko', hilfe: 'EW = Eintrittswahrscheinlichkeit, AW = Auswirkung, je hoch, mittel oder tief.', spalten: [
      { key: 'text', label: 'Risiko', art: 'kurz', max: 1000 },
      { key: 'wahrscheinlichkeit', label: 'EW', art: 'auswahl', optionen: STUFEN },
      { key: 'auswirkung', label: 'AW', art: 'auswahl', optionen: STUFEN },
      { key: 'massnahme', label: 'Massnahme', art: 'kurz', optional: true, max: 1000 },
      { key: 'verantwortlich', label: 'Verantwortlich', art: 'kurz', optional: true, max: 200 },
    ], neu: () => ({ registerId: null, text: '', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: '', verantwortlich: '' }) },
  ] },
  { nr: 11, titel: 'Change Management', felder: [
    { key: 'stakeholder', label: 'Stakeholder-Management', art: 'liste', eintrag: 'Stakeholder', spalten: [
      { key: 'gruppe', label: 'Stakeholder', art: 'kurz', max: 200 },
      { key: 'interesse', label: 'Interesse', art: 'kurz', optional: true, max: 1000 },
      { key: 'einfluss', label: 'Einfluss', art: 'kurz', optional: true, max: 1000 },
      { key: 'massnahmen', label: 'Geplante Massnahmen', art: 'kurz', optional: true, max: 2000 },
    ], neu: () => ({ registerId: null, gruppe: '', interesse: '', einfluss: '', massnahmen: '' }) },
    { key: 'kommunikation', label: 'Kommunikation', art: 'liste', eintrag: 'Massnahme', spalten: [
      { key: 'phase', label: 'Phase', art: 'auswahl', optionen: PHASEN },
      { key: 'text', label: 'Massnahme', art: 'kurz', max: 500 },
      { key: 'adressat', label: 'Adressat', art: 'kurz', optional: true, max: 200 },
      { key: 'ziel', label: 'Ziel', art: 'kurz', optional: true, max: 500 },
      { key: 'termin', label: 'Termin', art: 'datum', optional: true },
    ], neu: () => ({ registerId: null, phase: 'P1', text: '', adressat: '', ziel: '', termin: null }) },
  ] },
  { nr: 12, titel: 'Freigabe', felder: [text('bemerkung', 'Bemerkungen zur Freigabe', 'Quality-Check und Unterschriften führt das System; sie erscheinen nach dem Einreichen.')] },
  { nr: 13, titel: 'Beilagen', felder: [
    { key: 'beilagen', label: 'Beilagen', art: 'liste', eintrag: 'Beilage', hilfe: 'Zum Beispiel die Vorstudie; Dateien hochladen folgt.', spalten: [
      { key: 'bezeichnung', label: 'Bezeichnung', art: 'kurz', max: 200 },
      { key: 'version', label: 'Version / Datum', art: 'kurz', optional: true, max: 100 },
      { key: 'inhalt', label: 'Inhalt', art: 'kurz', optional: true, max: 1000 },
    ], neu: () => ({ bezeichnung: '', version: '', inhalt: '' }) },
  ] },
];

export const TERMINE: readonly [string, string][] = [
  ['projektStart', 'Projektstart'], ['phasenStart', 'Phasenstart'], ['phasenExit', 'Phasenende'], ['projektabschluss', 'Erwarteter Projektabschluss'],
];

/** Kapitel zur Nummer (1–13). */
export const kapitel = (nr: number) => KAPITEL.find(k => k.nr === nr) ?? KAPITEL[0]!;

/** DOM-ID eines Felds, Sprungziel der Pflichtangaben (K2-4). */
export const feldId = (nr: number, feld: string) => `vt-k${nr}-${feld}`;

/** Lokale Prüfung vor dem Speichern (I-F3, I-P6: der Server entscheidet): Pflichtspalten der Listen. */
export function pruefeLokal(nr: number, inhalt: Record<string, unknown>): Record<string, string> {
  const fehler: Record<string, string> = {};
  for (const f of kapitel(nr).felder) {
    if (f.art !== 'liste') continue;
    ((inhalt[f.key] ?? []) as Record<string, unknown>[]).forEach((z, i) => {
      for (const s of f.spalten ?? []) {
        const v = z[s.key];
        if (!s.optional && (v === '' || v === null || v === undefined)) fehler[`${f.key}/${i}/${s.key}`] = `${s.label}: Angabe fehlt.`;
      }
      if (nr === 9 && f.key === 'personal') {
        const mitFte = z.fte !== null && !!z.vonMonat && !!z.bisMonat;
        const nurGroesse = z.groesse !== null && z.fte === null && !z.vonMonat && !z.bisMonat;
        if (!mitFte && !nurGroesse) fehler[`${f.key}/${i}/groesse`] = 'Entweder eine Grösse (S/M/L) oder FTE mit Monat von und bis, nicht beides.';
      }
    });
  }
  return fehler;
}
