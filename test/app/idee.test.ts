/**
 * Projektidee einreichen (BC DM.01.01; UC-001 Schritte 1–2, A2.2; Kernablauf K4; AP-E4-1): Entwurf mit laufender
 * Nummer und Vorbelegung, Auswahl des Strategiebezugs ohne Leserecht auf Ziele, Pflichtfelder beim Einreichen,
 * Prüfaufgabe der UE im Eingang, Stand für Antragstellende, Rückfragen beantworten und erneut einreichen, Lesesicht.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { aufgabe } from '../../src/modules/eingang/index.ts';
import { full, skipDb } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

type H = Record<string, string>;

describe('Projektidee einreichen', { skip }, () => {
  let api: TestApi;
  let tenantId = '';
  let as1: H, as2: H, ue: H, gl: H, leser: H, nobody: H;
  let as1Id = '';
  let feld1 = '', feld2 = '', ziel1 = '', ziel2 = '', bereich = '';

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const mit = (h: H, version: number): H => ({ ...h, 'if-match': `W/"${version}"` });

  const vollstaendig = () => ({
    titel: 'Digitale Patientenaufnahme', ausgangslage: 'Aufnahme auf Papier, doppelte Erfassung.', zielsetzung: 'Aufnahme ohne Papier in 10 Minuten.',
    handlungsfeldId: feld1, strategischesZielId: ziel1, bereiche: [bereich],
    nutzen: 'hoch', nutzenText: 'Weniger Doppelerfassung.', aufwand: 'mittel', aufwandText: '', relevanz: 'hoch', relevanzText: '', herkunft: 'bereich',
  });

  before(async () => {
    api = await testApi();
    const a = await login(api, 'demo', 'u-as1', 'antragsteller');
    tenantId = a.tenantId;
    as1Id = a.principalId;
    as1 = { authorization: a.authorization };
    as2 = { authorization: (await login(api, 'demo', 'u-as2', 'antragsteller')).authorization };
    ue = { authorization: (await login(api, 'demo', 'u-ue', 'ue')).authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'gl')).authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser', 'leser')).authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
    const admin = { authorization: (await login(api, 'demo', 'u-admin', 'org-admin')).authorization };
    feld1 = (await call('POST', '/v1/handlungsfelder', gl, { label: 'Patientenorientierung', leitsatz: 'Der Mensch im Mittelpunkt.', position: 1 })).json().id;
    feld2 = (await call('POST', '/v1/handlungsfelder', gl, { label: 'Wirtschaftlichkeit', position: 2 })).json().id;
    ziel1 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld1, nummer: '1.1', text: 'Zugang verbessern' })).json().id;
    ziel2 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld2, nummer: '2.1', text: 'Kosten senken' })).json().id;
    assert.equal((await call('POST', '/v1/codetabellen/vorgabe', admin, {})).statusCode < 300, true);
    const b = await call('POST', '/v1/org-einheiten', admin, { kuerzel: 'DPF', name: 'Pflege', art: 'direktion' });
    assert.equal(b.statusCode, 201, b.body);
    bereich = b.json().id;
  });
  after(async () => { await api?.close(); });

  test('Auswahl für den Assistenten: Handlungsfelder mit Leitsatz und Zielen, Bereiche, Herkunft – ohne Leserecht auf Ziele', async () => {
    assert.equal((await call('GET', '/v1/strategische-ziele', as1)).statusCode, 403, 'Antragstellende lesen Ziele nicht direkt');
    const r = await call('GET', '/v1/ideen/auswahl', as1);
    assert.equal(r.statusCode, 200, r.body);
    const a = r.json();
    assert.deepEqual(a.handlungsfelder.map((f: { label: string; leitsatz: string; ziele: { nummer: string }[] }) => [f.label, f.leitsatz, f.ziele.map(z => z.nummer)]),
      [['Patientenorientierung', 'Der Mensch im Mittelpunkt.', ['1.1']], ['Wirtschaftlichkeit', '', ['2.1']]]);
    assert.deepEqual(a.bereiche.map((x: { kuerzel: string }) => x.kuerzel), ['DPF']);
    assert.deepEqual(a.herkunft.map((x: { schluessel: string }) => x.schluessel), ['innovationsprozess', 'strategieprozess', 'bereich']);
    // Pool und Prüfung (idee:read ohne idee:create) brauchen dieselben Bezeichnungen
    assert.equal((await call('GET', '/v1/ideen/auswahl', ue)).statusCode, 200);
    assert.equal((await call('GET', '/v1/ideen/auswahl', nobody)).statusCode, 403);
  });

  test('Entwurf mit Vorbelegung, laufender Nummer und ETag; Ziel ergänzt das Handlungsfeld; Bezüge geprüft', async () => {
    const c = await call('POST', '/v1/ideen', as1, { strategischesZielId: ziel1, herkunft: 'strategieprozess' });
    assert.equal(c.statusCode, 201, c.body);
    const e = c.json();
    assert.deepEqual([e.stand, e.handlungsfeldId, e.strategischesZielId, e.herkunft, e.eigene, e.version], ['entwurf', feld1, ziel1, 'strategieprozess', true, 1]);
    assert.deepEqual(e.can, { bearbeiten: true, einreichen: true, loeschen: true });
    assert.equal(c.headers.location, `/v1/ideen/${e.id}`);
    const n2 = (await call('POST', '/v1/ideen', as2, {})).json().nummer;
    assert.equal(n2, e.nummer + 1, 'laufend über alle Personen der Organisation');

    assert.equal((await call('PATCH', `/v1/ideen/${e.id}`, as1, { titel: 'x' })).statusCode, 428);
    const p = await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, 1), { titel: '  Neue Aufnahme ', bereiche: [bereich] });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().titel, p.json().bereiche, p.json().version], ['Neue Aufnahme', [bereich], 2]);
    assert.equal((await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, 1), { titel: 'alt' })).statusCode, 412);

    const fehler = async (body: unknown) => {
      const r = await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, 2), body);
      assert.equal(r.statusCode, 422, r.body);
      return r.json().errors.map((x: { path: string }) => x.path);
    };
    assert.deepEqual(await fehler({ strategischesZielId: ziel2 }), ['/strategischesZielId'], 'Ziel eines anderen Handlungsfelds');
    assert.deepEqual(await fehler({ bereiche: [randomUUID()] }), ['/bereiche']);
    assert.deepEqual(await fehler({ herkunft: 'erfunden' }), ['/herkunft']);
    assert.deepEqual(await fehler({ handlungsfeldId: randomUUID(), strategischesZielId: null }), ['/handlungsfeldId']);
    const fremd = (await call('POST', '/v1/handlungsfelder', { authorization: (await login(api, 'andere', 'u-gl-andere', 'gl')).authorization }, { label: 'Fremd' })).json().id;
    assert.deepEqual(await fehler({ handlungsfeldId: fremd, strategischesZielId: null }), ['/handlungsfeldId'], 'Handlungsfeld einer anderen Organisation wie unbekannt');
    assert.equal((await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, 2), { farbe: 'rot' })).statusCode, 422, 'unbekannte Felder');

    // Entwurf sieht nur, wer ihn erfasst hat
    assert.equal((await call('GET', `/v1/ideen/${e.id}`, ue)).statusCode, 404);
    assert.equal((await call('GET', `/v1/ideen/${e.id}`, as2)).statusCode, 404);
    assert.equal((await call('PATCH', `/v1/ideen/${e.id}`, mit(as2, 2), { titel: 'fremd' })).statusCode, 404);
  });

  test('Einreichen: Pflichtfelder als Sperre mit allen fehlenden Feldern, dann Ideenpool und Prüfaufgabe der UE', async () => {
    const e = (await call('POST', '/v1/ideen', as1, { titel: 'Nur ein Titel' })).json();
    const leer = await call('POST', `/v1/ideen/${e.id}/einreichen`, mit(as1, 1));
    assert.equal(leer.statusCode, 422, leer.body);
    assert.equal(leer.headers['content-type'], 'application/problem+json; charset=utf-8');
    const pfade = leer.json().errors.map((x: { path: string }) => x.path);
    assert.deepEqual(pfade, ['/ausgangslage', '/zielsetzung', '/handlungsfeldId', '/nutzen', '/aufwand', '/relevanz']);
    assert.match(leer.json().errors[1].message, /^Zielsetzung fehlt: Ohne Ziel kann die Unternehmensentwicklung/);

    const { titel: _t, ...rest } = vollstaendig();
    const p = await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, 1), rest);
    assert.equal(p.statusCode, 200, p.body);
    const r = await call('POST', `/v1/ideen/${e.id}/einreichen`, mit(as1, 2));
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().stand, r.json().can], ['eingereicht', { bearbeiten: false, einreichen: false, loeschen: false }]);
    assert.ok(r.json().eingereichtAt);

    // UE: Prüfaufgabe im Eingang mit Link auf die Idee (UC-001 Schritt 2, K4 Abnahme)
    const zuTun = (await call('GET', '/v1/eingang', ue)).json().items as { art: string; titel: string; link: string; bezug: { id: string } }[];
    const pruefen = zuTun.filter(x => x.art === 'idee.pruefen' && x.bezug.id === e.id);
    assert.equal(pruefen.length, 1);
    assert.deepEqual([pruefen[0]!.titel, pruefen[0]!.link], ['Projektidee prüfen · Nur ein Titel', `/portfolio/ideen/${e.nummer}`]);
    assert.ok(!(await call('GET', '/v1/eingang', as1)).json().items.some((x: { art: string }) => x.art === 'idee.pruefen'), 'nicht bei Antragstellenden');

    // Ideenpool (idee:read) sieht die eingereichte Idee, andere Antragstellende nicht; AS sieht sie als «eingereicht»
    assert.equal((await call('GET', `/v1/ideen/${e.id}`, ue)).json().eigene, false);
    assert.equal((await call('GET', `/v1/ideen/${e.id}`, as2)).statusCode, 404);
    const meine = (await call('GET', '/v1/ideen?eigene=true', as1)).json().items as { id: string; stand: string }[];
    assert.equal(meine.find(x => x.id === e.id)?.stand, 'eingereicht');
    assert.ok((await call('GET', '/v1/ideen', as2)).json().items.every((x: { eigene: boolean }) => x.eigene), 'nur eigene');

    // nach dem Einreichen nicht mehr änderbar, nicht verwerfbar, nicht erneut einreichbar
    assert.equal((await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, 3), { titel: 'später' })).statusCode, 409);
    assert.equal((await call('DELETE', `/v1/ideen/${e.id}`, mit(as1, 3))).statusCode, 409);
    assert.equal((await call('POST', `/v1/ideen/${e.id}/einreichen`, mit(as1, 3))).statusCode, 409);
  });

  test('Rückfragen beantworten und erneut einreichen (UC-001 A2.2): Aufgabe «ergänzen» erledigt, Prüfaufgabe wieder offen', async () => {
    const e = (await call('POST', '/v1/ideen', as1, vollstaendig())).json();
    assert.equal((await call('POST', `/v1/ideen/${e.id}/einreichen`, mit(as1, 1))).statusCode, 200);
    // Rückfrage der UE (Route mit AP-E4-2): Stand, Rückfrage und Aufgaben wie dort vorgesehen
    const ueId = (await login(api, 'demo', 'u-ue', 'ue')).principalId;
    const frage = await full(api.t.runtime, tenantId, async tx => {
      await tx.query("UPDATE ppm.idee SET stand = 'in_ergaenzung' WHERE id = $1", [e.id]);
      const id = (await tx.query<{ id: string }>("INSERT INTO ppm.idee_rueckfrage (tenant_id, idee_id, feld, text, gestellt_von) VALUES ($1, $2, 'zielsetzung', 'Woran messen Sie den Erfolg?', $3) RETURNING id", [tenantId, e.id, ueId])).rows[0]!.id;
      await aufgabe.erledigen(tx, { art: 'idee.pruefen', bezug: { typ: 'idee', id: e.id } });
      await aufgabe.oeffnen(tx, { art: 'idee.ergaenzen', bezug: { typ: 'idee', id: e.id }, empfaenger: { person: as1Id }, titel: 'Rückfragen zu Ihrer Idee beantworten', link: `/portfolio/ideen/${e.nummer}/bearbeiten` });
      return id;
    });
    const g = (await call('GET', `/v1/ideen/${e.id}`, as1)).json();
    assert.deepEqual([g.stand, g.can.bearbeiten, g.rueckfragen.map((q: { feld: string; text: string; antwort: string | null }) => [q.feld, q.text, q.antwort])],
      ['in_ergaenzung', true, [['zielsetzung', 'Woran messen Sie den Erfolg?', null]]]);
    assert.equal((await call('GET', '/v1/ideen?eigene=true', as1)).json().items.find((x: { id: string }) => x.id === e.id).rueckfragenOffen, 1);

    assert.equal((await call('PUT', `/v1/ideen/${e.id}/rueckfragen/${frage}`, as2, { antwort: 'fremd' })).statusCode, 404);
    assert.equal((await call('PUT', `/v1/ideen/${e.id}/rueckfragen/${randomUUID()}`, as1, { antwort: 'x' })).statusCode, 404);
    const a = await call('PUT', `/v1/ideen/${e.id}/rueckfragen/${frage}`, as1, { antwort: ' Aufnahmezeit unter 10 Minuten. ' });
    assert.equal(a.statusCode, 200, a.body);
    assert.equal(a.json().antwort, 'Aufnahmezeit unter 10 Minuten.');
    const v = (await call('GET', `/v1/ideen/${e.id}`, as1)).json().version;
    assert.equal((await call('PATCH', `/v1/ideen/${e.id}`, mit(as1, v), { zielsetzung: 'Aufnahme ohne Papier, unter 10 Minuten.' })).statusCode, 200);

    const r = await call('POST', `/v1/ideen/${e.id}/einreichen`, mit(as1, v + 1));
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().stand, 'eingereicht');
    assert.ok(!(await call('GET', '/v1/eingang', as1)).json().items.some((x: { art: string; bezug: { id: string } }) => x.art === 'idee.ergaenzen' && x.bezug.id === e.id));
    assert.ok((await call('GET', '/v1/eingang', ue)).json().items.some((x: { art: string; bezug: { id: string } }) => x.art === 'idee.pruefen' && x.bezug.id === e.id));
    assert.equal((await call('PUT', `/v1/ideen/${e.id}/rueckfragen/${frage}`, as1, { antwort: 'zu spät' })).statusCode, 409);
  });

  test('Entwurf verwerfen; Kopf mit eigenen Ideen und Pool; Rechte', async () => {
    const e = (await call('POST', '/v1/ideen', as2, { titel: 'Verwerfen' })).json();
    assert.equal((await call('DELETE', `/v1/ideen/${e.id}`, mit(as2, 1))).statusCode, 204);
    assert.equal((await call('GET', `/v1/ideen/${e.id}`, as2)).statusCode, 404);

    const k = (await call('GET', '/v1/ideen/kopf', as1)).json();
    assert.equal(k.zuPruefen, null);
    assert.ok(k.eigene.entwurf >= 1 && k.eigene.laufend >= 2);
    assert.ok((await call('GET', '/v1/ideen/kopf', ue)).json().zuPruefen >= 2);

    assert.equal((await call('POST', '/v1/ideen', nobody, {})).statusCode, 403);
    assert.equal((await call('GET', '/v1/ideen', leser)).statusCode, 403);
    assert.equal((await call('POST', '/v1/ideen', ue, {})).statusCode, 403, 'UE ohne Rolle «antragsteller» erfasst nicht (A-46: alle Mitglieder)');
    assert.equal((await call('GET', '/v1/ideen?nummer=1', ue)).statusCode, 200);
  });
});
