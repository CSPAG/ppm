/**
 * Aufgabe «Gate vorbereiten» (fachmodell.md 4.1, 4.2 `gate.vorbereiten`; UC-003 Ausgangslage, K2 Einstieg; A-27):
 * Ab 30 Arbeitstagen vor der geplanten Gate-Sitzung (Frist `gate_vorbereiten` im Phasenmodell) erhält die
 * Projektleitung «Gate P1–P2 vorbereiten · PRAT Mi 10.12. · Unterlagen bis Mi 3.12.» mit Frist Versand (5 Arbeitstage
 * vorher, Q8 Kap. 8.1). Geplant ist das Gate, wenn die UE es in eine Sitzung eingeplant hat (PP.04.05), sonst am ersten
 * Sitzungstermin des zuständigen Gremiums ab dem Phasenexit der Baseline (Kap. 7.2). Erledigt, sobald der Gate-Entwurf
 * eingereicht ist (Lauf) bzw. traktandiert (gate.ts). Idempotent je Projekt und Person.
 */
import type { PeriodicTask, Tx } from '@vollholz/platform';
import { fullTx } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { fristDatum } from '../phasenmodell/index.ts';
import { ART_VORBEREITEN, gateLabel, GATE_IN, gateVon } from './gate.ts';
import * as gs from './gate-store.ts';
import type { Phase } from './kapitel.ts';
import * as store from './store.ts';

/** So weit voraus werden Sitzungen betrachtet (Kalendertage); deckt 30 Arbeitstage mit Feiertagen reichlich ab. */
const HORIZONT_TAGE = 70;
const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

/** «Mi 10.12.» (darstellung.md, Formate). */
export function kurzDatum(d: string): string {
  const [j, m, t] = d.split('-').map(Number) as [number, number, number];
  return `${TAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()]} ${t}.${m}.`;
}
const heute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const plusTage = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const NAECHSTE: Readonly<Partial<Record<Phase, Phase>>> = { P0: 'P1', P1: 'P2', P2: 'P3', P3: 'P4' };

/** Fristen eines Mandanten prüfen (volle Sicht ohne Person); liefert die Zahl geöffneter bzw. nachgeführter Aufgaben. */
export async function gateVorbereitenPruefen(tx: Tx, jetzt = heute()): Promise<number> {
  let n = 0;
  for (const g of await gs.geplanteGates(tx, jetzt, plusTage(jetzt, HORIZONT_TAGE))) {
    const ziel = NAECHSTE[g.phase];
    const gate = ziel ? GATE_IN[ziel] : undefined;
    if (!gate) continue;
    const bezug = { typ: 'projekt', id: g.projekt_id };
    // eingereicht: Der Entwurf für dieses Gate ist über «in Arbeit» hinaus (fachmodell.md 4.2 «erledigt durch Einreichen»)
    const entwurf = (await store.versionen(tx, g.projekt_id)).find(v => store.ENTWURF.includes(v.stand) && gateVon(v) === gate);
    if (entwurf && entwurf.stand !== 'in_arbeit') {
      await aufgabe.erledigen(tx, { art: ART_VORBEREITEN, bezug });
      continue;
    }
    const ab = await fristDatum(tx, 'gate_vorbereiten', g.datum);
    if (!ab || jetzt < ab.datum) continue;
    const versand = (await fristDatum(tx, 'versand', g.datum))?.datum ?? g.datum;
    for (const person of await gs.projektleitung(tx, g.projekt_id)) {
      await aufgabe.oeffnen(tx, {
        art: ART_VORBEREITEN, bezug, empfaenger: { person },
        titel: `Gate ${gateLabel(gate)} vorbereiten`,
        kontext: `${g.nummer} ${g.name} · ${g.gremium.toUpperCase()} ${kurzDatum(g.datum)} · Unterlagen bis ${kurzDatum(versand)}`,
        link: `/projekte/${g.nummer}/vertrag/gate`,
        frist: { datum: versand, art: 'arbeitstage' },
      });
      n += 1;
    }
  }
  return n;
}

/** Stündlich über alle aktiven Mandanten (idempotent; die Aufgabe entsteht am ersten Lauf des Tages). */
export const gateTask: PeriodicTask = {
  name: 'vertrag.gate_vorbereiten',
  intervalMs: () => 60 * 60_000,
  async run({ db, log }) {
    const ids = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows.map(r => r.id);
    for (const tenantId of ids) {
      try {
        const n = await fullTx(db, tenantId, tx => gateVorbereitenPruefen(tx));
        if (n) log.info({ tenant: tenantId, aufgaben: n }, 'Vertrag: Gate vorbereiten geprüft');
      } catch (e) {
        log.warn({ tenant: tenantId, err: (e as Error).message }, 'Vertrag: Gate vorbereiten nicht geprüft');
      }
    }
  },
};
