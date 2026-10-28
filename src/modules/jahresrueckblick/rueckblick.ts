/**
 * Jahresrückblick (BC ZM.03.03; UC-013 Schritte 1, 3, 4; AP-E7-5): Die Jahresauswertung entsteht aus der Zielerreichung
 * des Jahres (Modul `ziel`, AP-E6-3) und den Vorhaben des Jahres; die UE traktandiert sie im PRAT (Art
 * `jahresrueckblick`, K3 Schritt 8: «Verabschiedet» · «Anpassungen verlangt») und erfasst Erkenntnisse und Massnahmen
 * für den nächsten Zielzyklus (UC-011). Lessons Learned (PS.04.03, UC-013 Schritt 2, A1) folgen mit AP-E7-1.
 */
import { conflict, notFound, type Tx } from '@vollholz/platform';
import { registriereTraktandenart, traktandum, type EntscheidFolge } from '../sitzung/index.ts';
import { zielerreichungDesJahres } from '../ziel/index.ts';
import type { JahresauswertungOut, JahresrueckblickOut } from './schemas.ts';
import * as store from './store.ts';

export const TITEL = (jahr: number) => `Jahresrückblick ${jahr}`;
export const bezugVon = (id: string) => ({ typ: 'jahresrueckblick', id });
/** Adresse in der Oberfläche (UI-37, Gremien › Jahresrückblick). */
export const link = (jahr: number) => `/gremien/jahresrueckblick/${jahr}`;

/** Jahresauswertung in der Lesesicht der Person (UC-013 Schritt 1). */
export async function auswerten(tx: Tx, jahr: number): Promise<JahresauswertungOut> {
  const ziele = (await zielerreichungDesJahres(tx, jahr)).map(z => ({
    typ: z.typ, id: z.id, nummer: z.nummer, text: z.text, metrik: z.metrik, zielwert: z.zielwert, stand: z.stand, beurteilung: z.beurteilung, quartal: z.quartal,
  }));
  const vh = await store.vorhaben(tx, jahr);
  const projekt = (v: store.VorhabenRow) => ({ id: v.id, nummer: v.nummer, name: v.name, portfolio: v.portfolio, phase: v.phase, lebenszyklus: v.lebenszyklus, seit: v.seit });
  return {
    zielerreichung: { gesamt: ziele.length, mitStand: ziele.filter(z => z.stand !== null).length, ziele },
    vorhaben: {
      abgeschlossen: vh.filter(v => v.lebenszyklus === 'abgeschlossen').map(projekt),
      abgebrochen: vh.filter(v => v.lebenszyklus === 'abgebrochen').map(projekt),
      laufend: vh.filter(v => v.lebenszyklus === 'aktiv' || v.lebenszyklus === 'sistiert').map(projekt),
    },
  };
}

/** Gespeicherter Stand in der Lesesicht der Person: vertrauliche Vorhaben nur, wer sie sieht. */
async function fuerLeser(tx: Tx, a: JahresauswertungOut): Promise<JahresauswertungOut> {
  const v = a.vorhaben;
  const ids = await store.sichtbar(tx, [...v.abgeschlossen, ...v.abgebrochen, ...v.laufend].map(p => p.id));
  const nur = (l: typeof v.laufend) => l.filter(p => ids.has(p.id));
  return { ...a, vorhaben: { abgeschlossen: nur(v.abgeschlossen), abgebrochen: nur(v.abgebrochen), laufend: nur(v.laufend) } };
}

