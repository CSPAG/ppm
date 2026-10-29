/**
 * Sitzungen vorbereiten (BC PP.04.01, PP.04.05; UC-006 Schritte 1–5, A1, A2; Abnahme K3): Vorschläge aus der Registry,
 * Aufnehmen mit Zeitbedarf und Einladungen, «via SNS-VR» aus dem Gremienweg, Unterlagenstand mit Verschieben, Versand mit
 * Vorschau und Protokoll, Lesesicht vor und nach dem Versand, Aufgabe «Sitzung vorbereiten» aus dem Lauf der Fristen.
 */
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { grant, login, person, testApi, type TestApi } from './api.ts';
import { registriereTraktandenart, traktandum } from '../../src/modules/sitzung/index.ts';
import { _abmelden, traktandenart, type Traktandenart } from '../../src/modules/sitzung/arten.ts';
import { fristenPruefen } from '../../src/modules/sitzung/fristen.ts';
import { heute, kurzDatum as kurz } from '../../src/modules/sitzung/format.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

/** Datum n Kalendertage nach heute, auf den nächsten Mittwoch gelegt (Sitzungstag). */
function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Unterlagen der Probe-Art «gate» je Projekt: Quality-Check bestanden oder offen. */
const qc = new Map<string, 'bestanden' | 'offen'>();

