/**
 * Berichtsaufgabe «Statusbericht erstellen» (docs/fachmodell.md 4.2, 2.14; UC-004 Ausgangslage, K1 Einstieg): ab dem
 * Tag `bericht_aufgabe` (A-26: der 18.) je aktivem Projekt in P0–P3 eines Portfolios mit Pflichten (A-07, A-08) an jede
 * Projektleitung, Frist `bericht_stichtag` (25., Q8 Kap. 8.4). Fristen aus dem Phasenmodell in Kraft, nie als Konstante.
 * Das Einreichen erledigt die Aufgabe, das Zurückziehen öffnet sie wieder (Job mit voller Sicht, weil die Projektleitung
 * Portfolio und Phasenmodell nicht lesen muss). Ohne Phasenmodell in Kraft keine Aufgabe.
 *
 * Bei «kritisch» erhält der Sponsor beim Einreichen eine Mitteilung mit Begründung und Massnahme (UC-004 A2.2, K1).
 */
import type { JobDefinition, PeriodicTask, Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { fristDatum } from '../phasenmodell/index.ts';
import { enqueue, fullTx, SCHEMA } from '../../platform.ts';
import { BERICHTSPHASEN, laufendePeriode } from './bericht.ts';
import type { Row } from './store.ts';

export const ART = 'statusbericht.erstellen';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** Monat der Periode für Titel und Texte («Oktober»). */
export const monat = (periode: string) => MONATE[Number(periode.slice(5, 7)) - 1]!;

/** Bezug der Aufgabe: Bericht eines Projekts in einer Periode (auch bevor er gespeichert ist). */
const bezug = (projektId: string, periode: string) => ({ typ: 'statusbericht', id: `${projektId}/${periode}` });

interface Kandidat { id: string; nummer: string; name: string; pl: string }

/**
 * Projekte mit Berichtspflicht in der Periode und ihre Projektleitungen, ohne eingereichten Bericht. Liest Projekt,
 * Portfolio und Projektorganisation (Tabellen der Module projekt und portfolio, unter statusbericht).
 */
async function kandidaten(tx: Tx, periode: string, projektId?: string): Promise<Kandidat[]> {
  return (await tx.query<Kandidat>(
    `SELECT p.id, p.nummer, p.name, pp.person_id AS pl
       FROM ${SCHEMA}.projekt p
       JOIN ${SCHEMA}.portfolio pf ON pf.id = p.portfolio_id AND pf.pflichten
       JOIN ${SCHEMA}.projekt_person pp ON pp.projekt_id = p.id AND pp.funktion = 'pl'
      WHERE p.lebenszyklus = 'aktiv' AND p.phase = ANY ($2::text[]) AND ($3::uuid IS NULL OR p.id = $3)
        AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.statusbericht b WHERE b.projekt_id = p.id AND b.periode = $1 AND b.stand <> 'entwurf')
      ORDER BY p.nummer, pp.person_id`, [periode, BERICHTSPHASEN, projektId ?? null])).rows;
}

/** Tag der Aufgabe und Stichtag der Periode; null ohne Phasenmodell in Kraft. */
async function fristen(tx: Tx, periode: string): Promise<{ ab: string; stichtag: string } | null> {
  const ab = await fristDatum(tx, 'bericht_aufgabe', `${periode}-01`);
  const stichtag = await fristDatum(tx, 'bericht_stichtag', `${periode}-01`);
  return ab && stichtag ? { ab: ab.datum, stichtag: stichtag.datum } : null;
}

const heute = async (tx: Tx) => (await tx.query<{ d: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM-DD') AS d")).rows[0]!.d;

/**
 * Berichtsaufgaben der laufenden Periode öffnen (idempotent: offene werden nachgeführt). Mit `projektId` nur für dieses
 * Projekt (nach dem Zurückziehen). Liefert die Zahl der offenen Aufgaben.
 */
export async function oeffnen(tx: Tx, o: { projektId?: string } = {}): Promise<number> {
  const periode = await laufendePeriode(tx);
  const f = await fristen(tx, periode);
  if (!f || (await heute(tx)) < f.ab) return 0;
  const liste = await kandidaten(tx, periode, o.projektId);
  for (const k of liste) {
    await aufgabe.oeffnen(tx, {
      art: ART, bezug: bezug(k.id, periode), empfaenger: { person: k.pl },
      titel: `Statusbericht ${monat(periode)} erstellen`,
      kontext: `${k.nummer} ${k.name} · als PL`,
      link: `/projekte/${k.nummer}/bericht?periode=${periode}`,
      frist: { datum: f.stichtag, art: 'kalendertage' },
    });
  }
  return liste.length;
}

/** Einreichen: Aufgabe aller Projektleitungen erledigt; bei «kritisch» Mitteilung an den Sponsor. */
export async function beimEinreichen(tx: Tx, r: Row): Promise<void> {
  await aufgabe.erledigen(tx, { art: ART, bezug: bezug(r.projekt_id, r.periode) });
  if (r.status !== 'kritisch') return;
  const p = (await tx.query<{ nummer: string; name: string; sp: string[] }>(
    `SELECT p.nummer, p.name, coalesce(array_agg(pp.person_id) FILTER (WHERE pp.funktion = 'sp'), '{}') AS sp
       FROM ${SCHEMA}.projekt p LEFT JOIN ${SCHEMA}.projekt_person pp ON pp.projekt_id = p.id
      WHERE p.id = $1 GROUP BY p.nummer, p.name`, [r.projekt_id])).rows[0];
  if (!p) return;
  for (const sp of p.sp) {
    await mitteilung.senden(tx, {
      an: sp, bezug: { typ: 'statusbericht', id: r.id },
      text: `${p.nummer} ${p.name} ist im Statusbericht ${monat(r.periode)} kritisch. Begründung: ${r.begruendung.trim()} Massnahme: ${r.massnahme.trim()}`.slice(0, 1000),
      link: `/projekte/${p.nummer}/bericht?periode=${r.periode}`,
    });
  }
}

export const OEFFNEN = 'statusbericht.berichtsaufgabe_oeffnen';

/** Berichtsaufgabe eines Projekts mit voller Sicht öffnen (nach dem Zurückziehen). */
export const oeffnenJob: JobDefinition<{ projektId: string }> = {
  kind: OEFFNEN,
  async run(ctx, p) { await ctx.tx(tx => oeffnen(tx, { projektId: p.projektId })); },
};

/** Zurückziehen: Aufgabe für dieses Projekt wieder öffnen (der Bericht ist wieder ein Entwurf). */
export async function beimZurueckziehen(tx: Tx, r: Row): Promise<void> {
  if (r.periode === (await laufendePeriode(tx))) await enqueue(tx, OEFFNEN, { projektId: r.projekt_id }, { dedupeKey: `${OEFFNEN}:${r.projekt_id}` });
}

/** Feste Aufgabe des Workers: stündlich je aktiver Organisation (idempotent; wirkt ab dem Tag der Aufgabe). */
export const berichtsaufgabenTask: PeriodicTask = {
  name: 'statusbericht.berichtsaufgaben',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    const orgs = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows;
    let n = 0;
    for (const o of orgs) {
      try {
        n += await fullTx(db, o.id, tx => oeffnen(tx));
      } catch (e) {
        log.error({ tenantId: o.id, err: e }, 'Berichtsaufgaben: Fehler in der Organisation');
      }
    }
    log.info({ organisationen: orgs.length, aufgaben: n }, 'Berichtsaufgaben nachgeführt');
  },
};
