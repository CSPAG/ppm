/**
 * Zuordnung Projekt ↔ Ziel für obere Module (PP.02.05; `projektZuordnen` aus `ziel`, aufgerufen vom Vertrag bei der
 * Baseline, AP-E3-1): PL ohne `ziel:write` ordnet sein Projekt zu (projekt:write am Projekt, Migration 301), idempotent,
 * mit Audit und Ereignis; Kernteam (nur lesen) nicht; fremdes Projekt, unbekanntes Ziel und unpassendes Jahresziel: 404.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import type { Principal } from '@vollholz/iam';
import { systemActor } from '@vollholz/platform';
import { projektZuordnen } from '../../src/modules/ziel/index.ts';
import { grant, person, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Zuordnung Projekt ↔ Ziel aus oberen Modulen', () => {
  let api: TestApi;
  let T: string;
  const id: Record<string, string> = {};

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      const one = async (sql: string, args: unknown[]) => (await tx.query<{ id: string }>(sql, args)).rows[0]!.id;
      const pf = await one("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T]);
      id.p1 = await one("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-001', 'Eins', $2) RETURNING id", [T, pf]);
      id.p2 = await one("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-002', 'Zwei', $2) RETURNING id", [T, pf]);
      const hf = await one("INSERT INTO ppm.handlungsfeld (tenant_id, label) VALUES ($1, 'Wirtschaftlichkeit') RETURNING id", [T]);
      id.s21 = await one("INSERT INTO ppm.strategisches_ziel (tenant_id, handlungsfeld_id, nummer, text) VALUES ($1, $2, '2.1', 'Kosten') RETURNING id", [T, hf]);
      id.s22 = await one("INSERT INTO ppm.strategisches_ziel (tenant_id, handlungsfeld_id, nummer, text) VALUES ($1, $2, '2.2', 'Erlöse') RETURNING id", [T, hf]);
      await tx.query('INSERT INTO ppm.zieljahr (tenant_id, jahr) VALUES ($1, 2027)', [T]);
      id.j211 = await one("INSERT INTO ppm.jahresziel (tenant_id, jahr, strategisches_ziel_id, nummer, text) VALUES ($1, 2027, $2, '2.1.1', 'Einkauf') RETURNING id", [T, id.s21]);
    });
  });
  after(async () => { await api?.close(); });

  /** Person mit Rolle am Projekt (wie der Resolver sie für eine Anfrage baut). */
  async function mit(sub: string, rolle: string, projekt: string): Promise<Principal> {
    const pid = await person(api, T, sub);
    await grant(api, T, `user:${pid}`, rolle, { type: 'projekt', id: projekt });
    return {
      tenantId: T, tenantAlias: 'acme', principalId: pid, kind: 'user', subject: sub, name: sub, email: null, clientId: null,
      groups: [], subjects: [`user:${pid}`, 'org:members'], scopes: [], platformAdmin: false, binding: null,
    } as unknown as Principal;
  }
  const who = systemActor('system', 'test-zuordnung');

  test('PL ohne ziel:write ordnet sein Projekt zu, idempotent, mit Audit und Ereignis', async () => {
    const pl = await mit('pl-1', 'projekt-fuehren', id.p1!);
    assert.equal(await api.iam.access.can(pl, 'ziel:write'), false);
    const a = await api.iam.tx(pl, tx => projektZuordnen(tx, who, id.p1!, { strategischesZielId: id.s21!, jahreszielId: id.j211 }));
    assert.equal(a.neu, true);
    const b = await api.iam.tx(pl, tx => projektZuordnen(tx, who, id.p1!, { strategischesZielId: id.s21!, jahreszielId: id.j211 }));
    assert.deepEqual(b, { id: a.id, neu: false });
    const c = await api.iam.tx(pl, tx => projektZuordnen(tx, who, id.p1!, { strategischesZielId: id.s22! }));
    assert.equal(c.neu, true);
    const rows = await full(api.t.runtime, T, async tx => ({
      zuordnungen: (await tx.query('SELECT strategisches_ziel_id, jahresziel_id FROM ppm.ziel_projekt WHERE projekt_id = $1 ORDER BY created_at', [id.p1])).rows,
      audit: (await tx.query('SELECT action FROM ppm.audit_log WHERE resource_id = $1', [a.id])).rows,
      events: (await tx.query('SELECT type FROM ppm.outbox_event WHERE subject = $1', [`ziel_projekt/${a.id}`])).rows,
    }));
    assert.deepEqual(rows.zuordnungen, [{ strategisches_ziel_id: id.s21, jahresziel_id: id.j211 }, { strategisches_ziel_id: id.s22, jahresziel_id: null }]);
    assert.deepEqual(rows.audit, [{ action: 'ziel_projekt.created' }]);
    assert.deepEqual(rows.events, [{ type: 'ziel_projekt.created' }]);
  });

  test('Kernteam (nur lesen) darf nicht; fremdes Projekt, unbekanntes Ziel, unpassendes Jahresziel: 404', async () => {
    const kt = await mit('kt-1', 'projekt-mitlesen', id.p1!);
    await assert.rejects(api.iam.tx(kt, tx => projektZuordnen(tx, who, id.p1!, { strategischesZielId: id.s21!, jahreszielId: null })),
      (e: { code?: string }) => e.code === '42501');
    const pl = await mit('pl-2', 'projekt-fuehren', id.p2!);
    await assert.rejects(api.iam.tx(pl, tx => projektZuordnen(tx, who, id.p1!, { strategischesZielId: id.s21! })), (e: { status?: number }) => e.status === 404);
    await assert.rejects(api.iam.tx(pl, tx => projektZuordnen(tx, who, id.p2!, { strategischesZielId: randomUUID() })), (e: { status?: number }) => e.status === 404);
    await assert.rejects(api.iam.tx(pl, tx => projektZuordnen(tx, who, id.p2!, { strategischesZielId: id.s22!, jahreszielId: id.j211 })), (e: { status?: number }) => e.status === 404);
  });
});
