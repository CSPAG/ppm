/**
 * Gate-Modus und Gate-Entscheid (AP-E3-3; PS.02.01, PS.02.02, PS.02.05; UC-002 Schritte 10–11, UC-003 Schritte 1–10,
 * A6; K2, K3): Nach der dritten Unterschrift steht das Gate-Review beim Gremium des Gremienwegs; der Entscheid in der
 * Sitzung setzt Baseline, Phase und Phasenmodell, bevor die Sitzung geschlossen ist (Abnahme «Phase und Baseline nach
 * Entscheid»), eine Korrektur nimmt die Folge zurück (A-30). Danach Entwurf für das Gate P1–P2 aus der Baseline mit
 * Leitfragen, Aufgabe «Gate vorbereiten» 30 Arbeitstage vor der eingeplanten Sitzung (A-27) und Entscheid «mit Auflagen»:
 * wieder in Arbeit, Baseline und Phase bleiben.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { traktandenart } from '../../src/modules/sitzung/arten.ts';
import { gateVorbereitenPruefen } from '../../src/modules/vertrag/gate-job.ts';
import { login, person, testApi, type TestApi } from './api.ts';
import { full, skipDb } from './harness.ts';

const skip = await skipDb();

const heute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const plusTage = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Datum n Kalendertage nach heute, auf den nächsten Mittwoch gelegt (Sitzungstag). */
function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type H = Record<string, string>;

