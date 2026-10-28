/**
 * Feldkatalog je Dokumentart (UC-018 Schritt 2: «ordnet die Felder den Daten zu»): das Modul, das ein Dokument erzeugt,
 * registriert beim Laden seine Datenfelder (Schlüssel, Bezeichnung) und liefert bei der Ausgabe die Werte dazu. Die
 * Richtung zeigt vom Fachmodul zur Vorlage (zielarchitektur.md, Checkliste Punkt 3); `vorlage` kennt kein Fachmodul.
 */
import type { Art } from './arten.ts';

export interface Feld {
  /** Stabiler Schlüssel, z. B. `projekt.name`, `kapitel1.ausgangslage`. */
  schluessel: string;
  /** Bezeichnung für die Zuordnung, z. B. «Projektname». */
  bezeichnung: string;
  /** Gruppe in der Auswahl, z. B. «Deckblatt», «1 Ausgangslage / Problembeschreibung». */
  gruppe: string;
}

const KATALOG = new Map<Art, readonly Feld[]>();

/** Feldkatalog einer Art registrieren (einmal je Art, beim Laden des erzeugenden Moduls). */
export function registrieren(art: Art, felder: readonly Feld[]): void {
  const doppelt = felder.find((f, i) => felder.findIndex(g => g.schluessel === f.schluessel) !== i);
  if (doppelt) throw new Error(`Feld ${doppelt.schluessel} doppelt im Katalog ${art}`);
  KATALOG.set(art, felder);
}

/** Feldkatalog der Art; null, solange kein Modul Daten für diese Art liefert. */
export const katalog = (art: Art): readonly Feld[] | null => KATALOG.get(art) ?? null;

/** Normalisierte Bezeichnung für den Vorschlag der Zuordnung («Projekt-Name» ≈ «projektname»). */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
