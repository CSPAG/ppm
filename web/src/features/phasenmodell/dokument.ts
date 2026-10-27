/**
 * Inhalt einer Version als bearbeitbares Dokument der Arbeitsfläche: Abschnitte, lokale Prüfung (I-F3, I-P6: der Server
 * entscheidet) und die Änderung für das automatische Speichern (die Listen ersetzen die bisherigen).
 */
import { T } from '../../ui/index.ts';
import type { Patch, Phasenmodell } from './api.ts';

export type Dok = Pick<Phasenmodell, 'beschreibung' | 'phasen' | 'gates' | 'kapitelWirkung' | 'fristen' | 'toleranzen'>;
export type Phase = Dok['phasen'][number];
export type Gate = Dok['gates'][number];
export type Pflicht = Phase['pflichtangaben'][number];
export type Frist = Dok['fristen'][number];
export type Toleranz = Dok['toleranzen'][number];

export const dokAus = (m: Phasenmodell): Dok => ({
  beschreibung: m.beschreibung, phasen: m.phasen, gates: m.gates, kapitelWirkung: m.kapitelWirkung, fristen: m.fristen, toleranzen: m.toleranzen,
});

/** Werteströme in der Reihenfolge des PM-Handbuchs (Q8 Abb. 4); weitere aus der Codetabelle folgen danach. */
export const WERTESTROEME = ['nutzen', 'projekt', 'klinik', 'ict', 'infrastruktur'] as const;
export const wertestromLabel = (k: string) => T.phasenmodell.wertestrom[k] ?? k;

/** Abschnitte der Arbeitsfläche: Version, Phasen und Gates im Ablauf, Fristen und Toleranzen, Kapitelwirkung. */
export interface Abschnitt { key: string; art: 'version' | 'phase' | 'gate' | 'fristen' | 'wirkung'; label: string }

export function abschnitte(d: Dok): Abschnitt[] {
  const ablauf: Abschnitt[] = [];
  for (const p of d.phasen) {
    const eintritt = d.gates.find(g => g.nachPhase === p.code);
    if (eintritt) ablauf.push({ key: eintritt.code, art: 'gate', label: eintritt.name });
    ablauf.push({ key: p.code, art: 'phase', label: p.name });
  }
  for (const g of d.gates) if (!ablauf.some(a => a.key === g.code)) ablauf.push({ key: g.code, art: 'gate', label: g.name });
  return [
    { key: 'version', art: 'version', label: T.phasenmodell.uebersicht },
    ...ablauf,
    { key: 'fristen', art: 'fristen', label: T.phasenmodell.fristenToleranzen },
    { key: 'wirkung', art: 'wirkung', label: T.phasenmodell.wirkung },
  ];
}

const FELD = /^[a-z][a-z0-9_]{0,59}$/;
const leer = (s: string) => !s.trim();

/** Fehler je Pfad (wie die Feldfehler des Servers, z. B. `/phasen/2/name`); Leerzeilen sind kein Fehler, sie entfallen. */
export function pruefeLokal(d: Dok): Record<string, string> {
  const e: Record<string, string> = {};
  const pflicht = (liste: Pflicht[], pfad: string) => liste.forEach((p, i) => {
    if (leer(p.feld) && leer(p.text)) return;
    if (!FELD.test(p.feld.trim())) e[`${pfad}/${i}/feld`] = T.phasenmodell.feldUngueltig;
    if (leer(p.text)) e[`${pfad}/${i}/text`] = T.phasenmodell.textFehlt;
  });
  d.phasen.forEach((p, i) => {
    if (leer(p.name)) e[`/phasen/${i}/name`] = T.phasenmodell.nameFehlt;
    pflicht(p.pflichtangaben, `/phasen/${i}/pflichtangaben`);
  });
  d.gates.forEach((g, i) => {
    if (leer(g.name)) e[`/gates/${i}/name`] = T.phasenmodell.nameFehlt;
    pflicht(g.pflichtangaben, `/gates/${i}/pflichtangaben`);
  });
  d.fristen.forEach((f, i) => {
    const max = f.einheit === 'tag_im_monat' ? 31 : 365;
    if (!Number.isInteger(f.wert) || f.wert < (f.einheit === 'tag_im_monat' ? 1 : 0) || f.wert > max) {
      e[`/fristen/${i}/wert`] = f.einheit === 'tag_im_monat' ? T.phasenmodell.tagUngueltig : T.phasenmodell.wertUngueltig;
    }
  });
  d.toleranzen.forEach((t, i) => {
    if (t.wert !== null && !(Number.isFinite(t.wert) && t.wert >= 0)) e[`/toleranzen/${i}/wert`] = T.phasenmodell.toleranzUngueltig;
  });
  return e;
}

/** Änderung für den Server: das ganze Dokument ohne Leerzeilen, Texte ohne Leerraum am Rand. */
export function alsPatch(d: Dok): Patch {
  const texte = <X extends { text: string }>(l: X[]) => l.filter(x => !leer(x.text)).map(x => ({ ...x, text: x.text.trim() }));
  const pflicht = (l: Pflicht[]) => l.filter(p => !(leer(p.feld) && leer(p.text))).map(p => ({ kapitel: p.kapitel, feld: p.feld.trim(), text: p.text.trim() }));
  return {
    beschreibung: d.beschreibung,
    phasen: d.phasen.map(p => ({ code: p.code, name: p.name.trim(), ergebnisse: texte(p.ergebnisse), pflichtangaben: pflicht(p.pflichtangaben) })),
    gates: d.gates.map(g => ({ code: g.code, name: g.name.trim(), leitfragen: texte(g.leitfragen), pflichtangaben: pflicht(g.pflichtangaben) })),
    kapitelWirkung: d.kapitelWirkung,
    fristen: d.fristen,
    toleranzen: d.toleranzen,
  };
}

/** Erlaubte Einheiten je Frist (UX-E11): Monatszyklus als Tag im Monat, sonst Arbeits- oder Kalendertage. */
export const einheitenFrist = (schluessel: string): Frist['einheit'][] =>
  schluessel.startsWith('bericht_') ? ['tag_im_monat'] : ['arbeitstage', 'kalendertage'];

/** Element einer Liste verschieben (für Reihenfolge per Tastatur). */
export function verschiebe<X>(l: X[], i: number, um: -1 | 1): X[] {
  const j = i + um;
  if (j < 0 || j >= l.length) return l;
  const n = [...l];
  [n[i], n[j]] = [n[j]!, n[i]!];
  return n;
}