describe('Sitzungen vorbereiten', () => {
  let api: TestApi;
  let tenantId: string;
  let ue: Record<string, string>, gl: Record<string, string>, mitglied: Record<string, string>, plH: Record<string, string>, nobody: Record<string, string>;
  let pl: string, ctl: string, sp: string;
  let portfolio: string, prat: string;
  let p1: { id: string; nummer: string }, p2: { id: string; nummer: string };
  let gateVorher: Traktandenart | undefined;
  let abschlussVorher: Traktandenart | undefined;
  const termin1 = mittwochIn(28), termin2 = mittwochIn(56);

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, url: string, headers: Record<string, string>, payload?: unknown, status = 200) => {
    const r = await call(method, url, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r.json();
  };
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'alle-fuehren');
    tenantId = u.tenantId;
    ue = { authorization: u.authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'alle-lesen')).authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
    const adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };

    // Phasenmodell in Kraft (Fristen sitzung_vorbereiten 15, versand 5 Arbeitstage, A-27)
    const pm = await call('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' });
    assert.equal(pm.statusCode, 201, pm.body);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, { ...adm, 'if-match': pm.headers.etag as string });

    // Portfolio A mit PRAT und SNS-VR; Gremienweg P0–P1 und P1–P2 zusätzlich über den SNS-VR (Q8 Kap. 5.1)
    portfolio = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).id;
    prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).id;
    const sns = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolio, kuerzel: 'sns-vr', name: 'SNS-VR', art: 'extern' }, 201)).id;
    await ok('PUT', `/v1/portfolios/${portfolio}/gremienweg`, { ...ue, 'if-match': 'W/"1"' }, { schritte: [
      { gate: 'P0_P1', gremiumId: prat, zusaetzlichGremiumId: sns }, { gate: 'P1_P2', gremiumId: prat, zusaetzlichGremiumId: sns }, { gate: 'P2_P3', gremiumId: prat },
    ] });
    for (const datum of [termin1, termin2]) await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum }, 201);

    // Projekte in P1 und P2 mit Projektorganisation
    [pl, ctl, sp] = [await person(api, tenantId, 'u-pl'), await person(api, tenantId, 'u-ctl'), await person(api, tenantId, 'u-sp')];
    // alle Mitglieder sind Antragstellende an der Organisation (A-46), Projektrollen setzt die Projektorganisation
    plH = { authorization: (await login(api, 'demo', 'u-pl', 'mitglied')).authorization };
    for (const [phase, set] of [['P1', (x: typeof p1) => { p1 = x; }], ['P2', (x: typeof p1) => { p2 = x; }]] as const) {
      const p = await ok('POST', '/v1/projekte', ue, { name: `Projekt ${phase}`, portfolioId: portfolio, phase }, 201);
      await ok('PUT', `/v1/projekte/${p.id}/organisation`, { ...ue, 'if-match': 'W/"0"' }, { mitglieder: [
        { personId: pl, funktion: 'pl', akv: '' }, { personId: ctl, funktion: 'ctl', akv: '' }, { personId: sp, funktion: 'sp', akv: '' },
      ] });
      set({ id: p.id, nummer: p.nummer });
    }

    // Mitglied des PRAT: Rolle «gremium» am Portfolio (A-45)
    const m = await login(api, 'demo', 'u-mitglied', null);
    await grant(api, tenantId, `user:${m.principalId}`, 'gremium', { type: 'portfolio', id: portfolio });
    mitglied = { authorization: m.authorization };

    // Probe-Arten: gate statt der Art aus vertrag (AP-E3-3, danach wiederhergestellt), abschluss ohne Unterlagen
    gateVorher = traktandenart('gate');
    _abmelden('gate');
    registriereTraktandenart({
      art: 'gate', ergebnisse: [{ schluessel: 'freigegeben', label: 'Freigegeben' }],
      zusammenfassung: async (_tx, b) => ({ antrag: `Freigabe Gate für ${b.projektId === p1.id ? p1.nummer : p2.nummer}` }),
      unterlagen: async (_tx, b) => {
        const q = qc.get(b.projektId ?? '') ?? 'bestanden';
        return [{ art: 'packet', titel: 'Gate Review Packet', bereit: q === 'bestanden', qualityCheck: q, hinweis: q === 'bestanden' ? 'Quality-Check bestanden' : 'Quality-Check offen' }];
      },
    });
    // abschluss statt der Art aus dem Modul abschluss (AP-E7-1, danach wiederhergestellt)
    abschlussVorher = traktandenart('abschluss');
    _abmelden('abschluss');
    registriereTraktandenart({ art: 'abschluss', ergebnisse: [{ schluessel: 'erledigt', label: 'Erledigt mit Massnahme' }] });
  });
  after(async () => {
    _abmelden('gate'); _abmelden('abschluss');
    if (gateVorher) registriereTraktandenart(gateVorher);
    if (abschlussVorher) registriereTraktandenart(abschlussVorher);
    await api?.close();
  });

  let sitzung: { id: string; version: number };

  test('Vorschläge aufnehmen: Gate-Review 35 Min. mit PL, CTL, SP; «via SNS-VR» aus dem Gremienweg (K3 Abnahme 1–3)', async () => {
    // Module schlagen vor (in ihrer Transaktion, ohne sitzung:write), idempotent je Geschäft
    const g1 = await sys(tx => traktandum.vorschlagen(tx, { art: 'gate', bezug: { typ: 'gate_antrag', id: 'g-p1' }, projektId: p1.id, titel: `Gate P1–P2 ${p1.nummer}` }));
    assert.equal(await sys(tx => traktandum.vorschlagen(tx, { art: 'gate', bezug: { typ: 'gate_antrag', id: 'g-p1' }, projektId: p1.id, titel: `Gate P1–P2 ${p1.nummer}`, antrag: 'Freigabe Phase P2' })), g1);
    await sys(tx => traktandum.vorschlagen(tx, { art: 'gate', bezug: { typ: 'gate_antrag', id: 'g-p2' }, projektId: p2.id, titel: `Gate P2–P3 ${p2.nummer}` }));
    await sys(tx => traktandum.vorschlagen(tx, { art: 'abschluss', bezug: { typ: 'abschlussbericht', id: 'a-1' }, projektId: p2.id, titel: 'Eskalation Lieferverzug' }));

    const s = await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin1 }, 201);
    assert.deepEqual([s.stand, s.traktanden.length, s.can.write, s.frist.arbeitstage], ['geplant', 1, true, 5]);
    // festes Traktandum 1 (K3 Schritt 4): ohne Portfoliobericht ein Platzhalter
    const fest = s.traktanden[0];
    assert.deepEqual([fest.titel, fest.art, fest.fest, fest.position, fest.bezug.typ, fest.unterlagen.stand], ['Bericht der Programmleitung', 'portfoliobericht', true, 1, 'sitzung', 'fehlt']);
    assert.equal((await call('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin1 })).statusCode, 409);
    assert.equal((await call('POST', '/v1/gremien/prat/sitzungen', ue, { datum: mittwochIn(200) })).statusCode, 422, 'nur zu einem Termin');

    const v = await ok('GET', `/v1/sitzungen/${s.id}/vorschlaege`, ue);
    assert.deepEqual(v.gruppen.map((x: { art: string; traktanden: unknown[] }) => [x.art, x.traktanden.length]), [['gate', 2], ['abschluss', 1]]);
    assert.equal(v.gruppen[0].traktanden[0].antrag, 'Freigabe Phase P2');

    let r = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: g1 });
    const t1 = r.traktanden[1];
    assert.deepEqual([t1.dauerMin, t1.viaSns, t1.position, t1.zeit, r.stand, t1.fest], [35, true, 2, null, 'in_vorbereitung', false]);
    assert.deepEqual(t1.einladungen.map((e: { funktion: string; personId: string }) => [e.funktion, e.personId]), [['pl', pl], ['ctl', ctl], ['sp', sp]]);
    assert.deepEqual([t1.unterlagen.stand, t1.unterlagen.liste[0].titel], ['bereit', 'Gate Review Packet']);

    const g2 = v.gruppen[0].traktanden[1].id;
    const esk = v.gruppen[1].traktanden[0].id;
    r = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: g2 });
    r = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: esk });
    assert.deepEqual(r.traktanden.map((t: { viaSns: boolean; dauerMin: number | null; unterlagen: { stand: string } }) => [t.viaSns, t.dauerMin, t.unterlagen.stand]),
      [[false, null, 'fehlt'], [true, 35, 'bereit'], [false, 35, 'bereit'], [false, null, 'keine']], 'P2 nicht über den SNS-VR; Eskalation ohne Unterlagen');
    assert.equal(r.zeitbedarfMin, 70);
    assert.deepEqual((await ok('GET', `/v1/sitzungen/${s.id}/vorschlaege`, ue)).gruppen, []);

    // Zeitfenster ab Beginn, Dauer gegen die Sitzungsdauer
    r = await ok('PATCH', `/v1/sitzungen/${s.id}`, { ...ue, 'if-match': `W/"${r.version}"` }, { beginn: '14:00', dauerMin: 180, ort: 'Sitzungszimmer 1' });
    assert.deepEqual(r.traktanden.map((t: { zeit: string }) => t.zeit), ['14:00', '14:00', '14:35', '15:10']);

    // Ordnen nur mit If-Match und vollständig
    const ids = r.traktanden.map((t: { id: string }) => t.id);
    assert.equal((await call('PUT', `/v1/sitzungen/${s.id}/traktanden`, { ...ue, 'if-match': 'W/"1"' }, { reihenfolge: ids })).statusCode, 412);
    assert.equal((await call('PUT', `/v1/sitzungen/${s.id}/traktanden`, { ...ue, 'if-match': `W/"${r.version}"` }, { reihenfolge: ids.slice(1) })).statusCode, 422);
    // das feste Traktandum bleibt an Position 1, lässt sich weder entfernen noch verschieben (409)
    const gesperrt = await call('PUT', `/v1/sitzungen/${s.id}/traktanden`, { ...ue, 'if-match': `W/"${r.version}"` }, { reihenfolge: [ids[1], ids[0], ids[2], ids[3]] });
    assert.deepEqual([gesperrt.statusCode, gesperrt.json().reason], [409, 'fest']);
    for (const weg of ['entfernen', 'verschieben']) {
      const x = await call('POST', `/v1/traktanden/${ids[0]}/${weg}`, ue);
      assert.deepEqual([x.statusCode, x.headers['content-type'], x.json().reason], [409, 'application/problem+json; charset=utf-8', 'fest'], weg);
    }
    r = await ok('PUT', `/v1/sitzungen/${s.id}/traktanden`, { ...ue, 'if-match': `W/"${r.version}"` }, { reihenfolge: [ids[0], ids[3], ids[1], ids[2]] });
    assert.deepEqual(r.traktanden.map((t: { id: string; position: number }) => [t.id, t.position]), [[ids[0], 1], [ids[3], 2], [ids[1], 3], [ids[2], 4]]);

    // Einplanen (PP.04.05) und wieder entfernen
    r = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { art: 'gate', projektId: p2.id, titel: 'Gate eingeplant' });
    const geplant = r.traktanden.find((t: { titel: string }) => t.titel === 'Gate eingeplant');
    assert.deepEqual([geplant.bezug.typ, geplant.position, geplant.antrag], ['projekt', 5, `Freigabe Gate für ${p2.nummer}`]);
    assert.equal((await call('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { art: 'gate', projektId: p2.id })).statusCode, 409, 'Geschäft schon traktandiert');
    r = await ok('POST', `/v1/traktanden/${geplant.id}/entfernen`, ue);
    assert.equal(r.traktanden.length, 4);
    sitzung = { id: s.id, version: r.version };

    // Kopfkarte «Meine Projekte»: je Projekt das nächste traktandierte Geschäft mit Gremium und Datum
    const n = await ok('GET', `/v1/traktanden/naechste?projektId=${p1.id}&projektId=${p2.id}&projektId=${randomUUID()}`, ue);
    const fuerP1 = n.items.find((x: { projektId: string }) => x.projektId === p1.id);
    assert.deepEqual([fuerP1.art, fuerP1.sitzung.id, fuerP1.sitzung.datum, fuerP1.sitzung.gremium.kuerzel, fuerP1.eingeladen], ['gate', s.id, s.datum, 'prat', false]);
    assert.equal(new Set(n.items.map((x: { projektId: string }) => x.projektId)).size, n.items.length, 'je Projekt höchstens eines');
  });

  test('Unterlagen fehlen: Warnung, mit einem Klick auf die nächste Sitzung, rückgängig (UC-006 A2, K3 Abnahme 4)', async () => {
    qc.set(p2.id, 'offen');
    const s = await ok('GET', `/v1/sitzungen/${sitzung.id}`, ue);
    const t = s.traktanden.find((x: { projekt: { id: string } | null; art: string }) => x.art === 'gate' && x.projekt?.id === p2.id);
    assert.equal(t.unterlagen.stand, 'quality_check_offen');
    const vor = await ok('GET', `/v1/sitzungen/${sitzung.id}/versand`, ue);
    assert.deepEqual(vor.warnungen.map((w: { traktandumId: string; stand: string }) => [w.traktandumId, w.stand]).filter(([id]: string[]) => id === t.id), [[t.id, 'quality_check_offen']]);

    const v = await ok('POST', `/v1/traktanden/${t.id}/verschieben`, ue);
    assert.deepEqual([v.nach.datum, v.traktandum.stand, v.traktandum.verschobenVon, v.traktandum.einladungen], [termin2, 'verschoben', termin1, []]);
    assert.equal((await ok('GET', `/v1/sitzungen/${sitzung.id}`, ue)).traktanden.length, 3);
    const naechste = await ok('GET', `/v1/gremien/prat/sitzungen/${termin2}`, ue);
    const vs = await ok('GET', `/v1/sitzungen/${naechste.id}/vorschlaege`, ue);
    // verschobene zuerst in ihrer Art; danach der vorhin entfernte Vorschlag ohne Sitzung
    assert.deepEqual(vs.gruppen[0].traktanden.map((x: { id: string; verschobenVon: string | null }) => [x.id === t.id, x.verschobenVon]), [[true, termin1], [false, null]]);

    // Rückgängig: in der ursprünglichen Sitzung wieder aufnehmen, dann endgültig verschieben
    let r = await ok('POST', `/v1/sitzungen/${sitzung.id}/traktanden`, ue, { vorschlagId: t.id });
    assert.equal(r.traktanden.length, 4);
    await ok('POST', `/v1/traktanden/${t.id}/verschieben`, ue);
    r = await ok('GET', `/v1/sitzungen/${sitzung.id}`, ue);
    assert.deepEqual(r.traktanden.map((x: { position: number }) => x.position), [1, 2, 3]);
    sitzung.version = r.version;
    qc.delete(p2.id);
  });

  test('Lesesicht vor dem Versand: Mitglieder und GL sehen keine Traktanden, Eingeladene nichts', async () => {
    const m = await ok('GET', `/v1/sitzungen/${sitzung.id}`, mitglied);
    assert.deepEqual([m.traktanden, m.can.write], [[], false]);
    assert.deepEqual((await ok('GET', `/v1/sitzungen/${sitzung.id}`, gl)).traktanden, []);
    assert.equal((await call('GET', `/v1/sitzungen/${sitzung.id}`, plH)).statusCode, 404);
    assert.equal((await call('GET', `/v1/sitzungen/${sitzung.id}/vorschlaege`, mitglied)).statusCode, 403);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/traktanden`, gl, { art: 'abschluss' })).statusCode, 403);
    assert.equal((await call('GET', '/v1/gremien/prat/sitzungen', nobody)).statusCode, 403);
  });

  test('Versand: Vorschau, Protokoll mit Arbeitstagen, Einladungen gebündelt, Mitglieder lesen ab Versand (K3 Abnahme 5, K3-1)', async () => {
    // Zur Eskalation nur den Sponsor einladen (Eingeladene festlegen, UC-006 Schritt 2)
    const esk = (await ok('GET', `/v1/sitzungen/${sitzung.id}`, ue)).traktanden.find((t: { art: string }) => t.art === 'abschluss');
    assert.equal((await call('PUT', `/v1/traktanden/${esk.id}/einladungen`, { ...ue, 'if-match': 'W/"99"' }, { einladungen: [] })).statusCode, 412);
    assert.equal((await call('PUT', `/v1/traktanden/${esk.id}/einladungen`, { ...ue, 'if-match': `W/"${esk.version}"` }, { einladungen: [{ personId: '00000000-0000-4000-8000-000000000009', funktion: 'weitere' }] })).statusCode, 422);
    const e = await ok('PUT', `/v1/traktanden/${esk.id}/einladungen`, { ...ue, 'if-match': `W/"${esk.version}"` }, { einladungen: [{ personId: sp, funktion: 'sp' }] });
    assert.deepEqual(e.einladungen.map((x: { personId: string }) => x.personId), [sp]);
    sitzung.version = (await ok('GET', `/v1/sitzungen/${sitzung.id}`, ue)).version;

    const vor = await ok('GET', `/v1/sitzungen/${sitzung.id}/versand`, ue);
    assert.deepEqual([vor.traktanden, vor.unterlagen, vor.eingeladene, vor.warnungen.map((w: { titel: string; stand: string }) => [w.titel, w.stand]), vor.verschoben, vor.frist.eingehalten],
      [3, { packet: 1, bericht: 0, beilage: 0 }, 3, [['Bericht der Programmleitung', 'fehlt']], 1, true]);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/versenden`, ue)).statusCode, 428);
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/versenden`, { ...ue, 'if-match': 'W/"1"' })).statusCode, 412);
    const s = await ok('POST', `/v1/sitzungen/${sitzung.id}/versenden`, { ...ue, 'if-match': `W/"${sitzung.version}"` });
    assert.equal(s.stand, 'versendet');
    assert.ok(s.versendetAt);
    assert.equal(s.versandVorlauf, s.frist.vorlauf);
    assert.ok(s.versandVorlauf >= 5);
    assert.equal(s.can.write, false);
    assert.equal(s.traktanden.find((t: { art: string }) => t.art === 'gate').unterlagen.liste[0].hinweis, 'Quality-Check bestanden', 'Stand festgehalten');
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/traktanden`, ue, { art: 'abschluss' })).statusCode, 409, 'nach dem Versand fest');
    assert.equal((await call('POST', `/v1/sitzungen/${sitzung.id}/versenden`, { ...ue, 'if-match': `W/"${s.version}"` })).statusCode, 409);

    // Protokoll: Audit sitzung.dispatched mit Vorlauf; Mitteilungen; Aufgabe «Unterlagen lesen» für die Mitglieder
    const [audit, mitteilungen] = await sys(async tx => [
      (await tx.query<{ data: { vorlauf: number; fristEingehalten: boolean } }>("SELECT data FROM ppm.audit_log WHERE action = 'sitzung.dispatched'")).rows,
      // ohne Mitteilungen zu Rollen (Projektorganisation, UC-016 Schritt 3)
      (await tx.query<{ empfaenger_person: string; text: string }>("SELECT empfaenger_person, text FROM ppm.mitteilung WHERE bezug_typ <> 'rolle' ORDER BY text")).rows,
    ] as const);
    assert.deepEqual([audit.length, audit[0]!.data.vorlauf, audit[0]!.data.fristEingehalten], [1, s.versandVorlauf, true]);
    const an = (p: string) => mitteilungen.filter(x => x.empfaenger_person === p).map(x => x.text);
    assert.equal(an(ctl).length, 1, 'je Person gebündelt');
    assert.equal(an(ctl)[0], `Du stellst am ${kurz(termin1)} im PRAT vor: ${p1.nummer} Projekt P1 · ca. 14:00.`);
    // SP ist zu beiden Geschäften eingeladen: eine Mitteilung (Eskalation ohne Zeitbedarf zuerst)
    assert.ok(an(sp).includes(`Du stellst am ${kurz(termin1)} im PRAT vor: ${p2.nummer} Projekt P2 · ca. 14:00; ${p1.nummer} Projekt P1 · ca. 14:00.`), JSON.stringify(an(sp)));
    assert.equal(an(pl).length, 2, 'Einladung und Verschiebung');
    assert.ok(an(sp).some(t => t.includes('verschoben auf')), 'SP über die Verschiebung informiert');
    assert.ok(!an(ctl).some(t => t.includes('verschoben')), 'CTL nicht');

    const eingang = (await ok('GET', '/v1/eingang', mitglied)).items.map((a: { titel: string }) => a.titel);
    assert.ok(eingang.some((t: string) => t.startsWith('Unterlagen PRAT') && t.endsWith('lesen')), JSON.stringify(eingang));

    // Mitglieder lesen ab Versand; Eingeladene nur ihr Traktandum
    assert.equal((await ok('GET', `/v1/sitzungen/${sitzung.id}`, mitglied)).traktanden.length, 3);
    const fuerPl = await ok('GET', `/v1/sitzungen/${sitzung.id}`, plH);
    assert.deepEqual(fuerPl.traktanden.map((t: { projekt: { id: string } }) => t.projekt.id), [p1.id]);
    // Kopfkarte: die eingeladene Projektleitung stellt vor (Einladung, nicht Projektrolle)
    const plN = await ok('GET', `/v1/traktanden/naechste?projektId=${p1.id}`, plH);
    assert.deepEqual(plN.items.map((x: { projektId: string; eingeladen: boolean }) => [x.projektId, x.eingeladen]), [[p1.id, true]]);
  });

  test('Lauf der Fristen: Sitzung und Aufgabe «Sitzung vorbereiten» 15 Arbeitstage vorher, idempotent (A-27)', async () => {
    const datum = mittwochIn(120);
    await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum }, 201);
    const vorher = new Date(Date.parse(`${datum}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
    const ab = new Date(Date.parse(`${datum}T00:00:00Z`) - 21 * 86_400_000).toISOString().slice(0, 10);
    assert.equal(await sys(tx => fristenPruefen(tx, vorher)), 0, 'noch nicht fällig');
    assert.ok(await sys(tx => fristenPruefen(tx, ab)) >= 1);
    await sys(tx => fristenPruefen(tx, ab));
    const s = await ok('GET', `/v1/gremien/prat/sitzungen/${datum}`, ue);
    const aufgaben = await sys(async tx => (await tx.query<{ titel: string; frist: string; frist_art: string; stand: string }>(
      "SELECT titel, to_char(frist, 'YYYY-MM-DD') AS frist, frist_art, stand FROM ppm.aufgabe WHERE art = 'sitzung.vorbereiten' AND bezug_id = $1", [s.id])).rows);
    assert.equal(aufgaben.length, 1);
    assert.match(aufgaben[0]!.titel, /^PRAT-Sitzung \w\w \d+\.\d+\. vorbereiten$/);
    assert.deepEqual([aufgaben[0]!.frist, aufgaben[0]!.frist_art, aufgaben[0]!.stand], [s.frist.bis, 'arbeitstage', 'offen']);
    const eingang = (await ok('GET', '/v1/eingang', ue)).items.map((a: { titel: string }) => a.titel);
    assert.ok(eingang.includes(aufgaben[0]!.titel));

    // Versand erledigt die Aufgabe
    const r = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { art: 'abschluss', titel: 'Eskalation ohne Projekt' });
    await ok('POST', `/v1/sitzungen/${s.id}/versenden`, { ...ue, 'if-match': `W/"${r.version}"` });
    const stand = await sys(async tx => (await tx.query<{ stand: string }>("SELECT stand FROM ppm.aufgabe WHERE art = 'sitzung.vorbereiten' AND bezug_id = $1", [s.id])).rows[0]!.stand);
    assert.equal(stand, 'erledigt');
  });

  test('Liste der Sitzungen und Kopf: Termine ohne Sitzung mit id null', async () => {
    const l = await ok('GET', '/v1/gremien/prat/sitzungen?limit=2', ue);
    assert.deepEqual(l.items.map((x: { datum: string; stand: string }) => [x.datum, x.stand]), [[termin1, 'versendet'], [termin2, 'geplant']]);
    assert.ok(l.nextCursor);
    const l2 = await ok('GET', `/v1/gremien/prat/sitzungen?cursor=${l.nextCursor}`, ue);
    assert.equal(l2.items.length, 1);
    const k = await ok('GET', '/v1/sitzungen/kopf', ue);
    assert.equal(k.sitzungen[0].datum, termin1);
    // je Gremium nur die nächste Sitzung (termin2 des PRAT fehlt)
    assert.equal(new Set(k.sitzungen.map((x: { gremium: { id: string } }) => x.gremium.id)).size, k.sitzungen.length);
    assert.ok(!k.sitzungen.some((x: { datum: string }) => x.datum === termin2));
    // Stand der Unterlagen wie in der Traktandenliste (Kopfkarte «Nächste Sitzung»)
    const s1 = await ok('GET', `/v1/sitzungen/${k.sitzungen[0].id}`, ue);
    assert.equal(k.sitzungen[0].unterlagenBereit, s1.traktanden.filter((t: { unterlagen: { stand: string } }) => ['bereit', 'keine'].includes(t.unterlagen.stand)).length);
    assert.equal((await call('GET', '/v1/gremien/unbekannt/sitzungen', ue)).statusCode, 404);
  });

  test('Suche für die Befehlspalette (I-N4): Gremium, Datum, Traktandentitel; nach Recht und Lesesicht', async () => {
    const suche = async (q: string, h: Record<string, string>) => (await ok('GET', `/v1/sitzungen?q=${encodeURIComponent(q)}`, h)).items as { id: string; datum: string; gremium: { kuerzel: string }; traktandum: string | null }[];
    const [j, m, d] = termin1.split('-');
    const s1 = (await ok('GET', `/v1/gremien/prat/sitzungen/${termin1}`, ue)).id as string;
    // Gremium (Kürzel, Name), kommende zuerst
    const g = await suche('PRAT', ue);
    assert.equal(g[0]!.id, s1);
    assert.ok(g.every(x => x.gremium.kuerzel === 'prat' && x.traktandum === null));
    assert.ok((await suche('programmaus', ue)).some(x => x.id === s1));
    // Datum: ISO, Monat, TT.MM. und TT.MM.JJJJ
    for (const q of [termin1, `${j}-${m}`, `${Number(d)}.${Number(m)}.`, `${d}.${m}.${j}`]) assert.ok((await suche(q, ue)).some(x => x.id === s1), q);
    assert.deepEqual(await suche('31.02.', ue), []);
    // Titel eines Traktandums (versendet: auch Mitglieder)
    const t = await suche('ohne Projekt', ue);
    assert.deepEqual(t.map(x => x.traktandum), ['Eskalation ohne Projekt']);
    assert.deepEqual((await suche('ohne Projekt', mitglied)).map(x => x.id), [t[0]!.id]);
    // Platzhalter sind Text, kein Muster; ohne Recht 403
    assert.deepEqual(await suche('%_', ue), []);
    assert.equal((await call('GET', '/v1/sitzungen?q=prat', nobody)).statusCode, 403);
    assert.equal((await call('GET', '/v1/sitzungen', ue)).statusCode, 422);
  });

  test('Festes Traktandum 1 «Bericht der Programmleitung»: der Vorschlag füllt den Platzhalter, einmal (K3 Schritt 4)', async () => {
    // nächste Sitzung in Vorbereitung mit Platzhalter: die zum zweiten Termin
    let s = await ok('GET', `/v1/gremien/prat/sitzungen/${termin2}`, ue);
    s = await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { art: 'abschluss', titel: 'Eskalation Termin' });
    const platzhalter = s.traktanden[0].id;
    // Vorschlag mit Recht auf die Traktandenliste (Job, UE): ersetzt den Platzhalter der nächsten Sitzung an Position 1
    const id = await sys(tx => traktandum.vorschlagen(tx, { art: 'portfoliobericht', bezug: { typ: 'portfoliobericht', id: randomUUID() }, portfolioId: portfolio, titel: 'Bericht der Programmleitung' }));
    s = await ok('GET', `/v1/sitzungen/${s.id}`, ue);
    assert.deepEqual(s.traktanden.map((t: { id: string; position: number; fest: boolean }) => [t.id === id, t.position, t.fest]), [[true, 1, true], [false, 2, false]]);
    assert.equal(s.traktanden.some((t: { id: string }) => t.id === platzhalter), false, 'Platzhalter ersetzt');
    // ein zweiter Bericht lässt sich nicht zusätzlich traktandieren
    const zweiter = await sys(tx => traktandum.vorschlagen(tx, { art: 'portfoliobericht', bezug: { typ: 'portfoliobericht', id: randomUUID() }, portfolioId: portfolio, titel: 'Bericht der Programmleitung' }));
    const x = await call('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: zweiter });
    assert.deepEqual([x.statusCode, x.json().reason], [409, 'fest']);
  });
});
