/**
 * Eskalation und Meilensteinabnahme (BC PS.03.03, PS.02.03; UC-004 A2.2, UC-006 Schritt 7; AP-E2-4): Einreichen
 * «kritisch» mit Entscheidbedarf legt die Eskalation an, schlägt sie dem entscheidenden Gremium vor und öffnet die Aufgabe
 * der Unternehmensentwicklung; ein erreichter Meilenstein mit Abnahme durch das Gremium wird vorgeschlagen. Zurückziehen
 * nimmt alles zurück. Die Folge des Entscheids (fachmodell.md 2.9) ist sichtbar, solange die Sitzung offen ist.
 *
 * Den Entscheid erfasst der Sitzungsmodus (AP-E2-2, `PUT /v1/traktanden/{id}/entscheid`); bis er auf `main` ist, ruft der
 * Test die Folge `beiEntscheid` der Art so auf, wie es der Sitzungsmodus in der Transaktion des Entscheids tut.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { login, person, testApi, type TestApi } from './api.ts';
import { traktandenart, type EntscheidFolge } from '../../src/modules/sitzung/arten.ts';
import { heute } from '../../src/modules/sitzung/format.ts';

const skip = await skipDb();

const PERIODE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);
const VOLL = {
  status: 'kritisch', trend: 'abwaerts', begruendung: 'Lieferverzug Hauptlieferant', massnahme: 'Zweiten Lieferanten beiziehen', entscheidNoetig: true,
  abweichung: Object.fromEntries(['inhalt', 'termin', 'ressourcen', 'budget'].map(d => [d, { stufe: 'keine', kommentar: '' }])),
};

/** Datum n Kalendertage nach heute, auf den nächsten Mittwoch gelegt (Sitzungstag). */
function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Vorschlag { id: string; art: string; bezug_id: string; titel: string; antrag: string; stand: string; sitzung_id: string | null }

