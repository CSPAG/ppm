/**
 * Risikolage und Portfoliobericht (BC PC.02.02, PC.04.02; UC-014 Schritte 2–3; K3 Schritt 4; AP-E2-3): Risikolage aus
 * Projekt- und Portfoliorisiken mit Abhängigkeiten und Eskalationen, Sichtbarkeit je Rolle; Bericht aus dem
 * abgeschlossenen Dashboard (PPM-4), Kommentar, Bereitstellen, Dokument über `vorlage`; Vorschlag «Bericht der
 * Programmleitung» mit dem Bericht als Unterlage.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { BERICHT_FELDER, mitFeldern } from '../../src/modules/auswertung/bericht-vorlage.ts';
import type { BerichtDaten } from '../../src/modules/auswertung/bericht.ts';
import { werte } from '../../src/modules/vorlage/modell.ts';
import { entpacken } from '../../src/modules/vorlage/zip.ts';
import { full } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { wordVorlage } from './fixtures/word.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
const PERIODE = heute.slice(0, 7);
const VORPERIODE = (() => { const [j, m] = PERIODE.split('-').map(Number) as [number, number]; return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`; })();

function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('Risikolage und Portfoliobericht', () => {
  let api: TestApi;
  let T = '';
  let ue: Record<string, string>, gremium: Record<string, string>, pl: Record<string, string>, gl: Record<string, string>;
  const p: Record<string, string> = {};
  let pfA = '', pfC = '';

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    T = u.tenantId;
    ue = { authorization: u.authorization };
    const l = await login(api, 'demo', 'u-pl', null);
    await full(api.t.runtime, T, async tx => {
      pfA = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      pfC = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'C', 'dir-med', 'Direktion Medizin', false) RETURNING id", [T])).rows[0]!.id;
      for (const [nr, pf, phase] of [['2026-001', pfA, 'P1'], ['2026-002', pfA, 'P2'], ['2026-003', pfC, 'P1']] as const) {
        p[nr] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $3, $4, $5) RETURNING id', [T, nr, `Projekt ${nr}`, pf, phase])).rows[0]!.id;
      }
      // vertraulich: nur mit projekt:vertraulich (UE, Gremium; nicht GL)
      await tx.query('UPDATE ppm.projekt SET vertraulich = true WHERE id = $1', [p['2026-002']]);
      // abgeschlossenes Projekt: seine Risiken zählen nicht
      p['2025-009'] = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, lebenszyklus) VALUES ($1, '2025-009', 'Altprojekt', $2, 'P4', 'abgeschlossen') RETURNING id", [T, pfA])).rows[0]!.id;
      await tx.query("INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, 'pl')", [T, p['2026-001'], l.principalId]);
      const risiko = (sp: 'projekt_id' | 'portfolio_id', id: string, text: string, w: string, a: string, stand = 'offen') => tx.query(
        `INSERT INTO ppm.risiko (tenant_id, ${sp}, text, wahrscheinlichkeit, auswirkung, massnahme, massnahme_stand) VALUES ($1, $2, $3, $4, $5, 'Massnahme', $6)`, [T, id, text, w, a, stand]);
      await risiko('projekt_id', p['2026-001']!, 'Lieferant fällt aus', 'mittel', 'hoch');
      await risiko('projekt_id', p['2026-002']!, 'Schlüsselperson fehlt', 'hoch', 'hoch', 'umgesetzt');
      await risiko('projekt_id', p['2026-002']!, 'Datenqualität', 'tief', 'mittel');
      await risiko('projekt_id', p['2026-003']!, 'Fremdes Portfolio', 'hoch', 'hoch');
      await risiko('projekt_id', p['2025-009']!, 'Alt', 'hoch', 'hoch');
      await risiko('portfolio_id', pfA, 'Budget des Portfolios knapp', 'hoch', 'hoch');
      await tx.query("INSERT INTO ppm.abhaengigkeit (tenant_id, projekt_id, zu_projekt_id, text) VALUES ($1, $2, $3, 'Schnittstelle')", [T, p['2026-002'], p['2026-001']]);
      await tx.query('INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, $2), ($1, $3)', [T, VORPERIODE, PERIODE]);
      const b = (await tx.query<{ id: string }>(
        `INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, stand, status, trend, phase, naechster_meilenstein, begruendung, massnahme, entscheid_noetig, eingereicht_at)
         VALUES ($1, $2, $3, 'geprueft', 'kritisch', 'abwaerts', 'P1', 'Konzept', 'Lieferverzug', 'Zweitlieferant', true, now()) RETURNING id`, [T, p['2026-001'], VORPERIODE])).rows[0]!.id;
      await tx.query("INSERT INTO ppm.eskalation (tenant_id, projekt_id, statusbericht_id, grund, massnahme) VALUES ($1, $2, $3, 'Lieferverzug', 'Zweitlieferant')", [T, p['2026-001'], b]);
    });
    pl = { authorization: l.authorization };
    await grant(api, T, `user:${l.principalId}`, 'pl', { type: 'projekt', id: p['2026-001']! });
    const g = await login(api, 'demo', 'u-gremium', null);
    await grant(api, T, `user:${g.principalId}`, 'gremium', { type: 'portfolio', id: pfA });
    gremium = { authorization: g.authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'gl')).authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, h: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method, url, headers: h, payload: payload as Record<string, unknown> | undefined });
  const ok = async (method: 'GET' | 'POST' | 'PATCH', url: string, h: Record<string, string>, payload?: unknown, code = 200) => {
    const r = await call(method, url, h, payload);
    assert.equal(r.statusCode, code, r.body);
    return r.json();
  };

  test('Risikolage: Projekt- und Portfoliorisiken, Matrix, Abhängigkeiten, Eskalationen; Sicht je Rolle (UC-014 Schritt 2)', async () => {
    const r = await ok('GET', '/v1/dashboard/risiken?portfolio=transformation', ue);
    // höchste Auswirkung und Wahrscheinlichkeit zuerst, offene vor umgesetzten; abgeschlossenes Projekt fehlt
    assert.deepEqual(r.risiken.map((x: { text: string; ebene: string }) => [x.ebene, x.text]), [
      ['portfolio', 'Budget des Portfolios knapp'],
      ['projekt', 'Schlüsselperson fehlt'],
      ['projekt', 'Lieferant fällt aus'],
      ['projekt', 'Datenqualität'],
    ]);
    const feld = (w: string, a: string) => r.matrix.find((m: { wahrscheinlichkeit: string; auswirkung: string }) => m.wahrscheinlichkeit === w && m.auswirkung === a).anzahl;
    assert.deepEqual([r.matrix.length, feld('hoch', 'hoch'), feld('mittel', 'hoch'), feld('tief', 'mittel'), feld('tief', 'tief')], [9, 2, 1, 1, 0]);
    assert.deepEqual(r.abhaengigkeiten.map((a: { von: { nummer: string }; zu: { nummer: string } }) => [a.von.nummer, a.zu.nummer]), [['2026-002', '2026-001']]);
    assert.deepEqual(r.eskalationen.map((e: { projekt: { nummer: string }; periode: string; stand: string }) => [e.projekt.nummer, e.periode, e.stand]), [['2026-001', VORPERIODE, 'offen']]);
    // ohne Portfolio: alle sichtbaren (UE: beide)
    assert.equal((await ok('GET', '/v1/dashboard/risiken', ue)).risiken.length, 5);
    // Gremium nur sein Portfolio; Projektrolle ohne Auswertung
    const g = await ok('GET', '/v1/dashboard/risiken', gremium);
    assert.deepEqual([g.portfolios.map((x: { schluessel: string }) => x.schluessel), g.risiken.length], [['transformation'], 4]);
    assert.equal((await call('GET', '/v1/dashboard/risiken?portfolio=dir-med', gremium)).statusCode, 404);
    assert.equal((await call('GET', '/v1/dashboard/risiken', pl)).statusCode, 403);

    // Export (Seitentyp Bericht): die Risiken wie die Tabelle, nach Feld der Matrix bzw. offener Massnahme
    const x = await call('GET', '/v1/dashboard/risiken?portfolio=transformation&format=csv', ue);
    assert.equal(x.statusCode, 200, x.body);
    assert.match(x.headers['content-disposition'] as string, /filename="risikolage-transformation\.csv"/);
    const zeilen = (q: string) => (async () => (await call('GET', `/v1/dashboard/risiken?portfolio=transformation&format=csv${q}`, ue)).body.replace(/^\uFEFF/, '').trim().split('\r\n'))();
    const alle = x.body.replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.equal(alle[0], 'Ebene;Nummer;Projekt;Risiko;Wahrscheinlichkeit;Auswirkung;Massnahme;Stand der Massnahme;Verantwortlich');
    assert.equal(alle.length - 1, 4);
    assert.equal((await zeilen('&w=hoch&a=hoch')).length - 1, feld('hoch', 'hoch'));
    assert.equal((await zeilen('&w=tief&a=tief')).length - 1, 0);
    assert.equal((await call('GET', '/v1/dashboard/risiken?w=hoch', ue)).statusCode, 422, '`w` nur für den Export');
  });

  let id = '';
  let prat = '';

  test('Portfoliobericht aus dem abgeschlossenen Dashboard; Kommentar, neu erzeugen, bereitstellen (UC-014 Schritt 3, PPM-4)', async () => {
    const neu = { portfolio: 'transformation', periode: VORPERIODE };
    // offene Periode: noch kein Bericht
    assert.equal((await call('POST', '/v1/portfolioberichte', ue, neu)).statusCode, 409);
    assert.equal((await call('POST', '/v1/portfolioberichte', gremium, neu)).statusCode, 403, 'nur mit auswertung:write');
    await ok('POST', `/v1/perioden/${VORPERIODE}/abschliessen`, ue);

    const b = await ok('POST', '/v1/portfolioberichte', ue, neu, 201);
    id = b.id;
    assert.deepEqual([b.stand, b.version, b.can, b.portfolio.schluessel], ['entwurf', 1, { bearbeiten: true, bereitstellen: true }, 'transformation']);
    // Stand bei Abschluss (dashboard_zeile), nur Portfolio «Transformation»
    assert.deepEqual(b.dashboard.items.filter((i: { nummer: string }) => i.nummer === '2026-001').map((i: { status: string | null; meldung: string; merkmale: string[] }) => [i.status, i.meldung, i.merkmale]),
      [['kritisch', 'gemeldet', ['eskalation']]]);
    assert.ok(b.dashboard.items.every((i: { portfolio: string }) => i.portfolio === 'Transformation'));
    assert.equal(b.dashboard.funnel.length, 5);
    assert.equal(b.risikolage.risiken.length, 4);

    // Kommentar mit If-Match; falsche Version 412
    assert.equal((await call('PATCH', `/v1/portfolioberichte/${id}`, ue, { kommentar: 'x' })).statusCode, 428);
    assert.equal((await call('PATCH', `/v1/portfolioberichte/${id}`, { ...ue, 'if-match': 'W/"9"' }, { kommentar: 'x' })).statusCode, 412);
    const k = await ok('PATCH', `/v1/portfolioberichte/${id}`, { ...ue, 'if-match': 'W/"1"' }, { kommentar: ' Lage stabil, ein Projekt kritisch. ' });
    assert.deepEqual([k.kommentar, k.version], ['Lage stabil, ein Projekt kritisch.', 2]);
    // neu erzeugen im Entwurf: Kommentar bleibt
    const n = await ok('POST', '/v1/portfolioberichte', ue, neu);
    assert.deepEqual([n.id, n.kommentar, n.version], [id, 'Lage stabil, ein Projekt kritisch.', 3]);

    // Entwurf sieht nur die UE
    assert.deepEqual((await ok('GET', '/v1/portfolioberichte', gremium)).items, []);
    assert.equal((await call('GET', `/v1/portfolioberichte/${id}`, gremium)).statusCode, 404);

    // entscheidendes Gremium des Portfolios: erhält beim Bereitstellen den Vorschlag
    prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: pfA, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).id;
    const r = await ok('POST', `/v1/portfolioberichte/${id}/bereitstellen`, { ...ue, 'if-match': 'W/"3"' });
    assert.deepEqual([r.stand, r.bereitgestelltAt !== null, r.can.bearbeiten], ['bereitgestellt', true, false]);
    // fest: weder Kommentar noch neu erzeugen
    assert.equal((await call('PATCH', `/v1/portfolioberichte/${id}`, { ...ue, 'if-match': 'W/"4"' }, { kommentar: 'später' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/portfolioberichte', ue, neu)).statusCode, 409);
    // jetzt sieht ihn das Gremium (lesend)
    const g = await ok('GET', `/v1/portfolioberichte/${id}`, gremium);
    assert.deepEqual([g.stand, g.can.bearbeiten], ['bereitgestellt', false]);
    assert.deepEqual((await ok('GET', '/v1/portfolioberichte?portfolio=transformation', gremium)).items.map((x: { id: string }) => x.id), [id]);
    assert.equal((await call('GET', '/v1/portfolioberichte', pl)).statusCode, 403);
    // gespeicherter Stand in der Sicht der Person: GL ohne projekt:vertraulich sieht 2026-002 weder als Zeile noch über
    // Risiken oder Abhängigkeiten; Funnel und Matrix neu gezählt
    const l = await ok('GET', `/v1/portfolioberichte/${id}`, gl);
    assert.ok(!JSON.stringify(l).includes('2026-002'));
    assert.deepEqual([l.risikolage.risiken.length, l.risikolage.abhaengigkeiten.length], [2, 0]);
    assert.equal(l.dashboard.funnel.reduce((n: number, f: { anzahl: number }) => n + f.anzahl, 0), l.dashboard.items.length);
    assert.ok(JSON.stringify(await ok('GET', `/v1/portfolioberichte/${id}`, ue)).includes('2026-002'));
  });

  test('Dokument als PDF und Word über die Ausgabe der Vorlagen; Export im Audit', async () => {
    const pdf = await call('GET', `/v1/portfolioberichte/${id}/dokument`, gremium);
    assert.equal(pdf.statusCode, 200, pdf.body);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.match(String(pdf.headers['content-disposition']), new RegExp(`Portfoliobericht_transformation_${VORPERIODE}\\.pdf`));
    assert.equal(pdf.rawPayload.subarray(0, 5).toString(), '%PDF-');
    const docx = await call('GET', `/v1/portfolioberichte/${id}/dokument?format=docx`, ue);
    assert.equal(docx.statusCode, 200);
    assert.equal(docx.rawPayload.subarray(0, 2).toString(), 'PK');
    const n = await full(api.t.runtime, T, async tx => (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM ppm.audit_log WHERE action = 'portfoliobericht.exported'")).rows[0]!.n);
    assert.equal(n, 2);
  });

  test('eigene Word-Vorlage: Feldkatalog aus dem gespeicherten Stand, Word-Ausgabe mit der aktiven Vorlage (AM.03.01, UC-018 Schritt 2)', async () => {
    // jedes Feld des Katalogs hat einen Wert aus dem Dokument (gleiche Texte wie im Grundbestand)
    const w = werte(mitFeldern(await ok('GET', `/v1/portfolioberichte/${id}`, ue) as BerichtDaten));
    assert.deepEqual(BERICHT_FELDER.filter(f => !(f.schluessel in w)).map(f => f.schluessel), []);
    const art = await ok('GET', '/v1/vorlagen/portfoliobericht', ue);
    assert.equal(art.felder.length, BERICHT_FELDER.length);

    const datei = wordVorlage([['«Portfolio» · «Peri', 'ode»'], ['«Kommentar der Programmleitung»'], ['«Projekte der Periode»'], ['«Offene Eskalationen»']], 'Intern · enthält Personendaten');
    const r = await call('POST', '/v1/vorlagen/portfoliobericht/versionen', ue, { dateiname: 'Portfoliobericht.docx', inhalt: datei.toString('base64') });
    assert.equal(r.statusCode, 201, r.body);
    assert.deepEqual([r.json().zuordnung, r.json().pruefung.aktivierbar], [{
      Portfolio: 'portfolio.name', Periode: 'bericht.periode', 'Kommentar der Programmleitung': 'bericht.kommentar', 'Projekte der Periode': 'projekte',
      'Offene Eskalationen': 'risikolage.eskalationen',
    }, true]);
    assert.equal((await call('POST', '/v1/vorlagen/portfoliobericht/versionen/1/aktivieren', { ...ue, 'if-match': r.headers.etag as string })).statusCode, 200);

    // das Gremium liest die Vorlage nicht, erhält aber den Bericht in ihrer Gestaltung; PDF weiter im Grundbestand
    const d = await call('GET', `/v1/portfolioberichte/${id}/dokument?format=docx`, gremium);
    assert.equal(d.statusCode, 200, d.body);
    const xml = entpacken(d.rawPayload).find(e => e.name === 'word/document.xml')!.daten.toString('utf8');
    assert.match(xml, /Transformation · \S+ \d{4}/);
    assert.match(xml, /Lage stabil, ein Projekt kritisch\./);
    assert.match(xml, /2026-001 · Projekt 2026-001 \(Eskalation\) · P1 · Kritisch/);
    assert.match(xml, /Lieferverzug · Zweitlieferant/);
    assert.doesNotMatch(xml, /«/);
    assert.equal((await call('GET', `/v1/portfolioberichte/${id}/dokument`, gremium)).rawPayload.subarray(0, 5).toString(), '%PDF-');
  });

  test('Vorschlag «Bericht der Programmleitung» an das Gremium mit dem Bericht als Unterlage (K3 Schritte 1 und 4)', async () => {
    const datum = mittwochIn(35);
    await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum }, 201);
    // neue Sitzung: der offene Vorschlag wird festes Traktandum 1 (K3 Schritt 4)
    const s = await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum }, 201);
    assert.equal(s.traktanden.length, 1, 'festes Traktandum 1');
    const t = s.traktanden[0];
    const monat = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${VORPERIODE}-01T00:00:00Z`));
    assert.deepEqual([t.titel, t.antrag, t.position, t.fest, t.bezug.typ], ['Bericht der Programmleitung', `Kenntnisnahme des Portfolioberichts ${monat}`, 1, true, 'portfoliobericht']);
    const vs = await ok('GET', `/v1/sitzungen/${s.id}/vorschlaege`, ue);
    assert.equal(vs.gruppen.find((x: { art: string }) => x.art === 'portfoliobericht'), undefined, 'kein Vorschlag mehr offen');
    // Unterlage «Portfoliobericht <Monat>» bereit
    const a = t;
    assert.deepEqual([a.unterlagen.stand, a.unterlagen.liste[0].titel], ['bereit', `Portfoliobericht ${monat}`]);
  });
});
