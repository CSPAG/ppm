/**
 * Prüfung der Zuordnung (UC-018 Schritt 2: «System prüft die Zuordnung»; Regeln nach interaktion.md I-P1/I-P2): Sperre,
 * solange ein Platzhalter keinem Datenfeld zugeordnet ist, ein Feld nicht im Katalog steht, die Datei keinen Platzhalter
 * hat oder für die Art noch kein Modul Daten liefert; Warnung ohne Kennzeichnung «Personendaten» (G12). Dieselben Texte
 * stehen vorher (Schublade), dabei (Aktivieren, 409) und danach.
 */
import { ART_NAME, type Art } from './arten.ts';
import { katalog, norm, type Feld } from './felder.ts';

export interface Meldung { stufe: 'sperre' | 'warnung' | 'hinweis'; regel: string; text: string; platzhalter?: string[] }
export interface Pruefung { aktivierbar: boolean; meldungen: Meldung[] }

const liste = (xs: string[]) => xs.map(x => `«${x}»`).join(', ');

export function pruefen(art: Art, platzhalter: readonly string[], zuordnung: Readonly<Record<string, string | null>>, personendaten: boolean): Pruefung {
  const felder = katalog(art);
  const m: Meldung[] = [];
  if (!felder) {
    m.push({ stufe: 'sperre', regel: 'datenquelle', text: `Datenquelle fehlt: Für «${ART_NAME[art]}» liefert noch kein Modul Daten. Die Vorlage bleibt Entwurf, bis die Dokumentausgabe dieser Art gebaut ist.` });
  }
  if (!platzhalter.length) {
    m.push({ stufe: 'sperre', regel: 'platzhalter', text: 'Platzhalter fehlen: Die Datei enthält keinen Platzhalter in Guillemets, z. B. «Projektname». Ergänze die Platzhalter in Word und lade die Datei erneut hoch.' });
  }
  const offen = platzhalter.filter(p => !zuordnung[p]);
  if (offen.length) {
    m.push({ stufe: 'sperre', regel: 'zuordnung', platzhalter: offen, text: `Zuordnung fehlt: ${offen.length} von ${platzhalter.length} Platzhaltern ohne Datenfeld (${liste(offen)}). Ordne jedem Platzhalter ein Feld zu.` });
  }
  if (felder) {
    const bekannt = new Set(felder.map(f => f.schluessel));
    const unbekannt = platzhalter.filter(p => zuordnung[p] && !bekannt.has(zuordnung[p]!));
    if (unbekannt.length) {
      m.push({ stufe: 'sperre', regel: 'feld', platzhalter: unbekannt, text: `Datenfeld unbekannt: ${liste(unbekannt)} verweisen auf Felder, die es für «${ART_NAME[art]}» nicht gibt. Wähle ein Feld aus der Liste.` });
    }
  }
  if (!personendaten) {
    m.push({ stufe: 'warnung', regel: 'personendaten', text: 'Kennzeichnung fehlt: Die Vorlage nennt «Personendaten» nicht. Erzeugte Dokumente enthalten Namen; ergänze in der Kopfzeile «Intern · enthält Personendaten» (G12).' });
  }
  return { aktivierbar: !m.some(x => x.stufe === 'sperre'), meldungen: m };
}

/**
 * Vorschlag der Zuordnung beim Hochladen (I-F2): zuerst die Zuordnung der letzten Version für gleich benannte
 * Platzhalter, sonst das Feld mit gleicher Bezeichnung («Projektname» ↔ «Projektname»), sonst offen.
 */
export function vorschlag(platzhalter: readonly string[], felder: readonly Feld[] | null, bisher: Readonly<Record<string, string | null>> = {}): Record<string, string | null> {
  const nachName = new Map((felder ?? []).flatMap(f => [[norm(f.bezeichnung), f.schluessel], [norm(f.schluessel), f.schluessel]] as const));
  const gueltig = new Set((felder ?? []).map(f => f.schluessel));
  return Object.fromEntries(platzhalter.map(p => {
    const alt = bisher[p];
    if (alt && gueltig.has(alt)) return [p, alt];
    return [p, nachName.get(norm(p)) ?? null];
  }));
}
