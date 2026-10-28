/**
 * Arbeitstage (A-43) und Fristen des Phasenmodells (docs/fachmodell.md 2.14): Montag bis Freitag ohne Feiertage der
 * Organisation (Rechnung in `stammdaten`, Fristen aus dem Phasenmodell). Beispiele aus den Kernabläufen K2 und K3
 * (Versand 5 Arbeitstage vor, Protokoll 3 nach der Sitzung).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { fristDatum } from '../../src/modules/phasenmodell/index.ts';
import { plusArbeitstage as addiereArbeitstage, arbeitstageZwischen, istArbeitstag, plusArbeitstageDb } from '../../src/modules/stammdaten/index.ts';
import { full } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';

const keine = new Set<string>();
/** Feiertage Bern 2025/2026 (Beispiel): Weihnachten, Stephanstag, Neujahr, Berchtoldstag, Karfreitag, Ostermontag. */
const bern = new Set(['2025-12-25', '2025-12-26', '2026-01-01', '2026-01-02', '2026-04-03', '2026-04-06']);

describe('Arbeitstage (rein)', () => {
  test('Wochenende ist kein Arbeitstag, Feiertage auch nicht', () => {
    assert.equal(istArbeitstag('2025-11-12', keine), true);   // Mi
    assert.equal(istArbeitstag('2025-11-15', keine), false);  // Sa
    assert.equal(istArbeitstag('2025-11-16', keine), false);  // So
    assert.equal(istArbeitstag('2025-12-25', bern), false);   // Do, Weihnachten
    assert.equal(istArbeitstag('2025-12-25', keine), true);
  });

  test('Beispiele K3: Versand 5 Arbeitstage vor, Protokoll 3 nach der Sitzung Mi 12.11.2025', () => {
    assert.equal(addiereArbeitstage('2025-11-12', -5, keine), '2025-11-05');
    assert.equal(addiereArbeitstage('2025-11-12', 3, keine), '2025-11-17');
  });

  test('Beispiel K2: Unterlagen 5 Arbeitstage vor dem PRAT Mi 10.12.2025', () => {
    assert.equal(addiereArbeitstage('2025-12-10', -5, keine), '2025-12-03');
  });

  test('Feiertage verschieben die Frist: über Weihnachten und Neujahr', () => {
    // Fr 19.12.2025 + 5 Arbeitstage: ohne Feiertage Fr 26.12., mit Weihnachten und Stephanstag Di 30.12.
    assert.equal(addiereArbeitstage('2025-12-19', 5, keine), '2025-12-26');
    assert.equal(addiereArbeitstage('2025-12-19', 5, bern), '2025-12-30');
    // Mi 7.1.2026 − 5 Arbeitstage: ohne Feiertage Mi 31.12., mit Neujahr und Berchtoldstag Mo 29.12.
    assert.equal(addiereArbeitstage('2026-01-07', -5, keine), '2025-12-31');
    assert.equal(addiereArbeitstage('2026-01-07', -5, bern), '2025-12-29');
  });

  test('Ostern: Karfreitag und Ostermontag', () => {
    assert.equal(addiereArbeitstage('2026-04-02', 1, bern), '2026-04-07');
    assert.equal(addiereArbeitstage('2026-04-07', -1, bern), '2026-04-02');
  });

  test('30 Arbeitstage vor einer Sitzung (Gate vorbereiten, A-27)', () => {
    // Mi 10.12.2025 − 30 Arbeitstage = 6 Wochen zurück: Mi 29.10.2025
    assert.equal(addiereArbeitstage('2025-12-10', -30, keine), '2025-10-29');
  });

  test('null Arbeitstage, Start am Wochenende, keine Bruchteile', () => {
    assert.equal(addiereArbeitstage('2025-11-15', 0, keine), '2025-11-15');
    assert.equal(addiereArbeitstage('2025-11-15', 1, keine), '2025-11-17');   // Sa → Mo
    assert.equal(addiereArbeitstage('2025-11-16', -1, keine), '2025-11-14');  // So → Fr
    assert.throws(() => addiereArbeitstage('2025-11-12', 1.5, keine), RangeError);
  });

  test('Arbeitstage zwischen zwei Daten: Gegenstück zum Addieren', () => {
    assert.equal(arbeitstageZwischen('2025-11-05', '2025-11-12', keine), 5);
    assert.equal(arbeitstageZwischen('2025-11-12', '2025-11-05', keine), -5);
    assert.equal(arbeitstageZwischen('2025-11-12', '2025-11-12', keine), 0);
    // rückwärts zählt das Ende der Richtung: Sa → Fr ist ein Arbeitstag zurück, Mo → Sa keiner
    assert.equal(arbeitstageZwischen('2025-11-15', '2025-11-14', keine), -1);
    assert.equal(arbeitstageZwischen('2025-11-17', '2025-11-15', keine), 0);
    assert.equal(arbeitstageZwischen('2025-11-14', '2025-11-15', keine), 0);
    assert.equal(arbeitstageZwischen('2025-12-19', '2025-12-30', bern), 5);
    for (const [d, n] of [['2025-12-19', 7], ['2026-03-30', 12], ['2026-01-07', -9], ['2025-11-15', -1], ['2025-11-16', -6]] as const) {
      assert.equal(arbeitstageZwischen(d, addiereArbeitstage(d, n, bern), bern), n, `${d} ${n}`);
    }
  });
});

