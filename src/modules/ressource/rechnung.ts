/**
 * Auslastung je Rolle und Monat (BC RK.02.04, UC-009 Schritt 5): Angebot gegen den Bedarf der Projekte in FTE × Monate
 * je Rolle und Phase (A-20: Pool = Rolle). Reine Rechnung ohne Datenbank, damit die Priorisierung (Szenarien mit
 * Wasserlinie, AP-E5-3) dieselbe Regel nutzt (darstellung.md: eine Regel, drei Stellen).
 */

/** Monat «JJJJ-MM» als fortlaufende Zahl und zurück. */
const zahl = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monatVon = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;

/** Alle Monate von–bis (beide eingeschlossen). */
export function monate(von: string, bis: string): string[] {
  const out: string[] = [];
  for (let n = zahl(von); n <= zahl(bis); n++) out.push(monatVon(n));
  return out;
}

export const plusMonate = (m: string, n: number) => monatVon(zahl(m) + n);
export const monateZwischen = (von: string, bis: string) => zahl(bis) - zahl(von);
export const quartal = (m: string) => `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;

/** Bedarf eines Projekts in FTE je Monat von–bis (Register Ressourcenbedarf, RK.02.05). */
export interface Bedarf { id: string; projektId: string; phase: string; rolle: string; fte: number; vonMonat: string; bisMonat: string; gedeckt: boolean }

/** Szenario aus der Priorisierung (UC-008 Schritt 5): je Projekt aktiv und Startmonat (null = Start wie geplant). */
export interface SzenarioPosition { projektId: string; aktiv: boolean; startMonat: string | null }

export type Lage = 'ueberbucht' | 'ohne_angebot' | 'ausgelastet' | 'frei' | 'leer';
export interface Zelle { monat: string; angebot: number | null; bedarf: number; frei: number; lage: Lage; beitraege: { projektId: string; phase: string; fte: number; gedeckt: boolean }[] }
export interface Engpass { rolle: string; quartal: string; monat: string; bedarf: number; angebot: number; projekte: number }
export interface Ergebnis { monate: string[]; rollen: { rolle: string; zellen: Zelle[] }[]; engpaesse: Engpass[] }

const rund = (x: number) => Math.round(x * 100) / 100;

/**
 * Bedarf nach Szenario: Projekte des Szenarios ohne `aktiv` fallen weg; mit `startMonat` verschiebt sich der ganze Bedarf
 * des Projekts so, dass sein frühester Monat auf den Start fällt. Projekte ausserhalb des Szenarios bleiben wie geplant.
 */
export function nachSzenario(bedarfe: readonly Bedarf[], positionen: readonly SzenarioPosition[]): Bedarf[] {
  const pos = new Map(positionen.map(p => [p.projektId, p]));
  const start = new Map<string, string>();
  for (const b of bedarfe) {
    const s = start.get(b.projektId);
    if (!s || b.vonMonat < s) start.set(b.projektId, b.vonMonat);
  }
  return bedarfe.flatMap(b => {
    const p = pos.get(b.projektId);
    if (!p) return [b];
    if (!p.aktiv) return [];
    if (!p.startMonat) return [b];
    const n = monateZwischen(start.get(b.projektId)!, p.startMonat);
    return [{ ...b, vonMonat: plusMonate(b.vonMonat, n), bisMonat: plusMonate(b.bisMonat, n) }];
  });
}

/** Lage einer Zelle: überbucht ist eine Warnung (UC-009 A1), freie Kapazität die Unterauslastung (UC-009 Schritt 5). */
function lage(angebot: number | null, bedarf: number): Lage {
  if (angebot === null) return bedarf > 0 ? 'ohne_angebot' : 'leer';
  if (bedarf > angebot) return 'ueberbucht';
  return bedarf === angebot ? 'ausgelastet' : 'frei';
}

/**
 * Auslastung im Zeitraum: je Rolle mit Angebot oder Bedarf eine Zeile mit allen Monaten; Engpässe je Rolle und Quartal
 * mit dem Monat der grössten Überbuchung.
 */
export function auslastung(von: string, bis: string, angebot: readonly { rolle: string; monat: string; fte: number }[], bedarfe: readonly Bedarf[]): Ergebnis {
  const ms = monate(von, bis);
  const index = new Map(ms.map((m, i) => [m, i]));
  const rollen = new Map<string, { angebot: (number | null)[]; beitraege: Zelle['beitraege'][] }>();
  const zeile = (rolle: string) => {
    let z = rollen.get(rolle);
    if (!z) rollen.set(rolle, z = { angebot: ms.map(() => null), beitraege: ms.map(() => []) });
    return z;
  };
  for (const a of angebot) {
    const i = index.get(a.monat);
    if (i !== undefined) zeile(a.rolle).angebot[i] = a.fte;
  }
  for (const b of bedarfe) {
    const z = zeile(b.rolle);
    const ab = Math.max(zahl(b.vonMonat), zahl(von));
    const bisN = Math.min(zahl(b.bisMonat), zahl(bis));
    for (let n = ab; n <= bisN; n++) z.beitraege[n - zahl(von)]!.push({ projektId: b.projektId, phase: b.phase, fte: b.fte, gedeckt: b.gedeckt });
  }

  const out: Ergebnis = { monate: ms, rollen: [], engpaesse: [] };
  for (const rolle of [...rollen.keys()].sort()) {
    const z = rollen.get(rolle)!;
    const zellen = ms.map((monat, i): Zelle => {
      const beitraege = z.beitraege[i]!;
      const angebotI = z.angebot[i]!;
      const bedarf = rund(beitraege.reduce((s, x) => s + x.fte, 0));
      return { monat, angebot: angebotI, bedarf, frei: rund((angebotI ?? 0) - bedarf), lage: lage(angebotI, bedarf), beitraege };
    });
    // Rollen, die im Zeitraum weder Angebot noch Bedarf haben (Bedarf ausserhalb), nicht zeigen
    if (zellen.every(x => x.lage === 'leer')) continue;
    out.rollen.push({ rolle, zellen });
    const jeQuartal = new Map<string, Zelle>();
    for (const x of zellen) {
      if (x.lage !== 'ueberbucht' && x.lage !== 'ohne_angebot') continue;
      const q = quartal(x.monat);
      const bisher = jeQuartal.get(q);
      if (!bisher || x.frei < bisher.frei) jeQuartal.set(q, x);
    }
    for (const [q, x] of jeQuartal) {
      out.engpaesse.push({ rolle, quartal: q, monat: x.monat, bedarf: x.bedarf, angebot: x.angebot ?? 0, projekte: new Set(x.beitraege.map(b => b.projektId)).size });
    }
  }
  out.engpaesse.sort((a, b) => a.quartal.localeCompare(b.quartal) || a.rolle.localeCompare(b.rolle));
  return out;
}
