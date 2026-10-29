/**
 * Abschluss, Sistierung, Abbruch und Wiederaufnahme (AP-E7-1; PS.04.01–03, PC.03.02, PC.03.04; UC-015, A-09):
 * Aufgabe «Abschlussbericht erstellen» in P4, Bericht mit Pflichtangaben, Nutzenprüfung durch SP und UE, Exit-Gate als
 * Traktandum der Art `abschluss` mit Folge in der Transaktion des Entscheids (Nacharbeit, Abschluss, Korrektur A-30),
 * Endzustand lesend (Abnahme), Sistieren mit Wiederaufnahme per Gremiumsentscheid, Abbruch nach Gate «Gestoppt»,
 * Lessons Learned und Dokument.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { abschlussPruefen } from '../../src/modules/abschluss/aufgabe-job.ts';
import { nachGate } from '../../src/modules/abschluss/folge.ts';
import { _abmelden } from '../../src/modules/abschluss/lessons-haken.ts';
import { lessonsLearned } from '../../src/modules/abschluss/index.ts';
import { grant, login, person, testApi, type TestApi } from './api.ts';
import { full } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

const heute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type H = Record<string, string>;
const LEER = { projektstand: '', zielerreichung: '', kpiWerte: [], businessCase: '', uebergabe: '', offenePunkte: [] };

describe('Abschluss: Exit-Gate, Sistierung, Abbruch, Wiederaufnahme', () => {
  let api: TestApi;
  let T = '';
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};
  const pj: Record<string, { id: string; nummer: string }> = {};
  const termine = [mittwochIn(14), mittwochIn(42), mittwochIn(70)];

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (who: string, method: string, url: string, payload?: unknown, headers: H = {}, status = 200) => {
    const r = await call(who, method, url, payload, headers);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return { body: r.body ? r.json() : null, etag: r.headers.etag as string };
  };
  const sys = <R>(fn: Parameters<typeof full<R>>[2]) => full(api.t.runtime, T, fn);
  const lz = (p: string) => sys(async tx => (await tx.query<{ lebenszyklus: string }>('SELECT lebenszyklus FROM ppm.projekt WHERE id = $1', [p])).rows[0]!.lebenszyklus);
  const aufgaben = (p: string) => sys(async tx => (await tx.query<{ titel: string; stand: string; empfaenger_person: string; link: string }>(
    "SELECT titel, stand, empfaenger_person, link FROM ppm.aufgabe WHERE art = 'abschluss.erstellen' AND bezug_id = $1 ORDER BY created_at", [p])).rows);
  const traktandum = (p: string) => sys(async tx => (await tx.query<{ id: string; stand: string; titel: string; antrag: string }>(
    "SELECT id, stand, titel, antrag FROM ppm.traktandum WHERE art = 'abschluss' AND projekt_id = $1 ORDER BY created_at DESC LIMIT 1", [p])).rows[0]);

  /** Sitzung am Termin mit dem Traktandum versenden und starten (K3 Schritte 1–7). */
  async function sitzungLaufend(datum: string, aufnehmen: { vorschlagId: string } | { art: string; projektId: string }): Promise<string> {
    let s = (await call('ue', 'GET', `/v1/gremien/prat/sitzungen/${datum}`)).json();
    if (!s?.id) s = (await ok('ue', 'POST', '/v1/gremien/prat/sitzungen', { datum }, {}, 201)).body;
    let r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/traktanden`, aufnehmen)).body;
    r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/versenden`, undefined, { 'if-match': `W/"${r.version}"` })).body;
    await ok('ue', 'POST', `/v1/sitzungen/${s.id}/starten`, undefined, { 'if-match': `W/"${r.version}"` });
    return s.id;
  }
  /** Entscheid erfassen bzw. korrigieren (A-30). */
  async function entscheiden(traktandumId: string, ergebnis: string, status = 200) {
    const e = await call('ue', 'GET', `/v1/traktanden/${traktandumId}/entscheid`);
    const v = e.statusCode === 200 ? e.json()?.version : undefined;
    return ok('ue', 'PUT', `/v1/traktanden/${traktandumId}/entscheid`, { ergebnis, begruendung: `Begründung ${ergebnis}` }, v ? { 'if-match': `W/"${v}"` } : {}, status);
  }

  before(async () => {
    api = await testApi();
    const ue = await login(api, 'acme', 'a-ue', 'alle-fuehren');
    T = ue.tenantId;
    h.ue = { authorization: ue.authorization };
    for (const f of ['sp', 'pl', 'kt']) {
      id[f] = await person(api, T, `a-${f}`);
      h[f] = { authorization: (await login(api, 'acme', `a-${f}`, 'mitglied')).authorization };
    }
    const portfolio = (await ok('ue', 'POST', '/v1/portfolios', { kategorie: 'A', schluessel: 'abschluss', name: 'Abschluss' }, {}, 201)).body.id;
    const prat = (await ok('ue', 'POST', '/v1/gremien', { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, {}, 201)).body.id;
    for (const datum of termine) await ok('ue', 'POST', `/v1/gremien/${prat}/termine`, { datum }, {}, 201);
    for (const [k, phase, name] of [['exit', 'P4', 'Neues Labor'], ['stopp', 'P2', 'Digitale Visite'], ['gate', 'P1', 'Bettenplanung']] as const) {
      const p = (await ok('ue', 'POST', '/v1/projekte', { name, portfolioId: portfolio, phase }, {}, 201)).body;
      pj[k] = { id: p.id, nummer: p.nummer };
      await ok('ue', 'PUT', `/v1/projekte/${p.id}/organisation`, { mitglieder: [
        { personId: id.sp, funktion: 'sp', akv: '' }, { personId: id.pl, funktion: 'pl', akv: '' }, { personId: id.kt, funktion: 'weitere', funktionText: 'Kernteam', akv: '' },
      ] }, { 'if-match': 'W/"0"' });
      // Zugriff getrennt von der Projektorganisation (Master Entscheid 16)
      for (const [f, rolle] of [['sp', 'projekt-steuern'], ['pl', 'projekt-fuehren'], ['kt', 'projekt-mitlesen']] as const) {
        await grant(api, T, `user:${id[f]}`, rolle, { type: 'projekt', id: p.id });
      }
    }
  });
  after(async () => { await api?.close(); });

  test('P4: Aufgabe «Abschlussbericht erstellen» an die PL; ausserhalb von P4 kein Bericht (UC-015 Ausgangslage)', async () => {
    assert.equal(await sys(tx => abschlussPruefen(tx)), 1);
    assert.equal(await sys(tx => abschlussPruefen(tx)), 1, 'idempotent');
    const a = await aufgaben(pj.exit!.id);
    assert.equal(a.length, 1);
    assert.deepEqual([a[0]!.titel, a[0]!.empfaenger_person, a[0]!.link, a[0]!.stand], ['Abschlussbericht Neues Labor erstellen', id.pl, `/projekte/${pj.exit!.nummer}/abschluss`, 'offen']);

    let g = await ok('pl', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual([g.body.lage, g.body.bericht, g.body.can.bearbeiten, g.etag, g.body.grundlagen.nutzenpruefung], ['abschluss', null, true, 'W/"0"', null]);
    // Grundlage der Beurteilung: letzte Nutzenprüfung aus dem Gate-Modus (UC-003 A2)
    await sys(tx => tx.query(`WITH v AS (INSERT INTO ppm.vertrag_version (tenant_id, projekt_id, nummer, anlass, zielphase) VALUES ($1, $2, '4.0', 'gate', 'P4') RETURNING id)
      INSERT INTO ppm.nutzenpruefung (tenant_id, projekt_id, version_id, beurteilung) SELECT $1, $2, id, 'Nutzen stabil' FROM v`, [T, pj.exit!.id]));
    g = await ok('pl', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual(g.body.grundlagen.nutzenpruefung, { version: '4.0', beurteilung: 'Nutzen stabil', werte: [] });
    const kt = await ok('kt', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual([kt.body.can.bearbeiten, kt.body.grundlagen.kosten], [false, { budgetBaseline: 0, prognose: 0, ist: 0 }], 'Kernteam liest mit Beträgen (Master Entscheid 13)');
    assert.equal((await call('kt', 'PUT', `/v1/projekte/${pj.exit!.id}/abschluss`, LEER, { 'if-match': 'W/"0"' })).statusCode, 403);
    const p2 = await call('pl', 'PUT', `/v1/projekte/${pj.stopp!.id}/abschluss`, LEER, { 'if-match': 'W/"0"' });
    assert.equal(p2.statusCode, 409, p2.body);
  });

  test('Bericht erfassen, Pflichtangaben, Nutzenprüfung SP und UE, Einreichen zum Exit-Gate (UC-015 Schritte 2–5)', async () => {
    const url = `/v1/projekte/${pj.exit!.id}/abschluss`;
    let r = await ok('pl', 'PUT', url, { ...LEER, zielerreichung: 'Ziele erreicht', offenePunkte: [{ text: 'Schulung', verantwortlich: 'Linie', termin: '2027-03-31' }] }, { 'if-match': 'W/"0"' });
    assert.equal(r.body.bericht.art, 'abschluss');
    const e = await call('pl', 'POST', `${url}/einreichen`, undefined, { 'if-match': r.etag });
    assert.equal(e.statusCode, 422, e.body);
    assert.deepEqual(e.json().errors.map((x: { path: string }) => x.path).sort(), ['/businessCase', '/uebergabe']);
    const b = r.body.bericht;
    r = await ok('pl', 'PUT', url, {
      projektstand: '', zielerreichung: b.zielerreichung, kpiWerte: b.kpiWerte, offenePunkte: b.offenePunkte, businessCase: 'Kosten im Rahmen', uebergabe: 'Betrieb übernimmt am 1.1.',
    }, { 'if-match': r.etag });

    assert.equal((await call('pl', 'PUT', `${url}/nutzen`, { rolle: 'sp', beurteilung: 'x' }, { 'if-match': r.etag })).statusCode, 403, 'PL ist nicht Sponsor');
    r = await ok('sp', 'PUT', `${url}/nutzen`, { rolle: 'sp', beurteilung: 'Nutzen erreicht' }, { 'if-match': r.etag });
    r = await ok('ue', 'PUT', `${url}/nutzen`, { rolle: 'ue', beurteilung: 'Bestätigt' }, { 'if-match': r.etag });
    assert.equal(r.body.bericht.nutzen.sp.text, 'Nutzen erreicht');

    await ok('pl', 'POST', `/v1/projekte/${pj.exit!.id}/lessons-learned`, { text: 'Früh mit dem Betrieb planen', kategorie: 'Übergabe' }, {}, 201);
    assert.equal((await call('kt', 'POST', `/v1/projekte/${pj.exit!.id}/lessons-learned`, { text: 'x' })).statusCode, 403);

    r = await ok('pl', 'POST', `${url}/einreichen`, undefined, { 'if-match': r.etag });
    assert.deepEqual([r.body.bericht.stand, r.body.can.bearbeiten], ['traktandiert', false]);
    const t = (await traktandum(pj.exit!.id))!;
    assert.deepEqual([t.stand, t.titel], ['vorgeschlagen', `Exit-Gate P4 ${pj.exit!.nummer} Neues Labor`]);
    id.tExit = t.id;
    assert.equal((await aufgaben(pj.exit!.id))[0]!.stand, 'erledigt');
    assert.equal(await sys(tx => abschlussPruefen(tx)), 0, 'eingereicht: keine neue Aufgabe');
  });

  test('Exit-Gate: Nacharbeiten, Korrektur zu «Abgeschlossen»; Endzustand lesend (UC-015 Schritt 6, A2; A-30)', async () => {
    id.s1 = await sitzungLaufend(termine[0]!, { vorschlagId: id.tExit! });
    const falsch = await call('ue', 'PUT', `/v1/traktanden/${id.tExit}/entscheid`, { ergebnis: 'sistiert', begruendung: 'x' });
    assert.equal(falsch.statusCode, 422, falsch.body);

    await entscheiden(id.tExit!, 'nacharbeiten');
    let g = await ok('pl', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual([g.body.bericht.stand, g.body.can.bearbeiten, g.body.entscheid.ergebnis], ['nacharbeit', true, 'nacharbeiten']);
    assert.ok((await aufgaben(pj.exit!.id)).some(a => a.stand === 'offen' && a.titel === 'Abschlussbericht Neues Labor überarbeiten'));

    await entscheiden(id.tExit!, 'abgeschlossen');
    g = await ok('kt', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual([g.body.lage, g.body.projekt.lebenszyklus, g.body.bericht.stand], ['abgeschlossen', 'abgeschlossen', 'abgenommen']);
    assert.ok(g.body.bericht.abgenommenAt);
    assert.ok((await aufgaben(pj.exit!.id)).every(a => a.stand !== 'offen'));

    // Korrektur weg vom Endzustand in der offenen Sitzung (A-30): Projekt wieder aktiv, Bericht wieder bearbeitbar
    await entscheiden(id.tExit!, 'nacharbeiten');
    g = await ok('pl', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual([g.body.lage, g.body.projekt.lebenszyklus, g.body.bericht.stand, g.body.bericht.abgenommenAt, g.body.can.bearbeiten],
      ['abschluss', 'aktiv', 'nacharbeit', null, true]);
    assert.ok((await aufgaben(pj.exit!.id)).some(a => a.stand === 'offen'));
    const audit = await sys(async tx => (await tx.query<{ action: string }>(
      "SELECT action FROM ppm.audit_log WHERE resource_type = 'projekt' AND resource_id = $1 AND action = 'projekt.reopened'", [pj.exit!.id])).rows);
    assert.equal(audit.length, 1);

    // und wieder zurück: abgeschlossen
    await entscheiden(id.tExit!, 'abgeschlossen');
    g = await ok('kt', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss`);
    assert.deepEqual([g.body.projekt.lebenszyklus, g.body.bericht.stand], ['abgeschlossen', 'abgenommen']);

    // Abnahme «Endzustand lesend»: Projekt, Register und Bericht nur noch lesen; Lessons Learned bleiben möglich (UC-013 A1)
    const projekt = await ok('ue', 'GET', `/v1/projekte/${pj.exit!.id}`);
    assert.equal((await call('ue', 'PATCH', `/v1/projekte/${pj.exit!.id}`, { name: 'Anders' }, { 'if-match': projekt.etag })).statusCode, 409);
    assert.equal((await call('pl', 'POST', `/v1/projekte/${pj.exit!.id}/meilensteine`, { phase: 'P4', art: 'meilenstein', text: 'Neu' })).statusCode, 409);
    assert.equal((await call('pl', 'PUT', `/v1/projekte/${pj.exit!.id}/abschluss`, LEER, { 'if-match': `W/"${g.body.bericht.version}"` })).statusCode, 409);
    assert.equal((await call('pl', 'POST', `/v1/projekte/${pj.exit!.id}/abschluss/einreichen`, undefined, { 'if-match': 'W/"1"' })).statusCode, 409);
    await ok('pl', 'POST', `/v1/projekte/${pj.exit!.id}/lessons-learned`, { text: 'Abnahme früh terminieren' }, {}, 201);

    const pdf = await call('kt', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss/dokument?format=pdf`);
    assert.equal(pdf.statusCode, 200);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.match(String(pdf.headers['content-disposition']), new RegExp(`Abschlussbericht-${pj.exit!.nummer}\\.pdf`));
    const docx = await call('kt', 'GET', `/v1/projekte/${pj.exit!.id}/abschluss/dokument?format=docx`);
    assert.equal(docx.statusCode, 200);
  });

  test('Sistieren per Entscheid, Korrektur, Bericht zur Sistierung, Wiederaufnahme per Gremiumsentscheid (UC-015 A1, A-09)', async () => {
    const s2 = await sitzungLaufend(termine[1]!, { art: 'abschluss', projektId: pj.stopp!.id });
    const t = (await traktandum(pj.stopp!.id))!;
    assert.equal(t.titel, `Sistierung oder Abbruch ${pj.stopp!.nummer} Digitale Visite`);
    assert.equal((await call('ue', 'PUT', `/v1/traktanden/${t.id}/entscheid`, { ergebnis: 'abgeschlossen', begruendung: 'x' })).statusCode, 422);

    await entscheiden(t.id, 'sistiert');
    assert.equal(await lz(pj.stopp!.id), 'sistiert');
    // Audit beim Projekt mit der Person, die den Entscheid erfasst (FolgeKontext, #120)
    const audit = await sys(async tx => (await tx.query<{ actor_kind: string }>("SELECT actor_kind FROM ppm.audit_log WHERE action = 'projekt.suspended' AND resource_id = $1", [pj.stopp!.id])).rows);
    assert.deepEqual(audit.map(a => a.actor_kind), ['user']);
    let g = await ok('pl', 'GET', `/v1/projekte/${pj.stopp!.id}/abschluss`);
    assert.deepEqual([g.body.lage, g.body.bericht.art, g.body.bericht.stand, g.body.can.wiederaufnahme], ['sistierung', 'sistierung', 'entwurf', true]);
    assert.equal((await aufgaben(pj.stopp!.id)).filter(a => a.stand === 'offen')[0]!.titel, 'Bericht zur Sistierung Digitale Visite erstellen');

    // Korrektur: weiterführen nimmt die Sistierung zurück, der unbearbeitete Bericht entfällt
    await entscheiden(t.id, 'weiterfuehren');
    assert.equal(await lz(pj.stopp!.id), 'aktiv');
    g = await ok('pl', 'GET', `/v1/projekte/${pj.stopp!.id}/abschluss`);
    assert.deepEqual([g.body.lage, g.body.bericht], ['keine', null]);
    assert.ok((await aufgaben(pj.stopp!.id)).every(a => a.stand !== 'offen'));

    await entscheiden(t.id, 'sistiert');
    await ok('ue', 'POST', `/v1/sitzungen/${s2}/schliessen`, undefined, { 'if-match': `W/"${(await ok('ue', 'GET', `/v1/sitzungen/${s2}`)).body.version}"` });

    // Bericht zur Sistierung: Stand Pflicht, danach eingereicht (Ende ohne Gremium)
    g = await ok('pl', 'GET', `/v1/projekte/${pj.stopp!.id}/abschluss`);
    const url = `/v1/projekte/${pj.stopp!.id}/abschluss`;
    const e = await call('pl', 'POST', `${url}/einreichen`, undefined, { 'if-match': g.etag });
    assert.equal(e.statusCode, 422);
    let r = await ok('pl', 'PUT', url, { ...LEER, projektstand: 'Konzept fertig, Umsetzung angehalten' }, { 'if-match': g.etag });
    r = await ok('pl', 'POST', `${url}/einreichen`, undefined, { 'if-match': r.etag });
    assert.equal(r.body.bericht.stand, 'eingereicht');
    // Register sistierter Projekte bleiben pflegbar (wie im Modul projekt)
    await ok('pl', 'POST', `/v1/projekte/${pj.stopp!.id}/meilensteine`, { phase: 'P2', art: 'meilenstein', text: 'Neustart' }, {}, 201);

    // Wiederaufnahme: Antrag ans Gremium, Entscheid «Weiterführen» = aktiv, Mitteilung an SP und PL
    assert.equal((await call('pl', 'POST', `/v1/projekte/${pj.exit!.id}/wiederaufnahme`, { begruendung: 'x' })).statusCode, 409);
    await ok('pl', 'POST', `/v1/projekte/${pj.stopp!.id}/wiederaufnahme`, { begruendung: 'Finanzierung gesichert' });
    const w = (await traktandum(pj.stopp!.id))!;
    assert.notEqual(w.id, t.id);
    assert.deepEqual([w.stand, w.titel, w.antrag], ['vorgeschlagen', `Wiederaufnahme ${pj.stopp!.nummer} Digitale Visite`, 'Finanzierung gesichert']);
    await sitzungLaufend(termine[2]!, { vorschlagId: w.id });
    await entscheiden(w.id, 'weiterfuehren');
    assert.equal(await lz(pj.stopp!.id), 'aktiv');
    const m = await sys(async tx => (await tx.query<{ empfaenger_person: string; text: string }>(
      "SELECT empfaenger_person, text FROM ppm.mitteilung WHERE bezug_typ = 'projekt' AND bezug_id = $1 ORDER BY empfaenger_person", [pj.stopp!.id])).rows);
    assert.deepEqual(m.map(x => x.empfaenger_person).sort(), [id.sp, id.pl].sort());
    assert.match(m[0]!.text, /über ein Gate fort/);
    // Korrektur: weiterhin sistiert
    await entscheiden(w.id, 'sistiert');
    assert.equal(await lz(pj.stopp!.id), 'sistiert');
    await entscheiden(w.id, 'weiterfuehren');
    assert.equal(await lz(pj.stopp!.id), 'aktiv');
  });

  test('Gate «Gestoppt»: Projekt abgebrochen, Bericht zum Abbruch im Endzustand erfassbar (UC-002 Ende, UC-015 A1)', async () => {
    await sys(tx => nachGate(tx, { projektId: pj.gate!.id, versionId: pj.gate!.id, gate: 'P1_P2', ergebnis: 'abgelehnt', begruendung: 'Nutzen nicht belegt' }));
    assert.equal(await lz(pj.gate!.id), 'abgebrochen');
    await sys(tx => nachGate(tx, { projektId: pj.gate!.id, versionId: pj.gate!.id, gate: 'P1_P2', ergebnis: 'abgelehnt', begruendung: 'Nutzen nicht belegt' }));
    // Korrektur des Gate-Entscheids (A-30): Abbruch zurückgenommen, der unbearbeitete Bericht entfällt; danach wieder «Gestoppt»
    await sys(tx => nachGate(tx, { projektId: pj.gate!.id, versionId: pj.gate!.id, gate: 'P1_P2', ergebnis: 'zurueckgestellt', begruendung: '' }));
    assert.equal(await lz(pj.gate!.id), 'aktiv');
    const k = (await ok('pl', 'GET', `/v1/projekte/${pj.gate!.id}/abschluss`)).body;
    assert.deepEqual([k.bericht, k.entscheid?.ergebnis], [null, 'weiterfuehren']);
    await sys(tx => nachGate(tx, { projektId: pj.gate!.id, versionId: pj.gate!.id, gate: 'P1_P2', ergebnis: 'abgelehnt', begruendung: 'Nutzen nicht belegt' }));
    assert.equal(await lz(pj.gate!.id), 'abgebrochen');

    const url = `/v1/projekte/${pj.gate!.id}/abschluss`;
    const g = await ok('pl', 'GET', url);
    assert.deepEqual([g.body.lage, g.body.bericht.art, g.body.can.bearbeiten, g.body.can.wiederaufnahme], ['abbruch', 'abbruch', true, false]);
    let r = await ok('pl', 'PUT', url, { ...LEER, projektstand: 'Abgebrochen nach P1' }, { 'if-match': g.etag });
    r = await ok('pl', 'POST', `${url}/einreichen`, undefined, { 'if-match': r.etag });
    assert.deepEqual([r.body.bericht.stand, r.body.can.bearbeiten], ['eingereicht', false]);
    assert.equal((await call('pl', 'PUT', url, LEER, { 'if-match': r.etag })).statusCode, 409);
    // die Aufgabe des zurückgenommenen Abbruchs ist entfallen, die neue erledigt
    assert.deepEqual((await aufgaben(pj.gate!.id)).map(a => a.stand), ['entfallen', 'erledigt']);
  });

  test('Lessons Learned: Liste mit Filter, Ändern und Löschen nur mit projekt:write (PS.04.03, UI-32)', async () => {
    const l = await ok('kt', 'GET', '/v1/lessons-learned');
    assert.equal(l.body.items.length, 2);
    assert.deepEqual(l.body.kategorien, ['Übergabe']);
    const f = await ok('kt', 'GET', `/v1/lessons-learned?kategorie=${encodeURIComponent('Übergabe')}&jahr=${heute().slice(0, 4)}`);
    assert.equal(f.body.items.length, 1);
    assert.equal(f.body.items[0].can.write, false);
    assert.equal((await ok('kt', 'GET', '/v1/lessons-learned?projekt=1999-999')).body.items.length, 0);
    const eintrag = (await ok('pl', 'GET', `/v1/lessons-learned?q=${encodeURIComponent('früh mit')}`)).body.items[0];
    assert.equal(eintrag.can.write, true);
    assert.equal((await call('kt', 'PATCH', `/v1/lessons-learned/${eintrag.id}`, { text: 'x' }, { 'if-match': `W/"${eintrag.version}"` })).statusCode, 403);
    const p = await ok('pl', 'PATCH', `/v1/lessons-learned/${eintrag.id}`, { kategorie: 'Betrieb' }, { 'if-match': `W/"${eintrag.version}"` });
    assert.equal(p.body.kategorie, 'Betrieb');
    await ok('pl', 'DELETE', `/v1/lessons-learned/${eintrag.id}`, undefined, { 'if-match': p.etag }, 204);
    assert.equal((await ok('kt', 'GET', '/v1/lessons-learned')).body.items.length, 1);
  });

  test('Haken beim Erfassen (AP-E7-5): läuft in der Transaktion, ein Fehler bricht das Erfassen ab; Projektleitung lesbar', async () => {
    const gesehen: { projektId: string; jahr: number }[] = [];
    const ok1 = async (_tx: unknown, l: { projektId: string; jahr: number }) => { gesehen.push({ projektId: l.projektId, jahr: l.jahr }); };
    lessonsLearned.beimErfassen(ok1);
    await ok('pl', 'POST', `/v1/projekte/${pj.exit!.id}/lessons-learned`, { text: 'Haken probieren' }, {}, 201);
    assert.deepEqual(gesehen, [{ projektId: pj.exit!.id, jahr: Number(heute().slice(0, 4)) }]);
    _abmelden(ok1);

    const fehler = async () => { throw new Error('Haken scheitert'); };
    lessonsLearned.beimErfassen(fehler);
    const r = await call('pl', 'POST', `/v1/projekte/${pj.exit!.id}/lessons-learned`, { text: 'nicht gespeichert' });
    _abmelden(fehler);
    assert.equal(r.statusCode, 500);
    assert.equal((await sys(tx => tx.query("SELECT 1 FROM ppm.lessons_learned WHERE text = 'nicht gespeichert'"))).rowCount, 0);

    assert.deepEqual(await sys(tx => lessonsLearned.projektleitung(tx, pj.exit!.id)), [id.pl]);
  });
});
