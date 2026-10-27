/**
 * Traktandenarten (Registry, docs/fachmodell.md 2.9): Obere Module registrieren ihre Art beim Laden ihres Moduls
 * (`registriereTraktandenart` in ihrer `index.ts`); `sitzung` importiert sie nie (Rückwirkung über Registrierung).
 * Die Art liefert Titel und Antrag, den Stand der Unterlagen (UC-006 Schritt 3), den Zeitbedarf und die Ergebnisse des
 * Entscheids; `beiEntscheid` läuft in der Transaktion des Entscheids (AP-E2-2, UX-Rückfluss UC-006 7–8).
 */
import type { Tx } from '@vollholz/platform';

/** Arten aus fachmodell.md 2.9 (CHECK in 130_sitzung.sql). */
export const ARTEN = ['portfoliobericht', 'gate', 'aenderung', 'meilenstein', 'eskalation', 'idee', 'priorisierung',
  'quartalsreporting', 'abschluss', 'jahresrueckblick'] as const;
export type Art = (typeof ARTEN)[number];

/** Bezeichnung und Reihenfolge der Gruppen in den Vorschlägen (K3 Schritt 1), solange die Art nichts anderes sagt. */
export const ART_LABEL: Readonly<Record<Art, string>> = {
  portfoliobericht: 'Portfoliobericht',
  gate: 'Gate-Review',
  meilenstein: 'Meilensteinabnahme',
  eskalation: 'Eskalation',
  aenderung: 'Änderung',
  idee: 'Initialisierung',
  priorisierung: 'Priorisierung und Szenario',
  quartalsreporting: 'Quartalsreporting',
  jahresrueckblick: 'Jahresrückblick',
  abschluss: 'Abschluss',
};

/** Zeitbedarf, den UC-006 selbst nennt: Gate-Review rund 35 Minuten (Präsentation 20, Diskussion 10, Entscheid 5). */
const DAUER_UC006: Partial<Record<Art, number>> = { gate: 35 };

/** Fachlicher Bezug des Traktandums (z. B. `{ typ: 'vertrag_version', id }`, `{ typ: 'periode', id: '2026-10' }`). */
export interface Bezug { typ: string; id: string; projektId: string | null }

/** Unterlage eines Traktandums (Gate Review Packet, Portfoliobericht, Beilage). */
export interface Unterlage {
  art: 'packet' | 'bericht' | 'beilage';
  titel: string;
  /** liegt vor und ist geprüft (Quality-Check bestanden, UC-006 A2) */
  bereit: boolean;
  /** Stand in Worten, z. B. «Quality-Check bestanden 28.10.» oder «Quality-Check offen» */
  hinweis?: string;
  /** Quality-Check: bestanden, offen (nicht bestanden oder nicht durchgeführt); ohne Angabe nicht nötig */
  qualityCheck?: 'bestanden' | 'offen';
  /** festgehaltener Inhalt (z. B. Hauptänderungen), wird mit dem Versand gespeichert */
  inhalt?: Record<string, unknown>;
}

/** Ergebnis eines Entscheids mit Bezeichnung (K3 Schritt 8, Optionen je Art). */
export interface Ergebnis { schluessel: string; label: string }

/** Entscheid, wie ihn AP-E2-2 an `beiEntscheid` übergibt. */
export interface EntscheidFolge { traktandumId: string; bezug: Bezug; ergebnis: string; begruendung: string; viaSns: boolean }

export interface Traktandenart {
  art: Art;
  /** Bezeichnung (sonst `ART_LABEL`) */
  label?: string;
  /** Zeitbedarf in Minuten beim Aufnehmen (UC-006 Schritt 2) */
  dauerMin?: number;
  /** Traktandum steht in jeder Sitzung (Portfoliobericht als Traktandum 1, UC-006 Schritt 4) */
  fest?: boolean;
  /** Titel und Antrag in einem Satz aus dem Geschäft (K3 Schritt 6) */
  zusammenfassung?(tx: Tx, bezug: Bezug): Promise<{ titel?: string; antrag?: string } | null>;
  /** Unterlagen mit Stand (UC-006 Schritt 3); ohne Funktion braucht die Art keine Unterlagen */
  unterlagen?(tx: Tx, bezug: Bezug): Promise<Unterlage[]>;
  /** Ergebnisse des Entscheids (AP-E2-2) */
  ergebnisse: readonly Ergebnis[];
  /** Folge des Entscheids in derselben Transaktion (AP-E2-2) */
  beiEntscheid?(tx: Tx, e: EntscheidFolge): Promise<void>;
}

const registry = new Map<Art, Traktandenart>();

/** Art registrieren (einmal je Art; beim Laden des registrierenden Moduls). */
export function registriereTraktandenart(a: Traktandenart): void {
  if (!(ARTEN as readonly string[]).includes(a.art)) throw new Error(`Traktandenart ${a.art} ist nicht im Fachmodell (2.9)`);
  if (registry.has(a.art)) throw new Error(`Traktandenart ${a.art} ist bereits registriert`);
  registry.set(a.art, a);
}

/** Registrierte Art oder undefined (die Art ist noch nicht umgesetzt). */
export const traktandenart = (art: Art): Traktandenart | undefined => registry.get(art);

export const artLabel = (art: Art): string => registry.get(art)?.label ?? ART_LABEL[art];

export const artDauer = (art: Art): number | null => registry.get(art)?.dauerMin ?? DAUER_UC006[art] ?? null;

/** Arten, die in jeder Sitzung stehen (UC-006 Schritt 4). */
export const festeArten = (): Traktandenart[] => [...registry.values()].filter(a => a.fest);

/** Nur für Tests: Registrierung zurücknehmen. */
export function _abmelden(art: Art): void { registry.delete(art); }

/**
 * Stand der Unterlagen eines Traktandums (K3 Schritt 3): `bereit` (alle bereit, Quality-Check bestanden),
 * `quality_check_offen`, `fehlt` (eine Unterlage liegt nicht vor oder die Art ist noch nicht umgesetzt) oder `keine`
 * (die Art braucht keine Unterlagen).
 */
export type UnterlagenStand = 'bereit' | 'quality_check_offen' | 'fehlt' | 'keine';

export async function unterlagenVon(tx: Tx, art: Art, bezug: Bezug): Promise<{ stand: UnterlagenStand; unterlagen: Unterlage[] }> {
  const a = registry.get(art);
  if (!a) return { stand: 'fehlt', unterlagen: [] };
  if (!a.unterlagen) return { stand: 'keine', unterlagen: [] };
  const unterlagen = await a.unterlagen(tx, bezug);
  if (!unterlagen.length || unterlagen.some(u => !u.bereit && u.qualityCheck !== 'offen')) return { stand: 'fehlt', unterlagen };
  if (unterlagen.some(u => u.qualityCheck === 'offen' || !u.bereit)) return { stand: 'quality_check_offen', unterlagen };
  return { stand: 'bereit', unterlagen };
}