describe('Eskalation und Meilensteinabnahme', { skip }, () => {
  let api: TestApi;
  let T = '';
  let ue: Record<string, string>, pl: Record<string, string>;
  let projekt: { id: string; nummer: string };
  let meilenstein = '';
  const termin = mittwochIn(28);

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, url: string, headers: Record<string, string>, payload?: unknown, status = 200) => {
    const r = await call(method, url, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r;
  };
  const sys = <R>(fn: Parameters<typeof full<R>>[2]) => full(api.t.runtime, T, fn);
  const bericht = (nach = '') => `/v1/projekte/${projekt.id}/berichte/${PERIODE}${nach}`;
  const vorschlaege = () => sys(async tx => (await tx.query<Vorschlag>(
    'SELECT id, art, bezug_id, titel, antrag, stand, sitzung_id FROM ppm.traktandum WHERE projekt_id = $1 ORDER BY art', [projekt.id])).rows);
  const eskalationen = () => sys(async tx => (await tx.query<{ id: string; stand: string; ergebnis: string | null; grund: string; massnahme: string; entscheid_begruendung: string }>(
    'SELECT id, stand, ergebnis, grund, massnahme, entscheid_begruendung FROM ppm.eskalation WHERE projekt_id = $1', [projekt.id])).rows);
  const aufgaben = () => sys(async tx => (await tx.query<{ titel: string; kontext: string; stand: string; bezug_id: string }>(
    "SELECT titel, kontext, stand, bezug_id FROM ppm.aufgabe WHERE art = 'eskalation.behandeln' ORDER BY created_at", [])).rows);
  /** Folge des Entscheids, wie sie der Sitzungsmodus (AP-E2-2) in der Transaktion des Entscheids aufruft. */
  const entscheiden = (t: Vorschlag, ergebnis: string, begruendung = '') => sys(tx => traktandenart(t.art as 'eskalation')!.beiEntscheid!(tx, {
    traktandumId: t.id, bezug: { typ: t.art, id: t.bezug_id, projektId: projekt.id }, ergebnis, begruendung, viaSns: false,
  } satisfies EntscheidFolge));

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    T = u.tenantId;
    ue = { authorization: u.authorization };
    const adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    const pm = await ok('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' }, 201);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, { ...adm, 'if-match': pm.headers.etag as string });

    // Portfolio mit entscheidendem Gremium und einem Sitzungstermin
    const portfolio = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).json().id;
    const prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).json().id;
    await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum: termin }, 201);

    // Projekt in P2 mit PL; alle Mitglieder sind Antragstellende an der Organisation (A-46)
    const plId = await person(api, T, 'u-pl');
    pl = { authorization: (await login(api, 'demo', 'u-pl', 'antragsteller')).authorization };
    const p = (await ok('POST', '/v1/projekte', ue, { name: 'Neues Labor', portfolioId: portfolio, phase: 'P2' }, 201)).json();
    projekt = { id: p.id, nummer: p.nummer };
    await ok('PUT', `/v1/projekte/${p.id}/organisation`, { ...ue, 'if-match': 'W/"0"' }, { mitglieder: [{ personId: plId, funktion: 'pl', akv: '' }] });

    // Meilenstein mit Abnahme durch das Gremium, von der PL als erreicht gemeldet (UC-004 Schritt 2)
    const m = (await ok('POST', `/v1/projekte/${p.id}/meilensteine`, pl, { phase: 'P2', art: 'meilenstein', text: 'Pilot abgeschlossen', terminAktuell: heute(), abnahme: 'gremium' }, 201)).json();
    meilenstein = m.id;
    await ok('PATCH', `/v1/projekte/${p.id}/meilensteine/${m.id}`, { ...pl, 'if-match': 'W/"1"' }, { erreichtAm: heute() });
  });
  after(async () => { await api?.close(); });

  test('Zurückziehen nimmt Eskalation, Vorschläge und Aufgabe zurück (UC-004 A2.2, Rückgängig 10 s)', async () => {
    await ok('PUT', bericht(), { ...pl, 'if-match': 'W/"0"' }, VOLL);
    await ok('POST', bericht('/einreichen'), { ...pl, 'if-match': 'W/"1"' });
    assert.equal((await eskalationen()).length, 1);
    assert.deepEqual((await vorschlaege()).map(v => v.art), ['eskalation', 'meilenstein']);

    await ok('POST', bericht('/zurueckziehen'), { ...pl, 'if-match': 'W/"2"' });
    assert.deepEqual(await eskalationen(), []);
    assert.deepEqual((await vorschlaege()).map(v => v.art), ['meilenstein'], 'der Meilenstein bleibt erreicht und darum vorgeschlagen');
    assert.deepEqual((await aufgaben()).map(a => a.stand), ['entfallen']);
  });

  test('Einreichen «kritisch» mit Entscheidbedarf: Eskalation, Vorschläge an das Gremium, Aufgabe der UE (PS.03.03, PS.02.03)', async () => {
    const r = await call('GET', bericht(), pl);
    await ok('POST', bericht('/einreichen'), { ...pl, 'if-match': r.headers.etag as string });

    const [e] = await eskalationen();
    assert.deepEqual([e!.stand, e!.ergebnis, e!.grund, e!.massnahme], ['offen', null, VOLL.begruendung, VOLL.massnahme]);
    const v = await vorschlaege();
    assert.deepEqual(v.map(x => [x.art, x.stand, x.titel, x.antrag]), [
      ['eskalation', 'vorgeschlagen', `Eskalation ${projekt.nummer} Neues Labor`, `Massnahme beschliessen: ${VOLL.massnahme}`],
      ['meilenstein', 'vorgeschlagen', `Meilensteinabnahme ${projekt.nummer}: Pilot abgeschlossen`, `Abnahme des Meilensteins «Pilot abgeschlossen», erreicht am ${heute().split('-').map(Number).reverse().join('.')}`],
    ]);
    assert.equal(v[0]!.bezug_id, e!.id);
    assert.equal(v[1]!.bezug_id, meilenstein);
    const a = (await aufgaben()).at(-1)!;
    assert.deepEqual([a.stand, a.bezug_id, a.titel], ['offen', e!.id, `Eskalation ${projekt.nummer} Neues Labor traktandieren`]);
    assert.match(a.kontext, /«kritisch» mit Entscheidbedarf$/);

    // Unterlage der Eskalation ist der Bericht (Unterlagenstand «bereit»)
    const u = await sys(tx => traktandenart('eskalation')!.unterlagen!(tx, { typ: 'eskalation', id: e!.id, projektId: projekt.id }));
    assert.deepEqual(u.map(x => [x.art, x.bereit, x.hinweis]), [['bericht', true, 'kritisch, Entscheid nötig']]);
  });

  test('Folge des Entscheids sichtbar vor Schliessen der Sitzung; Korrektur idempotent (UC-006 Schritt 7, fachmodell.md 2.9)', async () => {
    // Sitzung vorbereiten und beide Vorschläge aufnehmen (K3 Schritte 1–2); die Sitzung bleibt offen
    const s = (await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin }, 201)).json();
    const [esk, ms] = await vorschlaege();
    for (const t of [esk!, ms!]) await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: t.id });

    // Zurückgestellt: Eskalation bleibt für die Folgesitzung offen, Aufgabe erneut
    await entscheiden(esk!, 'zurueckgestellt', 'Offerte abwarten');
    let [e] = await eskalationen();
    assert.deepEqual([e!.stand, e!.ergebnis, e!.entscheid_begruendung], ['traktandiert', 'zurueckgestellt', 'Offerte abwarten']);
    let a = (await aufgaben()).at(-1)!;
    assert.deepEqual([a.stand, a.titel, a.kontext], ['offen', `Eskalation ${projekt.nummer} Neues Labor erneut traktandieren`, 'vom Gremium zurückgestellt']);

    // Korrektur in der Sitzung (A-30): erledigt mit Massnahme schliesst Eskalation und Aufgabe; zweimal gleich
    for (let i = 0; i < 2; i++) await entscheiden(esk!, 'erledigt', 'Zweiter Lieferant bewilligt');
    [e] = await eskalationen();
    assert.deepEqual([e!.stand, e!.ergebnis, e!.entscheid_begruendung], ['erledigt', 'erledigt', 'Zweiter Lieferant bewilligt']);
    a = (await aufgaben()).at(-1)!;
    assert.equal(a.stand, 'erledigt');

    // Nicht abgenommen bewirkt nichts; abgenommen trägt das Datum ins Register, sichtbar für die PL
    await entscheiden(ms!, 'nicht_abgenommen');
    const register = async () => (await ok('GET', `/v1/projekte/${projekt.id}/meilensteine`, pl)).json().items.find((x: { id: string }) => x.id === meilenstein);
    assert.equal((await register()).abgenommenAm, null);
    for (let i = 0; i < 2; i++) await entscheiden(ms!, 'abgenommen');
    assert.equal((await register()).abgenommenAm, heute());

    // Die Sitzung ist noch nicht geschlossen
    const offen = (await ok('GET', `/v1/sitzungen/${s.id}`, ue)).json();
    assert.notEqual(offen.stand, 'geschlossen');
    assert.notEqual(offen.stand, 'protokoll_versendet');
  });
});
