/**
 * Ad-hoc-Auswertungen (BC PC.04.03; UC-014 A2.1; AP-E7-6): UE oder FI wählt Filter, Kennzahlen und Gruppierung, das
 * System zeigt das Ergebnis mit den Einzelwerten und bietet einen Export (CSV) an. Nur lesend über die Tabellen der
 * unteren Module; was die Person nicht sehen darf (Projekte, vertrauliche Projekte, Kostenpositionen ohne
 * `finanzen:read`), filtert die Lesesicht (RLS). Ein Wert je Projekt, dann Summe je Gruppe.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import {
  FINANZ_KENNZAHLEN, PHASEN,
  type AuswertungEinzelwertOut, type AuswertungGruppeOut, type Gruppierung, type Kennzahl,
} from './adhoc-schemas.ts';

const S = SCHEMA;

export const KENNZAHL_LABEL: Readonly<Record<Kennzahl, string>> = {
  projekte: 'Projekte', kritisch: 'Status kritisch', eskalationen: 'Offene Eskalationen', meilensteine_offen: 'Offene Meilensteine',
  risiken: 'Risiken', budget: 'Budget (CHF)', prognose: 'Prognose (CHF)', ist: 'Ist (CHF)',
};
export const GRUPPIERUNG_LABEL: Readonly<Record<Gruppierung, string>> = {
  keine: 'Gesamt', portfolio: 'Portfolio', phase: 'Phase', status: 'Status', lebenszyklus: 'Lebenszyklus', handlungsfeld: 'Handlungsfeld',
};
export const STATUS_LABEL: Record<string, string> = { im_plan: 'Im Plan', kritisch: 'Kritisch', ohne: 'Ohne Bericht' };
export const LEBENSZYKLUS_LABEL: Record<string, string> = {
  aktiv: 'Aktiv', sistiert: 'Sistiert', abgebrochen: 'Abgebrochen', abgeschlossen: 'Abgeschlossen', zurueckgezogen: 'Zurückgezogen',
};

export interface Filter {
  periode: string; portfolioIds: string[]; phasen?: string[]; lebenszyklen: string[]; status?: string[]; handlungsfeldId?: string;
  finanzen: boolean;
}

export interface ProjektRow {
  projekt_id: string; nummer: string; name: string; portfolio_id: string; portfolio: string | null; phase: string; lebenszyklus: string;
  handlungsfeld_id: string | null; handlungsfeld: string | null; status: 'im_plan' | 'kritisch' | null;
  eskalationen: number; meilensteine_offen: number; risiken: number; budget: string | null; prognose: string | null; ist: string | null;
}

/**
 * Ein Wert je sichtbarem Projekt. Status: letzter eingereichter Bericht bis zur Stichperiode (wie «Werte aus» im
 * Dashboard). Offene Eskalationen: noch nicht «erledigt». Offene Meilensteine: Meilensteine und Lieferergebnisse ohne
 * «erreicht am». Beträge nur mit `finanzen` (sonst null, ohne die Kostentabelle zu lesen).
 */
export async function projekte(tx: Tx, f: Filter): Promise<ProjektRow[]> {
  const params: unknown[] = [f.periode, f.portfolioIds, f.lebenszyklen];
  const wo = ['p.portfolio_id = ANY ($2::uuid[])', 'p.lebenszyklus = ANY ($3::text[])'];
  if (f.phasen?.length) { params.push(f.phasen); wo.push(`p.phase = ANY ($${params.length}::text[])`); }
  if (f.handlungsfeldId) { params.push(f.handlungsfeldId); wo.push(`p.handlungsfeld_id = $${params.length}`); }
  if (f.status?.length) {
    params.push(f.status.filter(s => s !== 'ohne'));
    wo.push(`(s.status = ANY ($${params.length}::text[])${f.status.includes('ohne') ? ' OR s.status IS NULL' : ''})`);
  }
  const kosten = f.finanzen
    ? `LEFT JOIN LATERAL (SELECT sum(k.budget_baseline) AS budget, sum(k.prognose) AS prognose, sum(k.ist) AS ist
         FROM ${S}.kosten k WHERE k.projekt_id = p.id) k ON true`
    : 'LEFT JOIN LATERAL (SELECT NULL::numeric AS budget, NULL::numeric AS prognose, NULL::numeric AS ist) k ON true';
  return (await tx.query<ProjektRow>(
    `SELECT p.id AS projekt_id, p.nummer, p.name, p.portfolio_id, pf.name AS portfolio, p.phase, p.lebenszyklus,
            p.handlungsfeld_id, h.label AS handlungsfeld, s.status,
            (SELECT count(*)::int FROM ${S}.eskalation e WHERE e.projekt_id = p.id AND e.stand <> 'erledigt') AS eskalationen,
            (SELECT count(*)::int FROM ${S}.meilenstein m WHERE m.projekt_id = p.id AND m.art IN ('meilenstein', 'lieferergebnis')
               AND m.erreicht_am IS NULL) AS meilensteine_offen,
            (SELECT count(*)::int FROM ${S}.risiko r WHERE r.projekt_id = p.id) AS risiken,
            k.budget::text AS budget, k.prognose::text AS prognose, k.ist::text AS ist
       FROM ${S}.projekt p
       LEFT JOIN ${S}.portfolio pf ON pf.id = p.portfolio_id
       LEFT JOIN ${S}.handlungsfeld h ON h.id = p.handlungsfeld_id
       LEFT JOIN LATERAL (SELECT b.status FROM ${S}.statusbericht b
          WHERE b.projekt_id = p.id AND b.periode <= $1 AND b.stand <> 'entwurf' ORDER BY b.periode DESC LIMIT 1) s ON true
       ${kosten}
      WHERE ${wo.join(' AND ')}
      ORDER BY p.nummer, p.id`, params)).rows;
}

