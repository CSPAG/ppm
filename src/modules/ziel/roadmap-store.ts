/**
 * Datenzugriff der Roadmap (PP.04.03): Inhalt aus Zielen, Jahreszielen, Hauptaktivitäten und Vorhaben zusammenstellen
 * (Lesesicht der publizierenden Person, vertrauliche Projekte ausgenommen, A-34) und den Stand je Jahr speichern.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { RoadmapInhaltOut } from './roadmap-schemas.ts';

const R = `${SCHEMA}.roadmap`;

export interface RoadmapRow { id: string; jahr: number; inhalt: RoadmapInhaltOut; publiziert_at: Date; publiziert_by: string | null; version: number }

interface ZielRow { id: string; handlungsfeld_id: string; hf_label: string; nummer: string; text: string; metrik: string; zielwert: string }
interface JzRow { id: string; strategisches_ziel_id: string; nummer: string; text: string; metrik: string; zielwert: string }
interface HaRow { jahresziel_id: string; text: string; name: string | null }
interface PrRow { strategisches_ziel_id: string; jahresziel_id: string | null; nummer: string; name: string; phase: string; lebenszyklus: string }

/** Inhalt der Roadmap eines Jahres (Reihenfolge: Handlungsfelder nach Position, Ziele nach Nummer). */
export async function inhalt(tx: Tx, jahr: number): Promise<RoadmapInhaltOut> {
  const ziele = (await tx.query<ZielRow>(
    `SELECT s.id, s.handlungsfeld_id, h.label AS hf_label, s.nummer, s.text, s.metrik, s.zielwert
       FROM ${SCHEMA}.strategisches_ziel s JOIN ${SCHEMA}.handlungsfeld h ON h.id = s.handlungsfeld_id
      ORDER BY h.position, h.label, s.nummer_sort`)).rows;
  const jz = (await tx.query<JzRow>(
    `SELECT id, strategisches_ziel_id, nummer, text, metrik, zielwert FROM ${SCHEMA}.jahresziel WHERE jahr = $1 ORDER BY nummer_sort`, [jahr])).rows;
  const ha = (await tx.query<HaRow>(
    `SELECT h.jahresziel_id, h.text, p.display_name AS name FROM ${SCHEMA}.hauptaktivitaet h
       JOIN ${SCHEMA}.jahresziel j ON j.id = h.jahresziel_id LEFT JOIN ${SCHEMA}.principal p ON p.id = h.verantwortlich
      WHERE j.jahr = $1 ORDER BY h.position, h.created_at, h.id`, [jahr])).rows;
  const pr = (await tx.query<PrRow>(
    `SELECT z.strategisches_ziel_id, z.jahresziel_id, p.nummer, p.name, p.phase, p.lebenszyklus
       FROM ${SCHEMA}.ziel_projekt z JOIN ${SCHEMA}.projekt p ON p.id = z.projekt_id
       LEFT JOIN ${SCHEMA}.jahresziel j ON j.id = z.jahresziel_id
      WHERE NOT p.vertraulich AND (z.jahresziel_id IS NULL OR j.jahr = $1)
      ORDER BY p.nummer`, [jahr])).rows;
  const projekt = (p: PrRow) => ({ nummer: p.nummer, name: p.name, phase: p.phase, lebenszyklus: p.lebenszyklus });
  const felder = new Map<string, RoadmapInhaltOut['handlungsfelder'][number]>();
  for (const s of ziele) {
    const f = felder.get(s.handlungsfeld_id) ?? { id: s.handlungsfeld_id, label: s.hf_label, ziele: [] };
    felder.set(s.handlungsfeld_id, f);
    f.ziele.push({
      nummer: s.nummer, text: s.text, metrik: s.metrik, zielwert: s.zielwert,
      projekte: pr.filter(p => p.jahresziel_id === null && p.strategisches_ziel_id === s.id).map(projekt),
      jahresziele: jz.filter(j => j.strategisches_ziel_id === s.id).map(j => ({
        nummer: j.nummer, text: j.text, metrik: j.metrik, zielwert: j.zielwert,
        hauptaktivitaeten: ha.filter(h => h.jahresziel_id === j.id).map(h => ({ text: h.text, verantwortlich: h.name })),
        projekte: pr.filter(p => p.jahresziel_id === j.id).map(projekt),
      })),
    });
  }
  return { jahr, handlungsfelder: [...felder.values()] };
}

const COLS = 'id, jahr, inhalt, publiziert_at, publiziert_by, version';

export async function get(tx: Tx, jahr: number): Promise<RoadmapRow | null> {
  return (await tx.query<RoadmapRow>(`SELECT ${COLS} FROM ${R} WHERE jahr = $1`, [jahr])).rows[0] ?? null;
}

export async function list(tx: Tx): Promise<Pick<RoadmapRow, 'jahr' | 'publiziert_at' | 'version'>[]> {
  return (await tx.query<RoadmapRow>(`SELECT jahr, publiziert_at, version FROM ${R} ORDER BY jahr DESC`)).rows;
}

/** Publizieren: neu oder Stand ersetzen (Version und Zeitpunkt setzt der Trigger). */
export async function publizieren(tx: Tx, jahr: number, i: RoadmapInhaltOut): Promise<RoadmapRow> {
  return (await tx.query<RoadmapRow>(
    `INSERT INTO ${R} (tenant_id, jahr, inhalt) VALUES (app.tenant_id(), $1, $2)
     ON CONFLICT (tenant_id, jahr) DO UPDATE SET inhalt = EXCLUDED.inhalt RETURNING ${COLS}`, [jahr, JSON.stringify(i)])).rows[0]!;
}
