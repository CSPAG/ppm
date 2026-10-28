/**
 * Sitzung durchführen (BC PP.04.02, PS.02.02; UC-006 Schritte 6–9, A1, A3, A4; Abnahme K3, AP-E2-2): Sitzung starten,
 * Entscheid mit Folge der Art sofort (vor dem Schliessen), Begründung Pflicht, Auflagen, Korrektur mit Verlauf bis zum
 * Schliessen (A-30), Stellungnahme «via SNS-VR» und Entscheid des SNS-VR, Schliessen mit Folgevorschlägen, Aufgaben und
 * gebündelten Mitteilungen, Protokoll bereinigen und versenden, Auflage erfüllen, Liste der Entscheide.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { grant, login, person, testApi, type TestApi } from './api.ts';
import { registriereTraktandenart, traktandum, type EntscheidFolge, type FolgeKontext } from '../../src/modules/sitzung/index.ts';
import { _abmelden, traktandenart, type Traktandenart } from '../../src/modules/sitzung/arten.ts';
import { optionen } from '../../src/modules/sitzung/entscheid.ts';
import { heute } from '../../src/modules/sitzung/format.ts';

const skip = await skipDb();

function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Folgen, die die Probe-Art «gate» erhält (wie vertrag in AP-E3-3: Baseline und Phase). */
const folgen: EntscheidFolge[] = [];
/** Kontext je Folge (FolgeKontext: Akteur, Sitzung, Vorher bei Korrektur, Zugang). */
const kontexte: (FolgeKontext | undefined)[] = [];

/**
 * Art für den Test ersetzen: Registriert ein Modul die Art schon beim Laden (statusbericht: eskalation, meilenstein,
 * AP-E2-4; vertrag: gate, AP-E3-3), wird sie für diesen Test durch die Probe ersetzt und danach wiederhergestellt.
 */
const wiederherstellen: (() => void)[] = [];
function probeArt(a: Traktandenart): void {
  const vorher = traktandenart(a.art);
  if (vorher) _abmelden(a.art);
  registriereTraktandenart(a);
  wiederherstellen.push(() => { _abmelden(a.art); if (vorher) registriereTraktandenart(vorher); });
}