/** Wert einer Kennzahl für ein Projekt (Beträge in CHF auf Rappen). */
export function wert(r: ProjektRow, k: Kennzahl): number {
  switch (k) {
    case 'projekte': return 1;
    case 'kritisch': return r.status === 'kritisch' ? 1 : 0;
    case 'eskalationen': return r.eskalationen;
    case 'meilensteine_offen': return r.meilensteine_offen;
    case 'risiken': return r.risiken;
    default: return Number(r[k] ?? 0);
  }
}

/** Gruppe eines Projekts (`-` für «ohne»). */
export function gruppe(r: ProjektRow, g: Gruppierung): { schluessel: string; label: string } {
  switch (g) {
    case 'keine': return { schluessel: 'gesamt', label: GRUPPIERUNG_LABEL.keine };
    case 'portfolio': return { schluessel: r.portfolio_id, label: r.portfolio ?? '–' };
    case 'phase': return { schluessel: r.phase, label: r.phase };
    case 'status': return { schluessel: r.status ?? 'ohne', label: STATUS_LABEL[r.status ?? 'ohne']! };
    case 'lebenszyklus': return { schluessel: r.lebenszyklus, label: LEBENSZYKLUS_LABEL[r.lebenszyklus] ?? r.lebenszyklus };
    case 'handlungsfeld': return r.handlungsfeld_id && r.handlungsfeld ? { schluessel: r.handlungsfeld_id, label: r.handlungsfeld } : { schluessel: '-', label: 'Ohne Handlungsfeld' };
  }
}

const rappen = (n: number) => Math.round(n * 100) / 100;

export function auswerten(rows: ProjektRow[], kennzahlen: readonly Kennzahl[], g: Gruppierung): {
  gruppen: AuswertungGruppeOut[]; summe: Record<string, number>; einzelwerte: AuswertungEinzelwertOut[];
} {
  const leer = () => Object.fromEntries(kennzahlen.map(k => [k, 0])) as Record<string, number>;
  const gruppen = new Map<string, AuswertungGruppeOut>();
  const summe = leer();
  const einzelwerte = rows.map(r => {
    const gr = gruppe(r, g);
    const werte = Object.fromEntries(kennzahlen.map(k => [k, rappen(wert(r, k))])) as Record<string, number>;
    const ziel = gruppen.get(gr.schluessel) ?? { ...gr, werte: leer() };
    gruppen.set(gr.schluessel, ziel);
    for (const k of kennzahlen) { ziel.werte[k] = rappen(ziel.werte[k]! + werte[k]!); summe[k] = rappen(summe[k]! + werte[k]!); }
    return {
      projektId: r.projekt_id, nummer: r.nummer, name: r.name, portfolio: r.portfolio ?? '–', phase: r.phase, lebenszyklus: r.lebenszyklus,
      status: r.status, handlungsfeld: r.handlungsfeld, gruppe: gr.schluessel, werte,
    };
  });
  return { gruppen: ordnen([...gruppen.values()], g), summe, einzelwerte };
}

/** Ordnung der Gruppen: Phasen P0–P4, Status kritisch zuerst, «ohne» zuletzt, sonst nach Name. */
function ordnen(gruppen: AuswertungGruppeOut[], g: Gruppierung): AuswertungGruppeOut[] {
  const rang = (x: AuswertungGruppeOut) => {
    if (g === 'phase') return (PHASEN as readonly string[]).indexOf(x.schluessel);
    if (g === 'status') return ['kritisch', 'im_plan', 'ohne'].indexOf(x.schluessel);
    return x.schluessel === '-' ? 1 : 0;
  };
  return gruppen.sort((a, b) => rang(a) - rang(b) || a.label.localeCompare(b.label, 'de-CH'));
}

export const istFinanz = (k: Kennzahl) => FINANZ_KENNZAHLEN.includes(k);

export { csv, csvFeld } from '../../platform.ts';