describe('Projektvertrag: Gate-Modus und Gate-Entscheid', { skip }, () => {
  let api: TestApi;
  let T = '';
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};
  let projekt = { id: '', nummer: '' };
  let modellId = '';
  const termin1 = mittwochIn(28), termin2 = mittwochIn(56);

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (who: string, method: string, url: string, payload?: unknown, headers: H = {}, status = 200) => {
    const r = await call(who, method, url, payload, headers);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return { body: r.json(), etag: r.headers.etag as string };
  };
  const sys = <R>(fn: Parameters<typeof full<R>>[2]) => full(api.t.runtime, T, fn);
  const projektZeile = () => sys(async tx => (await tx.query<{ phase: string; phasenmodell_id: string | null }>('SELECT phase, phasenmodell_id FROM ppm.projekt WHERE id = $1', [projekt.id])).rows[0]!);
  const versionen = () => sys(async tx => (await tx.query<{ id: string; nummer: string; stand: string; baseline: boolean; anlass: string; zielphase: string; basis_version_id: string | null }>(
    'SELECT id, nummer, stand, baseline, anlass, zielphase, basis_version_id FROM ppm.vertrag_version WHERE projekt_id = $1 ORDER BY created_at', [projekt.id])).rows);
  const traktanden = () => sys(async tx => (await tx.query<{ id: string; art: string; bezug_typ: string; bezug_id: string; gremium_id: string; sitzung_id: string | null; stand: string; titel: string; antrag: string }>(
    "SELECT id, art, bezug_typ, bezug_id, gremium_id, sitzung_id, stand, titel, antrag FROM ppm.traktandum WHERE projekt_id = $1 AND art = 'gate' ORDER BY created_at", [projekt.id])).rows);
  const aufgaben = (art: string) => sys(async tx => (await tx.query<{ empfaenger_person: string | null; titel: string; kontext: string; link: string; stand: string; frist: string | null }>(
    "SELECT empfaenger_person, titel, kontext, link, stand, to_char(frist, 'YYYY-MM-DD') AS frist FROM ppm.aufgabe WHERE art = $1 ORDER BY created_at", [art])).rows);

  /** Entwurf einreichen, Quality-Check bestätigen, SP, PL und CTL unterzeichnen (K2 Schritte 6–8). */
  async function bisUnterzeichnet(v: string, etag: string): Promise<void> {
    const e = await ok('pl', 'POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': etag });
    await ok('ue', 'POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': e.etag });
    for (const who of ['sp', 'pl', 'ctl']) {
      const p = await ok(who, 'GET', `/v1/vertragsversionen/${v}/pruefung`);
      await ok(who, 'POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': p.etag });
    }
  }
  /** Sitzung am Termin mit dem Gate-Traktandum versenden und starten (K3 Schritte 1–7); liefert das Traktandum. */
  async function sitzungLaufend(datum: string, traktandumId: string, aufnehmen: boolean): Promise<{ sitzung: string }> {
    let s = (await call('ue', 'GET', `/v1/gremien/prat/sitzungen/${datum}`)).json();
    if (!s?.id) s = (await ok('ue', 'POST', '/v1/gremien/prat/sitzungen', { datum }, {}, 201)).body;
    let r = s;
    if (aufnehmen) r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/traktanden`, { vorschlagId: traktandumId })).body;
    r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/versenden`, undefined, { 'if-match': `W/"${r.version}"` })).body;
    await ok('ue', 'POST', `/v1/sitzungen/${s.id}/starten`, undefined, { 'if-match': `W/"${r.version}"` });
    return { sitzung: s.id };
  }

  before(async () => {
    api = await testApi();
    const ue = await login(api, 'acme', 'g-ue', 'ue');
    T = ue.tenantId;
    h.ue = { authorization: ue.authorization };
    h.adm = { authorization: (await login(api, 'acme', 'g-adm', 'org-admin')).authorization };
    for (const f of ['sp', 'pl', 'ctl', 'kt']) {
      id[f] = await person(api, T, `g-${f}`);
      // alle Mitglieder sind Antragstellende (A-46) und lesen Portfolios und Gremienweg (fachmodell.md 3.3)
      h[f] = { authorization: (await login(api, 'acme', `g-${f}`, 'antragsteller')).authorization };
    }
    // Phasenmodell nach der Vorgabe (Leitfragen je Gate, Standard-Ergebnisse); am Gate P1–P2 ohne Pflichtangaben
    const m = await ok('ue', 'POST', '/v1/phasenmodelle', { quelle: 'vorgabe' }, {}, 201);
    const p = await ok('ue', 'PATCH', `/v1/phasenmodelle/${m.body.id}`, { gates: [{ code: 'P1_P2', pflichtangaben: [] }] }, { 'if-match': m.etag });
    await ok('adm', 'POST', `/v1/phasenmodelle/${m.body.id}/in-kraft-setzen`, undefined, { 'if-match': p.etag });
    modellId = m.body.id;

    // Portfolio A mit PRAT; Gremienweg P0–P1 und P1–P2 beim PRAT (ohne SNS-VR, das deckt sitzung-entscheid ab)
    const portfolio = (await ok('ue', 'POST', '/v1/portfolios', { kategorie: 'A', schluessel: 'gate', name: 'Gate' }, {}, 201)).body.id;
    id.prat = (await ok('ue', 'POST', '/v1/gremien', { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, {}, 201)).body.id;
    await ok('ue', 'PUT', `/v1/portfolios/${portfolio}/gremienweg`, { schritte: [{ gate: 'P0_P1', gremiumId: id.prat }, { gate: 'P1_P2', gremiumId: id.prat }] }, { 'if-match': 'W/"1"' });
    for (const datum of [termin1, termin2]) await ok('ue', 'POST', `/v1/gremien/${id.prat}/termine`, { datum }, {}, 201);

    const pj = (await ok('ue', 'POST', '/v1/projekte', { name: 'Digitale Patientenaufnahme', portfolioId: portfolio, phase: 'P0' }, {}, 201)).body;
    projekt = { id: pj.id, nummer: pj.nummer };
    await ok('ue', 'PUT', `/v1/projekte/${pj.id}/organisation`, { mitglieder: [
      { personId: id.sp, funktion: 'sp', akv: '' }, { personId: id.pl, funktion: 'pl', akv: '' }, { personId: id.ctl, funktion: 'ctl', akv: '' }, { personId: id.kt, funktion: 'kt', akv: '' },
    ] }, { 'if-match': 'W/"0"' });
  });
  after(async () => { await api?.close(); });

  test('Erster Vertrag: nach der dritten Unterschrift traktandiert beim PRAT, Packet mit Leitfragen P0–P1 (UC-002 Schritt 10, UC-003 Schritt 9)', async () => {
    const e = await ok('pl', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'initial' }, {}, 201);
    id.v1 = e.body.version.id;
    const g = await ok('kt', 'GET', `/v1/vertragsversionen/${id.v1}/gate`);
    assert.deepEqual([g.body.gate.code, g.body.gate.label, g.body.gremienweg.gremium.kuerzel, g.body.fortschritt], ['P0_P1', 'P0–P1', 'prat', { beantwortet: 0, gesamt: 5 }]);
    assert.deepEqual(g.body.can, { antworten: false, nutzen: false }, 'Kernteam liest nur');
    await bisUnterzeichnet(id.v1, e.etag);

    const [t] = await traktanden();
    assert.deepEqual([t!.bezug_typ, t!.bezug_id, t!.gremium_id, t!.stand, t!.titel, t!.antrag],
      ['projekt', projekt.id, id.prat, 'vorgeschlagen', `Gate P0–P1 ${projekt.nummer} Digitale Patientenaufnahme`, 'Projektvertrag Version 0.1 und Phase P1 freigeben']);
    id.t1 = t!.id;
    assert.equal((await versionen())[0]!.stand, 'traktandiert');
    const u = await sys(tx => traktandenart('gate')!.unterlagen!(tx, { typ: 'projekt', id: projekt.id, projektId: projekt.id }));
    assert.equal(u.length, 1);
    assert.deepEqual([u[0]!.art, u[0]!.bereit, u[0]!.qualityCheck], ['packet', true, 'bestanden']);
    assert.equal((u[0]!.inhalt as { leitfragen: unknown[] }).leitfragen.length, 5);
  });

  test('Entscheid «freigegeben»: Baseline, Phase P1 und Phasenmodell vor dem Schliessen; Korrektur nimmt die Folge zurück (UC-002 Schritt 11, A-30)', async () => {
    await sitzungLaufend(termin1, id.t1!, true);
    const r = await ok('ue', 'PUT', `/v1/traktanden/${id.t1}/entscheid`, { ergebnis: 'freigegeben', begruendung: 'Vertrag vollständig' });
    let [v] = await versionen();
    assert.deepEqual([v!.stand, v!.baseline], ['abgenommen', true]);
    assert.deepEqual(await projektZeile(), { phase: 'P1', phasenmodell_id: modellId });

    // Korrektur in der laufenden Sitzung: zurückgestellt → wieder in Arbeit, keine Baseline, Phase P0
    const e1 = await ok('ue', 'GET', `/v1/traktanden/${id.t1}/entscheid`);
    await ok('ue', 'PUT', `/v1/traktanden/${id.t1}/entscheid`, { ergebnis: 'zurueckgestellt', begruendung: 'Kosten offen' }, { 'if-match': `W/"${e1.body.version}"` });
    [v] = await versionen();
    assert.deepEqual([v!.stand, v!.baseline, (await projektZeile()).phase], ['in_arbeit', false, 'P0']);
    assert.equal((await aufgaben('vertrag.ueberarbeiten')).filter(a => a.stand === 'offen').length, 1);

    // und zurück: freigegeben
    const e2 = await ok('ue', 'GET', `/v1/traktanden/${id.t1}/entscheid`);
    await ok('ue', 'PUT', `/v1/traktanden/${id.t1}/entscheid`, { ergebnis: 'freigegeben', begruendung: 'Kosten geklärt' }, { 'if-match': `W/"${e2.body.version}"` });
    [v] = await versionen();
    assert.deepEqual([v!.stand, v!.baseline, (await projektZeile()).phase], ['abgenommen', true, 'P1']);
    assert.equal((await aufgaben('vertrag.ueberarbeiten')).filter(a => a.stand === 'offen').length, 0);
    assert.ok(r.body);
    const g = await ok('pl', 'GET', `/v1/vertragsversionen/${id.v1}/gate`);
    assert.equal(g.body.entscheid.ergebnis, 'freigegeben');
  });

  test('Aufgabe «Gate vorbereiten» 30 Arbeitstage vor der eingeplanten Sitzung, idempotent (fachmodell.md 4.2, A-27)', async () => {
    // die UE plant das Gate-Review P1–P2 in die Sitzung am zweiten Termin ein (PP.04.05)
    const s = (await ok('ue', 'POST', '/v1/gremien/prat/sitzungen', { datum: termin2 }, {}, 201)).body;
    const r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/traktanden`, { art: 'gate', projektId: projekt.id })).body;
    const t = r.traktanden.find((x: { art: string }) => x.art === 'gate');
    assert.equal(t.titel, `Gate P1–P2 ${projekt.nummer} Digitale Patientenaufnahme`);
    id.t2 = t.traktandumId ?? t.id;

    assert.equal(await sys(tx => gateVorbereitenPruefen(tx, plusTage(termin2, -60))), 0, 'zu früh');
    const jetzt = plusTage(termin2, -10);
    assert.equal(await sys(tx => gateVorbereitenPruefen(tx, jetzt)), 1);
    await sys(tx => gateVorbereitenPruefen(tx, jetzt));
    const a = await aufgaben('gate.vorbereiten');
    assert.equal(a.length, 1);
    assert.equal(a[0]!.empfaenger_person, id.pl);
    assert.equal(a[0]!.titel, 'Gate P1–P2 vorbereiten');
    assert.match(a[0]!.kontext, new RegExp(`^${projekt.nummer} Digitale Patientenaufnahme · PRAT Mi \\d+\\.\\d+\\. · Unterlagen bis \\w\\w \\d+\\.\\d+\\.$`));
    assert.equal(a[0]!.link, `/projekte/${projekt.nummer}/vertrag/gate`);
    assert.ok(a[0]!.frist && a[0]!.frist < termin2);
  });

  test('Gate-Entwurf P1–P2 aus der Baseline mit Leitfragen; Entscheid «mit Auflagen»: in Arbeit, Baseline und Phase bleiben (UC-003, A6)', async () => {
    assert.equal((await call('pl', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung: 'x' })).statusCode, 409, 'Änderung ist ein anderes Paket');
    const e = await ok('pl', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'gate' }, {}, 201);
    id.v2 = e.body.version.id;
    const v = (await versionen()).find(x => x.id === id.v2)!;
    assert.deepEqual([v.nummer, v.anlass, v.zielphase, v.basis_version_id], ['2.0', 'gate', 'P2', id.v1]);
    const k7 = (await ok('pl', 'GET', `/v1/vertragsversionen/${id.v2}/kapitel/7`)).body;
    assert.ok(k7.inhalt.meilensteine.some((m: { phase: string }) => m.phase === 'P2'), 'Standard-Ergebnisse der Zielphase vorausgefüllt');

    // Leitfragen beantworten (UC-003 Schritt 4): If-Match, «trifft nicht zu» nur mit Begründung, Rechte
    const g = await ok('pl', 'GET', `/v1/vertragsversionen/${id.v2}/gate`);
    assert.deepEqual([g.body.gate.code, g.body.fortschritt.gesamt, g.body.can.antworten, g.body.nutzen], ['P1_P2', 5, true, null]);
    const [f1, f2] = g.body.leitfragen as { id: string }[];
    const url = (f: { id: string }) => `/v1/vertragsversionen/${id.v2}/gate/leitfragen/${f.id}`;
    const a1 = await ok('pl', 'PUT', url(f1!), { antwort: 'Business Case positiv' }, { 'if-match': 'W/"0"' });
    assert.deepEqual([a1.etag, a1.body.antwort.text, a1.body.antwort.zutreffend], ['W/"1"', 'Business Case positiv', true]);
    assert.equal((await call('pl', 'PUT', url(f1!), { antwort: 'neu' }, { 'if-match': 'W/"0"' })).statusCode, 412);
    assert.equal((await call('pl', 'PUT', url(f2!), { antwort: ' ', zutreffend: false }, { 'if-match': 'W/"0"' })).statusCode, 422);
    assert.equal((await call('kt', 'PUT', url(f2!), { antwort: 'x' }, { 'if-match': 'W/"0"' })).statusCode, 403);
    assert.equal((await call('ue', 'PUT', url(f2!), { antwort: 'x' }, { 'if-match': 'W/"0"' })).statusCode, 403);
    await ok('pl', 'PUT', url(f2!), { antwort: 'Finanzierung erst 2027', zutreffend: false }, { 'if-match': 'W/"0"' });
    assert.equal((await call('pl', 'PUT', `/v1/vertragsversionen/${id.v2}/gate/nutzen`, { beurteilung: 'x', werte: [] }, { 'if-match': 'W/"0"' })).statusCode, 409, 'Nutzenprüfung erst ab P3');
    assert.deepEqual((await ok('pl', 'GET', `/v1/vertragsversionen/${id.v2}/gate`)).body.fortschritt, { beantwortet: 2, gesamt: 5 });

    // eingereicht: «Gate vorbereiten» erledigt; nach den Unterschriften dasselbe eingeplante Traktandum
    const cur = await ok('pl', 'GET', `/v1/vertragsversionen/${id.v2}/gate`);
    assert.equal(cur.body.stand, 'in_arbeit');
    const k = await ok('pl', 'GET', `/v1/vertragsversionen/${id.v2}/pruefung`);
    await bisUnterzeichnet(id.v2, k.etag);
    assert.equal((await call('pl', 'PUT', url(f1!), { antwort: 'zu spät' }, { 'if-match': 'W/"1"' })).statusCode, 409, 'nach dem Einreichen gesperrt');
    assert.equal((await aufgaben('gate.vorbereiten'))[0]!.stand, 'erledigt');
    const ts = await traktanden();
    assert.equal(ts.filter(t => t.stand !== 'entschieden').length, 1, 'kein zweites Traktandum');
    const u = await sys(tx => traktandenart('gate')!.unterlagen!(tx, { typ: 'projekt', id: projekt.id, projektId: projekt.id }));
    const lf = (u[0]!.inhalt as { leitfragen: { antwort: string | null; zutreffend: boolean | null }[] }).leitfragen;
    assert.deepEqual(lf.slice(0, 2).map(x => [x.antwort, x.zutreffend]), [['Business Case positiv', true], ['Finanzierung erst 2027', false]]);

    await sitzungLaufend(termin2, id.t2!, false);
    await ok('ue', 'PUT', `/v1/traktanden/${id.t2}/entscheid`, {
      ergebnis: 'mit_auflagen', begruendung: 'Risikoplan fehlt', auflagen: [{ text: 'Risikoplan nachreichen', verantwortlich: id.pl, termin: mittwochIn(70) }],
    });
    const vs = await versionen();
    assert.deepEqual(vs.map(x => [x.nummer, x.stand, x.baseline]), [['0.1', 'abgenommen', true], ['2.0', 'in_arbeit', false]]);
    assert.equal((await projektZeile()).phase, 'P1');
    const ueb = (await aufgaben('vertrag.ueberarbeiten')).filter(a => a.stand === 'offen');
    assert.equal(ueb.length, 1);
    assert.match(ueb[0]!.kontext, /Gate P1–P2 mit Auflagen freigegeben: Risikoplan fehlt$/);
    assert.equal((await ok('pl', 'GET', `/v1/vertragsversionen/${id.v2}/gate`)).body.can.antworten, true, 'wieder bearbeitbar');
  });
});
