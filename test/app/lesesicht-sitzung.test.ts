/**
 * Lesesicht der Sitzungen nach «vertraulich heisst nur wer eingetragen ist» (Master Entscheid 22, A-76, Migration 471):
 * Sitzungen, Traktanden und Einladungen eines vertraulichen Portfolios sieht mit `sitzung:read` nur, wer das Portfolio
 * sieht; ein vertrauliches Traktandum nur, wer das Projekt trotz «vertraulich» liest. «Alle Portfolios lesen» sieht beides
 * nur, wenn eingetragen. Eingeladene sehen ihr Traktandum weiter. Das Protokoll blendet nach derselben Lesesicht aus.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import type { Principal } from '@vollholz/iam';
import { fuerLeser, type ProtokollInhalt } from '../../src/modules/sitzung/protokoll.ts';
import { grant, person, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

/** Traktanden: Portfolio des Gremiums, Projekt und Kennzeichen «vertraulich» des Traktandums. */
const TRAKTANDEN = {
  'a-offen': { portfolio: 'a', projekt: '2026-001', vertraulich: false },
  'a-vertraulich': { portfolio: 'a', projekt: '2026-002', vertraulich: true },
  'v-offen': { portfolio: 'v', projekt: '2026-005', vertraulich: false },
} as const;
type Tr = keyof typeof TRAKTANDEN;

/** Personen mit ihren Tupeln, den Sitzungen und Traktanden, die sie sehen sollen. */
const FAELLE: { sub: string; tupel: { rolle: string; ort: 'org' | 'portfolio:a' | 'portfolio:v' }[]; sitzungen: ('a' | 'v')[]; traktanden: Tr[] }[] = [
  { sub: 'ue', tupel: [{ rolle: 'alle-fuehren', ort: 'org' }], sitzungen: ['a', 'v'], traktanden: ['a-offen', 'a-vertraulich', 'v-offen'] },
  { sub: 'gl', tupel: [{ rolle: 'alle-lesen', ort: 'org' }], sitzungen: ['a'], traktanden: ['a-offen'] },
  { sub: 'gremium-a', tupel: [{ rolle: 'gremium', ort: 'portfolio:a' }], sitzungen: ['a'], traktanden: ['a-offen', 'a-vertraulich'] },
  { sub: 'gremium-v', tupel: [{ rolle: 'gremium', ort: 'portfolio:v' }], sitzungen: ['v'], traktanden: ['v-offen'] },
  // «Gruppe GL · darf lesen» am vertraulichen Portfolio: Sitzungen über «alle lesen», weil das Portfolio jetzt sichtbar ist
  { sub: 'gl-mitlesen-v', tupel: [{ rolle: 'alle-lesen', ort: 'org' }, { rolle: 'portfolio-mitlesen', ort: 'portfolio:v' }], sitzungen: ['a', 'v'], traktanden: ['a-offen', 'v-offen'] },
];

