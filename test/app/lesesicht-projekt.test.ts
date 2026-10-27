/**
 * Lesesicht = `can` für Projekte (identity-kit 7.6, docs/fachmodell.md 3.4, Abnahme AP-E0-1): Was die Policy von
 * `ppm.projekt` je Person liefert, deckt sich mit der Entscheidung des Baukastens (`can('projekt:read')`), ergänzt um die
 * Regel «vertraulich» (A-34: nur Projektrollen, UE und Gremium des Portfolios). Ebenso Schreiben (`projekt:write`) und
 * Anlegen (`projekt:create` an org oder am Portfolio). Fälle: Rolle an der Organisation, am Portfolio, am Projekt.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Principal } from '@vollholz/iam';
import { grant, person, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';

const skip = await skipDb();

/** Projekte: Portfolio und Kennzeichen «vertraulich». */
const PROJEKTE = {
  '2026-001': { portfolio: 'a', vertraulich: false },
  '2026-002': { portfolio: 'a', vertraulich: true },
  '2026-003': { portfolio: 'c', vertraulich: false },
  '2026-004': { portfolio: 'c', vertraulich: true },
} as const;
type Nr = keyof typeof PROJEKTE;

/** Personen mit ihren Tupeln und dem, was sie lesen und ändern sollen (fachmodell.md 3.3). */
const FAELLE: { sub: string; tupel: { rolle: string; ort: 'org' | 'portfolio:a' | 'portfolio:c' | `projekt:${Nr}` }[]; liest: Nr[]; aendert: Nr[]; legtAn: ('a' | 'c')[] }[] = [
  { sub: 'ohne', tupel: [], liest: [], aendert: [], legtAn: [] },
  { sub: 'ue', tupel: [{ rolle: 'ue', ort: 'org' }], liest: ['2026-001', '2026-002', '2026-003', '2026-004'], aendert: ['2026-001', '2026-002', '2026-003', '2026-004'], legtAn: ['a', 'c'] },
  { sub: 'gl', tupel: [{ rolle: 'gl', ort: 'org' }], liest: ['2026-001', '2026-003'], aendert: [], legtAn: [] },
  { sub: 'gremium-a', tupel: [{ rolle: 'gremium', ort: 'portfolio:a' }], liest: ['2026-001', '2026-002'], aendert: [], legtAn: [] },
  { sub: 'direktion-c', tupel: [{ rolle: 'direktion', ort: 'portfolio:c' }], liest: ['2026-003'], aendert: [], legtAn: ['c'] },
  { sub: 'pl-002', tupel: [{ rolle: 'pl', ort: 'projekt:2026-002' }], liest: ['2026-002'], aendert: ['2026-002'], legtAn: [] },
  { sub: 'kt-004', tupel: [{ rolle: 'kt', ort: 'projekt:2026-004' }], liest: ['2026-004'], aendert: [], legtAn: [] },
  { sub: 'gl-sp-004', tupel: [{ rolle: 'gl', ort: 'org' }, { rolle: 'sp', ort: 'projekt:2026-004' }], liest: ['2026-001', '2026-003', '2026-004'], aendert: [], legtAn: [] },
];

