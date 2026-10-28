/**
 * Quartalsreporting an den VR (BC ZM.03.02, PC.04.02; UC-012 Schritte 3–6, A1; UC-006 A4; Kernablauf K6; AP-E6-4):
 * Entwurf aus Zielerreichung, Portfoliobericht des letzten Quartalsmonats und den zur Weiterleitung markierten Geschäften
 * (Abnahme K6: «Der Entwurf enthält die im PRAT zur Weiterleitung markierten Geschäfte»), Kommentare mit If-Match,
 * Traktandieren im PRAT, Verabschiedung und «Anpassungen verlangt» (A1) in der Sitzung, Dokument über `vorlage`,
 * Rückmeldung und Aufträge des VR als Aufgaben (Abnahme K6), ausserordentliche Weiterleitung (A-03), Lauf nach
 * Quartalsende.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { login, person, testApi, type TestApi } from './api.ts';
import { full, skipDb } from './harness.ts';
import { heute } from '../../src/modules/sitzung/format.ts';
import { letztePeriode, letztesQuartal, zeitraum } from '../../src/modules/ziel/quartal.ts';
import { quartalPruefen } from '../../src/modules/ziel/quartal-lauf.ts';

const skip = await skipDb();

type H = Record<string, string>;

function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('Quartalsreporting an den VR', { skip }, () => {
  let api: TestApi;
  let tenantId = '';
  let ue: H, gl: H, leser: H, verantwortlich: H;
  let verantwortlichId = '', portfolioA = '', prat = '', zielId = '';
  const quartal = letztesQuartal(heute());
  const laufend = `${heute().slice(0, 4)}-Q${Math.floor((Number(heute().slice(5, 7)) - 1) / 3) + 1}`;
  const termin = mittwochIn(28);
  const entscheide: Record<string, string> = {};

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, url: string, headers: H, payload?: unknown, status = 200) => {
    const r = await call(method, url, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r;
  };
  const mit = (h: H, etag: string): H => ({ ...h, 'if-match': etag });
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);
  const aufgaben = (art: string) => sys(async tx => (await tx.query<{ bezug_id: string; empfaenger_person: string | null; empfaenger_recht: string | null; stand: string; frist: string | null }>(
    "SELECT bezug_id, empfaenger_person, empfaenger_recht, stand, to_char(frist, 'YYYY-MM-DD') AS frist FROM ppm.aufgabe WHERE art = $1 ORDER BY created_at", [art])).rows);

  /** Entscheid in einer vergangenen Sitzung des Quartals (Daten wie nach AP-E2-2), `anVr` markiert. */
  async function entscheidIm(datum: string, titel: string, anVr: boolean): Promise<string> {
    return sys(async tx => {
      const s = (await tx.query<{ id: string }>("INSERT INTO ppm.sitzung (tenant_id, portfolio_id, gremium_id, datum, stand, versendet_at) VALUES ($1, $2, $3, $4, 'geschlossen', now()) RETURNING id", [tenantId, portfolioA, prat, datum])).rows[0]!.id;
      const t = (await tx.query<{ id: string }>(
        `INSERT INTO ppm.traktandum (tenant_id, portfolio_id, gremium_id, sitzung_id, art, bezug_typ, bezug_id, titel, stand, versendet_at)
         VALUES ($1, $2, $3, $4, 'eskalation', 'eskalation', $5, $6, 'entschieden', now()) RETURNING id`, [tenantId, portfolioA, prat, s, `e-${titel}`, titel])).rows[0]!.id;
      return (await tx.query<{ id: string }>(
        "INSERT INTO ppm.entscheid (tenant_id, traktandum_id, sitzung_id, ergebnis, begruendung, an_vr) VALUES ($1, $2, $3, 'erledigt', 'Budgetfreigabe nötig', $4) RETURNING id",
        [tenantId, t, s, anVr])).rows[0]!.id;
    });
  }

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    tenantId = u.tenantId;
    ue = { authorization: u.authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'gl')).authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser', 'leser')).authorization };
    const v = await login(api, 'demo', 'u-verantwortlich', null);
    verantwortlichId = v.principalId; verantwortlich = { authorization: v.authorization };
    await person(api, tenantId, 'u-andere');
    const adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    const pm = await ok('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' }, 201);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, mit(adm, pm.headers.etag as string));
    portfolioA = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).json().id;
    prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolioA, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).json().id;
    await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum: termin }, 201);

    // Ziel mit Stand im Quartal
    const feld = (await ok('POST', '/v1/handlungsfelder', adm, { label: 'Patientenorientierung' }, 201)).json().id;
    zielId = (await ok('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld, nummer: '1.1', text: 'Wartezeit senken', metrik: 'Median Wartezeit', zielwert: '−10 %' }, 201)).json().id;
    await ok('POST', `/v1/zielerreichung/${quartal}`, gl, { zielTyp: 'strategisch', zielId, stand: '−4 %', beurteilung: 'auf Kurs' }, 201);

    // Portfoliobericht des letzten Quartalsmonats (AP-E2-3), bereitgestellt
    const periode = letztePeriode(quartal);
    await sys(async tx => {
      await tx.query("INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, $2) ON CONFLICT DO NOTHING", [tenantId, periode]);
      const inhalt = {
        dashboard: { abgeschlossenAt: null, funnel: [], items: [
          { nummer: '2026-001', name: 'Neues KIS', phase: 'P2', status: 'kritisch', trend: 'abwaerts', meldung: 'gemeldet', naechsterMeilenstein: { termin: '2026-12-01', text: 'Go-live Pilot' } },
          { nummer: '2026-002', name: 'Patientenportal', phase: 'P1', status: 'im_plan', trend: null, meldung: 'nicht_gemeldet', naechsterMeilenstein: null },
        ] },
        risikolage: {
          matrix: [],
          risiken: [
            { projekt: { nummer: '2026-001', name: 'Neues KIS' }, text: 'Lieferverzug', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: 'Zweitlieferant' },
            { projekt: null, text: 'Fachkräftemangel', wahrscheinlichkeit: 'tief', auswirkung: 'hoch', massnahme: '' },
          ],
          abhaengigkeiten: [{ von: { nummer: '2026-002', name: 'Patientenportal' }, zu: { nummer: '2026-001', name: 'Neues KIS' }, text: 'Schnittstelle' }],
          eskalationen: [{ projekt: { nummer: '2026-001', name: 'Neues KIS' }, periode, grund: 'Verzug', massnahme: 'Budget' }],
        },
      };
      await tx.query(
        "INSERT INTO ppm.portfoliobericht (tenant_id, portfolio_id, periode, stand, inhalt, bereitgestellt_at) VALUES ($1, $2, $3, 'bereitgestellt', $4, now())",
        [tenantId, portfolioA, periode, inhalt]);
    });
    const { von, bis } = zeitraum(quartal);
    entscheide.anVr = await entscheidIm(von, 'Eskalation KIS', true);
    entscheide.ohne = await entscheidIm(bis, 'Eskalation Portal', false);
    entscheide.ausserhalb = await entscheidIm('2020-01-15', 'Altes Geschäft', true);
  });
  after(async () => { await api?.close(); });

  test('Lauf nach Quartalsende öffnet «Quartalsreporting erstellen» einmal', async () => {
    assert.equal(await sys(tx => quartalPruefen(tx)), quartal);
    await sys(tx => quartalPruefen(tx));
    const a = (await aufgaben('quartalsreporting.erstellen')).filter(x => x.bezug_id === quartal);
    assert.deepEqual(a.map(x => [x.empfaenger_recht, x.stand]), [['quartalsbericht:write', 'offen']]);
  });

  test('Entwurf aus Zielerreichung, Portfoliobericht und Weiterleitungen; laufendes Quartal 409; Rechte', async () => {
    assert.equal((await call('POST', `/v1/quartalsberichte/${laufend}/erzeugen`, ue)).statusCode, 409, 'Quartal läuft noch');
    assert.equal((await call('POST', `/v1/quartalsberichte/${quartal}/erzeugen`, gl)).statusCode, 403);
    assert.equal((await call('GET', `/v1/quartalsberichte/${quartal}`, ue)).statusCode, 404);
    const r = await ok('POST', `/v1/quartalsberichte/${quartal}/erzeugen`, ue, undefined, 201);
    const b = r.json();
    assert.equal(b.stand, 'in_arbeit');
    assert.deepEqual([b.inhalt.zielerreichung.nachgefuehrt, b.inhalt.zielerreichung.gesamt], [1, 1]);
    assert.equal(b.inhalt.zielerreichung.ziele[0].stand, '−4 %');
    const pf = b.inhalt.portfolios[0];
    assert.deepEqual([pf.name, pf.projekte, pf.kritisch, pf.nichtGemeldet, pf.bereitgestellt], ['Transformation', 2, 1, 1, true]);
    assert.deepEqual(pf.risiken.map((x: { text: string }) => x.text), ['Lieferverzug'], 'nur kritische Risiken');
    assert.equal(pf.meilensteine[0].text, 'Go-live Pilot');
    // Abnahme K6: die zur Weiterleitung markierten Geschäfte des Quartals
    assert.deepEqual(b.inhalt.weiterleitungen.map((w: { entscheidId: string; gremium: string }) => [w.entscheidId, w.gremium]), [[entscheide.anVr, 'PRAT']]);
    assert.deepEqual(b.inhalt.hinweise, []);
    assert.deepEqual(b.can, { erzeugen: true, bearbeiten: true, traktandieren: true, rueckmeldung: false });
    // GL liest (ziel:read), ohne Handlungen; ohne ziel:read nicht
    const g = await ok('GET', `/v1/quartalsberichte/${quartal}`, gl);
    assert.deepEqual(g.json().can, { erzeugen: false, bearbeiten: false, traktandieren: false, rueckmeldung: false });
    assert.equal((await call('GET', `/v1/quartalsberichte/${quartal}`, verantwortlich)).statusCode, 403);
    assert.ok((await ok('GET', '/v1/quartalsberichte', gl)).json().items.some((x: { quartal: string }) => x.quartal === quartal));
  });

  test('Kommentare mit If-Match, neu erzeugen behält sie; ausserordentliche Weiterleitung (A-03)', async () => {
    let r = await ok('GET', `/v1/quartalsberichte/${quartal}`, ue);
    assert.equal((await call('PATCH', `/v1/quartalsberichte/${quartal}`, ue, { kommentare: { gesamtstatus: 'x' } })).statusCode, 428);
    assert.equal((await call('PATCH', `/v1/quartalsberichte/${quartal}`, mit(ue, 'W/"99"'), { kommentare: { gesamtstatus: 'x' } })).statusCode, 412);
    r = await ok('PATCH', `/v1/quartalsberichte/${quartal}`, mit(ue, r.headers.etag as string), { kommentare: { gesamtstatus: ' Programm auf Kurs. ', auswirkungen: 'Budget 2027 +2 Mio.' } });
    assert.equal(r.json().kommentare.gesamtstatus, 'Programm auf Kurs.');
    assert.equal(r.json().kommentare.risiken, '');

    assert.equal((await call('POST', '/v1/vr-weiterleitungen', ue, { entscheidId: entscheide.ohne })).statusCode, 422, 'nicht markiert');
    assert.equal((await call('POST', '/v1/vr-weiterleitungen', gl, { entscheidId: entscheide.anVr })).statusCode, 403);
    await ok('POST', '/v1/vr-weiterleitungen', ue, { entscheidId: entscheide.anVr, weitergeleitetAm: zeitraum(quartal).bis, bemerkung: 'Brief an den VR' }, 204);
    assert.equal((await call('POST', '/v1/vr-weiterleitungen', ue, { entscheidId: entscheide.anVr })).statusCode, 409);
    const w = (await ok('GET', `/v1/vr-weiterleitungen?quartal=${quartal}`, gl)).json().items;
    assert.deepEqual(w.map((x: { ausserordentlichAm: string | null }) => x.ausserordentlichAm), [zeitraum(quartal).bis]);

    r = await ok('POST', `/v1/quartalsberichte/${quartal}/erzeugen`, ue);
    assert.equal(r.json().kommentare.gesamtstatus, 'Programm auf Kurs.', 'Kommentare bleiben');
    assert.equal(r.json().inhalt.weiterleitungen[0].ausserordentlichAm, zeitraum(quartal).bis);
  });

  test('Traktandieren, «Anpassungen verlangt» (A1), Korrektur zu «Verabschiedet», Dokument', async () => {
    let r = await ok('GET', `/v1/quartalsberichte/${quartal}`, ue);
    r = await ok('POST', `/v1/quartalsberichte/${quartal}/traktandieren`, mit(ue, r.headers.etag as string));
    assert.equal(r.json().stand, 'traktandiert');
    assert.equal((await call('PATCH', `/v1/quartalsberichte/${quartal}`, mit(ue, r.headers.etag as string), { kommentare: { risiken: 'x' } })).statusCode, 409);
    assert.equal((await aufgaben('quartalsreporting.erstellen')).find(x => x.bezug_id === quartal)!.stand, 'erledigt');

    const sitzung = async () => {
      const t = await sys(async tx => (await tx.query<{ id: string; titel: string }>(
        "SELECT id, titel FROM ppm.traktandum WHERE art = 'quartalsreporting' AND stand = 'vorgeschlagen'")).rows);
      assert.equal(t.length, 1);
      assert.match(t[0]!.titel, /^Quartalsreporting Q\d \d{4}$/);
      let s = (await call('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin })).json();
      if (!s.id) s = (await ok('GET', `/v1/gremien/prat/sitzungen/${termin}`, ue)).json();
      let v = (await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: t[0]!.id })).json();
      return { s, v, t: t[0]!.id };
    };
    // erste Sitzung: Anpassungen verlangt
    const a = await sitzung();
    let v = (await ok('POST', `/v1/sitzungen/${a.s.id}/versenden`, mit(ue, `W/"${a.v.version}"`))).json();
    await ok('POST', `/v1/sitzungen/${a.s.id}/starten`, mit(ue, `W/"${v.version}"`));
    await ok('PUT', `/v1/traktanden/${a.t}/entscheid`, ue, { ergebnis: 'anpassungen', begruendung: 'Risiken ausführlicher' });
    r = await ok('GET', `/v1/quartalsberichte/${quartal}`, ue);
    assert.deepEqual([r.json().stand, r.json().rueckmeldungPrat], ['in_arbeit', 'Risiken ausführlicher']);
    assert.equal((await aufgaben('quartalsreporting.erstellen')).filter(x => x.bezug_id === quartal && x.stand === 'offen').length, 1, 'Aufgabe wieder offen');
    // Korrektur in der Sitzung (A-30): verabschiedet
    const ent = await sys(async tx => (await tx.query<{ version: number }>('SELECT version FROM ppm.entscheid WHERE traktandum_id = $1', [a.t])).rows[0]!);
    await ok('PUT', `/v1/traktanden/${a.t}/entscheid`, mit(ue, `W/"${ent.version}"`), { ergebnis: 'verabschiedet', begruendung: 'Doch so' });
    r = await ok('GET', `/v1/quartalsberichte/${quartal}`, ue);
    assert.equal(r.json().stand, 'verabschiedet');
    assert.ok(r.json().verabschiedetAt);
    assert.deepEqual(r.json().can, { erzeugen: false, bearbeiten: false, traktandieren: false, rueckmeldung: true });
    assert.equal((await call('POST', `/v1/quartalsberichte/${quartal}/erzeugen`, ue)).statusCode, 409);

    // Dokument für den VR über vorlage (PDF und Word), Export im Audit
    const pdf = await ok('GET', `/v1/quartalsberichte/${quartal}/dokument`, gl);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.ok(pdf.rawPayload.subarray(0, 5).toString() === '%PDF-');
    const docx = await ok('GET', `/v1/quartalsberichte/${quartal}/dokument?format=docx`, ue);
    assert.match(String(docx.headers['content-disposition']), new RegExp(`Quartalsreporting_${quartal}\\.docx`));
    const audit = await sys(async tx => (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM ppm.audit_log WHERE action = 'quartalsbericht.exported'")).rows[0]!.n);
    assert.equal(audit, 2);
  });

  test('Rückmeldung und Aufträge des VR: Aufgaben im Eingang der Verantwortlichen (Abnahme K6)', async () => {
    let r = await ok('GET', `/v1/quartalsberichte/${quartal}`, ue);
    r = await ok('PUT', `/v1/quartalsberichte/${quartal}/vr-rueckmeldung`, mit(ue, r.headers.etag as string), { vrRueckmeldung: 'Der VR nimmt Kenntnis.' });
    assert.equal(r.json().vrRueckmeldung, 'Der VR nimmt Kenntnis.');
    assert.equal((await call('POST', `/v1/quartalsberichte/${quartal}/auftraege`, ue, { text: 'x', verantwortlich: '00000000-0000-4000-8000-000000000009' })).statusCode, 422);
    const a = (await ok('POST', `/v1/quartalsberichte/${quartal}/auftraege`, ue, { text: 'Kostenplan KIS nachreichen', verantwortlich: verantwortlichId, termin: '2027-03-31' }, 201)).json();
    const auf = await aufgaben('quartalsreporting.auftrag');
    assert.deepEqual(auf.map(x => [x.bezug_id, x.empfaenger_person, x.stand, x.frist]), [[a.id, verantwortlichId, 'offen', '2027-03-31']]);
    assert.equal((await ok('GET', `/v1/quartalsberichte/${quartal}`, gl)).json().auftraege.length, 1);
    // erledigen: nur die verantwortliche Person oder die UE
    assert.equal((await call('POST', `/v1/vr-auftraege/${a.id}/erledigen`, leser)).statusCode, 403, 'sieht den Auftrag, darf ihn nicht erledigen');
    const e = await ok('POST', `/v1/vr-auftraege/${a.id}/erledigen`, verantwortlich);
    assert.ok(e.json().erledigtAt);
    assert.equal((await aufgaben('quartalsreporting.auftrag'))[0]!.stand, 'erledigt');
    assert.equal((await call('POST', `/v1/vr-auftraege/${a.id}/erledigen`, ue)).statusCode, 409);
  });
});