describe('Sitzung durchführen: Entscheide, Auflagen, Protokoll', { skip }, () => {
  let api: TestApi;
  let tenantId: string;
  let ueId = '';
  let ue: Record<string, string>, mitglied: Record<string, string>, plH: Record<string, string>, nobody: Record<string, string>;
  let pl: string, sp: string;
  let p1: { id: string; nummer: string }, p2: { id: string; nummer: string };
  const termin1 = mittwochIn(28), termin2 = mittwochIn(56);
  let sitzung: { id: string; version: number };
  const tid: Record<string, string> = {};

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, url: string, headers: Record<string, string>, payload?: unknown, status = 200) => {
    const r = await call(method, url, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r.json();
  };
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);
  const mitteilungen = (an: string) => sys(async tx => (await tx.query<{ text: string; bezug_typ: string }>(
    'SELECT text, bezug_typ FROM ppm.mitteilung WHERE empfaenger_person = $1 ORDER BY created_at, text', [an])).rows);
  const aufgaben = (art: string) => sys(async tx => (await tx.query<{ bezug_id: string; empfaenger_person: string | null; frist: string | null; stand: string; titel: string }>(
    "SELECT bezug_id, empfaenger_person, to_char(frist, 'YYYY-MM-DD') AS frist, stand, titel FROM ppm.aufgabe WHERE art = $1 ORDER BY created_at", [art])).rows);

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    tenantId = u.tenantId;
    ueId = u.principalId;
    ue = { authorization: u.authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
    const adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    const pm = await call('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' });
    assert.equal(pm.statusCode, 201, pm.body);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, { ...adm, 'if-match': pm.headers.etag as string });

    const portfolio = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).id;
    const prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).id;
    const sns = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolio, kuerzel: 'sns-vr', name: 'SNS-VR', art: 'extern' }, 201)).id;
    await ok('PUT', `/v1/portfolios/${portfolio}/gremienweg`, { ...ue, 'if-match': 'W/"1"' }, { schritte: [
      { gate: 'P0_P1', gremiumId: prat, zusaetzlichGremiumId: sns }, { gate: 'P1_P2', gremiumId: prat, zusaetzlichGremiumId: sns }, { gate: 'P2_P3', gremiumId: prat },
    ] });
    for (const datum of [termin1, termin2]) await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum }, 201);

    const ctl = await person(api, tenantId, 'u-ctl');
    [pl, sp] = [await person(api, tenantId, 'u-pl'), await person(api, tenantId, 'u-sp')];
    plH = { authorization: (await login(api, 'demo', 'u-pl', 'antragsteller')).authorization };
    for (const [phase, set] of [['P1', (x: typeof p1) => { p1 = x; }], ['P2', (x: typeof p1) => { p2 = x; }]] as const) {
      const p = await ok('POST', '/v1/projekte', ue, { name: `Projekt ${phase}`, portfolioId: portfolio, phase }, 201);
      await ok('PUT', `/v1/projekte/${p.id}/organisation`, { ...ue, 'if-match': 'W/"0"' }, { mitglieder: [
        { personId: pl, funktion: 'pl', akv: '' }, { personId: ctl, funktion: 'ctl', akv: '' }, { personId: sp, funktion: 'sp', akv: '' },
      ] });
      set({ id: p.id, nummer: p.nummer });
    }
    const m = await login(api, 'demo', 'u-mitglied', null);
    await grant(api, tenantId, `user:${m.principalId}`, 'gremium', { type: 'portfolio', id: portfolio });
    mitglied = { authorization: m.authorization };

    // Probe-Arten: gate mit Folge (wie vertrag, AP-E3-3), eskalation und meilenstein ohne Folge (wie statusbericht,
    // AP-E2-4); die Ergebnisse von meilenstein entsprechen K3 Schritt 8
    probeArt({
      art: 'gate',
      ergebnisse: [{ schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'mit_auflagen', label: 'Mit Auflagen freigegeben' },
        { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }, { schluessel: 'abgelehnt', label: 'Gestoppt' }],
      beiEntscheid: async (tx, e, k) => {
        // in der Transaktion des Entscheids: sieht den Entscheid schon
        const n = (await tx.query('SELECT 1 FROM ppm.entscheid WHERE traktandum_id = $1', [e.traktandumId])).rowCount;
        assert.equal(n, 1);
        folgen.push(e);
        kontexte.push(k);
      },
    });
    probeArt({ art: 'eskalation', ergebnisse: [{ schluessel: 'erledigt', label: 'Erledigt mit Massnahme' }, { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }] });
    probeArt({ art: 'meilenstein', ergebnisse: [{ schluessel: 'abgenommen', label: 'Abgenommen' }, { schluessel: 'nicht_abgenommen', label: 'Nicht abgenommen' }] });

    // Traktanden: Gate P2 (PRAT entscheidet), Gate P1 (via SNS-VR), zwei Eskalationen, Meilenstein
    const v = [
      { k: 'gateP2', art: 'gate', bezug: 'g-p2', projekt: () => p2.id, titel: 'Gate P2–P3' },
      { k: 'gateP1', art: 'gate', bezug: 'g-p1', projekt: () => p1.id, titel: 'Gate P1–P2' },
      { k: 'esk1', art: 'eskalation', bezug: 'e-1', projekt: () => p2.id, titel: 'Eskalation Lieferverzug' },
      { k: 'esk2', art: 'eskalation', bezug: 'e-2', projekt: () => p2.id, titel: 'Eskalation Budget' },
      { k: 'ms', art: 'meilenstein', bezug: 'm-1', projekt: () => p2.id, titel: 'Meilenstein Konzept' },
    ] as const;
    const s = await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin1 }, 201);
    let r = s;
    for (const x of v) {
      const id = await sys(tx => traktandum.vorschlagen(tx, { art: x.art, bezug: { typ: x.art, id: x.bezug }, projektId: x.projekt(), titel: x.titel, antrag: `Antrag ${x.titel}` }));
      r = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: id });
      tid[x.k] = id;
    }
    r = await ok('POST', `/v1/sitzungen/${s.id}/versenden`, { ...ue, 'if-match': `W/"${r.version}"` });
    sitzung = { id: s.id, version: r.version };
  });
  after(async () => { for (const w of wiederherstellen.reverse()) w(); await api?.close(); });

  const entscheid = (k: string, body: unknown, headers: Record<string, string> = {}) => call('PUT', `/v1/traktanden/${tid[k]}/entscheid`, { ...ue, ...headers }, body);

  test('Sitzung starten: erst nach dem Versand, mit If-Match; Optionen je Art (K3 Schritt 7–8)', async () => {
    assert.equal((await entscheid('gateP2', { ergebnis: 'freigegeben', begruendung: 'gut' })).statusCode, 409, 'erst starten');
    const m = await ok('GET', `/v1/sitzungen/${sitzung.id}/entscheide`, ue);
    assert.deepEqual([m.stand, m.can, m.ohneEntscheid], ['versendet', { starten: true, erfassen: false, schliessen: false }, 5]);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/starten`, ue)).statusCode, 428);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/starten`, { ...mitglied, 'if-match': `W/"${sitzung.version}"` })).statusCode, 403);
    const s = await ok('POST', `/v1/sitzungen/${sitzung.id}/starten`, { ...ue, 'if-match': `W/"${sitzung.version}"` });
    assert.deepEqual([s.stand, s.can.erfassen, s.can.schliessen], ['laufend', true, true]);
    const opt = Object.fromEntries(s.traktanden.map((t: { traktandumId: string; optionen: { schluessel: string }[] }) => [t.traktandumId, t.optionen.map(o => o.schluessel)]));
    assert.deepEqual(opt[tid.ms!], ['abgenommen', 'nicht_abgenommen']);
    assert.deepEqual(optionen('jahresrueckblick').map(o => o.schluessel), ['verabschiedet', 'anpassungen'], 'unregistrierte Art: Ergebnisse aus K3');
    assert.deepEqual(optionen('portfoliobericht'), [], 'Kenntnisnahme');
    assert.deepEqual(opt[tid.esk1!], ['erledigt', 'zurueckgestellt'], 'Registry geht vor');
    sitzung.version = s.version;
  });

  test('Entscheid erfassen: Begründung Pflicht, Auflagen bei «mit Auflagen», Folge sofort, Benachrichtigung erst beim Schliessen', async () => {
    let r = await entscheid('gateP2', { ergebnis: 'freigegeben', begruendung: '  ' });
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().detail ?? r.json().title, 'Begründung fehlt: Sie erscheint im Protokoll und beim Projekt.');
    assert.equal((await entscheid('gateP2', { ergebnis: 'abgenommen', begruendung: 'x' })).statusCode, 422, 'Ergebnis der Art');
    assert.equal((await entscheid('gateP2', { ergebnis: 'mit_auflagen', begruendung: 'x' })).statusCode, 422, 'mindestens eine Auflage');
    assert.equal((await entscheid('gateP2', { ergebnis: 'mit_auflagen', begruendung: 'x', auflagen: [{ text: 'a', verantwortlich: '00000000-0000-4000-8000-000000000009', termin: '2026-12-01' }] })).statusCode, 422);
    assert.equal((await call('PUT', `/v1/traktanden/${tid.gateP2}/entscheid`, mitglied, { ergebnis: 'freigegeben', begruendung: 'x' })).statusCode, 403);
    const vorher = (await mitteilungen(pl)).length;

    const termin = mittwochIn(70);
    const t0 = Date.now();
    r = await entscheid('gateP2', { ergebnis: 'mit_auflagen', begruendung: 'Business Case überzeugt', auflagen: [{ text: 'Risikoplan nachreichen', verantwortlich: pl, termin }] });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(Date.now() - t0 < 5000, 'Erfassen in Sekunden (K3-3; Messung im Sitzungsmodus folgt im E2E)');
    const e = r.json();
    assert.deepEqual([e.ergebnis, e.label, e.stellungnahme, e.auflagen.length, e.auflagen[0].verantwortlich.id, e.verlauf.length, e.can.korrigieren],
      ['mit_auflagen', 'Mit Auflagen freigegeben', false, 1, pl, 1, true]);
    // Folge der Art sofort, vor dem Schliessen (K3 Abnahme «Phase und Baseline stehen richtig, bevor die Sitzung geschlossen wird»)
    assert.deepEqual(folgen.map(f => [f.traktandumId, f.ergebnis, f.viaSns, f.bezug.id]), [[tid.gateP2, 'mit_auflagen', false, 'g-p2']]);
    // Kontext: die UE als Akteur, Sitzung und Traktandum, noch kein früheres Ergebnis, Zugang zu Datenbank und Tupeln
    const k = kontexte[0]!;
    assert.deepEqual([k.principalId, k.akteur.principal?.principalId, k.sitzungId, k.traktandumId, k.vorher], [ueId, ueId, sitzung.id, tid.gateP2, null]);
    assert.equal(typeof k.db.query, 'function');
    assert.equal(typeof k.tuples, 'object');
    // keine Mitteilung und keine Aufgabe vor dem Schliessen
    assert.equal((await mitteilungen(pl)).length, vorher);
    assert.equal((await aufgaben('auflage.erfuellen')).length, 0);
    const t = await ok('GET', `/v1/traktanden/${tid.gateP2}`, ue);
    assert.equal(t.stand, 'entschieden');
  });

  test('Korrektur bis zum Schliessen mit Verlauf (A-30, UX-OF-9)', async () => {
    const vorher = await ok('GET', `/v1/traktanden/${tid.gateP2}/entscheid`, ue);
    assert.equal((await entscheid('gateP2', { ergebnis: 'freigegeben', begruendung: 'x' })).statusCode, 428);
    assert.equal((await entscheid('gateP2', { ergebnis: 'freigegeben', begruendung: 'x' }, { 'if-match': 'W/"9"' })).statusCode, 412);
    const r = await entscheid('gateP2', { ergebnis: 'mit_auflagen', begruendung: 'Business Case überzeugt, Termin knapp', anVr: true,
      auflagen: [{ text: 'Risikoplan nachreichen', verantwortlich: pl, termin: mittwochIn(70) }, { text: 'Terminplan bestätigen', verantwortlich: sp, termin: mittwochIn(63) }] },
    { 'if-match': `W/"${vorher.version}"` });
    assert.equal(r.statusCode, 200, r.body);
    const e = r.json();
    assert.deepEqual([e.version, e.anVr, e.auflagen.map((a: { text: string }) => a.text), e.verlauf.map((v: { version: number; begruendung: string }) => v.version)],
      [2, true, ['Risikoplan nachreichen', 'Terminplan bestätigen'], [1, 2]]);
    assert.equal(folgen.length, 2, 'Folge erneut mit dem korrigierten Entscheid');
    // bei Korrektur das zuvor erfasste Ergebnis im Kontext (A-30)
    assert.deepEqual([folgen[1]!.ergebnis, kontexte[1]?.vorher], ['mit_auflagen', { ergebnis: 'mit_auflagen', begruendung: 'Business Case überzeugt' }]);
  });

  test('Via SNS-VR: Stellungnahme ohne Folge; übrige Entscheide; Mitglied liest (UC-006 A1)', async () => {
    const r = await entscheid('gateP1', { ergebnis: 'freigegeben', begruendung: 'PRAT empfiehlt die Freigabe' });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().stellungnahme, r.json().can.snsErfassen], [true, false]);
    assert.equal(folgen.length, 2, 'keine Folge vor dem SNS-VR');
    assert.equal((await entscheid('esk1', { ergebnis: 'zurueckgestellt', begruendung: 'Massnahme unklar' })).statusCode, 200);
    assert.equal((await entscheid('ms', { ergebnis: 'abgenommen', begruendung: 'Konzept liegt vor' })).statusCode, 200);

    const m = await ok('GET', `/v1/sitzungen/${sitzung.id}/entscheide`, mitglied);
    assert.deepEqual([m.can.erfassen, m.ohneEntscheid, m.traktanden.filter((t: { entscheid: unknown }) => t.entscheid).length], [false, 1, 4]);
    assert.equal((await call('GET', `/v1/sitzungen/${sitzung.id}/entscheide`, nobody)).statusCode, 404);
  });

  test('Schliessen: Folgevorschläge, Auflagen als Aufgaben, Mitteilungen gebündelt, Protokollentwurf (UC-006 Schritt 8, A3)', async () => {
    const s0 = await ok('GET', `/v1/sitzungen/${sitzung.id}/entscheide`, ue);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/schliessen`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 412);
    const vorPl = (await mitteilungen(pl)).length;
    const r = await ok('POST', `/v1/sitzungen/${sitzung.id}/schliessen`, { ...ue, 'if-match': `W/"${s0.version}"` });
    assert.deepEqual([r.nichtBehandelt, r.zurueckgestellt, r.auflagen, r.sitzung.stand, r.sitzung.traktanden.length], [1, 1, 2, 'geschlossen', 5], 'mit dem festen Traktandum 1');

    // PL: genau eine neue, gebündelte Mitteilung (I-B3)
    const neu = (await mitteilungen(pl)).slice(vorPl);
    assert.equal(neu.length, 1, JSON.stringify(neu));
    assert.match(neu[0]!.text, /^PRAT \w\w \d+\.\d+\.: /);
    for (const teil of ['Gate P2–P3: Mit Auflagen freigegeben', 'Gate P1–P2: Stellungnahme Freigegeben, Entscheid SNS-VR ausstehend',
      'Eskalation Budget: nicht behandelt', 'Auflage bis']) assert.ok(neu[0]!.text.includes(teil), `${teil} in ${neu[0]!.text}`);

    const auf = await aufgaben('auflage.erfuellen');
    assert.deepEqual(auf.map(a => [a.empfaenger_person, a.frist, a.stand]).sort(), [[pl, mittwochIn(70), 'offen'], [sp, mittwochIn(63), 'offen']].sort());
    const prot = await aufgaben('protokoll.versenden');
    assert.deepEqual([prot.length, prot[0]!.bezug_id, prot[0]!.stand], [1, sitzung.id, 'offen']);
    assert.ok(prot[0]!.frist && prot[0]!.frist > termin1, 'Frist nach der Sitzung');
    assert.ok((await aufgaben('sitzung.lesen')).every(a => a.stand !== 'offen'));

    // Entscheide sind fest (A-30)
    const e = await ok('GET', `/v1/traktanden/${tid.gateP2}/entscheid`, ue);
    assert.equal((await entscheid('gateP2', { ergebnis: 'freigegeben', begruendung: 'x' }, { 'if-match': `W/"${e.version}"` })).statusCode, 409);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/schliessen`, { ...ue, 'if-match': `W/"${r.sitzung.version}"` })).statusCode, 409);

    // Nicht behandelt und zurückgestellt: Vorschläge der nächsten Sitzung mit Herkunft
    const n = await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin2 }, 201);
    const vs = await ok('GET', `/v1/sitzungen/${n.id}/vorschlaege`, ue);
    const esk = vs.gruppen.find((g: { art: string }) => g.art === 'eskalation').traktanden;
    assert.deepEqual(esk.map((t: { titel: string; verschobenVon: string }) => [t.titel, t.verschobenVon]).sort(),
      [['Eskalation Budget', termin1], ['Eskalation Lieferverzug', termin1]]);
    assert.equal(esk.find((t: { titel: string }) => t.titel === 'Eskalation Budget').id, tid.esk2, 'dasselbe Traktandum');
  });

  test('Entscheid des SNS-VR nach dem Schliessen: Folge jetzt, einmal (UC-006 A1, A-02)', async () => {
    const e = await ok('GET', `/v1/traktanden/${tid.gateP1}/entscheid`, ue);
    assert.equal(e.can.snsErfassen, true);
    assert.equal((await call('PUT', `/v1/traktanden/${tid.gateP2}/entscheid/sns`, { ...ue, 'if-match': 'W/"2"' }, { ergebnis: 'freigegeben', begruendung: 'x' })).statusCode, 409, 'nicht via SNS-VR');
    const r = await ok('PUT', `/v1/traktanden/${tid.gateP1}/entscheid/sns`, { ...ue, 'if-match': `W/"${e.version}"` }, { ergebnis: 'freigegeben', begruendung: 'SNS-VR stimmt zu' });
    assert.deepEqual([r.sns.ergebnis, r.sns.label, r.can.snsErfassen], ['freigegeben', 'Freigegeben', false]);
    assert.deepEqual(folgen.at(-1) && [folgen.at(-1)!.traktandumId, folgen.at(-1)!.viaSns, folgen.at(-1)!.ergebnis], [tid.gateP1, true, 'freigegeben']);
    assert.deepEqual([kontexte.at(-1)?.principalId, kontexte.at(-1)?.vorher], [ueId, null], 'SNS-VR: die UE erfasst (A-02)');
    assert.equal((await call('PUT', `/v1/traktanden/${tid.gateP1}/entscheid/sns`, { ...ue, 'if-match': `W/"${r.version}"` }, { ergebnis: 'abgelehnt', begruendung: 'x' })).statusCode, 409);
    assert.ok((await mitteilungen(sp)).some(m => m.text.includes('Entscheid SNS-VR Freigegeben')));
  });

  test('Protokoll: Entwurf nur für sitzung:write, bereinigen, Vorschau, versenden (UC-006 Schritt 9, K3-4)', async () => {
    assert.equal((await call('GET', `/v1/sitzungen/${sitzung.id}/protokoll`, mitglied)).statusCode, 404, 'Entwurf erst ab Versand');
    const p = await ok('GET', `/v1/sitzungen/${sitzung.id}/protokoll`, ue);
    assert.deepEqual([p.stand, p.can.write, p.inhalt.kopf.gremium.kuerzel], ['entwurf', true, 'prat']);
    const beh = Object.fromEntries(p.inhalt.traktanden.map((t: { traktandumId: string; behandlung: string }) => [t.traktandumId, t.behandlung]));
    assert.deepEqual([beh[tid.gateP2!], beh[tid.esk2!], beh[tid.ms!]], ['entschieden', 'nicht_behandelt', 'entschieden']);
    const g = p.inhalt.traktanden.find((t: { traktandumId: string }) => t.traktandumId === tid.gateP2);
    assert.deepEqual([g.entscheid.label, g.entscheid.begruendung, g.entscheid.auflagen.length, g.entscheid.anVr], ['Mit Auflagen freigegeben', 'Business Case überzeugt, Termin knapp', 2, true]);
    assert.ok(p.frist.bis > termin1);

    assert.equal((await call('PUT', `/v1/sitzungen/${sitzung.id}/protokoll`, { ...ue, 'if-match': `W/"${p.version}"` }, { notizen: [{ traktandumId: '00000000-0000-4000-8000-000000000009', notiz: 'x' }] })).statusCode, 422);
    const b = await ok('PUT', `/v1/sitzungen/${sitzung.id}/protokoll`, { ...ue, 'if-match': `W/"${p.version}"` }, { anwesende: 'Alle Mitglieder', notizen: [{ traktandumId: tid.gateP2, notiz: 'Diskussion zum Termin' }] });
    assert.deepEqual([b.version, b.inhalt.anwesende, b.inhalt.traktanden.find((t: { traktandumId: string }) => t.traktandumId === tid.gateP2).notiz], [p.version + 1, 'Alle Mitglieder', 'Diskussion zum Termin']);

    const v = await ok('GET', `/v1/sitzungen/${sitzung.id}/protokoll/versand`, ue);
    assert.ok([pl, sp].every(x => v.beteiligte.some((b2: { personId: string }) => b2.personId === x)));
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/protokoll/versenden`, { ...ue, 'if-match': `W/"${p.version}"` })).statusCode, 412);
    const vorSp = (await mitteilungen(sp)).length;
    const r = await ok('POST', `/v1/sitzungen/${sitzung.id}/protokoll/versenden`, { ...ue, 'if-match': `W/"${b.version}"` });
    assert.deepEqual([r.stand, r.can.write, r.frist.eingehalten], ['versendet', false, true]);
    assert.equal((await mitteilungen(sp)).length, vorSp + 1);
    assert.equal((await ok('GET', `/v1/sitzungen/${sitzung.id}/protokoll`, mitglied)).stand, 'versendet');
    assert.equal((await ok('GET', `/v1/sitzungen/${sitzung.id}/entscheide`, ue)).stand, 'protokoll_versendet');
    assert.equal((await aufgaben('protokoll.versenden'))[0]!.stand, 'erledigt');
    const audit = await sys(async tx => (await tx.query<{ data: { nachSitzung: number; fristEingehalten: boolean } }>("SELECT data FROM ppm.audit_log WHERE action = 'protokoll.dispatched'")).rows);
    assert.deepEqual([audit.length, audit[0]!.data.fristEingehalten], [1, true]);
    assert.equal((await call('PUT', `/v1/sitzungen/${sitzung.id}/protokoll`, { ...ue, 'if-match': `W/"${r.version}"` }, { anwesende: 'x' })).statusCode, 409);
  });

  test('Entscheide und Auflagen: Liste mit Filtern, Auflage erledigt melden (UI-36, UC-006 A3, A4)', async () => {
    const l = await ok('GET', '/v1/entscheide?gremium=prat&limit=2', ue);
    assert.equal(l.items.length, 2);
    assert.ok(l.nextCursor);
    const l2 = await ok('GET', `/v1/entscheide?gremium=prat&cursor=${l.nextCursor}`, ue);
    assert.equal(l.items.length + l2.items.length, 4);
    assert.equal(new Set([...l.items, ...l2.items].map((e: { id: string }) => e.id)).size, 4);
    assert.deepEqual((await ok('GET', '/v1/entscheide?anVr=true', ue)).items.map((e: { traktandumId: string }) => e.traktandumId), [tid.gateP2]);
    assert.equal((await ok('GET', `/v1/entscheide?projektId=${p1.id}`, ue)).items.length, 1);
    const offen = await ok('GET', '/v1/entscheide?auflagen=offen', ue);
    assert.equal(offen.items.length, 1);
    const auflage = offen.items[0].auflagen.find((a: { verantwortlich: { id: string } }) => a.verantwortlich.id === pl);

    // PL ist eingeladen und sieht den Entscheid; nur die verantwortliche Person (oder sitzung:write) meldet erledigt
    assert.equal((await call('POST', `/v1/auflagen/${auflage.id}/erfuellen`, nobody)).statusCode, 404);
    const a = await ok('POST', `/v1/auflagen/${auflage.id}/erfuellen`, plH);
    assert.deepEqual([a.stand, a.can.erfuellen], ['erfuellt', false]);
    assert.equal((await aufgaben('auflage.erfuellen')).find(x => x.bezug_id === auflage.id)!.stand, 'erledigt');
    assert.equal((await ok('POST', `/v1/auflagen/${auflage.id}/erfuellen`, plH)).stand, 'erfuellt', 'wiederholt ohne Wirkung');
    assert.equal((await ok('GET', '/v1/entscheide?auflagen=offen', ue)).items.length, 1, 'Auflage des SP noch offen');
    assert.equal((await call('GET', '/v1/entscheide', nobody)).statusCode, 403);
  });
});
