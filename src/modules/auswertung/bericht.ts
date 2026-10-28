/**
 * Portfoliobericht der Periode (BC PC.04.02, UC-014 Schritt 3; Kernablauf K3 Schritt 4; AP-E2-3): entsteht im System aus
 * dem abgeschlossenen Dashboard und der Risikolage (PPM-4: keine Datei von Hand), die UE ergänzt ihren Kommentar und
 * stellt ihn bereit. Art `portfoliobericht` in der Registry der Sitzung (fachmodell.md 2.9): Traktandum 1 «Bericht der
 * Programmleitung» steht in jeder Sitzung (UC-006 Schritt 4), Unterlage ist der bereitgestellte Bericht der letzten
 * abgeschlossenen Periode, Folge des Entscheids ist die Kenntnisnahme.
 */
import { conflict, notFound, type Tx } from '@vollholz/platform';
import { registriereTraktandenart } from '../sitzung/index.ts';
import { funnel, sortieren, zeile } from './dashboard.ts';
import { risikolage } from './risiko-routes.ts';
import type { PortfolioberichtKurzOut, PortfolioberichtOut } from './bericht-schemas.ts';
import * as store from './bericht-store.ts';
import * as dashboard from './store.ts';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** «Oktober 2026» */
export const monat = (periode: string) => `${MONATE[Number(periode.slice(5, 7)) - 1]} ${periode.slice(0, 4)}`;

export const TITEL_TRAKTANDUM = 'Bericht der Programmleitung';

/** Inhalt bei Erzeugung: abgeschlossenes Dashboard des Portfolios und Risikolage (Lesesicht der UE). */
export async function inhalt(tx: Tx, pf: dashboard.PortfolioRow, p: store.PeriodeStandRow) {
  const items = sortieren((await dashboard.zeilenAbgeschlossen(tx, p.periode, [pf.id])).map(r => zeile(r, pf.name)));
  return {
    dashboard: { abgeschlossenAt: p.abgeschlossen_at, items, funnel: funnel(items) },
    risikolage: await risikolage(tx, [pf.id]),
  };
}

export type BerichtInhalt = Awaited<ReturnType<typeof inhalt>>;
/** Bericht mit typisiertem Inhalt (für das Dokument). */
export type BerichtDaten = PortfolioberichtKurzOut & { kommentar: string } & BerichtInhalt;

export function daten(b: store.BerichtRow): BerichtDaten {
  return { ...kurz(b), kommentar: b.kommentar, ...(b.inhalt as unknown as BerichtInhalt) };
}

/** Bericht erzeugen bzw. im Entwurf neu erzeugen; `neu` sagt, ob er angelegt wurde. */
export async function erzeugen(tx: Tx, pf: dashboard.PortfolioRow, periode: string): Promise<{ id: string; neu: boolean }> {
  const p = await store.periode(tx, periode);
  if (p?.stand !== 'abgeschlossen') throw conflict(`Die Periode ${monat(periode)} ist noch nicht abgeschlossen. Der Portfoliobericht entsteht aus dem abgeschlossenen Dashboard.`);
  const vorhanden = await store.von(tx, pf.id, periode);
  if (vorhanden?.stand === 'bereitgestellt') throw conflict('Der Portfoliobericht ist bereitgestellt und bleibt so, wie er dem Gremium vorliegt.');
  const neu = await inhalt(tx, pf, p);
  if (vorhanden) { await store.erneuern(tx, vorhanden.id, neu); return { id: vorhanden.id, neu: false }; }
  return { id: await store.anlegen(tx, pf.id, periode, neu), neu: true };
}

export function kurz(b: Omit<store.BerichtRow, 'inhalt' | 'kommentar'>): PortfolioberichtKurzOut {
  return {
    id: b.id, portfolio: { id: b.portfolio_id, schluessel: b.schluessel, name: b.portfolio_name }, periode: b.periode, stand: b.stand,
    erzeugtAt: b.erzeugt_at.toISOString(), bereitgestelltAt: b.bereitgestellt_at?.toISOString() ?? null, version: b.version,
  };
}

export function voll(b: store.BerichtRow, schreiben: boolean): PortfolioberichtOut {
  const i = b.inhalt as unknown as BerichtInhalt;
  const entwurf = b.stand === 'entwurf';
  return { ...kurz(b), kommentar: b.kommentar, dashboard: i.dashboard, risikolage: i.risikolage, can: { bearbeiten: schreiben && entwurf, bereitstellen: schreiben && entwurf } };
}

export async function lesenOder404(tx: Tx, id: string): Promise<store.BerichtRow> {
  const b = await store.lesen(tx, id);
  if (!b) throw notFound('Portfoliobericht');
  return b;
}

/** Art `portfoliobericht` in der Registry der Sitzung (fachmodell.md 2.9; UC-006 Schritt 4, K3 Schritt 4). */
export function registrierePortfoliobericht(): void {
  registriereTraktandenart({
    art: 'portfoliobericht',
    label: 'Portfoliobericht',
    fest: true,
    ergebnisse: [{ schluessel: 'kenntnis_genommen', label: 'Zur Kenntnis genommen' }],
    zusammenfassung: async (tx, bezug) => {
      const s = bezug.typ === 'sitzung' ? await store.zurSitzung(tx, bezug.id) : null;
      return { titel: TITEL_TRAKTANDUM, antrag: s?.periode ? `Kenntnisnahme des Portfolioberichts ${monat(s.periode)}` : 'Kenntnisnahme des Portfolioberichts' };
    },
    unterlagen: async (tx, bezug) => {
      const s = bezug.typ === 'sitzung' ? await store.zurSitzung(tx, bezug.id) : null;
      if (!s?.periode) return [];
      const titel = `Portfoliobericht ${monat(s.periode)}`;
      const b = s.bericht;
      if (!b) return [{ art: 'bericht', titel, bereit: false, hinweis: 'noch nicht erzeugt' }];
      if (b.stand === 'entwurf') return [{ art: 'bericht', titel, bereit: false, hinweis: 'Entwurf, noch nicht bereitgestellt' }];
      return [{ art: 'bericht', titel, bereit: true, hinweis: 'bereitgestellt', inhalt: { portfoliobericht: b.id, periode: b.periode } }];
    },
    // Folge des Entscheids: Kenntnisnahme (fachmodell.md 2.9), am Bericht ändert sich nichts
  });
}
