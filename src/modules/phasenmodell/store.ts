/**
 * Datenzugriff des Phasenmodells. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen oder
 * ändern darf, regelt die Lesesicht (RLS) – auch, dass eine Version in Kraft unveränderlich ist.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { DIMENSIONEN_TOLERANZ, FRISTEN, GATES, PHASEN, type Dokument, type PhasenmodellPatchIn } from './schemas.ts';

export interface Row {
  id: string; nummer: number; stand: 'entwurf' | 'in_kraft' | 'abgeloest'; beschreibung: string; in_kraft_ab: Date | null; in_kraft_by: string | null;
  version: number; created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null;
}

const S = SCHEMA;
const T = `${S}.phasenmodell`;
const COLS = 'id, nummer, stand, beschreibung, in_kraft_ab, in_kraft_by, version, created_at, created_by, updated_at, updated_by';

/** Neueste zuerst. */
export async function list(tx: Tx, o: { after?: number | null; limit: number }): Promise<Row[]> {
  const args: unknown[] = [o.limit + 1];
  let where = '';
  if (o.after != null) { args.push(o.after); where = 'WHERE nummer < $2'; }
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} ${where} ORDER BY nummer DESC LIMIT $1`, args)).rows;
}

export async function get(tx: Tx, id: string): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} WHERE id = $1`, [id])).rows[0] ?? null;
}

