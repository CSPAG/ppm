/**
 * Übersicht der Periode (UC-005 Schritt 1, K1 «Prüfen» Schritt 1): je berichtspflichtigem Projekt Stand, Status und
 * Trend mit Vorperiode, Auffälligkeiten und mögliche Aktionen; Kopf mit Anzahlen, Fristen und Wirkung des Abschlusses.
 * Offene Perioden aus den Berichten, abgeschlossene aus dem Stand bei Abschluss (`dashboard_zeile`).
 */
import type { Tx } from '@vollholz/platform';
import { laufendePeriode } from './bericht.ts';
import {
  auffaelligkeiten, eingereichterBericht, fristen, rang, register, vorperiodeVon, zeilenStand,
} from './pruefung.ts';
import type { PeriodenstandOut, PeriodeQueryIn, PeriodeZeileOut } from './pruefung-schemas.ts';
import * as pstore from './pruefung-store.ts';
import { abschlussHinweis, berichtVermerke } from './vermerk.ts';

/** Rechte der anfragenden Person (aus `req.can`), je Portfolio gecacht. */
export interface Rechte {
  pruefen(portfolioId: string): Promise<boolean>;
  abschliessen(): Promise<boolean>;
}

export function zeileOffen(z: pstore.ZeileRow, auff: PeriodeZeileOut['auffaelligkeiten'], pruefen: boolean, offen: boolean): PeriodeZeileOut {
  const stand = zeilenStand(z);
  const darf = pruefen && offen;
  return {
    projektId: z.projekt_id, projektNummer: z.nummer, projektName: z.name, portfolioId: z.portfolio_id, portfolioName: z.portfolio_name,
    phase: eingereichterBericht(z) ? z.phase! : z.projekt_phase,
    stand, entwurf: z.stand === 'entwurf',
    status: eingereichterBericht(z) ? z.status : null,
    trend: eingereichterBericht(z) ? z.trend : null,
    abschlussPer: eingereichterBericht(z) ? z.abschluss_per : null,
    naechsterMeilenstein: eingereichterBericht(z) ? z.naechster_meilenstein ?? '' : '',
    vorperiode: z.vor_periode ? { periode: z.vor_periode, status: z.vor_status, trend: z.vor_trend } : null,
    auffaelligkeiten: auff,
    nachRueckfrage: stand === 'eingereicht' && z.beantwortet,
    rueckfrage: z.rueckfrage_text && z.rueckfrage_at ? { text: z.rueckfrage_text, gestelltAt: z.rueckfrage_at } : null,
    eingereichtAt: eingereichterBericht(z) ? z.eingereicht_at : null,
    geprueftAt: z.geprueft_at,
    eingefordertAt: z.eingefordert_at,
    version: z.version ?? 0,
    vermerke: berichtVermerke(z.stand ?? '', !offen),
    can: {
      // nach dem Abschluss lässt sich die Prüfung nachtragen (Vermerk «nicht geprüft», A-74)
      bestaetigen: pruefen && stand === 'eingereicht',
      rueckfrage: darf && (stand === 'eingereicht' || stand === 'geprueft'),
      einfordern: darf && stand === 'ausstehend' && z.pflichtig,
      zuruecknehmen: darf && stand === 'geprueft',
    },
  };
}

function zeileAbgeschlossen(z: pstore.StandRow, periode: string, pruefen: boolean): PeriodeZeileOut {
  // mit dem eingereichten Bericht abgeschlossen: «eingereicht» mit Vermerk, die Prüfung lässt sich nachtragen (A-74)
  const ungeprueft = z.gemeldet && z.bericht_stand === 'eingereicht';
  return {
    projektId: z.projekt_id, projektNummer: z.nummer, projektName: z.name, portfolioId: z.portfolio_id, portfolioName: z.portfolio_name,
    phase: z.phase, stand: ungeprueft ? 'eingereicht' : z.gemeldet ? 'geprueft' : 'nicht_gemeldet', entwurf: false,
    status: z.status, trend: z.trend, abschlussPer: z.abschluss_per, naechsterMeilenstein: z.naechster_meilenstein,
    vorperiode: { periode: vorperiodeVon(periode), status: z.status_vorperiode, trend: z.vor_trend },
    auffaelligkeiten: [], nachRueckfrage: z.gemeldet && z.beantwortet, rueckfrage: null,
    eingereichtAt: z.eingereicht_at, geprueftAt: z.geprueft_at, eingefordertAt: null, version: z.version ?? 0,
    vermerke: berichtVermerke(z.bericht_stand ?? '', true),
    can: { bestaetigen: ungeprueft && pruefen, rueckfrage: false, einfordern: false, zuruecknehmen: false },
  };
}

