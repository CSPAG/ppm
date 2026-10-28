/**
 * Eingang (BC AM.01.03, UC-016 Schritt 4, UX-E3; Fachmodell 4): Schnittstelle für die Fachmodule (öffnen idempotent,
 * erledigen, entfallen), «Zu tun» nach Frist, Aufgaben an ein Recht, von Hand erledigen, Mitteilungen, Stellvertretung
 * (Aufgabe einer Person sieht die Vertretung, befristete Tupel, künftiger Zeitraum über den Job) und Lesesicht.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { aufgabe, mitteilung, stellvertretung } from '../../src/modules/eingang/index.ts';
import { platform } from '../../src/platform.ts';
import { full, skipDb } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

const tag = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(d);
};

describe('Eingang', { skip }, () => {
  let api: TestApi;
  let tenantId: string;
  type P = { h: Record<string, string>; id: string };
  let anna: P, beat: P, cora: P, gl: P, ohne: P;

  before(async () => {
    api = await testApi();
    const mk = async (sub: string, role: string | null) => { const l = await login(api, 'demo', sub, role); tenantId = l.tenantId; return { h: { authorization: l.authorization }, id: l.principalId }; };
    anna = await mk('u-anna', 'leser');
    beat = await mk('u-beat', 'leser');
    cora = await mk('u-cora', 'leser');
    gl = await mk('u-gl', 'gl');
    ohne = await mk('u-ohne', null);
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);
  const titel = async (p: P, q = '') => (await call('GET', `/v1/eingang${q}`, p.h)).json().items.map((a: { titel: string }) => a.titel);

  test('Aufgabe an eine Person: nur sie sieht sie; öffnen ist idempotent und führt Titel und Frist nach', async () => {
    const bezug = { typ: 'periode', id: '2026-10' };
    const id1 = await sys(tx => aufgabe.oeffnen(tx, { art: 'statusbericht.erstellen', bezug, empfaenger: { person: anna.id }, titel: 'Statusbericht Oktober erstellen', link: '/projekte/2026-014/bericht', frist: { datum: tag(3), art: 'kalendertage' } }));
    const id2 = await sys(tx => aufgabe.oeffnen(tx, { art: 'statusbericht.erstellen', bezug, empfaenger: { person: anna.id }, titel: 'Statusbericht Oktober erstellen · Erinnerung', kontext: '2026-014 · als PL', link: '/projekte/2026-014/bericht', frist: { datum: tag(2), art: 'kalendertage' } }));
    assert.equal(id1, id2);
    const r = await call('GET', '/v1/eingang', anna.h);
    assert.equal(r.statusCode, 200, r.body);
    const [a] = r.json().items;
    assert.deepEqual([a.titel, a.kontext, a.frist, a.fristArt, a.empfaenger, a.vertretung, a.can.erledigen], ['Statusbericht Oktober erstellen · Erinnerung', '2026-014 · als PL', tag(2), 'kalendertage', 'person', null, false]);
    assert.deepEqual(await titel(beat), []);
    assert.equal((await call('GET', '/v1/eingang', ohne.h)).statusCode, 403);

    assert.equal(await sys(tx => aufgabe.erledigen(tx, { art: 'statusbericht.erstellen', bezug })), 1);
    assert.deepEqual(await titel(anna), []);
    // nach dem Erledigen entsteht beim nächsten Öffnen eine neue Aufgabe
    const id3 = await sys(tx => aufgabe.oeffnen(tx, { art: 'statusbericht.erstellen', bezug, empfaenger: { person: anna.id }, titel: 'Neu', link: '/x' }));
    assert.notEqual(id3, id1);
    assert.equal(await sys(tx => aufgabe.entfallen(tx, { art: 'statusbericht.erstellen', bezug, empfaenger: { person: anna.id } })), 1);
  });

  test('Aufgabe an ein Recht: alle mit dem Recht sehen sie, andere nicht; Schliessen auch ohne Sicht', async () => {
    const bezug = { typ: 'handlungsfeld', id: 'probe' };
    await sys(tx => aufgabe.oeffnen(tx, { art: 'handlungsfeld.pruefen', bezug, empfaenger: { recht: 'handlungsfeld:write' }, titel: 'Handlungsfeld prüfen', link: '/ziele/handlungsfelder' }));
    assert.deepEqual(await titel(gl), ['Handlungsfeld prüfen']);
    assert.deepEqual(await titel(anna), []);
    // Anna (ohne Recht) schliesst in ihrer Anfrage die Aufgabe der GL (z. B. Zurückziehen)
    const n = await full(api.t.runtime, tenantId, tx => aufgabe.erledigen(tx, { art: 'handlungsfeld.pruefen', bezug }));
    assert.equal(n, 1);
    assert.deepEqual(await titel(gl), []);
  });

  test('«Zu tun» nach Frist (ohne Frist zuletzt), Filter frist, Cursor, Anzahl', async () => {
    const o = (t: string, frist: number | null) => sys(tx => aufgabe.oeffnen(tx, {
      art: 'probe.sortieren', bezug: { typ: 'probe', id: t }, empfaenger: { person: cora.id }, titel: t, link: '/eingang',
      frist: frist === null ? null : { datum: tag(frist), art: 'arbeitstage' },
    }));
    await o('ohne Frist', null);
    await o('in 5 Tagen', 5);
    await o('überfällig', -2);
    await o('morgen', 1);
    assert.deepEqual(await titel(cora), ['überfällig', 'morgen', 'in 5 Tagen', 'ohne Frist']);
    assert.deepEqual(await titel(cora, '?filter=frist'), ['überfällig', 'morgen', 'in 5 Tagen']);
    const p1 = (await call('GET', '/v1/eingang?limit=2', cora.h)).json();
    assert.equal(p1.items.length, 2);
    const p2 = (await call('GET', `/v1/eingang?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`, cora.h)).json();
    assert.deepEqual(p2.items.map((a: { titel: string }) => a.titel), ['in 5 Tagen', 'ohne Frist']);
    assert.equal(p2.nextCursor, null);
    const bad = await call('GET', `/v1/eingang?filter=frist&cursor=${encodeURIComponent(p1.nextCursor)}`, cora.h);
    assert.equal(bad.statusCode, 422);
    const n = await call('GET', '/v1/eingang/anzahl', cora.h);
    assert.deepEqual(n.json(), { offen: 4, ueberfaellig: 1, naechsteFrist: tag(1) });
    for (const t of ['ohne Frist', 'in 5 Tagen', 'überfällig', 'morgen']) await sys(tx => aufgabe.erledigen(tx, { art: 'probe.sortieren', bezug: { typ: 'probe', id: t } }));
  });

  test('von Hand erledigen nur bei manuellen Aufgaben, nur eigene', async () => {
    const m = await sys(tx => aufgabe.oeffnen(tx, { art: 'sitzung.lesen', bezug: { typ: 'sitzung', id: 's1' }, empfaenger: { person: anna.id }, titel: 'Unterlagen lesen', link: '/gremien/prat', manuell: true }));
    const f = await sys(tx => aufgabe.oeffnen(tx, { art: 'vertrag.unterzeichnen', bezug: { typ: 'vertrag_version', id: 'v1' }, empfaenger: { person: anna.id }, titel: 'Vertrag unterzeichnen', link: '/projekte/x' }));
    assert.equal((await call('POST', `/v1/eingang/aufgaben/${m}/erledigen`, beat.h)).statusCode, 404);
    const no = await call('POST', `/v1/eingang/aufgaben/${f}/erledigen`, anna.h);
    assert.equal(no.statusCode, 409);
    assert.match(no.headers['content-type'] as string, /application\/problem\+json/);
    const ok = await call('POST', `/v1/eingang/aufgaben/${m}/erledigen`, anna.h);
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual(await titel(anna), ['Vertrag unterzeichnen']);
    assert.equal((await call('POST', `/v1/eingang/aufgaben/${m}/erledigen`, anna.h)).statusCode, 404);
    const audit = await sys(tx => tx.query("SELECT action FROM ppm.audit_log WHERE action = 'aufgabe.completed' AND resource_id = $1", [m]));
    assert.equal(audit.rowCount, 1);
    await sys(tx => aufgabe.entfallen(tx, { art: 'vertrag.unterzeichnen', bezug: { typ: 'vertrag_version', id: 'v1' } }));
  });

  test('Mitteilungen: nur an die Empfängerin, gelesen markieren', async () => {
    const id = await sys(tx => mitteilung.senden(tx, { an: anna.id, bezug: { typ: 'idee', id: '7' }, text: 'Deine Idee wurde zurückgewiesen.', link: '/portfolio/ideen' }));
    const r = (await call('GET', '/v1/mitteilungen', anna.h)).json();
    assert.equal(r.ungelesen, 1);
    assert.equal(r.items[0].text, 'Deine Idee wurde zurückgewiesen.');
    assert.deepEqual((await call('GET', '/v1/mitteilungen', beat.h)).json().items, []);
    assert.equal((await call('POST', `/v1/mitteilungen/${id}/gelesen`, beat.h)).statusCode, 404);
    assert.equal((await call('POST', `/v1/mitteilungen/${id}/gelesen`, anna.h)).statusCode, 204);
    assert.equal((await call('POST', `/v1/mitteilungen/${id}/gelesen`, anna.h)).statusCode, 204);
    const u = (await call('GET', '/v1/mitteilungen?ungelesen=true', anna.h)).json();
    assert.deepEqual([u.ungelesen, u.items.length], [0, 0]);
  });

  test('Stellvertretung: die Vertretung sieht im Zeitraum die Aufgaben der Person, mit Vermerk; Ende entzieht sie', async () => {
    const bezug = { typ: 'vertrag_version', id: 'v-stv' };
    await sys(tx => aufgabe.oeffnen(tx, { art: 'vertrag.unterzeichnen', bezug, empfaenger: { person: anna.id }, titel: 'Projektvertrag unterzeichnen', link: '/projekte/2026-014/vertrag' }));
    const c = await call('POST', '/v1/stellvertretungen', anna.h, { vertreter: beat.id, von: tag(0), bis: tag(7) });
    assert.equal(c.statusCode, 201, c.body);
    const s = c.json();
    assert.deepEqual([s.vertreter.id, s.vertretene.id, s.aktiv, s.unterschriften, s.richtung, s.can.beenden], [beat.id, anna.id, true, false, 'eigene', true]);

    const b = (await call('GET', '/v1/eingang', beat.h)).json().items;
    assert.equal(b.length, 1);
    assert.deepEqual([b[0].titel, b[0].vertretung.person.id, b[0].vertretung.bis], ['Projektvertrag unterzeichnen', anna.id, tag(7)]);
    assert.equal((await call('GET', '/v1/eingang/anzahl', beat.h)).json().offen, 1);
    assert.deepEqual(await titel(cora), []);
    // die Vertretung erhält eine Mitteilung mit Link auf die Stellvertretung
    const m = (await call('GET', '/v1/mitteilungen', beat.h)).json().items;
    assert.match(m[0].text, /hat dich als Stellvertretung erfasst/);
    assert.equal(m[0].link, '/konto/stellvertretung');
    // beide sehen die Stellvertretung, beenden nur die vertretene Person
    const lb = (await call('GET', '/v1/stellvertretungen', beat.h)).json().items;
    assert.deepEqual([lb.length, lb[0].richtung, lb[0].can.beenden], [1, 'fuer_andere', false]);
    assert.deepEqual((await call('GET', '/v1/stellvertretungen', cora.h)).json().items, []);
    // Schnittstelle für die Fachmodule (Unterschriften nur mit ausdrücklichem Recht, A-31)
    const a = await sys(tx => stellvertretung.aktiv(tx, { vertretene: anna.id, vertreter: beat.id }));
    assert.deepEqual([a?.id, a?.unterschriften], [s.id, false]);
    assert.equal(await sys(tx => stellvertretung.aktiv(tx, { vertretene: anna.id, vertreter: cora.id })), null);
    assert.deepEqual(await sys(tx => stellvertretung.vertretene(tx, beat.id)), [{ person: anna.id, bis: tag(7), unterschriften: false }]);

    assert.equal((await call('DELETE', `/v1/stellvertretungen/${s.id}`, beat.h)).statusCode, 404);
    assert.equal((await call('DELETE', `/v1/stellvertretungen/${s.id}`, anna.h)).statusCode, 204);
    assert.deepEqual(await titel(beat), []);
    const audit = await sys(tx => tx.query("SELECT action FROM ppm.audit_log WHERE resource_id = $1 ORDER BY id", [s.id]));
    assert.deepEqual(audit.rows.map(r => r.action), ['stellvertretung.created', 'stellvertretung.deleted']);
    await sys(tx => aufgabe.entfallen(tx, { art: 'vertrag.unterzeichnen', bezug }));
  });

  test('Stellvertretung in der Zukunft: noch keine Sicht, Job zum Beginn eingereiht', async () => {
    await sys(tx => aufgabe.oeffnen(tx, { art: 'probe.zukunft', bezug: { typ: 'probe', id: 'z' }, empfaenger: { person: cora.id }, titel: 'Zukunft', link: '/eingang' }));
    const c = await call('POST', '/v1/stellvertretungen', cora.h, { vertreter: anna.id, von: tag(3), bis: tag(5), unterschriften: true });
    assert.equal(c.statusCode, 201, c.body);
    assert.equal(c.json().aktiv, false);
    assert.deepEqual(await titel(anna), []);
    const job = await sys(tx => tx.query<{ run_at: Date }>("SELECT run_at FROM ppm.job WHERE kind = 'eingang.stellvertretung_aktivieren' AND payload->>'id' = $1", [c.json().id]));
    assert.equal(job.rowCount, 1);
    assert.ok(job.rows[0]!.run_at.getTime() > Date.now() + 86_400_000);
    assert.equal((await call('DELETE', `/v1/stellvertretungen/${c.json().id}`, cora.h)).statusCode, 204);
  });

  test('Stellvertretung prüft Eingaben', async () => {
    const bad = async (body: unknown) => (await call('POST', '/v1/stellvertretungen', anna.h, body)).statusCode;
    assert.equal(await bad({ vertreter: anna.id, von: tag(0), bis: tag(1) }), 422);
    assert.equal(await bad({ vertreter: beat.id, von: tag(2), bis: tag(1) }), 422);
    assert.equal(await bad({ vertreter: beat.id, von: tag(-5), bis: tag(-1) }), 422);
    assert.equal(await bad({ vertreter: '00000000-0000-4000-8000-000000000000', von: tag(0), bis: tag(1) }), 422);
    assert.equal(await bad({ vertreter: beat.id, von: tag(0) }), 422);
  });

  test('befristete Tupel: Rollen der Person an Portfolio und Projekt, nicht an der Organisation', { skip: !platform.model.types.has('projekt') && 'Typ projekt kommt mit AP-E0-1' }, async () => {
    const projekt = '11111111-1111-4111-8111-111111111111';
    const role = platform.model.relationsAt('projekt')[0]!;
    await grant(api, tenantId, `user:${anna.id}`, role, { type: 'projekt', id: projekt });
    const c = await call('POST', '/v1/stellvertretungen', anna.h, { vertreter: cora.id, von: tag(0), bis: tag(2) });
    assert.equal(c.statusCode, 201, c.body);
    const t = await sys(tx => tx.query<{ relation: string; object_type: string; expires_at: Date | null }>(
      'SELECT relation, object_type, expires_at FROM ppm.authz_tuple WHERE subject = $1', [`user:${cora.id}`]));
    const p = t.rows.filter(r => r.object_type === 'projekt');
    assert.equal(p.length, 1);
    assert.equal(p[0]!.relation, role);
    assert.ok(p[0]!.expires_at && p[0]!.expires_at.getTime() > Date.now() + 2 * 86_400_000);
    assert.ok(t.rows.every(r => r.object_type !== 'org' || r.relation === 'leser'));
    assert.equal((await call('DELETE', `/v1/stellvertretungen/${c.json().id}`, anna.h)).statusCode, 204);
    const nach = await sys(tx => tx.query("SELECT 1 FROM ppm.authz_tuple WHERE subject = $1 AND object_type = 'projekt'", [`user:${cora.id}`]));
    assert.equal(nach.rowCount, 0);
  });

  test('nur Projektrolle: Eingang und Aufgaben an das Recht am Projekt', async () => {
    const projekt = '22222222-2222-4222-8222-222222222222';
    const pl = await login(api, 'demo', 'u-nur-pl', null);
    await grant(api, tenantId, `user:${pl.principalId}`, 'pl', { type: 'projekt', id: projekt });
    const h = { authorization: pl.authorization };
    await sys(tx => aufgabe.oeffnen(tx, { art: 'kpi.erfassen', bezug: { typ: 'projekt', id: projekt }, empfaenger: { recht: 'kpi:write', ort: { typ: 'projekt', id: projekt } }, titel: 'KPI-Werte erfassen', link: '/projekte' }));
    await sys(tx => aufgabe.oeffnen(tx, { art: 'kpi.erfassen', bezug: { typ: 'projekt', id: 'anderes' }, empfaenger: { recht: 'kpi:write', ort: { typ: 'projekt', id: '33333333-3333-4333-8333-333333333333' } }, titel: 'Anderes Projekt', link: '/projekte' }));
    const r = await call('GET', '/v1/eingang', h);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json().items.map((a: { titel: string }) => a.titel), ['KPI-Werte erfassen']);
    assert.equal((await call('GET', '/v1/stellvertretungen', h)).statusCode, 200);
    await sys(tx => aufgabe.entfallen(tx, { art: 'kpi.erfassen', bezug: { typ: 'projekt', id: projekt } }));
    await sys(tx => aufgabe.entfallen(tx, { art: 'kpi.erfassen', bezug: { typ: 'projekt', id: 'anderes' } }));
  });

  test('Lesesicht: ohne das Modul kein Schreiben in Aufgaben und Mitteilungen', async () => {
    const id = await sys(tx => aufgabe.oeffnen(tx, { art: 'probe.rls', bezug: { typ: 'probe', id: 'r' }, empfaenger: { person: anna.id }, titel: 'RLS', link: '/eingang' }));
    await assert.rejects(sys(tx => tx.query("UPDATE ppm.aufgabe SET titel = 'x' WHERE id = $1 RETURNING id", [id]).then(r => { if (!r.rowCount) throw new Error('keine Zeile'); })));
    await assert.rejects(sys(tx => tx.query("INSERT INTO ppm.aufgabe (tenant_id, art, bezug_typ, bezug_id, empfaenger_person, titel, link) VALUES (app.tenant_id(), 'probe.x', 'probe', 'x', $1, 'x', '/x')", [anna.id])));
    await assert.rejects(sys(tx => tx.query("INSERT INTO ppm.mitteilung (tenant_id, empfaenger_person, bezug_typ, bezug_id, text) VALUES (app.tenant_id(), $1, 'probe', 'x', 'x')", [anna.id])));
    await sys(tx => aufgabe.erledigen(tx, { art: 'probe.rls', bezug: { typ: 'probe', id: 'r' } }));
  });
});