export async function byStand(tx: Tx, stand: 'entwurf' | 'in_kraft'): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} WHERE stand = $1`, [stand])).rows[0] ?? null;
}

/** Inhalt einer Version in der Reihenfolge des Modells. */
export async function dokument(tx: Tx, id: string): Promise<Dokument> {
  // nacheinander: eine Transaktion verarbeitet nur eine Abfrage zugleich
  const phasen = await tx.query<{ code: string; name: string }>(`SELECT code, name FROM ${S}.phase WHERE phasenmodell_id = $1 ORDER BY position`, [id]);
  const gates = await tx.query<{ code: string; name: string }>(`SELECT code, name FROM ${S}.gate WHERE phasenmodell_id = $1 ORDER BY position`, [id]);
  const leitfragen = await tx.query<{ gate_code: string; wertestrom: string; text: string }>(`SELECT gate_code, wertestrom, text FROM ${S}.leitfrage WHERE phasenmodell_id = $1 ORDER BY position, id`, [id]);
  const ergebnisse = await tx.query<{ phase_code: string; art: 'lieferergebnis' | 'meilenstein'; text: string }>(`SELECT phase_code, art, text FROM ${S}.standard_ergebnis WHERE phasenmodell_id = $1 ORDER BY position, id`, [id]);
  const pflicht = await tx.query<{ phase_code: string | null; gate_code: string | null; kapitel: number; feld: string; text: string }>(
    `SELECT phase_code, gate_code, kapitel, feld, text FROM ${S}.pflichtangabe WHERE phasenmodell_id = $1 ORDER BY position, id`, [id]);
  const wirkung = await tx.query<{ kapitel: number; dimension: Dokument['kapitelWirkung'][number]['dimension'] }>(`SELECT kapitel, dimension FROM ${S}.kapitel_wirkung WHERE phasenmodell_id = $1 ORDER BY kapitel, dimension`, [id]);
  const fristen = await tx.query<Dokument['fristen'][number]>(
    `SELECT schluessel, wert, einheit FROM ${S}.frist WHERE phasenmodell_id = $1 ORDER BY array_position($2::text[], schluessel)`, [id, FRISTEN]);
  const toleranzen = await tx.query<{ dimension: Dokument['toleranzen'][number]['dimension']; wert: string | null; einheit: Dokument['toleranzen'][number]['einheit'] }>(
    `SELECT dimension, wert, einheit FROM ${S}.toleranz WHERE phasenmodell_id = $1 ORDER BY array_position($2::text[], dimension)`, [id, DIMENSIONEN_TOLERANZ]);
  const ohne = <X extends { phase_code?: unknown; gate_code?: unknown }>(x: X) => { const { phase_code: _p, gate_code: _g, ...rest } = x; return rest; };
  return {
    phasen: phasen.rows.map(p => ({
      code: p.code as Dokument['phasen'][number]['code'], name: p.name,
      ergebnisse: ergebnisse.rows.filter(e => e.phase_code === p.code).map(ohne),
      pflichtangaben: pflicht.rows.filter(x => x.phase_code === p.code).map(ohne),
    })),
    gates: gates.rows.map(g => ({
      code: g.code as Dokument['gates'][number]['code'], name: g.name,
      leitfragen: leitfragen.rows.filter(l => l.gate_code === g.code).map(ohne),
      pflichtangaben: pflicht.rows.filter(x => x.gate_code === g.code).map(ohne),
    })),
    kapitelWirkung: wirkung.rows,
    fristen: fristen.rows,
    toleranzen: toleranzen.rows.map(t => ({ ...t, wert: t.wert === null ? null : Number(t.wert) })),
  };
}

/** Neuer Entwurf mit der nächsten Nummer; null, wenn schon ein Entwurf besteht. */
export async function createEntwurf(tx: Tx, beschreibung: string): Promise<Row | null> {
  return (await tx.query<Row>(
    `INSERT INTO ${T} (tenant_id, nummer, beschreibung)
     SELECT app.tenant_id(), coalesce(max(nummer), 0) + 1, $1 FROM ${T}
     ON CONFLICT (tenant_id) WHERE stand = 'entwurf' DO NOTHING RETURNING ${COLS}`, [beschreibung])).rows[0] ?? null;
}

const json = (v: unknown) => JSON.stringify(v);

/** Inhalt in eine leere Version schreiben (Vorgabe oder Kopie). */
export async function schreibeDokument(tx: Tx, id: string, d: Dokument): Promise<void> {
  const name = (code: string, liste: { code: string; name: string }[]) => liste.find(x => x.code === code)?.name;
  await tx.query(
    `INSERT INTO ${S}.phase (tenant_id, phasenmodell_id, code, name, position)
     SELECT app.tenant_id(), $1, x.code, x.name, x.position FROM jsonb_to_recordset($2) AS x(code text, name text, position int)`,
    [id, json(PHASEN.map((code, position) => ({ code, position, name: name(code, d.phasen) ?? code })))]);
  await tx.query(
    `INSERT INTO ${S}.gate (tenant_id, phasenmodell_id, code, name, von_phase, nach_phase, position)
     SELECT app.tenant_id(), $1, x.code, x.name, x.von, x.nach, x.position FROM jsonb_to_recordset($2) AS x(code text, name text, von text, nach text, position int)`,
    [id, json(GATES.map((g, position) => ({ ...g, position, name: name(g.code, d.gates) ?? g.code })))]);
  for (const p of d.phasen) await ersetzePhase(tx, id, p);
  for (const g of d.gates) await ersetzeGate(tx, id, g);
  await ersetzeWirkung(tx, id, d.kapitelWirkung);
  await setzeFristen(tx, id, d.fristen);
  await setzeToleranzen(tx, id, d.toleranzen);
}

type PhaseTeil = NonNullable<PhasenmodellPatchIn['phasen']>[number];
type GateTeil = NonNullable<PhasenmodellPatchIn['gates']>[number];

export async function ersetzePhase(tx: Tx, id: string, p: PhaseTeil): Promise<void> {
  if (p.name !== undefined) await tx.query(`UPDATE ${S}.phase SET name = btrim($3) WHERE phasenmodell_id = $1 AND code = $2`, [id, p.code, p.name]);
  if (p.ergebnisse) {
    await tx.query(`DELETE FROM ${S}.standard_ergebnis WHERE phasenmodell_id = $1 AND phase_code = $2`, [id, p.code]);
    await tx.query(
      `INSERT INTO ${S}.standard_ergebnis (tenant_id, phasenmodell_id, phase_code, art, position, text)
       SELECT app.tenant_id(), $1, $2, x.art, x.position, btrim(x.text) FROM jsonb_to_recordset($3) AS x(art text, position int, text text)`,
      [id, p.code, json(p.ergebnisse.map((e, position) => ({ ...e, position })))]);
  }
  if (p.pflichtangaben) await ersetzePflicht(tx, id, 'phase_code', p.code, p.pflichtangaben);
}

export async function ersetzeGate(tx: Tx, id: string, g: GateTeil): Promise<void> {
  if (g.name !== undefined) await tx.query(`UPDATE ${S}.gate SET name = btrim($3) WHERE phasenmodell_id = $1 AND code = $2`, [id, g.code, g.name]);
  if (g.leitfragen) {
    await tx.query(`DELETE FROM ${S}.leitfrage WHERE phasenmodell_id = $1 AND gate_code = $2`, [id, g.code]);
    await tx.query(
      `INSERT INTO ${S}.leitfrage (tenant_id, phasenmodell_id, gate_code, wertestrom, position, text)
       SELECT app.tenant_id(), $1, $2, x.wertestrom, x.position, btrim(x.text) FROM jsonb_to_recordset($3) AS x(wertestrom text, position int, text text)`,
      [id, g.code, json(g.leitfragen.map((l, position) => ({ ...l, position })))]);
  }
  if (g.pflichtangaben) await ersetzePflicht(tx, id, 'gate_code', g.code, g.pflichtangaben);
}

async function ersetzePflicht(tx: Tx, id: string, spalte: 'phase_code' | 'gate_code', code: string, liste: Dokument['phasen'][number]['pflichtangaben']): Promise<void> {
  await tx.query(`DELETE FROM ${S}.pflichtangabe WHERE phasenmodell_id = $1 AND ${spalte} = $2`, [id, code]);
  await tx.query(
    `INSERT INTO ${S}.pflichtangabe (tenant_id, phasenmodell_id, ${spalte}, kapitel, feld, position, text)
     SELECT app.tenant_id(), $1, $2, x.kapitel, x.feld, x.position, btrim(x.text) FROM jsonb_to_recordset($3) AS x(kapitel int, feld text, position int, text text)`,
    [id, code, json(liste.map((x, position) => ({ ...x, position })))]);
}

export async function ersetzeWirkung(tx: Tx, id: string, liste: Dokument['kapitelWirkung']): Promise<void> {
  await tx.query(`DELETE FROM ${S}.kapitel_wirkung WHERE phasenmodell_id = $1`, [id]);
  await tx.query(
    `INSERT INTO ${S}.kapitel_wirkung (tenant_id, phasenmodell_id, kapitel, dimension)
     SELECT DISTINCT app.tenant_id(), $1::uuid, x.kapitel, x.dimension FROM jsonb_to_recordset($2) AS x(kapitel int, dimension text)`, [id, json(liste)]);
}

/** Fristen je Schlüssel setzen (fehlende anlegen, genannte überschreiben). */
export async function setzeFristen(tx: Tx, id: string, liste: Dokument['fristen']): Promise<void> {
  await tx.query(
    `INSERT INTO ${S}.frist (tenant_id, phasenmodell_id, schluessel, wert, einheit)
     SELECT app.tenant_id(), $1, x.schluessel, x.wert, x.einheit FROM jsonb_to_recordset($2) AS x(schluessel text, wert int, einheit text)
     ON CONFLICT (tenant_id, phasenmodell_id, schluessel) DO UPDATE SET wert = excluded.wert, einheit = excluded.einheit`, [id, json(liste)]);
}

export async function setzeToleranzen(tx: Tx, id: string, liste: Dokument['toleranzen']): Promise<void> {
  await tx.query(
    `INSERT INTO ${S}.toleranz (tenant_id, phasenmodell_id, dimension, wert, einheit)
     SELECT app.tenant_id(), $1, x.dimension, x.wert, x.einheit FROM jsonb_to_recordset($2) AS x(dimension text, wert numeric, einheit text)
     ON CONFLICT (tenant_id, phasenmodell_id, dimension) DO UPDATE SET wert = excluded.wert, einheit = excluded.einheit`, [id, json(liste)]);
}

/** Bearbeitungsstand erhöhen (und Beschreibung setzen); null, wenn die Version abweicht oder kein Entwurf mehr ist. */
export async function touch(tx: Tx, id: string, version: number, beschreibung?: string): Promise<Row | null> {
  return (await tx.query<Row>(
    `UPDATE ${T} SET beschreibung = coalesce($3, beschreibung) WHERE id = $1 AND version = $2 AND stand = 'entwurf' RETURNING ${COLS}`,
    [id, version, beschreibung?.trim() ?? null])).rows[0] ?? null;
}

/** Entwurf in Kraft setzen, die bisherige Version ablösen; liefert die abgelöste Nummer (oder null). */
export async function inKraft(tx: Tx, id: string, version: number): Promise<{ row: Row; abgeloest: number | null } | null> {
  const alt = (await tx.query<{ nummer: number }>(`UPDATE ${T} SET stand = 'abgeloest' WHERE stand = 'in_kraft' AND id <> $1 RETURNING nummer`, [id])).rows[0];
  const row = (await tx.query<Row>(
    `UPDATE ${T} SET stand = 'in_kraft', in_kraft_ab = now(), in_kraft_by = app.principal_id() WHERE id = $1 AND version = $2 AND stand = 'entwurf' RETURNING ${COLS}`,
    [id, version])).rows[0];
  return row ? { row, abgeloest: alt?.nummer ?? null } : null;
}

export async function remove(tx: Tx, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${T} WHERE id = $1 AND version = $2 AND stand = 'entwurf'`, [id, version])).rowCount ?? 0) > 0;
}

export async function frist(tx: Tx, id: string, schluessel: string): Promise<Dokument['fristen'][number] | null> {
  return (await tx.query<Dokument['fristen'][number]>(`SELECT schluessel, wert, einheit FROM ${S}.frist WHERE phasenmodell_id = $1 AND schluessel = $2`, [id, schluessel])).rows[0] ?? null;
}