describe('Lesesicht der Sitzungen bei «vertraulich»', () => {
  let api: TestApi;
  let T: string;
  const portfolio: Record<string, string> = {};
  const sitzung: Record<string, string> = {};
  const traktandum = {} as Record<Tr, string>;
  let eingeladen = '';

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    eingeladen = await person(api, T, 'eingeladen');
    await full(api.t.runtime, T, async tx => {
      for (const [k, vertraulich] of [['a', false], ['v', true]] as const) {
        portfolio[k] = (await tx.query<{ id: string }>(
          "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten, vertraulich) VALUES ($1, 'A', $2, $2, true, $3) RETURNING id",
          [T, k, vertraulich])).rows[0]!.id;
        const g = (await tx.query<{ id: string }>(
          "INSERT INTO ppm.gremium (tenant_id, portfolio_id, kuerzel, name, art) VALUES ($1, $2, $3, $3, 'entscheidend') RETURNING id", [T, portfolio[k], `g-${k}`])).rows[0]!.id;
        sitzung[k] = (await tx.query<{ id: string }>(
          "INSERT INTO ppm.sitzung (tenant_id, portfolio_id, gremium_id, datum, stand, versendet_at) VALUES ($1, $2, $3, '2026-11-18', 'versendet', now()) RETURNING id",
          [T, portfolio[k], g])).rows[0]!.id;
      }
      let position = 1;
      for (const [k, t] of Object.entries(TRAKTANDEN)) {
        const p = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, vertraulich) VALUES ($1, $2, $2, $3, $4) RETURNING id',
          [T, t.projekt, portfolio[t.portfolio], t.vertraulich])).rows[0]!.id;
        traktandum[k as Tr] = (await tx.query<{ id: string }>(
          `INSERT INTO ppm.traktandum (tenant_id, portfolio_id, gremium_id, sitzung_id, art, bezug_typ, bezug_id, projekt_id, titel, stand, position, vertraulich, versendet_at)
           SELECT $1, portfolio_id, gremium_id, id, 'gate', 'projekt', $3::text, $3::uuid, $4, 'traktandiert', $5, $6, now() FROM ppm.sitzung WHERE id = $2 RETURNING id`,
          [T, sitzung[t.portfolio], p, k, position++, t.vertraulich])).rows[0]!.id;
      }
      await tx.query(
        `INSERT INTO ppm.einladung (tenant_id, traktandum_id, sitzung_id, portfolio_id, person_id, funktion, versendet_at)
         SELECT tenant_id, id, sitzung_id, portfolio_id, $2, 'pl', now() FROM ppm.traktandum WHERE id = $1`, [traktandum['v-offen'], eingeladen]);
    });
  });
  after(async () => { await api?.close(); });

  async function wer(sub: string, tupel: (typeof FAELLE)[number]['tupel']): Promise<Principal> {
    const id = sub === 'eingeladen' ? eingeladen : await person(api, T, sub);
    for (const t of tupel) {
      const [typ, k] = t.ort.split(':') as [string, string | undefined];
      await grant(api, T, `user:${id}`, t.rolle, typ === 'org' ? { type: 'org' } : { type: typ, id: portfolio[k!] });
    }
    return {
      tenantId: T, tenantAlias: 'acme', principalId: id, kind: 'user', subject: sub, name: sub, email: null, clientId: null,
      groups: [], subjects: [`user:${id}`, 'org:members'], scopes: [], platformAdmin: false, binding: null,
    } as unknown as Principal;
  }

  const sieht = (p: Principal) => api.iam.tx(p, async tx => ({
    sitzungen: (await tx.query<{ id: string }>('SELECT id FROM ppm.sitzung')).rows.map(r => Object.keys(sitzung).find(k => sitzung[k] === r.id)!).sort(),
    traktanden: (await tx.query<{ titel: Tr }>('SELECT titel FROM ppm.traktandum')).rows.map(r => r.titel).sort(),
    einladungen: Number((await tx.query<{ n: string }>('SELECT count(*) AS n FROM ppm.einladung')).rows[0]!.n),
  }));

  test('Sitzungen und Traktanden je Rolle (A-76)', async () => {
    for (const f of FAELLE) {
      const s = await sieht(await wer(f.sub, f.tupel));
      assert.deepEqual(s.sitzungen, [...f.sitzungen].sort(), `${f.sub}: Sitzungen`);
      assert.deepEqual(s.traktanden, [...f.traktanden].sort(), `${f.sub}: Traktanden`);
    }
  });

  test('Eingeladene sehen ihr Traktandum im vertraulichen Portfolio weiter', async () => {
    const s = await sieht(await wer('eingeladen', []));
    assert.deepEqual([s.sitzungen, s.traktanden, s.einladungen], [['v'], ['v-offen'], 1]);
  });

  test('Später vertraulich: Portfolio umstellen schützt bestehende Traktanden (laufend abgeleitet)', async () => {
    const gl = await wer('gl', [{ rolle: 'alle-lesen', ort: 'org' }]);
    const gremiumA = await wer('gremium-a', [{ rolle: 'gremium', ort: 'portfolio:a' }]);
    await full(api.t.runtime, T, tx => tx.query('UPDATE ppm.portfolio SET vertraulich = true WHERE id = $1', [portfolio.a]));
    try {
      assert.deepEqual((await sieht(gl)).traktanden, [], 'alle lesen: nichts mehr aus dem vertraulichen Portfolio');
      assert.deepEqual((await sieht(gremiumA)).traktanden, ['a-offen', 'a-vertraulich'], 'Gremium am Portfolio weiter');
    } finally {
      await full(api.t.runtime, T, tx => tx.query('UPDATE ppm.portfolio SET vertraulich = false WHERE id = $1', [portfolio.a]));
    }
    // nur das Projekt: das Traktandum folgt, ohne dass sein eigenes Kennzeichen geändert wird
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.projekt SET vertraulich = true WHERE nummer = '2026-001'"));
    try {
      assert.deepEqual((await sieht(gl)).traktanden, [], 'alle lesen: a-offen jetzt vertraulich');
    } finally {
      await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.projekt SET vertraulich = false WHERE nummer = '2026-001'"));
    }
  });

  test('Protokoll: nur Traktanden in der Lesesicht', () => {
    const t = (id: string, vertraulich: boolean, nummer?: string) =>
      ({ traktandumId: id, vertraulich, projekt: nummer ? { nummer, name: nummer } : null }) as unknown as ProtokollInhalt['traktanden'][number];
    // x offen ohne Projekt, y vertraulich, z vertraulich, w offen mit Projekt (später vertraulich: Projekt nicht sichtbar)
    const inhalt = { traktanden: [t('x', false), t('y', true, '2026-002'), t('z', true, '2026-003'), t('w', false, '2026-001')] } as unknown as ProtokollInhalt;
    const ids = (traktanden: string[], projekte: string[]) =>
      fuerLeser(inhalt, { traktanden: new Set(traktanden), projekte: new Set(projekte) }).traktanden.map(x => x.traktandumId);
    assert.deepEqual(ids(['x', 'z', 'w'], ['2026-001']), ['x', 'z', 'w']);
    assert.deepEqual(ids([], ['2026-001', '2026-002']), ['x', 'w'], 'von der Sitzung gelöst: offene mit sichtbarem Projekt');
    assert.deepEqual(ids([], []), ['x'], 'Projekt nicht (mehr) sichtbar');
  });
});