/** Antwort: gespeicherter Stand, Auswertung live (in Arbeit) bzw. bei Traktandierung. */
export async function antwort(tx: Tx, jahr: number, r: store.RueckblickRow | null, schreiben: boolean): Promise<JahresrueckblickOut> {
  const stand = r?.stand ?? 'offen';
  const auswertung = r?.inhalt && stand !== 'in_arbeit' ? await fuerLeser(tx, r.inhalt as unknown as JahresauswertungOut) : await auswerten(tx, jahr);
  const offen = stand === 'offen' || stand === 'in_arbeit';
  return {
    jahr, stand, erkenntnisse: r?.erkenntnisse ?? '', massnahmen: r?.massnahmen ?? '', rueckmeldung: r?.rueckmeldung ?? '',
    traktandiertAt: offen ? null : r?.traktandiert_at?.toISOString() ?? null, ausgewertetAt: r?.ausgewertet_at?.toISOString() ?? null,
    version: r?.version ?? 0, auswertung,
    // Erkenntnisse und Massnahmen auch nach der Auswertung des PRAT (UC-013 Schritt 4), nicht während der Traktandierung
    can: { bearbeiten: schreiben && stand !== 'traktandiert', traktandieren: schreiben && offen },
  };
}

/** Traktandieren (UC-013 Schritt 3): Auswertung festhalten, im PRAT vorschlagen. */
export async function traktandieren(tx: Tx, jahr: number): Promise<store.RueckblickRow> {
  let r = await store.lesen(tx, jahr);
  if (!r) throw notFound('Jahresrückblick');
  if (r.stand !== 'in_arbeit') throw conflict(`Der ${TITEL(jahr)} ist bereits traktandiert oder ausgewertet.`);
  const id = r.id;
  const portfolioId = await store.portfolioA(tx);
  if (!portfolioId) throw conflict('Es ist kein Portfolio der Kategorie A erfasst; der PRAT ist dessen entscheidendes Gremium.');
  await store.traktandieren(tx, id, await auswerten(tx, jahr));
  await traktandum.vorschlagen(tx, {
    art: 'jahresrueckblick', bezug: bezugVon(id), portfolioId, titel: TITEL(jahr),
    antrag: `Auswertung des Jahres ${jahr}; Erkenntnisse und Massnahmen für den nächsten Zielzyklus`,
  });
  r = await store.vonId(tx, id);
  return r!;
}

/** Ergebnisse des PRAT (K3 Schritt 8: Jahresrückblick). */
export const ERGEBNISSE = [{ schluessel: 'verabschiedet', label: 'Verabschiedet' }, { schluessel: 'anpassungen', label: 'Anpassungen verlangt' }] as const;

/**
 * Folge des Entscheids (fachmodell.md 2.9; UC-013 Schritt 4), idempotent: «Verabschiedet» hält den Rückblick als
 * ausgewertet fest (Erkenntnisse gespeichert); «Anpassungen verlangt» setzt ihn mit der Begründung auf «in Arbeit».
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge): Promise<void> {
  if (f.bezug.typ !== 'jahresrueckblick') return;
  const r = await store.vonId(tx, f.bezug.id);
  if (!r) return;
  if (f.ergebnis === 'verabschiedet') { if (r.stand !== 'ausgewertet') await store.standSetzen(tx, r.id, 'ausgewertet'); return; }
  await store.standSetzen(tx, r.id, 'in_arbeit', f.begruendung);
}

/** Art `jahresrueckblick` in der Registry der Sitzung (fachmodell.md 2.9): Jahresauswertung als Unterlage. */
export function registriereJahresrueckblick(): void {
  registriereTraktandenart({
    art: 'jahresrueckblick',
    label: 'Jahresrückblick',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const r = bezug.typ === 'jahresrueckblick' ? await store.vonId(tx, bezug.id) : null;
      return r ? { titel: TITEL(r.jahr), antrag: `Auswertung des Jahres ${r.jahr}; Erkenntnisse und Massnahmen für den nächsten Zielzyklus` } : null;
    },
    unterlagen: async (tx, bezug) => {
      const r = bezug.typ === 'jahresrueckblick' ? await store.vonId(tx, bezug.id) : null;
      if (!r) return [];
      const bereit = r.stand !== 'in_arbeit';
      return [{ art: 'bericht', titel: `Jahresauswertung ${r.jahr}`, bereit, hinweis: bereit ? 'Stand bei Traktandierung' : 'in Arbeit', inhalt: { jahresrueckblick: r.id, jahr: r.jahr } }];
    },
    beiEntscheid,
  });
}
