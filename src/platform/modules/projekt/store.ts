/**
 * Datenzugriff des Moduls «projekt». Läuft immer in einer Transaktion mit Mandantenkontext (`req.tx` bzw. `fullTx`);
 * die Lesesicht (RLS) liefert nur, was die Person sehen darf. Jede Änderung schreibt eine Fassung in den Verlauf.
 */
import type { Tx } from '../../db/pool.ts';
import type { Projekt, ProjektCreate, ProjektPatch } from './schemas.ts';

interface Row { id: string; label: string; beschreibung: string; beginn: string | null; ende: string | null; classification: number; version: number; created_at: Date; updated_at: Date }

const COLS = "id, label, beschreibung, to_char(beginn, 'YYYY-MM-DD') AS beginn, to_char(ende, 'YYYY-MM-DD') AS ende, classification, version, created_at, updated_at";

export const toProjekt = (r: Row): Projekt => ({
  id: r.id, label: r.label, beschreibung: r.beschreibung, beginn: r.beginn, ende: r.ende, classification: r.classification,
  version: r.version, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
});

async function snapshot(tx: Tx, p: Projekt, action: 'created' | 'updated' | 'deleted', by: string | null) {
  const { can: _can, ...data } = p;
  await tx.query('INSERT INTO ppm.projekt_version (tenant_id, projekt_id, version, action, data, changed_by) VALUES (app.tenant_id(), $1, $2, $3, $4, $5)',
    [p.id, action === 'deleted' ? p.version + 1 : p.version, action, JSON.stringify(data), by]);
}

export const projekte = {
  /** Seite nach Bezeichnung (Cursor: letzte Bezeichnung und ID). */
  async list(tx: Tx, o: { q: string; limit: number; after: { label: string; id: string } | null }): Promise<Projekt[]> {
    const r = await tx.query<Row>(
      `SELECT ${COLS} FROM ppm.projekt
       WHERE ($1 = '' OR label ILIKE $2 ESCAPE '\\')
         AND ($3::text IS NULL OR (lower(label), id) > (lower($3), $4::uuid))
       ORDER BY lower(label), id LIMIT $5`,
      [o.q, `%${o.q.replace(/[\\%_]/g, m => `\\${m}`)}%`, o.after?.label ?? null, o.after?.id ?? null, o.limit]);
    return r.rows.map(toProjekt);
  },

  async get(tx: Tx, id: string, lock = false): Promise<Projekt | null> {
    const r = await tx.query<Row>(`SELECT ${COLS} FROM ppm.projekt WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    return r.rows[0] ? toProjekt(r.rows[0]) : null;
  },

  async create(tx: Tx, input: ProjektCreate, by: string): Promise<Projekt> {
    const r = await tx.query<Row>(
      `INSERT INTO ppm.projekt (tenant_id, label, beschreibung, beginn, ende, classification, created_by, updated_by)
       VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6, $6) RETURNING ${COLS}`,
      [input.label.trim(), input.beschreibung ?? '', input.beginn ?? null, input.ende ?? null, input.classification ?? 0, by]);
    const p = toProjekt(r.rows[0]!);
    await snapshot(tx, p, 'created', by);
    return p;
  },

  /** Ändert die Fassung `version`; `null`, wenn die Lesesicht das Projekt nicht (mehr) zum Schreiben freigibt. */
  async update(tx: Tx, id: string, patch: ProjektPatch, version: number, by: string): Promise<Projekt | null> {
    const sets: string[] = [], vals: unknown[] = [id, version, by];
    for (const [k, col] of [['label', 'label'], ['beschreibung', 'beschreibung'], ['beginn', 'beginn'], ['ende', 'ende'], ['classification', 'classification']] as const) {
      if (patch[k] === undefined) continue;
      vals.push(k === 'label' ? patch.label!.trim() : patch[k]);
      sets.push(`${col} = $${vals.length}`);
    }
    const r = await tx.query<Row>(
      `UPDATE ppm.projekt SET ${sets.join(', ')}, version = version + 1, updated_at = now(), updated_by = $3
       WHERE id = $1 AND version = $2 RETURNING ${COLS}`, vals);
    if (!r.rows[0]) return null;
    const p = toProjekt(r.rows[0]);
    await snapshot(tx, p, 'updated', by);
    return p;
  },

  async remove(tx: Tx, p: Projekt, by: string): Promise<boolean> {
    const r = await tx.query('DELETE FROM ppm.projekt WHERE id = $1 AND version = $2', [p.id, p.version]);
    if (!r.rowCount) return false;
    await snapshot(tx, p, 'deleted', by);
    return true;
  },

  async history(tx: Tx, id: string) {
    const r = await tx.query<{ version: number; action: 'created' | 'updated' | 'deleted'; changed_at: Date; changed_by: string | null; data: Record<string, unknown> }>(
      'SELECT version, action, changed_at, changed_by, data FROM ppm.projekt_version WHERE projekt_id = $1 ORDER BY version DESC', [id]);
    return r.rows.map(v => ({ version: v.version, action: v.action, changedAt: v.changed_at.toISOString(), changedBy: v.changed_by, data: v.data }));
  },

  /** Kennzahlen der Organisation (Job «projekt.summary»). */
  async summary(tx: Tx) {
    const r = await tx.query<{ classification: number; n: number }>('SELECT classification, count(*)::int AS n FROM ppm.projekt GROUP BY classification ORDER BY classification');
    return { total: r.rows.reduce((a, x) => a + x.n, 0), byClassification: Object.fromEntries(r.rows.map(x => [String(x.classification), x.n])) };
  },
};
