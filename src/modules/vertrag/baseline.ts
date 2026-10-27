/**
 * Baseline setzen mit Register-Übernahme (DM.02.06 Wirkung, UC-002 Schritt 11, UC-003 Schritt 10, UC-007 Schritt 4;
 * fachmodell.md 2.6): Die Version wird «abgenommen» und verbindlich, die bisherige Baseline gilt nicht mehr, und die
 * Listen der Kapitel gehen ins Register des Projekts (`projektdaten.uebernehmen`) – Termine und Budget als neue
 * Baseline-Spalten. Die IDs im Register schreibt das System in die Kapitel zurück, damit der nächste Entwurf dieselben
 * Einträge fortschreibt.
 *
 * Auslöser sind der Gate-Entscheid (Traktandenart `gate`, AP-E3-3) und der Entscheid einer Änderung (AP-E3-4). Läuft in
 * deren Transaktion; die Rechte prüft der Aufrufer. Entscheidet jemand ohne `vertrag:write` und `projekt:write` (UE im
 * Gremium), ruft der Aufrufer in voller Sicht (`fullTx`) auf – das ist Systemverhalten des Entscheids.
 */
import { conflict, notFound, type Actor, type Tx } from '@vollholz/platform';
import { projektdaten, type RegisterName } from '../projektdaten/index.ts';
import { record } from '../../platform.ts';
import type { Inhalt } from './kapitel.ts';
import * as store from './store.ts';

/** Stände, aus denen eine Version Baseline werden kann: eingereicht und noch nicht entschieden. */
const ENTSCHEIDBAR: readonly store.Stand[] = store.ENTWURF.filter(s => s !== 'in_arbeit');

type Liste = { registerId: string | null } & Record<string, unknown>;
interface Zuordnung {
  kapitel: number; feld: string; register: RegisterName;
  /** Felder des Registers aus dem Listeneintrag. */
  werte: (e: Liste) => Record<string, unknown>;
}

/** Welche Liste welches Register füllt (Q7 Kap. 3, 6, 7, 9, 10, 11; fachmodell.md 2.6). */
const ZUORDNUNG: readonly Zuordnung[] = [
  { kapitel: 3, feld: 'kpis', register: 'kpi', werte: e => pick(e, 'art', 'text', 'einheit', 'zielwert') },
  { kapitel: 6, feld: 'abhaengigkeiten', register: 'abhaengigkeit', werte: e => pick(e, 'zuProjektId', 'text', 'ansprechperson') },
  { kapitel: 7, feld: 'meilensteine', register: 'meilenstein', werte: e => ({ ...pick(e, 'phase', 'art', 'text'), terminAktuell: e.termin, terminBaseline: e.termin }) },
  // Prognose = neuer Plan; danach führt der Statusbericht sie nach (PC.01.03)
  { kapitel: 9, feld: 'kosten', register: 'kosten', werte: e => ({ ...pick(e, 'phase', 'art', 'text', 'lieferant', 'offerte'), budgetBaseline: e.betrag, prognose: e.betrag }) },
  { kapitel: 9, feld: 'personal', register: 'ressourcenbedarf', werte: e => pick(e, 'phase', 'rolle', 'groesse', 'fte', 'vonMonat', 'bisMonat', 'bemerkung') },
  { kapitel: 10, feld: 'risiken', register: 'risiko', werte: e => pick(e, 'text', 'wahrscheinlichkeit', 'auswirkung', 'massnahme', 'verantwortlich') },
  { kapitel: 11, feld: 'stakeholder', register: 'stakeholder', werte: e => pick(e, 'gruppe', 'interesse', 'einfluss', 'massnahmen') },
  // Kommunikationsmassnahmen werden wie ein Meilenstein geführt (PS.05.03)
  { kapitel: 11, feld: 'kommunikation', register: 'meilenstein', werte: e => ({ ...pick(e, 'phase', 'text', 'adressat', 'ziel'), art: 'kommunikation', terminAktuell: e.termin, terminBaseline: e.termin }) },
];

function pick(e: Record<string, unknown>, ...k: string[]): Record<string, unknown> {
  return Object.fromEntries(k.map(x => [x, e[x]]));
}

/** Version als Baseline setzen und die Listen ins Register übernehmen; liefert die Version danach. */
export async function baselineSetzen(tx: Tx, who: Actor, versionId: string): Promise<store.VersionRow> {
  const v = await store.version(tx, versionId);
  if (!v) throw notFound('Vertragsversion');
  if (!ENTSCHEIDBAR.includes(v.stand)) throw conflict(`Version ${v.nummer} ist nicht zum Entscheid eingereicht.`, { reason: 'stand', stand: v.stand });
  const vorher = (await store.versionen(tx, v.projekt_id)).find(x => x.baseline) ?? null;

  const kapitel = new Map((await store.kapitel(tx, versionId)).map(k => [k.kapitel, k]));
  const neu = new Map<number, Record<string, unknown>>();
  for (const z of ZUORDNUNG) {
    const k = kapitel.get(z.kapitel);
    if (!k) continue;
    const inhalt = neu.get(z.kapitel) ?? { ...k.inhalt };
    const liste = (inhalt[z.feld] ?? []) as Liste[];
    const ids = await projektdaten.uebernehmen(tx, who, v.projekt_id, z.register, liste.map(e => ({ id: e.registerId, ...z.werte(e) })));
    inhalt[z.feld] = liste.map((e, i) => ({ ...e, registerId: ids[i] }));
    neu.set(z.kapitel, inhalt);
  }
  for (const [nr, inhalt] of neu) await store.kapitelSetzen(tx, versionId, nr, null, inhalt, kapitel.get(nr)!.geaendert);

  await store.baselineAufheben(tx, v.projekt_id);
  if (!(await store.standSetzen(tx, versionId, null, ENTSCHEIDBAR, 'abgenommen', { baseline: true }))) throw notFound('Vertragsversion');
  const r = (await store.version(tx, versionId))!;
  const daten = { id: r.id, projektId: r.projekt_id, nummer: r.nummer, anlass: r.anlass, zielphase: r.zielphase, vorherigeBaseline: vorher?.id ?? null };
  await record(tx, who, { action: 'vertrag.baselined', resourceType: 'vertrag_version', resourceId: r.id, data: daten, event: daten });
  return r;
}

