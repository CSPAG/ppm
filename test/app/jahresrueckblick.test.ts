/**
 * Jahresrückblick (BC ZM.03.03; UC-013 Schritte 1, 3, 4; AP-E7-5): Jahresauswertung aus Zielerreichung und Vorhaben des
 * Jahres, Erkenntnisse und Massnahmen mit If-Match, Traktandieren im PRAT, «Anpassungen verlangt» und «Verabschiedet»
 * (K3 Schritt 8) in der Sitzung, Rechte.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full } from './harness.ts';
import { heute } from '../../src/modules/sitzung/format.ts';
import { letztesQuartal } from '../../src/modules/ziel/quartal.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

type H = Record<string, string>;

function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('Jahresrückblick', () => {
  let api: TestApi;
  let tenantId = '';
  let ue: H, gl: H, ohne: H, prat: H, fremd: H, zweitesA: H;
  let portfolioA = '';
  const quartal = letztesQuartal(heute());
  const jahr = Number(quartal.slice(0, 4));
  const url = `/v1/jahresrueckblicke/${jahr}`;
  const termin = mittwochIn(28);
  const projekt: Record<string, string> = {};
  let lesson: { id: string; jahr: number } = { id: '', jahr: 0 };

  const call = (method: string, u: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url: u, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, u: string, headers: H, payload?: unknown, status = 200) => {
    const r = await call(method, u, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${u}: ${r.body}`);
    return r;
  };
  const mit = (h: H, etag: string): H => ({ ...h, 'if-match': etag });
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);
  const nummern = (l: { nummer: string }[]) => l.map(p => p.nummer);

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    tenantId = u.tenantId;
    ue = { authorization: u.authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'gl')).authorization };
    ohne = { authorization: (await login(api, 'demo', 'u-ohne', null)).authorization };
    const adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    const pm = await ok('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' }, 201);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, mit(adm, pm.headers.etag as string));
    portfolioA = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).json().id;
    const pratId = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolioA, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).json().id;
    await ok('POST', `/v1/gremien/${pratId}/termine`, ue, { datum: termin }, 201);
    // A-67: Mitglied des PRAT (Gremium am Portfolio der Kategorie A) und eines anderen Gremiums
    const portfolioB = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'B', schluessel: 'medizin', name: 'Medizin' }, 201)).json().id;
    const m = await login(api, 'demo', 'u-prat', null);
    await grant(api, tenantId, `user:${m.principalId}`, 'gremium', { type: 'portfolio', id: portfolioA });
    prat = { authorization: m.authorization };
    const f = await login(api, 'demo', 'u-fremd', null);
    await grant(api, tenantId, `user:${f.principalId}`, 'gremium', { type: 'portfolio', id: portfolioB });
    fremd = { authorization: f.authorization };
    // ein zweites Portfolio der Kategorie A (nach Name später): sein Gremium ist nicht der PRAT
    const portfolioA2 = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'zentrum', name: 'Zentrum' }, 201)).json().id;
    const z = await login(api, 'demo', 'u-zweites-a', null);
    await grant(api, tenantId, `user:${z.principalId}`, 'gremium', { type: 'portfolio', id: portfolioA2 });
    zweitesA = { authorization: z.authorization };

    // Ziel mit Stand im Jahr
    const feld = (await ok('POST', '/v1/handlungsfelder', adm, { label: 'Patientenorientierung' }, 201)).json().id;
    const zielId = (await ok('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld, nummer: '1.1', text: 'Wartezeit senken', metrik: 'Median Wartezeit', zielwert: '−10 %' }, 201)).json().id;
    await ok('POST', `/v1/strategische-ziele`, gl, { handlungsfeldId: feld, nummer: '1.2', text: 'Ohne Stand', metrik: 'x', zielwert: 'y' }, 201);
    await ok('POST', `/v1/zielerreichung/${quartal}`, gl, { zielTyp: 'strategisch', zielId, stand: '−4 %', beurteilung: 'auf Kurs' }, 201);

    // Vorhaben: im Jahr abgeschlossen, früher abgeschlossen, im Jahr abgebrochen, laufend
    await sys(async tx => {
      const neu = async (nr: string, lz: string, seit: string | null) => {
        const id = projekt[nr] = crypto.randomUUID();
        // Verlauf nur anhängen: der Wechsel des Lebenszyklus am Datum `seit` als Fassung vor der Übernahme
        if (seit) {
          await tx.query(`INSERT INTO ppm.projekt_version (tenant_id, projekt_id, version, action, nummer, name, portfolio_id, phase, lebenszyklus, vertraulich, changed_at)
                          VALUES ($1, $2, 0, 'updated', $3, $3, $4, 'P2', $5, false, $6)`, [tenantId, id, nr, portfolioA, lz, `${seit}T12:00:00+02:00`]);
        }
        await tx.query("INSERT INTO ppm.projekt (tenant_id, id, nummer, name, portfolio_id, phase, lebenszyklus) VALUES ($1, $2, $3, $3, $4, 'P2', $5)", [tenantId, id, nr, portfolioA, lz]);
      };
      await neu('2020-901', 'abgeschlossen', `${jahr}-06-15`);
      await neu('2020-902', 'abgeschlossen', '2020-06-15');
      await neu('2020-903', 'abgebrochen', `${jahr}-03-01`);
      await neu('2020-904', 'aktiv', null);
      await neu('2020-905', 'abgeschlossen', `${jahr}-09-30`);
    });
    // Lessons Learned über die REST-Schnittstelle von `abschluss` (AP-E7-1): nur 2020-905 hat welche
    lesson = (await ok('POST', `/v1/projekte/${projekt['2020-905']}/lessons-learned`, ue, { text: 'Früh mit dem Betrieb planen', kategorie: 'Übergabe' }, 201)).json();
  });
  after(async () => { await api?.close(); });

  test('Jahresauswertung aus Zielerreichung und Vorhaben; Rechte', async () => {
    assert.equal((await call('GET', url, ohne)).statusCode, 403);
    const r = await ok('GET', url, gl);
    assert.equal(r.headers.etag, 'W/"0"');
    const b = r.json();
    assert.deepEqual([b.stand, b.version, b.erkenntnisse], ['offen', 0, '']);
    assert.deepEqual([b.auswertung.zielerreichung.gesamt, b.auswertung.zielerreichung.mitStand], [2, 1]);
    assert.deepEqual(b.auswertung.zielerreichung.ziele.map((z: { nummer: string; stand: string | null; quartal: string | null }) => [z.nummer, z.stand, z.quartal]),
      [['1.1', '−4 %', quartal], ['1.2', null, null]]);
    assert.deepEqual(nummern(b.auswertung.vorhaben.abgeschlossen), ['2020-901', '2020-905']);
    // UC-013 Schritt 2: abgeschlossene Vorhaben ohne Lessons Learned; die Lessons Learned des Jahres der Erfassung
    assert.deepEqual(nummern(b.auswertung.lessonsLearned.ohne), ['2020-901']);
    const ll = (await ok('GET', `/v1/jahresrueckblicke/${lesson.jahr}`, gl)).json().auswertung.lessonsLearned.eintraege;
    assert.deepEqual(ll.map((l: { id: string; projekt: { nummer: string }; kategorie: string }) => [l.id, l.projekt.nummer, l.kategorie]), [[lesson.id, '2020-905', 'Übergabe']]);
    assert.equal(b.auswertung.vorhaben.abgeschlossen[0].seit, `${jahr}-06-15`);
    assert.deepEqual(nummern(b.auswertung.vorhaben.abgebrochen), ['2020-903']);
    assert.ok(nummern(b.auswertung.vorhaben.laufend).includes('2020-904'));
    assert.deepEqual(b.can, { bearbeiten: false, traktandieren: false });
    assert.deepEqual((await ok('GET', url, ue)).json().can, { bearbeiten: true, traktandieren: true });
  });

  test('Erkenntnisse erfassen: anlegen, If-Match, nur UE; traktandieren erst gespeichert', async () => {
    assert.equal((await call('POST', `${url}/traktandieren`, ue)).statusCode, 404, 'noch nichts gespeichert');
    // A-67: das Gremium sieht weder die Auswertung live noch den Rückblick in Arbeit
    assert.equal((await call('GET', url, prat)).statusCode, 404);
    assert.equal((await call('PUT', url, gl, { erkenntnisse: 'x', massnahmen: '' })).statusCode, 403);
    let r = await ok('PUT', url, ue, { erkenntnisse: ' Zu viele Vorhaben parallel. ', massnahmen: '' });
    assert.deepEqual([r.json().stand, r.json().erkenntnisse, r.headers.etag], ['in_arbeit', 'Zu viele Vorhaben parallel.', 'W/"1"']);
    assert.equal((await call('PUT', url, ue, { erkenntnisse: 'x', massnahmen: '' })).statusCode, 428);
    assert.equal((await call('PUT', url, mit(ue, 'W/"9"'), { erkenntnisse: 'x', massnahmen: '' })).statusCode, 412);
    r = await ok('PUT', url, mit(ue, r.headers.etag as string), { erkenntnisse: 'Zu viele Vorhaben parallel.', massnahmen: 'WIP-Limite je Portfolio' });
    assert.deepEqual([r.json().massnahmen, r.json().version], ['WIP-Limite je Portfolio', 2]);
    assert.equal((await call('GET', url, prat)).statusCode, 404, 'in Arbeit');
    assert.equal((await call('GET', `${url}/dokument`, prat)).statusCode, 404, 'in Arbeit');
  });

  test('Traktandieren im PRAT, «Anpassungen verlangt», Korrektur zu «Verabschiedet»', async () => {
    let r = await ok('POST', `${url}/traktandieren`, ue);
    assert.equal(r.json().stand, 'traktandiert');
    assert.deepEqual(r.json().can, { bearbeiten: false, traktandieren: false });
    assert.equal((await call('POST', `${url}/traktandieren`, ue)).statusCode, 409);
    // A-67: ab «traktandiert» liest das Mitglied des PRAT den Stand bei Traktandierung, ohne Handlungen; ein anderes Gremium nie
    const g = await ok('GET', url, prat);
    assert.deepEqual([g.json().stand, g.json().erkenntnisse, g.json().can], ['traktandiert', 'Zu viele Vorhaben parallel.', { bearbeiten: false, traktandieren: false }]);
    assert.equal((await call('GET', `${url}/dokument`, prat)).statusCode, 200);
    assert.equal((await call('PUT', url, mit(prat, g.headers.etag as string), { erkenntnisse: 'x', massnahmen: '' })).statusCode, 403);
    for (const u of [`${url}`, `${url}/dokument`]) assert.equal((await call('GET', u, fremd)).statusCode, 403, u);
    // Gremium eines anderen Portfolios der Kategorie A: liest nie, auch wenn es nur sein eigenes Portfolio sieht
    for (const u of [`${url}`, `${url}/dokument`]) assert.ok([403, 404].includes((await call('GET', u, zweitesA)).statusCode), u);
    assert.equal((await call('GET', url, ohne)).statusCode, 403);
    assert.equal((await call('PUT', url, mit(ue, r.headers.etag as string), { erkenntnisse: 'x', massnahmen: '' })).statusCode, 409);
    // Stand bei Traktandierung: ein später abgeschlossenes Vorhaben ändert die Auswertung nicht mehr
    await sys(tx => tx.query("UPDATE ppm.projekt SET lebenszyklus = 'abgeschlossen' WHERE id = $1", [projekt['2020-904']]));
    assert.deepEqual(nummern((await ok('GET', url, gl)).json().auswertung.vorhaben.abgeschlossen), ['2020-901', '2020-905']);

    const t = await sys(async tx => (await tx.query<{ id: string; titel: string; portfolio_id: string }>(
      "SELECT id, titel, portfolio_id FROM ppm.traktandum WHERE art = 'jahresrueckblick' AND stand = 'vorgeschlagen'")).rows);
    assert.deepEqual(t.map(x => [x.titel, x.portfolio_id]), [[`Jahresrückblick ${jahr}`, portfolioA]]);
    const s = (await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin }, 201)).json();
    const v = (await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: t[0]!.id })).json();
    const vs = (await ok('POST', `/v1/sitzungen/${s.id}/versenden`, mit(ue, `W/"${v.version}"`))).json();
    await ok('POST', `/v1/sitzungen/${s.id}/starten`, mit(ue, `W/"${vs.version}"`));
    await ok('PUT', `/v1/traktanden/${t[0]!.id}/entscheid`, ue, { ergebnis: 'anpassungen', begruendung: 'Massnahmen konkretisieren' });
    r = await ok('GET', url, ue);
    assert.deepEqual([r.json().stand, r.json().rueckmeldung, r.json().traktandiertAt], ['in_arbeit', 'Massnahmen konkretisieren', null]);
    assert.ok(nummern(r.json().auswertung.vorhaben.abgeschlossen).includes('2020-904'), 'in Arbeit wieder live');

    // Korrektur in der Sitzung (A-30): verabschiedet
    const ent = await sys(async tx => (await tx.query<{ version: number }>('SELECT version FROM ppm.entscheid WHERE traktandum_id = $1', [t[0]!.id])).rows[0]!);
    await ok('PUT', `/v1/traktanden/${t[0]!.id}/entscheid`, mit(ue, `W/"${ent.version}"`), { ergebnis: 'verabschiedet', begruendung: 'Doch so' });
    r = await ok('GET', url, ue);
    assert.equal(r.json().stand, 'ausgewertet');
    assert.ok(r.json().ausgewertetAt);
    assert.deepEqual(r.json().can, { bearbeiten: true, traktandieren: false });
    // Erkenntnisse nach dem Entscheid des PRAT nachführen (UC-013 Schritt 4)
    r = await ok('PUT', url, mit(ue, r.headers.etag as string), { erkenntnisse: 'Zu viele Vorhaben parallel.', massnahmen: 'WIP-Limite 5 je Portfolio' });
    assert.deepEqual([r.json().stand, r.json().massnahmen], ['ausgewertet', 'WIP-Limite 5 je Portfolio']);
    const audit = await sys(async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE action LIKE 'jahresrueckblick.%' ORDER BY id")).rows.map(x => x.action));
    // dazu der Export des Gremiums (A-67)
    assert.deepEqual(audit, ['jahresrueckblick.created', 'jahresrueckblick.updated', 'jahresrueckblick.scheduled', 'jahresrueckblick.exported', 'jahresrueckblick.updated']);
  });

  test('Lessons Learned anfordern (A1): Aufgabe an die PL, erledigt mit der ersten Lesson Learned', async () => {
    const pl = await login(api, 'demo', 'u-pl', null);
    await sys(tx => tx.query("INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, 'pl')", [tenantId, projekt['2020-901'], pl.principalId]));
    assert.equal((await call('POST', `${url}/lessons-learned/anfordern`, gl)).statusCode, 403);
    // 2020-901 und das oben abgeschlossene 2020-904 ohne Lessons Learned; nur 2020-901 hat eine PL
    assert.deepEqual((await ok('POST', `${url}/lessons-learned/anfordern`, ue)).json(), { vorhaben: 2, aufgaben: 1 });
    await ok('POST', `${url}/lessons-learned/anfordern`, ue);
    const aufgaben = () => sys(async tx => (await tx.query<{ bezug_id: string; empfaenger_person: string; stand: string; link: string }>(
      "SELECT bezug_id, empfaenger_person, stand, link FROM ppm.aufgabe WHERE art = 'lessons_learned.erfassen' ORDER BY created_at")).rows);
    assert.deepEqual((await aufgaben()).map(a => [a.bezug_id, a.empfaenger_person, a.stand, a.link]),
      [[projekt['2020-901'], pl.principalId, 'offen', '/projekte/2020-901/abschluss']], 'idempotent');
    // A1.2: erfasst eine Person mit projekt:write die Lesson Learned, ist die Aufgabe erledigt
    await ok('POST', `/v1/projekte/${projekt['2020-901']}/lessons-learned`, ue, { text: 'Abnahme früher planen' }, 201);
    assert.deepEqual((await aufgaben()).map(a => a.stand), ['erledigt']);
  });

  test('Dokument über vorlage (PDF und Word), Export im Audit', async () => {
    assert.equal((await call('GET', '/v1/jahresrueckblicke/2001/dokument', gl)).statusCode, 404);
    assert.equal((await call('GET', `${url}/dokument`, ohne)).statusCode, 403);
    const pdf = await ok('GET', `${url}/dokument`, gl);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.equal(pdf.rawPayload.subarray(0, 5).toString(), '%PDF-');
    const docx = await ok('GET', `${url}/dokument?format=docx`, ue);
    assert.match(String(docx.headers['content-disposition']), new RegExp(`Jahresrueckblick_${jahr}\\.docx`));
    const n = await sys(async tx => (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM ppm.audit_log WHERE action = 'jahresrueckblick.exported'")).rows[0]!.n);
    assert.equal(n, 3, 'mit dem Export des Gremiums im Traktandieren-Test');
  });
});
