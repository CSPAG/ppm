/**
 * Quality-Check und Unterschriften des Projektvertrags (AP-E3-2; DM.02.05, DM.02.06; UC-002 Schritte 9–10, A5; UC-003
 * Schritte 7–8, A4, A5; K2 Schritte 7–8): Rückmeldung mit Kommentar je Kapitel, Bestätigung mit Unterzeichnungsaufgaben
 * an SP, PL und CTL (K2-Abnahme), Unterzeichnen in Vertretung nur mit Recht auf Unterschriften (A-31), Verweigern mit
 * Begründung, Rechte, If-Match und Audit.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { unterzeichnung } from '../../src/modules/vertrag/index.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

type H = Record<string, string>;
const heute = (tage = 0) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date(Date.now() + tage * 86_400_000));

/** Nach der letzten Unterschrift registriertes Verhalten (Schnittstelle für AP-E3-3). */
const unterzeichnet: string[] = [];
unterzeichnung.registrieren(async (_tx, o) => { unterzeichnet.push(`${o.projekt.nummer}:${o.version.nummer}:${o.version.stand}`); });

describe('Projektvertrag: Quality-Check und Unterschriften', () => {
  let api: TestApi;
  let T: string;
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};
  const projekt: Record<'a' | 'b' | 'ohne', string> = { a: '', b: '', ohne: '' };

  async function person(sub: string, rollen: [string, string | null][]): Promise<void> {
    const l = await login(api, 'acme', sub, null);
    id[sub] = l.principalId;
    h[sub] = { authorization: l.authorization };
    for (const [rolle, p] of rollen) await grant(api, T, `user:${l.principalId}`, rolle, p ? { type: 'projekt', id: p } : { type: 'org' });
  }
  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  /** Entwurf anlegen und durch die PL einreichen; liefert ID und ETag. */
  async function eingereicht(p: string): Promise<{ v: string; etag: string }> {
    const e = await call('pl', 'POST', `/v1/projekte/${p}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(e.statusCode, 201, e.body);
    const v = e.json().version.id as string;
    const r = await call('pl', 'POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': e.headers.etag as string });
    assert.equal(r.statusCode, 200, r.body);
    return { v, etag: r.headers.etag as string };
  }
  const pruefung = async (who: string, v: string) => {
    const r = await call(who, 'GET', `/v1/vertragsversionen/${v}/pruefung`);
    assert.equal(r.statusCode, 200, r.body);
    return { body: r.json(), etag: r.headers.etag as string };
  };
  /** Offene Aufgaben einer Art zur Version: Empfänger (Person) und Kontext. */
  const aufgaben = (art: string, v: string) => full(api.t.runtime, T, async tx => (await tx.query<{ person: string; kontext: string; stand: string }>(
    'SELECT empfaenger_person AS person, kontext, stand FROM ppm.aufgabe WHERE art = $1 AND bezug_id = $2 ORDER BY created_at, empfaenger_person', [art, v])).rows);

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      for (const [k, nr] of [['a', '2026-001'], ['b', '2026-002'], ['ohne', '2026-003']] as const) {
        projekt[k] = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $3, $4, 'P0') RETURNING id",
          [T, nr, `Projekt ${k.toUpperCase()}`, pf])).rows[0]!.id;
      }
    });
    await person('adm', [['org-admin', null]]);
    await person('ue', [['ue', null]]);
    await person('sp', [['sp', projekt.a], ['sp', projekt.b], ['sp', projekt.ohne]]);
    await person('pl', [['pl', projekt.a], ['pl', projekt.b], ['pl', projekt.ohne]]);
    await person('ctl', [['ctl', projekt.a], ['ctl', projekt.b]]);
    await person('kt', [['kt', projekt.a]]);
    await person('vertretung', []);
    await person('ohneRecht', []);
    // Projektorganisation (PP.04.04): im Projekt «ohne» fehlt die CTL
    await full(api.t.runtime, T, async tx => {
      for (const [p, funktionen] of [[projekt.a, ['sp', 'pl', 'ctl', 'kt']], [projekt.b, ['sp', 'pl', 'ctl']], [projekt.ohne, ['sp', 'pl']]] as const) {
        for (const f of funktionen) await tx.query('INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, $4)', [T, p, id[f], f]);
      }
    });
    // Phasenmodell ohne Pflichtangaben in Kraft (Einreichen ohne Sperre)
    const m = await call('ue', 'POST', '/v1/phasenmodelle', {});
    assert.equal(m.statusCode, 201, m.body);
    assert.equal((await call('adm', 'POST', `/v1/phasenmodelle/${m.json().id}/in-kraft-setzen`, undefined, { 'if-match': m.headers.etag as string })).statusCode, 200);
  });
  after(async () => { await api?.close(); });

  let versionA = '';

  test('Quality-Check: Rückmeldung mit Kommentar je Kapitel zurück an die PL (UC-002 A5)', async () => {
    const { v, etag } = await eingereicht(projekt.a);
    versionA = v;
    const vorher = await pruefung('ue', v);
    assert.deepEqual([vorher.body.stand, vorher.body.can.qualityCheck, vorher.body.unterzeichnung, vorher.body.qualityChecks], ['in_pruefung', true, null, []]);
    assert.equal((await pruefung('pl', v)).body.can.qualityCheck, false);

    assert.equal((await call('pl', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': etag })).statusCode, 403, 'nur vertrag:review');
    assert.equal((await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'rueckmeldung' }, { 'if-match': etag })).statusCode, 422, 'Rückmeldung ohne Kommentar');
    assert.equal((await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'rueckmeldung', kommentare: [{ kapitel: 7, text: 'a' }, { kapitel: 7, text: 'b' }] },
      { 'if-match': etag })).statusCode, 422, 'Kapitel doppelt');
    assert.equal((await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' })).statusCode, 428);
    assert.equal((await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': 'W/"99"' })).statusCode, 412);

    const r = await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`,
      { ergebnis: 'rueckmeldung', kommentare: [{ kapitel: 9, text: ' Personal in FTE fehlt ' }, { kapitel: 7, text: 'Meilensteine P1 ergänzen' }] }, { 'if-match': etag });
    assert.equal(r.statusCode, 200, r.body);
    const b = r.json();
    assert.equal(b.stand, 'in_arbeit');
    assert.deepEqual(b.qualityChecks[0].kommentare, [{ kapitel: 7, text: 'Meilensteine P1 ergänzen' }, { kapitel: 9, text: 'Personal in FTE fehlt' }]);
    assert.deepEqual([b.qualityChecks[0].ergebnis, b.qualityChecks[0].personId, b.unterzeichnung], ['rueckmeldung', id.ue, null]);
    assert.deepEqual((await aufgaben('vertrag.quality_check', v)).map(a => a.stand), ['erledigt']);
    const ueb = await aufgaben('vertrag.ueberarbeiten', v);
    assert.deepEqual(ueb.map(a => [a.person, a.stand]), [[id.pl, 'offen']]);
    assert.match(ueb[0]!.kontext, /Rückmeldung aus dem Quality-Check zu 2 Kapiteln/);
    // ein zweiter Check auf dieselbe Version ist erst nach erneutem Einreichen möglich
    assert.equal((await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': r.headers.etag as string })).statusCode, 409);
  });

  test('bestätigt: SP, PL und CTL erhalten je eine Unterzeichnungsaufgabe; alle drei unterzeichnen, CTL in Vertretung (A-31)', async () => {
    // Version aus dem ersten Test erneut einreichen
    const v = versionA;
    const g = await call('pl', 'GET', `/v1/vertragsversionen/${v}`);
    const e = await call('pl', 'POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': g.headers.etag as string });
    assert.equal(e.statusCode, 200, e.body);
    assert.deepEqual((await aufgaben('vertrag.ueberarbeiten', v)).map(a => a.stand), ['erledigt']);

    const q = await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': e.headers.etag as string });
    assert.equal(q.statusCode, 200, q.body);
    assert.deepEqual([q.json().stand, q.json().unterzeichnung.anzahl, q.json().unterzeichnung.vollstaendig], ['zur_unterzeichnung', 0, false]);
    assert.deepEqual(q.json().unterzeichnung.funktionen.map((f: { funktion: string; personen: string[] }) => [f.funktion, f.personen]),
      [['sp', [id.sp]], ['pl', [id.pl]], ['ctl', [id.ctl]]]);
    // Abnahme K2: nach «Quality-Check bestätigen» haben SP, PL und CTL je eine Unterzeichnungsaufgabe
    const ua = await aufgaben('vertrag.unterzeichnen', v);
    assert.deepEqual(ua.map(a => a.person).sort(), [id.sp, id.pl, id.ctl].sort());
    assert.ok(ua.every(a => a.stand === 'offen'));
    assert.ok(ua.some(a => a.person === id.sp && /als Sponsor/.test(a.kontext)));

    // Rechte: KT hat kein vertrag:sign; ohne Recht am Projekt 404
    assert.equal((await call('kt', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': q.headers.etag as string })).statusCode, 403);
    assert.equal((await call('ohneRecht', 'GET', `/v1/vertragsversionen/${v}/pruefung`)).statusCode, 404);

    let etag = q.headers.etag as string;
    const pl = await call('pl', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': etag });
    assert.equal(pl.statusCode, 200, pl.body);
    assert.deepEqual([pl.json().stand, pl.json().unterzeichnung.anzahl, pl.json().can.unterzeichnen], ['zur_unterzeichnung', 1, []]);
    assert.equal((await call('pl', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': etag })).statusCode, 412, 'alter Stand');
    etag = pl.headers.etag as string;
    assert.equal((await call('pl', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': etag })).statusCode, 409, 'schon unterzeichnet');

    const sp = await call('sp', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': etag });
    assert.equal(sp.statusCode, 200, sp.body);
    etag = sp.headers.etag as string;
    assert.deepEqual((await aufgaben('vertrag.unterzeichnen', v)).filter(a => a.stand === 'offen').map(a => a.person), [id.ctl]);

    // Stellvertretung der CTL ohne Recht auf Unterschriften: die Vertretung kann nicht unterzeichnen
    const s1 = await call('ctl', 'POST', '/v1/stellvertretungen', { vertreter: id.vertretung, von: heute(), bis: heute(3) });
    assert.equal(s1.statusCode, 201, s1.body);
    assert.deepEqual((await pruefung('vertretung', v)).body.can.unterzeichnen, []);
    assert.equal((await call('vertretung', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': etag })).statusCode, 409);
    assert.equal((await call('ctl', 'DELETE', `/v1/stellvertretungen/${s1.json().id}`)).statusCode, 204);
    // … mit ausdrücklichem Recht auf Unterschriften schon, mit Vermerk «in Vertretung von»
    const s2 = await call('ctl', 'POST', '/v1/stellvertretungen', { vertreter: id.vertretung, von: heute(), bis: heute(3), unterschriften: true });
    assert.equal(s2.statusCode, 201, s2.body);
    assert.deepEqual((await pruefung('vertretung', v)).body.can.unterzeichnen, [{ funktion: 'ctl', inVertretungVon: id.ctl }]);
    const ctl = await call('vertretung', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': etag });
    assert.equal(ctl.statusCode, 200, ctl.body);
    const u = ctl.json().unterzeichnung;
    assert.deepEqual([ctl.json().stand, u.anzahl, u.vollstaendig], ['unterzeichnet', 3, true]);
    assert.deepEqual(u.funktionen.map((f: { funktion: string; unterschrift: { personId: string; inVertretungVon: string | null } }) =>
      [f.funktion, f.unterschrift.personId, f.unterschrift.inVertretungVon]), [['sp', id.sp, null], ['pl', id.pl, null], ['ctl', id.vertretung, id.ctl]]);
    assert.deepEqual((await aufgaben('vertrag.unterzeichnen', v)).map(a => a.stand), ['erledigt', 'erledigt', 'erledigt']);
    assert.deepEqual(unterzeichnet, ['2026-001:0.1:unterzeichnet'], 'registriertes Verhalten nach der letzten Unterschrift');

    const audit = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string; actor_id: string }>(
      "SELECT action, actor_id FROM ppm.audit_log WHERE resource_id = $1 AND action LIKE 'vertrag.%' ORDER BY id", [v])).rows);
    assert.deepEqual(audit.map(a => a.action), [
      'vertrag.drafted', 'vertrag.submitted', 'vertrag.review_returned', 'vertrag.submitted', 'vertrag.review_confirmed', 'vertrag.signed', 'vertrag.signed', 'vertrag.signed',
    ]);
    assert.deepEqual(audit.filter(a => a.action === 'vertrag.signed').map(a => a.actor_id), [id.pl, id.sp, id.vertretung]);
  });

  test('verweigert: Begründung Pflicht, Durchgang endet, PL erhält die Begründung im Eingang (UC-003 A5)', async () => {
    const { v, etag } = await eingereicht(projekt.b);
    const q = await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': etag });
    assert.equal(q.statusCode, 200, q.body);
    const pl = await call('pl', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': q.headers.etag as string });
    assert.equal(pl.statusCode, 200, pl.body);
    const e = pl.headers.etag as string;
    assert.equal((await call('ctl', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'verweigert', begruendung: '  ' }, { 'if-match': e })).statusCode, 422);
    const r = await call('ctl', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'verweigert', begruendung: 'Kosten P1 ohne Offerte' }, { 'if-match': e });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().stand, 'in_arbeit');
    assert.deepEqual(r.json().unterzeichnung.funktionen.find((f: { funktion: string }) => f.funktion === 'ctl').unterschrift,
      { ...r.json().unterzeichnung.funktionen.find((f: { funktion: string }) => f.funktion === 'ctl').unterschrift, ergebnis: 'verweigert', begruendung: 'Kosten P1 ohne Offerte' });
    // übrige Unterzeichnungen entfallen; die PL überarbeitet mit der Begründung
    const ua = await aufgaben('vertrag.unterzeichnen', v);
    assert.deepEqual(ua.map(a => [a.person === id.pl ? 'pl' : a.person === id.ctl ? 'ctl' : 'sp', a.stand]).sort(), [['ctl', 'erledigt'], ['pl', 'erledigt'], ['sp', 'entfallen']]);
    const ueb = await aufgaben('vertrag.ueberarbeiten', v);
    assert.deepEqual(ueb.map(a => [a.person, a.stand]), [[id.pl, 'offen']]);
    assert.match(ueb[0]!.kontext, /nicht unterzeichnet von .*: Kosten P1 ohne Offerte/);
    // der Sponsor kann nach dem Ende des Durchgangs nicht mehr unterzeichnen
    assert.equal((await call('sp', 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': r.headers.etag as string })).statusCode, 409);
  });

  test('ohne CTL in der Projektorganisation ist «bestätigt» gesperrt (409), Rückmeldung bleibt möglich', async () => {
    const { v, etag } = await eingereicht(projekt.ohne);
    const r = await call('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': etag });
    assert.equal(r.statusCode, 409, r.body);
    assert.match(r.json().detail, /Es fehlt CTL/);
    assert.deepEqual(r.json().fehlend, ['ctl']);
    assert.equal((await pruefung('ue', v)).body.stand, 'in_pruefung', 'nichts geändert');
  });
});
