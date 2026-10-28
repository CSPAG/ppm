/**
 * Texte des Priorisierungsentscheids (K5 Schritte 7–8, «Texte»; UC-008 A2; eigene Datei von AP-E5-5): Anrede «Du»
 * (UX-OF-1), Schweizer Rechtschreibung; Sperren mit Regel, Ist-Wert und Ausweg kommen vom Server (I-P2).
 */
import type { Folge } from './EntscheidApi.ts';

export const TE = {
  titel: 'Antrag ans Gremium',
  folgenTitel: 'Folgeentscheide für laufende Projekte unter der Wasserlinie',
  folgenSub: 'Für jedes laufende Projekt unter der Wasserlinie beantragst du «Zurückstellen», «Sistieren» oder «Abbrechen». Das Gremium entscheidet sie mit dem Szenario. Bei «Sistieren» und «Abbrechen» erhält die Projektleitung danach die Aufgabe, den Schritt einzuleiten.',
  keineFolgen: 'Kein laufendes Projekt liegt unter der Wasserlinie; es braucht keinen Folgeentscheid.',
  projekt: 'Projekt', phase: 'Phase', folge: 'Folgeentscheid', begruendung: 'Begründung',
  folgeLabel: (nr: string) => `Folgeentscheid für ${nr}`,
  begruendungLabel: (nr: string) => `Begründung für ${nr}`,
  waehlen: 'wählen …',
  FOLGE: { zurueckstellen: 'Zurückstellen', sistieren: 'Sistieren', abbrechen: 'Abbrechen' } as Record<Folge, string>,
  offen: 'offen',
  speichern: 'Folgeentscheide speichern',
  gespeichert: 'Folgeentscheide gespeichert.',
  zurueckgenommen: 'Folgeentscheide gespeichert. Das Traktandum ist zurückgenommen; traktandiere den Antrag erneut.',
  traktandieren: 'Für das Gremium traktandieren',
  aktualisieren: 'Traktandum aktualisieren',
  traktandiert: (titel: string) => `Traktandiert: «${titel}». Das Gremium findet den Antrag in der nächsten Sitzung.`,
  istTraktandiert: 'Der Antrag ist traktandiert. Geänderte Folgeentscheide nehmen das Traktandum zurück, solange die Unterlagen nicht versendet sind.',
  nurAntrag: 'Traktandieren kannst du, sobald das Szenario als Antrag gewählt ist (im Vergleich «Als Antrag wählen»).',
  entschieden: 'Das Gremium hat dieses Szenario gewählt. Rang und Start der enthaltenen Projekte sind Ist-Stand; die Folgeentscheide gelten.',
  nurLesen: 'Die Folgeentscheide beantragt die Unternehmensentwicklung; du siehst sie nur.',
  konflikt: 'Das Szenario hat sich inzwischen geändert. Lade neu und prüfe die Folgeentscheide noch einmal.',
  neuLaden: 'Neu laden',
};
