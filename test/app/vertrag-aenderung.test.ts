/**
 * Änderungsantrag, Versionsvergleich und Hauptänderungen (AP-E3-4; PS.03.01, PS.03.02, PS.03.04; UC-007; K2 Schritte 5,
 * 9): Entwurf aus der Baseline, Vergleich mit «neu» / «entfernt» / «geändert» und Differenz, Hauptänderungen mit altem und
 * neuem Budget (K2-Abnahme), Einreichen beim Sponsor ohne Quality-Check, Freigabe durch den SP; eine Änderung an den
 * Kosten kann der SP nicht freigeben, nur an den PRAT unterstützen (K2-Abnahme, Abnahme AP-E3-4); der PRAT gibt frei
 * (Folge in der Transaktion der UE) oder der SP lehnt mit Begründung ab (A2).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { systemActor } from '@vollholz/platform';
import { vertrag } from '../../src/modules/vertrag/index.ts';
import { heute } from '../../src/modules/sitzung/format.ts';
import { login, person, testApi, type TestApi } from './api.ts';
import { full, skipDb } from './harness.ts';

const skip = await skipDb();

type H = Record<string, string>;
/** Datum n Kalendertage nach heute, auf den nächsten Mittwoch gelegt (Sitzungstag). */
function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('Projektvertrag: Änderungsantrag und Versionsvergleich', { skip }, () => {
  let api: TestApi;
  let T = '';
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};
  let projekt = { id: '', nummer: '' };
  let ohneBaseline = '';
  const termin = mittwochIn(28);

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
  const ok = async (who: string, method: string, url: string, payload?: unknown, headers: H = {}, status = 200) => {
    const r = await call(who, method, url, payload, headers);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r;
  };
  const sys = <R>(fn: Parameters<typeof full<R>>[2]) => full(api.t.runtime, T, fn);
  async function speichern(version: string, nr: number, aendern: (i: Record<string, any>) => void) {
    const g = await ok('pl', 'GET', `/v1/vertragsversionen/${version}/kapitel/${nr}`);
    const inhalt = g.json().inhalt;
    aendern(inhalt);
    return ok('pl', 'PUT', `/v1/vertragsversionen/${version}/kapitel/${nr}`, { inhalt }, { 'if-match': g.headers.etag as string });
  }
  const entwurf = async (begruendung: string) => (await ok('pl', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung }, {}, 201)).json().version;
  const aenderung = (who: string, v: string) => ok(who, 'GET', `/v1/vertragsversionen/${v}/aenderung`);
  const einreichen = async (v: string) => {
    const a = await aenderung('pl', v);
    return ok('pl', 'POST', `/v1/vertragsversionen/${v}/aenderung/einreichen`, undefined, { 'if-match': a.headers.etag as string });
  };
  const entscheiden = async (v: string, ergebnis: string, begruendung?: string) => {
    const a = await aenderung('sp', v);
    return call('sp', 'POST', `/v1/vertragsversionen/${v}/aenderung/entscheiden`, { ergebnis, ...(begruendung !== undefined ? { begruendung } : {}) }, { 'if-match': a.headers.etag as string });
  };
  const aufgaben = (art: string, v: string) => sys(async tx => (await tx.query<{ person: string; stand: string; titel: string }>(
    'SELECT empfaenger_person AS person, stand, titel FROM ppm.aufgabe WHERE art = $1 AND bezug_id = $2 ORDER BY created_at', [art, v])).rows);
  const mitteilungen = (an: string) => sys(async tx => (await tx.query<{ text: string }>('SELECT text FROM ppm.mitteilung WHERE empfaenger_person = $1 ORDER BY created_at', [an])).rows.map(r => r.text));
  const baseline = async () => (await ok('pl', 'GET', `/v1/projekte/${projekt.id}/vertrag`)).json().baseline as string;

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    T = u.tenantId;
    id.ue = u.principalId;
    h.ue = { authorization: u.authorization };
    h.adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    // Phasenmodell nach der Vorgabe: Kapitelwirkung Kap. 5 Scope, Kap. 9 Budget und Ressourcen (PM-Handbuch)
    const pm = await ok('ue', 'POST', '/v1/phasenmodelle', { quelle: 'vorgabe' }, {}, 201);
    await ok('adm', 'POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, undefined, { 'if-match': pm.headers.etag as string });

    const portfolio = (await ok('ue', 'POST', '/v1/portfolios', { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, {}, 201)).json().id;
    const prat = (await ok('ue', 'POST', '/v1/gremien', { portfolioId: portfolio, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, {}, 201)).json().id;
    await ok('ue', 'POST', `/v1/gremien/${prat}/termine`, { datum: termin }, {}, 201);

    for (const sub of ['pl', 'sp', 'ctl', 'kt']) {
      id[sub] = await person(api, T, `u-${sub}`);
      h[sub] = { authorization: (await login(api, 'demo', `u-${sub}`, 'antragsteller')).authorization };
    }
    const p = (await ok('ue', 'POST', '/v1/projekte', { name: 'Digitale Aufnahme', portfolioId: portfolio, phase: 'P1' }, {}, 201)).json();
    projekt = { id: p.id, nummer: p.nummer };
    await ok('ue', 'PUT', `/v1/projekte/${p.id}/organisation`, { mitglieder: ['pl', 'sp', 'ctl', 'kt'].map(f => ({ personId: id[f], funktion: f, akv: '' })) }, { 'if-match': 'W/"0"' });
    const q = (await ok('ue', 'POST', '/v1/projekte', { name: 'Ohne Vertrag', portfolioId: portfolio, phase: 'P1' }, {}, 201)).json();
    ohneBaseline = q.id;
    await ok('ue', 'PUT', `/v1/projekte/${q.id}/organisation`, { mitglieder: [{ personId: id.pl, funktion: 'pl', akv: '' }] }, { 'if-match': 'W/"0"' });

    // Erster Vertrag mit Kosten, Personal, Meilenstein und Risiko, eingereicht und als Baseline gesetzt (Gate-Entscheid, AP-E3-3)
    const v = (await ok('pl', 'POST', `/v1/projekte/${p.id}/vertrag/entwuerfe`, { anlass: 'initial' }, {}, 201)).json().version.id as string;
    await speichern(v, 7, i => { i.meilensteine = [{ registerId: null, phase: 'P2', art: 'meilenstein', text: 'Go-live', termin: '2027-03-01' }]; });
    await speichern(v, 9, i => {
      i.kosten = [
        { registerId: null, phase: 'P1', art: 'opex', text: 'Konzept', lieferant: '', offerte: '', betrag: 100000 },
        { registerId: null, phase: 'P2', art: 'capex', text: 'Lizenzen', lieferant: 'Acme', offerte: '', betrag: 2100000 },
      ];
      i.personal = [{ registerId: null, phase: 'P2', rolle: 'entwicklung', groesse: null, fte: 1.5, vonMonat: '2027-01', bisMonat: '2027-06', bemerkung: '' }];
    });
    await speichern(v, 10, i => { i.risiken = [{ registerId: null, text: 'Lieferverzug', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: '', verantwortlich: '' }]; });
    const d = await ok('pl', 'GET', `/v1/vertragsversionen/${v}`);
    await ok('pl', 'POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': d.headers.etag as string });
    await sys(tx => vertrag.baselineSetzen(tx, systemActor('system'), v));
  });
  after(async () => { await api?.close(); });

  let v1 = '';

  test('Entwurf «Änderung»: übernimmt die Baseline vollständig; nur mit Baseline und Begründung (UC-007 Schritt 1)', async () => {
    const b = await baseline();
    assert.deepEqual((await ok('pl', 'GET', `/v1/projekte/${projekt.id}/vertrag`)).json().can.entwerfen, ['aenderung', 'gate'], 'mit Baseline auch das Gate (AP-E3-3)');
    assert.deepEqual((await ok('pl', 'GET', `/v1/projekte/${ohneBaseline}/vertrag`)).json().can.entwerfen, ['initial']);
    const ohne = await call('pl', 'POST', `/v1/projekte/${ohneBaseline}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung: 'x' });
    assert.equal(ohne.statusCode, 409, ohne.body);
    assert.match(ohne.json().detail, /keinen freigegebenen Projektvertrag/);
    assert.equal((await call('pl', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung: ' ' })).statusCode, 422);
    assert.equal((await call('sp', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung: 'x' })).statusCode, 403);

    const e = await entwurf('Annahmen zum WLAN haben sich geändert');
    v1 = e.id;
    assert.deepEqual([e.nummer, e.anlass, e.zielphase, e.stand, e.basisVersionId, e.begruendung, e.can], ['0.2', 'aenderung', 'P1', 'in_arbeit', b, 'Annahmen zum WLAN haben sich geändert', { write: true, einreichen: false }]);
    const k9 = (await ok('pl', 'GET', `/v1/vertragsversionen/${v1}/kapitel/9`)).json();
    assert.deepEqual(k9.inhalt, k9.basis, 'Baseline vollständig übernommen, mit den Verweisen ins Register');
    assert.ok(k9.inhalt.kosten.every((k: { registerId: string | null }) => k.registerId));
    assert.equal((await call('pl', 'POST', `/v1/projekte/${projekt.id}/vertrag/entwuerfe`, { anlass: 'aenderung', begruendung: 'zweiter' })).statusCode, 409, 'höchstens ein Entwurf');
    // ohne Anpassung: noch nichts einzureichen; die allgemeine Einreichung gilt nicht für Änderungen
    const r = await call('pl', 'POST', `/v1/vertragsversionen/${v1}/aenderung/einreichen`, undefined, { 'if-match': (await aenderung('pl', v1)).headers.etag as string });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().reason, 'unveraendert');
  });

  test('Änderung ohne Wirkung auf Scope, Budget, Ressourcen: SP gibt frei, Version wird Baseline (UC-007 Schritte 2–4)', async () => {
    await speichern(v1, 4, i => { i.annahmen = 'WLAN in allen Stationen ab 2027'; });
    const vg = (await ok('pl', 'GET', `/v1/vertragsversionen/${v1}/vergleich`)).json();
    assert.deepEqual(vg.kapitel.filter((k: { geaendert: boolean }) => k.geaendert).map((k: { kapitel: number }) => k.kapitel), [4]);
    assert.deepEqual(vg.kapitel[3].unterschiede, [{ feld: 'annahmen', label: 'Annahmen', eintrag: null, eintragFeld: null, art: 'neu', alt: '', neu: 'WLAN in allen Stationen ab 2027', differenz: null }]);
    const ha = (await ok('pl', 'GET', `/v1/vertragsversionen/${v1}/hauptaenderungen`)).json();
    assert.deepEqual(ha.rubriken.map((r: { rubrik: string; erzeugt: string[] }) => [r.rubrik, r.erzeugt]),
      [['scope', []], ['zeitplan', []], ['ressourcen_budget', []], ['annahmen', ['Annahmen ergänzt']], ['key_risiken', []]]);

    const r = await einreichen(v1);
    const a = r.json();
    assert.deepEqual([a.stand, a.wirkung, a.can], ['in_pruefung', { prat: false, dimensionen: [], kapitel: [], hinweis: null }, { einreichen: false, freigeben: false, ablehnen: false, anPrat: false }]);
    assert.deepEqual((await aufgaben('aenderung.entscheiden', v1)).map(x => [x.person, x.stand, x.titel]), [[id.sp, 'offen', 'Änderung am Projektvertrag Digitale Aufnahme entscheiden']]);
    // kein Quality-Check für eine Änderung (UC-007 Schritt 3)
    const pr = await ok('ue', 'GET', `/v1/vertragsversionen/${v1}/pruefung`);
    assert.equal(pr.json().can.qualityCheck, false);
    assert.equal((await call('ue', 'POST', `/v1/vertragsversionen/${v1}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': pr.headers.etag as string })).statusCode, 409);

    const s = (await aenderung('sp', v1)).json();
    assert.deepEqual(s.can, { einreichen: false, freigeben: true, ablehnen: true, anPrat: false });
    assert.equal((await call('pl', 'POST', `/v1/vertragsversionen/${v1}/aenderung/entscheiden`, { ergebnis: 'freigegeben' }, { 'if-match': `W/"${s.version}"` })).statusCode, 403, 'nur vertrag:decide');
    assert.equal((await call('sp', 'POST', `/v1/vertragsversionen/${v1}/aenderung/entscheiden`, { ergebnis: 'freigegeben' }, { 'if-match': 'W/"99"' })).statusCode, 412);
    assert.equal((await entscheiden(v1, 'an_prat')).statusCode, 409, 'ohne Wirkung entscheidet der SP');
    const f = await entscheiden(v1, 'freigegeben');
    assert.equal(f.statusCode, 200, f.body);
    assert.deepEqual([f.json().stand, f.json().entscheid.ergebnis, f.json().entscheid.personId], ['abgenommen', 'freigegeben', id.sp]);
    assert.equal(await baseline(), v1);
    assert.deepEqual((await aufgaben('aenderung.entscheiden', v1)).map(x => x.stand), ['erledigt']);
    assert.ok((await mitteilungen(id.pl!)).includes('Änderung freigegeben: Version 0.2 des Projektvertrags Digitale Aufnahme ist Baseline.'));
  });

  let v2 = '';

  test('Hauptänderungen und Vergleich: Budget alt und neu, Termine, neue Risiken; Beträge nur mit Recht (K2-Abnahme, A-33)', async () => {
    v2 = (await entwurf('Lizenzkosten gestiegen, Go-live verschoben')).id;
    await speichern(v2, 9, i => { i.kosten[1].betrag = 2400000; });
    await speichern(v2, 7, i => { i.meilensteine[0].termin = '2027-06-01'; });
    await speichern(v2, 10, i => { i.risiken.push({ registerId: null, text: 'Ressourcenengpass', wahrscheinlichkeit: 'hoch', auswirkung: 'mittel', massnahme: '', verantwortlich: '' }); });

    const ha = (await ok('pl', 'GET', `/v1/vertragsversionen/${v2}/hauptaenderungen`)).json();
    const rub = Object.fromEntries(ha.rubriken.map((r: { rubrik: string; erzeugt: string[] }) => [r.rubrik, r.erzeugt]));
    assert.deepEqual(rub.ressourcen_budget, ['Budget P2: CHF 2,40 Mio. statt CHF 2,10 Mio. (+14 %)', 'Budget gesamt: CHF 2,50 Mio. statt CHF 2,20 Mio. (+14 %)']);
    assert.deepEqual(rub.zeitplan, ['Meilenstein «Go-live»: Termin 1.6.2027 statt 1.3.2027']);
    assert.deepEqual(rub.key_risiken, ['Neu: Risiko «Ressourcenengpass» (EW hoch, AW mittel)']);
    const vg = (await ok('pl', 'GET', `/v1/vertragsversionen/${v2}/vergleich`)).json();
    assert.equal(vg.betraege, true);
    assert.deepEqual(vg.kapitel[8].unterschiede.map((u: { eintrag: string; eintragFeld: string; art: string; alt: number; neu: number; differenz: number }) => [u.eintrag, u.eintragFeld, u.art, u.alt, u.neu, u.differenz]),
      [['P2 Lizenzen', 'betrag', 'geaendert', 2100000, 2400000, 300000]]);
    assert.deepEqual(vg.kapitel[9].unterschiede.map((u: { art: string; eintrag: string }) => [u.art, u.eintrag]), [['neu', 'Ressourcenengpass']]);
    // Vergleich mit einer bestimmten Version; fremde Version abgewiesen
    const mitErster = (await ok('pl', 'GET', `/v1/vertragsversionen/${v2}/vergleich?mit=${v1}`)).json();
    assert.equal(mitErster.mitNummer, '0.2');
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${v2}/vergleich?mit=00000000-0000-4000-8000-000000000000`)).statusCode, 422);

    // Kernteam ohne Recht auf Beträge: keine Beträge im Vergleich, kein Budget in den Hauptänderungen
    const kt = (await ok('kt', 'GET', `/v1/vertragsversionen/${v2}/vergleich`)).json();
    assert.deepEqual([kt.betraege, kt.kapitel[8].geaendert], [false, false]);
    const kth = (await ok('kt', 'GET', `/v1/vertragsversionen/${v2}/hauptaenderungen`)).json();
    assert.deepEqual(kth.rubriken.find((r: { rubrik: string }) => r.rubrik === 'ressourcen_budget').erzeugt, []);
    assert.equal(kth.can.write, false);

    // PL formuliert um und ergänzt «Andere» (K2 Schritt 5); If-Match auf die Version
    const g = await ok('pl', 'GET', `/v1/vertragsversionen/${v2}/hauptaenderungen`);
    assert.equal((await call('pl', 'PUT', `/v1/vertragsversionen/${v2}/hauptaenderungen`, { rubriken: {}, andere: '' })).statusCode, 428);
    assert.equal((await call('kt', 'PUT', `/v1/vertragsversionen/${v2}/hauptaenderungen`, { rubriken: {}, andere: '' }, { 'if-match': g.headers.etag as string })).statusCode, 403);
    const put = await ok('pl', 'PUT', `/v1/vertragsversionen/${v2}/hauptaenderungen`,
      { rubriken: { zeitplan: ' Go-live drei Monate später ', scope: null }, andere: 'Lieferant neu verhandelt' }, { 'if-match': g.headers.etag as string });
    const p = put.json();
    assert.deepEqual([p.rubriken[1].text, p.rubriken[0].text, p.andere], ['Go-live drei Monate später', null, 'Lieferant neu verhandelt']);
    assert.equal((await call('pl', 'PUT', `/v1/vertragsversionen/${v2}/hauptaenderungen`, { rubriken: {}, andere: '' }, { 'if-match': g.headers.etag as string })).statusCode, 412);
  });

  test('Änderung an den Kosten: SP kann nicht freigeben, nur an den PRAT unterstützen (Abnahme AP-E3-4, K2-Prüfung)', async () => {
    await einreichen(v2);
    const s = (await aenderung('sp', v2)).json();
    assert.deepEqual(s.wirkung, {
      prat: true, dimensionen: ['budget', 'ressourcen'], kapitel: [9],
      hinweis: 'Freigabe durch den PRAT: Diese Änderung betrifft Budget und Ressourcen. Du kannst sie unterstützen; entscheiden wird der PRAT.',
    });
    assert.deepEqual(s.can, { einreichen: false, freigeben: false, ablehnen: true, anPrat: true });
    const f = await entscheiden(v2, 'freigegeben');
    assert.equal(f.statusCode, 409, f.body);
    assert.deepEqual([f.json().reason, f.json().detail], ['prat', s.wirkung.hinweis]);
    assert.equal((await entscheiden(v2, 'abgelehnt', ' ')).statusCode, 422, 'Ablehnen nur mit Begründung');
    assert.equal(await baseline(), v1, 'Baseline unverändert');

    const r = await entscheiden(v2, 'an_prat');
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().stand, r.json().entscheid.ergebnis], ['traktandiert', 'an_prat']);
    const t = await sys(async tx => (await tx.query<{ art: string; titel: string; antrag: string; stand: string }>(
      'SELECT art, titel, antrag, stand FROM ppm.traktandum WHERE bezug_id = $1', [v2])).rows);
    assert.deepEqual(t, [{ art: 'aenderung', titel: `Änderung Projektvertrag ${projekt.nummer} Digitale Aufnahme`, antrag: 'Version 0.3 freigeben: Lizenzkosten gestiegen, Go-live verschoben', stand: 'vorgeschlagen' }]);
    assert.deepEqual((await aufgaben('aenderung.entscheiden', v2)).map(x => x.stand), ['erledigt']);
  });

  test('PRAT gibt frei: Folge in der Transaktion der UE setzt die Baseline und führt das Register nach (UC-007 A1.2)', async () => {
    const vorschlag = await sys(async tx => (await tx.query<{ id: string }>('SELECT id FROM ppm.traktandum WHERE bezug_id = $1', [v2])).rows[0]!.id);
    const s = (await ok('ue', 'POST', '/v1/gremien/prat/sitzungen', { datum: termin }, {}, 201)).json();
    let r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/traktanden`, { vorschlagId: vorschlag })).json();
    r = (await ok('ue', 'POST', `/v1/sitzungen/${s.id}/versenden`, undefined, { 'if-match': `W/"${r.version}"` })).json();
    await ok('ue', 'POST', `/v1/sitzungen/${s.id}/starten`, undefined, { 'if-match': `W/"${r.version}"` });
    await ok('ue', 'PUT', `/v1/traktanden/${vorschlag}/entscheid`, { ergebnis: 'freigegeben', begruendung: 'Mehrkosten durch Nutzen gedeckt' });

    assert.equal(await baseline(), v2);
    // Akteur der Folge ist die UE, die den Entscheid erfasst (FolgeKontext), nicht das System
    const audit = await sys(async tx => (await tx.query<{ action: string; actor_kind: string; actor_id: string | null }>(
      "SELECT action, actor_kind, actor_id FROM ppm.audit_log WHERE resource_id = $1 AND action IN ('vertrag.change_decided', 'vertrag.baselined') ORDER BY seq", [v2])).rows);
    assert.deepEqual(audit.slice(-2).map(a => [a.action, a.actor_id]), [['vertrag.baselined', id.ue], ['vertrag.change_decided', id.ue]]);
    const kosten = (await ok('pl', 'GET', `/v1/projekte/${projekt.id}/kosten`)).json().items as { text: string; budgetBaseline: number }[];
    assert.deepEqual(kosten.map(k => [k.text, k.budgetBaseline]).sort(), [['Konzept', 100000], ['Lizenzen', 2400000]]);
    const ms = (await ok('pl', 'GET', `/v1/projekte/${projekt.id}/meilensteine`)).json().items as { text: string; terminBaseline: string }[];
    assert.equal(ms.find(m => m.text === 'Go-live')?.terminBaseline, '2027-06-01');
  });

  test('SP lehnt ab: Begründung Pflicht, Baseline bleibt, PL informiert; nächste Änderung erhält die nächste Nummer (UC-007 A2)', async () => {
    const v3 = (await entwurf('Abgrenzung erweitern')).id;
    await speichern(v3, 4, i => { i.loesungsansatz = 'Zusätzlich Tablet-Lösung'; });
    await einreichen(v3);
    const r = await entscheiden(v3, 'abgelehnt', 'Nicht im Budget');
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().stand, r.json().entscheid.ergebnis, r.json().entscheid.begruendung], ['abgelehnt', 'abgelehnt', 'Nicht im Budget']);
    assert.equal(await baseline(), v2);
    assert.ok((await mitteilungen(id.pl!)).some(m => m.startsWith('Änderung abgelehnt: Version 0.4')));
    assert.equal((await entscheiden(v3, 'freigegeben')).statusCode, 409, 'bereits entschieden');
    assert.equal((await entwurf('Neuer Anlauf')).nummer, '0.5');
  });
});
