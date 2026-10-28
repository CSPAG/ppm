/**
 * Ideenpool und Prüfung (BC DM.01.02–04, PP.02.04; UC-001 Schritte 3–5, A1–A3; Kernablauf K4; AP-E4-2): Pool ohne
 * Entwürfe und «wartet am längsten zuerst», Funnel, ähnliche Ideen nur für die UE (A-32), Leitfragen Eintritt P0 aus dem
 * Phasenmodell in Kraft, Raster mit Vorschlag, Kategorie mit Portfolio und Gremium, Rückfrage mit Aufgabe, Zurückweisen
 * mit Begründung und Mitteilung, Zusammenführen; Antragstellende sehen weder Raster noch Leitfragen (K4 Z8).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { grant, login, testApi, type TestApi } from './api.ts';
import { skipDb } from './harness.ts';

const skip = await skipDb();

type H = Record<string, string>;

describe('Ideenpool und Prüfung', { skip }, () => {
  let api: TestApi;
  let tenantId = '';
  let as1: H, as2: H, ue: H, adm: H, gremium: H;
  let as1Id = '', as2Id = '', gremiumId = '';
  let feld = '', bereich = '', portfolioA = '', portfolioC1 = '', portfolioC2 = '';

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const mit = (h: H, etag: string): H => ({ ...h, 'if-match': etag });

  /** Idee von `wer` anlegen und einreichen; liefert ID, Nummer und ETag nach dem Einreichen. */
  async function eingereicht(wer: H, titel: string, o: Record<string, unknown> = {}) {
    const c = await call('POST', '/v1/ideen', wer, {
      titel, ausgangslage: `${titel} heute`, zielsetzung: `${titel} morgen`, handlungsfeldId: feld, bereiche: [bereich],
      nutzen: 'hoch', aufwand: 'mittel', relevanz: 'hoch', ...o,
    });
    assert.equal(c.statusCode, 201, c.body);
    const r = await call('POST', `/v1/ideen/${c.json().id}/einreichen`, mit(wer, 'W/"1"'));
    assert.equal(r.statusCode, 200, r.body);
    return { id: c.json().id as string, nummer: c.json().nummer as number, etag: r.headers.etag as string };
  }
  const etagVon = async (id: string) => (await call('GET', `/v1/ideen/${id}/pruefung`, ue)).headers.etag as string;
  const mitteilungen = async (h: H) => (await call('GET', '/v1/mitteilungen', h)).json().items as { text: string }[];

  before(async () => {
    api = await testApi();
    const a = await login(api, 'demo', 'u-as1', 'antragsteller');
    tenantId = a.tenantId; as1Id = a.principalId; as1 = { authorization: a.authorization };
    const b = await login(api, 'demo', 'u-as2', 'antragsteller');
    as2Id = b.principalId; as2 = { authorization: b.authorization };
    ue = { authorization: (await login(api, 'demo', 'u-ue', 'ue')).authorization };
    adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    const g = await login(api, 'demo', 'u-gremium', null);
    gremiumId = g.principalId; gremium = { authorization: g.authorization };
    feld = (await call('POST', '/v1/handlungsfelder', adm, { label: 'Patientenorientierung' })).json().id;
    bereich = (await call('POST', '/v1/org-einheiten', adm, { kuerzel: 'DPF', name: 'Pflege', art: 'direktion' })).json().id;
    // Phasenmodell nach Vorgabe in Kraft (Leitfragen Eintritt P0)
    const pm = await call('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' });
    assert.equal(pm.statusCode, 201, pm.body);
    assert.equal((await call('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, mit(adm, pm.headers.etag as string))).statusCode, 200);
    // Portfolios A (mit PRAT) und zwei der Kategorie C
    portfolioA = (await call('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'a', name: 'Transformation' })).json().id;
    assert.equal((await call('POST', '/v1/gremien', ue, { portfolioId: portfolioA, kuerzel: 'prat', name: 'PRAT', art: 'entscheidend' })).statusCode, 201);
    portfolioC1 = (await call('POST', '/v1/portfolios', ue, { kategorie: 'C', schluessel: 'c-pflege', name: 'Direktion Pflege' })).json().id;
    portfolioC2 = (await call('POST', '/v1/portfolios', ue, { kategorie: 'C', schluessel: 'c-medizin', name: 'Direktion Medizin' })).json().id;
    await grant(api, tenantId, `user:${gremiumId}`, 'gremium', { type: 'portfolio', id: portfolioA });
  });
  after(async () => { await api?.close(); });

  test('Pool ohne Entwürfe, wartet am längsten zuerst; Funnel; nur mit idee:read', async () => {
    const x = await eingereicht(as1, 'Pool Eins');
    const y = await eingereicht(as2, 'Pool Zwei');
    await call('POST', '/v1/ideen', as1, { titel: 'Nur Entwurf' });
    const p = await call('GET', '/v1/ideen/pool', ue);
    assert.equal(p.statusCode, 200, p.body);
    const titel = p.json().items.map((i: { titel: string }) => i.titel);
    assert.ok(!titel.includes('Nur Entwurf'));
    assert.ok(titel.indexOf('Pool Eins') < titel.indexOf('Pool Zwei'), 'wartet am längsten zuerst');
    const f = (await call('GET', '/v1/ideen/pool/funnel', ue)).json();
    assert.ok(f.stufen.find((s: { stand: string }) => s.stand === 'eingereicht').anzahl >= 2);
    assert.ok(f.letzteEinreichung);
    assert.equal((await call('GET', '/v1/ideen/pool', as1)).statusCode, 403, 'Antragstellende sehen den Pool nicht');
    assert.equal((await call('GET', `/v1/ideen/${x.id}/pruefung`, as1)).statusCode, 403, 'noch Raster noch Leitfragen');
    assert.equal((await call('GET', `/v1/ideen/${y.id}/aehnliche`, ue)).json().items.some((i: { idee: { id: string } }) => i.idee.id === x.id), true, 'gleiches Handlungsfeld');
  });

  test('Leitfragen aus dem Phasenmodell, Raster mit Vorschlag, Kategorie mit Portfolio; «in Prüfung» mit Mitteilung', async () => {
    const i = await eingereicht(as1, 'Qualifizieren');
    const p0 = (await call('GET', `/v1/ideen/${i.id}/pruefung`, ue)).json();
    assert.equal(p0.leitfragen.length, 5, 'fünf Leitfragen zum Eintritt P0 (Q6 F6)');
    assert.deepEqual(p0.can, { pruefen: true, abschliessen: true });
    assert.equal(p0.vorschlag, null);

    assert.equal((await call('PUT', `/v1/ideen/${i.id}/leitfragen`, mit(ue, 'W/"1"'), { antworten: [] })).statusCode, 412);
    const l = await call('PUT', `/v1/ideen/${i.id}/leitfragen`, mit(ue, i.etag), { antworten: [{ position: 0, antwort: ' Strategisch relevant. ' }], vorgesehenerSponsor: as2Id });
    assert.equal(l.statusCode, 200, l.body);
    assert.equal(l.json().leitfragen[0].antwort, 'Strategisch relevant.');
    assert.equal(l.json().vorgesehenerSponsor, as2Id);
    assert.equal((await call('GET', `/v1/ideen/${i.id}`, as1)).json().stand, 'in_pruefung');
    assert.ok((await mitteilungen(as1)).some(m => m.text.includes('«Qualifizieren» ist in Prüfung')));
    assert.equal((await call('PUT', `/v1/ideen/${i.id}/leitfragen`, mit(ue, l.headers.etag as string), { antworten: [{ position: 99, antwort: 'x' }] })).statusCode, 422);
    // der vorgesehene Sponsor sieht die Idee lesend (Lesesicht EIGEN)
    assert.equal((await call('GET', `/v1/ideen/${i.id}`, as2)).statusCode, 200);

    const r = await call('PUT', `/v1/ideen/${i.id}/raster`, mit(ue, l.headers.etag as string), { raster: [
      { kriterium: 'relevanz', einschaetzung: 'hoch' }, { kriterium: 'direktionen', einschaetzung: 'hoch' }, { kriterium: 'abhaengigkeiten', einschaetzung: 'hoch' },
      { kriterium: 'priorisierung', einschaetzung: 'hoch' }, { kriterium: 'change', einschaetzung: 'mittel' },
    ] });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json().vorschlag, { kategorie: 'A', hoch: 4, mittel: 1, tief: 0 });

    // Kategorie C: zwei Direktionen → Portfolio nötig
    const c = await call('POST', `/v1/ideen/${i.id}/kategorie`, mit(ue, r.headers.etag as string), { kategorie: 'C' });
    assert.equal(c.statusCode, 422);
    assert.equal(c.json().errors[0].path, '/portfolioId');
    const k = await call('POST', `/v1/ideen/${i.id}/kategorie`, mit(ue, r.headers.etag as string), { kategorie: 'A', begruendung: 'wie Raster' });
    assert.equal(k.statusCode, 200, k.body);
    assert.deepEqual([k.json().kategorie, k.json().portfolioId, k.json().zustaendig?.kuerzel], ['A', portfolioA, 'prat']);
    const kc = await call('POST', `/v1/ideen/${i.id}/kategorie`, mit(ue, k.headers.etag as string), { kategorie: 'C', portfolioId: portfolioC2, begruendung: 'Direktion allein betroffen' });
    assert.equal(kc.statusCode, 200, kc.body);
    assert.equal(kc.json().portfolioId, portfolioC2);
    assert.ok(portfolioC1);
    // Antragstellende sehen Kategorie und Raster nicht
    const sicht = (await call('GET', `/v1/ideen/${i.id}`, as1)).json();
    assert.equal('kategorie' in sicht, false);
  });

  test('Rückfrage: «in Ergänzung», Aufgabe an die antragstellende Person, Prüfaufgabe entfällt', async () => {
    const i = await eingereicht(as1, 'Rückfrage');
    const r = await call('POST', `/v1/ideen/${i.id}/rueckfragen`, mit(ue, i.etag), { fragen: [{ feld: 'zielsetzung', text: 'Woran misst du den Erfolg?' }] });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().can.pruefen, false);
    const g = (await call('GET', `/v1/ideen/${i.id}`, as1)).json();
    assert.deepEqual([g.stand, g.rueckfragen[0].feld, g.can.bearbeiten], ['in_ergaenzung', 'zielsetzung', true]);
    const zuTun = (await call('GET', '/v1/eingang', as1)).json().items as { art: string; link: string; bezug: { id: string } }[];
    assert.equal(zuTun.find(a => a.art === 'idee.ergaenzen' && a.bezug.id === i.id)?.link, `/portfolio/ideen/${i.nummer}`);
    assert.ok(!(await call('GET', '/v1/eingang', ue)).json().items.some((a: { art: string; bezug: { id: string } }) => a.art === 'idee.pruefen' && a.bezug.id === i.id));
    assert.equal((await call('POST', `/v1/ideen/${i.id}/rueckfragen`, mit(ue, r.headers.etag as string), { fragen: [{ text: 'Noch eine' }] })).statusCode, 409);
  });

  test('Zurückweisen: Begründung Pflicht, AS und Gremium informiert, Begründung für AS sichtbar (UC-001 A3, A-06)', async () => {
    const i = await eingereicht(as1, 'Zurückweisen');
    const k = await call('POST', `/v1/ideen/${i.id}/kategorie`, mit(ue, i.etag), { kategorie: 'A' });
    assert.equal(k.statusCode, 200, k.body);
    assert.equal((await call('POST', `/v1/ideen/${i.id}/zurueckweisen`, mit(ue, k.headers.etag as string), { begruendung: '' })).statusCode, 422);
    const z = await call('POST', `/v1/ideen/${i.id}/zurueckweisen`, mit(ue, k.headers.etag as string), { begruendung: ' Kein strategischer Bezug. ' });
    assert.equal(z.statusCode, 200, z.body);
    assert.deepEqual(z.json().can, { pruefen: false, abschliessen: false });
    const g = (await call('GET', `/v1/ideen/${i.id}`, as1)).json();
    assert.deepEqual([g.stand, g.begruendung], ['zurueckgewiesen', 'Kein strategischer Bezug.']);
    assert.ok((await mitteilungen(as1)).some(m => m.text.includes('«Zurückweisen» wird nicht weiterverfolgt')));
    assert.ok((await mitteilungen(gremium)).some(m => m.text.includes('zurückgewiesen')), 'Gremium informiert (A-06)');
    assert.ok(!(await call('GET', '/v1/eingang', ue)).json().items.some((a: { art: string; bezug: { id: string } }) => a.art === 'idee.pruefen' && a.bezug.id === i.id));
  });

  test('Zusammenführen: andere Idee «zusammengeführt» mit Verweis, Angaben übernommen, beide informiert (UC-001 A1)', async () => {
    const fuehrend = await eingereicht(as1, 'Führend');
    const andere = await eingereicht(as2, 'Andere');
    const m = await call('POST', `/v1/ideen/${andere.id}/zusammenfuehren`, mit(ue, andere.etag), { fuehrendeIdeeId: fuehrend.id });
    assert.equal(m.statusCode, 200, m.body);
    const a = (await call('GET', `/v1/ideen/${andere.id}`, as2)).json();
    assert.deepEqual([a.stand, a.fuehrendeIdeeId], ['zusammengefuehrt', fuehrend.id]);
    const f = (await call('GET', `/v1/ideen/${fuehrend.id}`, ue)).json();
    assert.match(f.zielsetzung, new RegExp(`Aus Idee ${andere.nummer} \\(Andere\\): Andere morgen`));
    for (const h of [as1, as2]) assert.ok((await mitteilungen(h)).some(x => x.text.includes('wurden zusammengeführt')));
    // die zusammengeführte Idee ist abgeschlossen; mit einer abgeschlossenen führt man nicht zusammen
    const dritte = await eingereicht(as1, 'Dritte');
    assert.equal((await call('POST', `/v1/ideen/${dritte.id}/zusammenfuehren`, mit(ue, dritte.etag), { fuehrendeIdeeId: andere.id })).statusCode, 409);
    assert.equal((await call('POST', `/v1/ideen/${dritte.id}/zusammenfuehren`, mit(ue, await etagVon(dritte.id)), { fuehrendeIdeeId: dritte.id })).statusCode, 422);
    assert.equal((await call('GET', `/v1/ideen/${dritte.id}/aehnliche`, as1)).statusCode, 403, 'ähnliche Ideen nur für die UE (A-32)');
    assert.equal((await call('GET', `/v1/ideen/${dritte.id}/aehnliche`, gremium)).statusCode, 403);
  });
});