/** Eine Zeile der offenen Periode (nach einer Aktion); null, wenn das Projekt nicht sichtbar oder nicht in der Periode ist. */
export async function zeile(tx: Tx, periode: string, projektId: string, rechte: Rechte): Promise<{ row: pstore.ZeileRow; out: PeriodeZeileOut } | null> {
  const row = (await pstore.zeilen(tx, periode, { projektId }))[0];
  if (!row) return null;
  const p = await pstore.periode(tx, periode);
  const auff = eingereichterBericht(row) ? auffaelligkeiten(row, await register(tx, row.projekt_id)) : [];
  return { row, out: zeileOffen(row, auff, await rechte.pruefen(row.portfolio_id), p?.stand !== 'abgeschlossen') };
}

export interface Uebersicht { kopf: PeriodenstandOut; items: PeriodeZeileOut[]; rows: pstore.ZeileRow[] }

/** Ganze Periode: Kopf über alle sichtbaren Projekte, Zeilen ungefiltert und sortiert «auffällig zuerst». */
export async function uebersicht(tx: Tx, periode: string, rechte: Rechte): Promise<Uebersicht> {
  const p = await pstore.periode(tx, periode);
  const offen = p?.stand !== 'abgeschlossen';
  let items: PeriodeZeileOut[];
  let rows: pstore.ZeileRow[] = [];
  if (offen) {
    rows = await pstore.zeilen(tx, periode);
    items = [];
    for (const z of rows) {
      const auff = eingereichterBericht(z) ? auffaelligkeiten(z, await register(tx, z.projekt_id)) : [];
      items.push(zeileOffen(z, auff, await rechte.pruefen(z.portfolio_id), true));
    }
  } else {
    items = [];
    for (const z of await pstore.standZeilen(tx, periode)) items.push(zeileAbgeschlossen(z, periode, await rechte.pruefen(z.portfolio_id)));
  }
  items.sort((a, b) => rang(a) - rang(b) || a.projektNummer.localeCompare(b.projektNummer));

  const zaehle = (s: PeriodeZeileOut['stand']) => items.filter(i => i.stand === s).length;
  const eingereicht = zaehle('eingereicht');
  const geprueft = zaehle('geprueft');
  const hinweis = !offen ? null : abschlussHinweis(eingereicht);
  const laufend = await laufendePeriode(tx);
  const darfAbschliessen = offen && periode <= laufend && (await rechte.abschliessen());
  return {
    rows,
    items,
    kopf: {
      periode,
      stand: offen ? 'offen' : 'abgeschlossen',
      abgeschlossenAt: p?.abgeschlossen_at ?? null,
      abgeschlossenBy: p?.abgeschlossen_by ? { id: p.abgeschlossen_by, name: p.abgeschlossen_name ?? 'Unbekannt' } : null,
      version: p?.version ?? 0,
      anzahl: {
        projekte: items.length, eingereicht, zurueckgegeben: zaehle('zurueckgegeben'), geprueft,
        ausstehend: zaehle('ausstehend'), nichtGemeldet: zaehle('nicht_gemeldet'),
        auffaellig: items.filter(i => i.stand === 'eingereicht' && i.auffaelligkeiten.length).length,
      },
      fristen: await fristen(tx, periode),
      vorperiode: vorperiodeVon(periode),
      abschluss: {
        moeglich: darfAbschliessen,
        hinweis,
        geprueft,
        ungeprueft: eingereicht,
        nichtGemeldet: offen ? items.length - geprueft - eingereicht : zaehle('nicht_gemeldet'),
      },
      can: { pruefen: items.some(i => i.can.bestaetigen || i.can.rueckfrage || i.can.einfordern || i.can.zuruecknehmen), abschliessen: darfAbschliessen },
    },
  };
}

/** Filter der Liste (I-L1); der Kopf zählt immer alle. */
export function filtern(items: PeriodeZeileOut[], q: PeriodeQueryIn): PeriodeZeileOut[] {
  let r = items;
  if (q.stand) r = r.filter(i => i.stand === q.stand);
  if (q.portfolio) r = r.filter(i => i.portfolioId === q.portfolio);
  if (q.auffaellig !== undefined) r = r.filter(i => (i.auffaelligkeiten.length > 0) === q.auffaellig);
  if (q.sort === 'nummer') r = [...r].sort((a, b) => a.projektNummer.localeCompare(b.projektNummer));
  return r;
}