// Tests mit Datenbank: ohne Konfiguration einzeln übersprungen, konfiguriert und nicht erreichbar scheitert der Lauf
const db = dbTests(await postgresSkip());

db.describe('Fristen mit Feiertagen der Organisation', () => {
  let api: TestApi;
  let tenantId: string;

  db.before(async () => {
    api = await testApi();
    const admin = await login(api, 'fristen', 'f-admin', 'org-admin');
    tenantId = admin.tenantId;
    const h = { authorization: admin.authorization };
    const e = await api.app.inject({ method: 'POST', url: '/v1/phasenmodelle', headers: h, payload: {} });
    assert.equal(e.statusCode, 201, e.body);
    const k = await api.app.inject({ method: 'POST', url: `/v1/phasenmodelle/${e.json().id}/in-kraft-setzen`, headers: { ...h, 'if-match': e.headers.etag as string } });
    assert.equal(k.statusCode, 200, k.body);
    // Feiertage der Organisation (stammdaten, AM.02.02)
    await full(api.t.runtime, tenantId, tx => tx.query(
      "INSERT INTO ppm.feiertag (tenant_id, datum, label) SELECT $1, d::date, 'Feiertag' FROM unnest($2::text[]) AS d", [tenantId, [...bern]]));
  });
  db.after(async () => { await api?.close(); });

  db.test('Fristen aus der Version in Kraft, Arbeitstage ohne Feiertage', async () => {
    await full(api.t.runtime, tenantId, async tx => {
      assert.deepEqual(await fristDatum(tx, 'versand', '2025-11-12'), { datum: '2025-11-05', frist: { schluessel: 'versand', wert: 5, einheit: 'arbeitstage' } });
      assert.equal((await fristDatum(tx, 'protokoll', '2025-11-12'))?.datum, '2025-11-17');
      assert.equal((await fristDatum(tx, 'gate_vorbereiten', '2025-12-10'))?.datum, '2025-10-29');
      assert.equal((await fristDatum(tx, 'sitzung_vorbereiten', '2025-11-12'))?.datum, '2025-10-22');
    });
  });

  db.test('Feiertage der Organisation verschieben die Frist', async () => {
    await full(api.t.runtime, tenantId, async tx => {
      assert.equal((await fristDatum(tx, 'protokoll', '2025-12-23'))?.datum, '2025-12-30');
      assert.equal((await fristDatum(tx, 'versand', '2026-01-07'))?.datum, '2025-12-29');
      assert.equal(await plusArbeitstageDb(tx, '2026-04-02', 1), '2026-04-07');
      // lange Fristen über viele Feiertage: Spanne wird bei Bedarf erweitert
      assert.equal(await plusArbeitstageDb(tx, '2025-12-19', 60), addiereArbeitstage('2025-12-19', 60, bern));
    });
  });

  db.test('Monatszyklus: Tag im Monat der Periode, am Monatsende begrenzt', async () => {
    await full(api.t.runtime, tenantId, async tx => {
      assert.equal((await fristDatum(tx, 'bericht_aufgabe', '2026-10-01'))?.datum, '2026-10-18');
      assert.equal((await fristDatum(tx, 'bericht_stichtag', '2026-02-14'))?.datum, '2026-02-25');
    });
  });

  db.test('Feiertage einer anderen Organisation zählen nicht', async () => {
    const other = await login(api, 'andere-fristen', 'f-other', 'org-admin');
    const h = { authorization: other.authorization };
    const e = await api.app.inject({ method: 'POST', url: '/v1/phasenmodelle', headers: h, payload: {} });
    await api.app.inject({ method: 'POST', url: `/v1/phasenmodelle/${e.json().id}/in-kraft-setzen`, headers: { ...h, 'if-match': e.headers.etag as string } });
    await full(api.t.runtime, other.tenantId, async tx => {
      assert.equal((await fristDatum(tx, 'protokoll', '2025-12-23'))?.datum, '2025-12-26');
    });
  });

  db.test('ohne Phasenmodell in Kraft keine Frist', async () => {
    const leer = await login(api, 'ohne-modell', 'f-leer', 'org-admin');
    await full(api.t.runtime, leer.tenantId, async tx => { assert.equal(await fristDatum(tx, 'versand', '2025-11-12'), null); });
  });
});