describe('Lesesicht = can: Projekte', { skip }, () => {
  let api: TestApi;
  let T: string;
  const portfolio: Record<string, string> = {};
  const projekt = {} as Record<Nr, string>;

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      for (const k of ['a', 'c']) {
        portfolio[k] = (await tx.query<{ id: string }>(
          'INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, $2, $3, $3, $4) RETURNING id',
          [T, k.toUpperCase(), k, k === 'a'])).rows[0]!.id;
      }
      for (const [nr, p] of Object.entries(PROJEKTE)) {
        projekt[nr as Nr] = (await tx.query<{ id: string }>(
          'INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, vertraulich) VALUES ($1, $2, $2, $3, $4) RETURNING id',
          [T, nr, portfolio[p.portfolio], p.vertraulich])).rows[0]!.id;
      }
    });
  });
  after(async () => { await api?.close(); });

  /** Principal einer Person mit ihren Tupeln (wie der Resolver ihn für eine Anfrage baut). */
  async function wer(f: (typeof FAELLE)[number]): Promise<Principal> {
    const id = await person(api, T, f.sub);
    for (const t of f.tupel) {
      const [typ, schluessel] = t.ort.split(':') as [string, string | undefined];
      const ort = typ === 'org' ? { type: 'org' } : { type: typ, id: typ === 'portfolio' ? portfolio[schluessel!] : projekt[schluessel as Nr] };
      await grant(api, T, `user:${id}`, t.rolle, ort);
    }
    return {
      tenantId: T, tenantAlias: 'acme', principalId: id, kind: 'user', subject: f.sub, name: f.sub, email: null, clientId: null,
      groups: [], subjects: [`user:${id}`, 'org:members'], scopes: [], platformAdmin: false, binding: null,
    } as unknown as Principal;
  }

  /** Erwartung aus der Entscheidung: `can(projekt:read)` und Regel «vertraulich» (Projektrolle oder projekt:vertraulich an org/Portfolio). */
  async function sollLesen(p: Principal, nr: Nr): Promise<boolean> {
    const ref = { type: 'projekt', id: projekt[nr] };
    if (!await api.iam.access.can(p, 'projekt:read', ref)) return false;
    if (!PROJEKTE[nr].vertraulich) return true;
    const rollen = api.iam.access.relationsWith('projekt:read');
    const amProjekt = await full(api.t.runtime, T, async tx => (await tx.query(
      `SELECT 1 FROM ppm.authz_tuple WHERE object_type = 'projekt' AND object_id = $1 AND subject = ANY ($2) AND relation = ANY ($3)
         AND (expires_at IS NULL OR expires_at > now())`, [projekt[nr], p.subjects, rollen])).rowCount! > 0);
    return amProjekt || await api.iam.access.can(p, 'projekt:vertraulich', { type: 'portfolio', id: portfolio[PROJEKTE[nr].portfolio] });
  }

  test('Lesen, Ändern und Anlegen je Rolle wie die Entscheidung', async () => {
    for (const f of FAELLE) {
      const p = await wer(f);
      const sichtbar = await api.iam.tx(p, async tx => (await tx.query<{ nummer: Nr }>('SELECT nummer FROM ppm.projekt ORDER BY nummer')).rows.map(r => r.nummer));
      const soll: Nr[] = [];
      for (const nr of Object.keys(PROJEKTE) as Nr[]) if (await sollLesen(p, nr)) soll.push(nr);
      assert.deepEqual(sichtbar, soll, `${f.sub}: Lesesicht = can`);
      assert.deepEqual(sichtbar, f.liest, `${f.sub}: lesen nach fachmodell.md 3.3`);

      const geaendert: Nr[] = [];
      for (const nr of Object.keys(PROJEKTE) as Nr[]) {
        const n = await api.iam.tx(p, async tx => (await tx.query("UPDATE ppm.projekt SET name = name || '' WHERE id = $1", [projekt[nr]])).rowCount ?? 0);
        if (n > 0) geaendert.push(nr);
        assert.equal(n > 0, sichtbar.includes(nr) && await api.iam.access.can(p, 'projekt:write', { type: 'projekt', id: projekt[nr] }), `${f.sub}: ändern ${nr} = can`);
      }
      assert.deepEqual(geaendert, f.aendert, `${f.sub}: ändern nach fachmodell.md 3.3`);

      const angelegt: ('a' | 'c')[] = [];
      for (const k of ['a', 'c'] as const) {
        const ok = await api.iam.tx(p, async tx => {
          await tx.query('SAVEPOINT s');
          const r = await tx.query("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-999', 'Neu', $2)", [T, portfolio[k]]).then(() => true, () => false);
          await tx.query('ROLLBACK TO SAVEPOINT s');
          return r;
        });
        if (ok) angelegt.push(k);
        assert.equal(ok, await api.iam.access.can(p, 'projekt:create', { type: 'portfolio', id: portfolio[k] }), `${f.sub}: anlegen in ${k} = can`);
      }
      assert.deepEqual(angelegt, f.legtAn, `${f.sub}: anlegen nach fachmodell.md 3.3`);
    }
  });

  test('Hilfsfunktionen der Lesesicht folgen der Policy von ppm.projekt', async () => {
    const p = await wer(FAELLE.find(f => f.sub === 'gremium-a')!);
    await api.iam.tx(p, async tx => {
      const r = (await tx.query<{ nr: Nr; s: boolean; pf: string | null }>(
        'SELECT x.nr, ppm.projekt_sichtbar(x.id) AS s, ppm.portfolio_von(x.id) AS pf FROM unnest($1::text[], $2::uuid[]) AS x (nr, id) ORDER BY 1',
        [Object.keys(projekt), Object.values(projekt)])).rows;
      assert.deepEqual(r.map(x => [x.nr, x.s, x.pf]), [
        ['2026-001', true, portfolio.a], ['2026-002', true, portfolio.a], ['2026-003', false, null], ['2026-004', false, null],
      ]);
    });
  });
});
