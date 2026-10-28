/**
 * Projektvertrag (AP-E3-1, docs/fachmodell.md 2.10; K2): erster Entwurf mit Vorbelegung (UC-002 Schritt 1), höchstens
 * ein Entwurf (UX-E5), Kapitel mit Schema, ETag und Rechten (Beträge A-33), Pflichtangaben je Phase mit Sprungziel
 * (Abnahme K2-4: jede fehlende Angabe führt mit einem Klick zur Stelle), Einreichen mit Quality-Check-Aufgabe
 * (UC-002 Schritt 8), Grösse S/M/L am Gate P1–P2 gesperrt (UC-003 A1) und Baseline mit Übernahme ins Register.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { systemActor } from '@vollholz/platform';
import { vertrag } from '../../src/modules/vertrag/index.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';

const skip = await skipDb();

type Ort = { type: 'org' } | { type: 'portfolio' | 'projekt'; id: string };
type H = Record<string, string>;

describe('Projektvertrag', { skip }, () => {
  let api: TestApi;
  let T: string;
  let pf: string;
  const projekt: Record<'p0' | 'p2' | 'andere', string> = { p0: '', p2: '', andere: '' };
  let ziel = '', handlungsfeld = '';
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};

  /** Person mit Rollen; jede ist auch Antragstellerin an der Organisation («Alle Mitglieder», A-46). */
  async function person(sub: string, rollen: [string, Ort][]): Promise<H> {
    const l = await login(api, 'acme', sub, null);
    id[sub] = l.principalId;
    for (const [rolle, ort] of [...rollen, ['antragsteller', { type: 'org' }] as [string, Ort]]) await grant(api, T, `user:${l.principalId}`, rolle, ort);
    return { authorization: l.authorization };
  }
  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  /** Kapitel lesen, ändern und mit dem ETag speichern. */
  async function speichern(who: string, version: string, nr: number, aendern: (i: Record<string, unknown>) => void) {
    const g = await call(who, 'GET', `/v1/vertragsversionen/${version}/kapitel/${nr}`);
    assert.equal(g.statusCode, 200, g.body);
    const inhalt = g.json().inhalt;
    aendern(inhalt);
    return call(who, 'PUT', `/v1/vertragsversionen/${version}/kapitel/${nr}`, { inhalt }, { 'if-match': g.headers.etag as string });
  }

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      handlungsfeld = (await tx.query<{ id: string }>("INSERT INTO ppm.handlungsfeld (tenant_id, label) VALUES ($1, 'Patientenpfade') RETURNING id", [T])).rows[0]!.id;
      ziel = (await tx.query<{ id: string }>("INSERT INTO ppm.strategisches_ziel (tenant_id, handlungsfeld_id, nummer, text) VALUES ($1, $2, '2.1', 'Digitale Aufnahme') RETURNING id", [T, handlungsfeld])).rows[0]!.id;
      const herkunft = { ausgangslage: 'Papierformulare bei der Aufnahme', zielsetzung: 'Aufnahme digital in 10 Minuten', strategischesZielId: ziel };
      for (const [k, nr, phase, hk] of [['p0', '2026-001', 'P0', herkunft], ['p2', '2026-002', 'P2', {}], ['andere', '2026-003', 'P1', {}]] as const) {
        projekt[k] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, herkunft) VALUES ($1, $2, $2, $3, $4, $5) RETURNING id',
          [T, nr, pf, phase, JSON.stringify(hk)])).rows[0]!.id;
      }
    });
    h.adm = await person('adm', [['org-admin', { type: 'org' }]]);
    h.ue = await person('ue', [['ue', { type: 'org' }]]);
    h.pl = await person('pl', [['pl', { type: 'projekt', id: projekt.p0 }], ['pl', { type: 'projekt', id: projekt.p2 }], ['kt', { type: 'projekt', id: projekt.andere }]]);
    h.kt = await person('kt', [['kt', { type: 'projekt', id: projekt.p0 }]]);
    h.ctl = await person('ctl', [['ctl', { type: 'projekt', id: projekt.p0 }]]);

    // Phasenmodell nach der Vorgabe, am Gate P0–P1 mit Pflichtangaben (die UE legt sie fest, K13, A-12)
    const m = await call('ue', 'POST', '/v1/phasenmodelle', {});
    assert.equal(m.statusCode, 201, m.body);
    const p = await call('ue', 'PATCH', `/v1/phasenmodelle/${m.json().id}`, {
      gates: [{
        code: 'P0_P1', pflichtangaben: [
          { kapitel: 1, feld: 'ausgangslage', text: 'Ausgangslage' },
          { kapitel: 2, feld: 'strategisches_ziel_id', text: 'Strategisches Ziel' },
          { kapitel: 9, feld: 'personal', text: 'Personalbedarf (mindestens als Grösse)' },
          { kapitel: 10, feld: 'risiken', text: 'Risiken' },
          { kapitel: 11, feld: 'gibtsnicht', text: 'Change Management' },
        ],
      }],
    }, { 'if-match': m.headers.etag as string });
    assert.equal(p.statusCode, 200, p.body);
    assert.equal((await call('adm', 'POST', `/v1/phasenmodelle/${m.json().id}/in-kraft-setzen`, undefined, { 'if-match': p.headers.etag as string })).statusCode, 200);
  });
  after(async () => { await api?.close(); });

  let entwurf = '';

  test('erster Entwurf: Version 0.1 mit Vorbelegung aus Idee und Phasenmodell; höchstens ein Entwurf (UX-E5)', async () => {
    const vorher = await call('pl', 'GET', `/v1/projekte/${projekt.p0}/vertrag`);
    assert.equal(vorher.statusCode, 200, vorher.body);
    assert.deepEqual(vorher.json(), { projektId: projekt.p0, versionen: [], entwurf: null, baseline: null, can: { entwerfen: ['initial'] } });
    assert.equal((await call('kt', 'POST', `/v1/projekte/${projekt.p0}/vertrag/entwuerfe`, { anlass: 'initial' })).statusCode, 403);
    assert.equal((await call('pl', 'POST', `/v1/projekte/${projekt.p0}/vertrag/entwuerfe`, { anlass: 'gate' })).statusCode, 409, 'Gate folgt mit AP-E3-3');

    const c = await call('pl', 'POST', `/v1/projekte/${projekt.p0}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(c.statusCode, 201, c.body);
    const d = c.json();
    entwurf = d.version.id;
    assert.deepEqual([d.version.nummer, d.version.anlass, d.version.zielphase, d.version.stand, d.version.baseline, d.version.can], ['0.1', 'initial', 'P1', 'in_arbeit', false, { write: true, einreichen: true, zurueckziehen: false }]);
    assert.equal(c.headers.location, `/v1/vertragsversionen/${entwurf}`);
    assert.deepEqual(d.kapitel.map((k: { kapitel: number }) => k.kapitel), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    assert.deepEqual(d.kapitel.slice(0, 3).map((k: { titel: string }) => k.titel), ['Ausgangslage / Problembeschreibung', 'Strategiebezug', 'Ziele und Nutzenbeitrag']);

    // Ausgangslage, Zielsetzung und Strategiebezug aus der Projektidee (UC-002 Schritt 1)
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/1`)).json().inhalt.ausgangslage, 'Papierformulare bei der Aufnahme');
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/2`)).json().inhalt.strategischesZielId, ziel);
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/3`)).json().inhalt.ziele, 'Aufnahme digital in 10 Minuten');
    // Lieferergebnisse und Meilensteine von P0 und P1 aus dem Phasenmodell (I-F2, UC-002 Schritt 6)
    const k7 = (await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/7`)).json().inhalt;
    assert.ok(k7.meilensteine.some((x: { phase: string; text: string }) => x.phase === 'P1' && x.text === 'Lösungskonzept'));
    assert.deepEqual([...new Set(k7.meilensteine.map((x: { phase: string }) => x.phase))], ['P0', 'P1']);

    // zweiter Entwurf: 409 mit Verweis auf den bestehenden
    const zwei = await call('pl', 'POST', `/v1/projekte/${projekt.p0}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(zwei.statusCode, 409, zwei.body);
    assert.equal(zwei.json().entwurf.id, entwurf);
    const liste = (await call('pl', 'GET', `/v1/projekte/${projekt.p0}/vertrag`)).json();
    assert.deepEqual([liste.entwurf, liste.can.entwerfen, liste.versionen.length], [entwurf, [], 1]);
    // Änderung ohne Begründung (UC-007 Schritt 2)
    assert.equal((await call('pl', 'POST', `/v1/projekte/${projekt.p0}/vertrag/entwuerfe`, { anlass: 'aenderung' })).statusCode, 422);
  });

  test('Kapitel: Schema, ETag (K2 Z7), Rechte, Beträge nur mit finanzen:read (A-33)', async () => {
    const url = `/v1/vertragsversionen/${entwurf}/kapitel/4`;
    const g = await call('pl', 'GET', url);
    assert.equal((await call('pl', 'PUT', url, { inhalt: { loesungsansatz: 'x', annahmen: '' } })).statusCode, 428);
    assert.equal((await call('pl', 'PUT', url, { inhalt: { loesungsansatz: 'x' } }, { 'if-match': g.headers.etag as string })).statusCode, 422, 'ganzer Inhalt');
    const falsch = await call('pl', 'PUT', url, { inhalt: { loesungsansatz: 'x', annahmen: '', farbe: 'rot' } }, { 'if-match': g.headers.etag as string });
    assert.equal(falsch.statusCode, 422);
    const ok = await call('pl', 'PUT', url, { inhalt: { loesungsansatz: 'Formular-App', annahmen: 'WLAN' } }, { 'if-match': g.headers.etag as string });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ok.json().version, 2);
    assert.equal((await call('pl', 'PUT', url, { inhalt: { loesungsansatz: 'alt', annahmen: '' } }, { 'if-match': g.headers.etag as string })).statusCode, 412);
    assert.equal((await call('kt', 'GET', url)).json().can.write, false);
    assert.equal((await call('kt', 'PUT', url, { inhalt: { loesungsansatz: 'x', annahmen: '' } }, { 'if-match': ok.headers.etag as string })).statusCode, 403);

    // Zielauswahl für Kap. 2: die Projektleitung sieht die Ziele auch ohne ziel:read an der Organisation; Kernteam nicht
    const auswahl = await call('pl', 'GET', `/v1/projekte/${projekt.p0}/vertrag/ziele`);
    assert.equal(auswahl.statusCode, 200, auswahl.body);
    assert.deepEqual(auswahl.json().ziele, [{ id: ziel, nummer: '2.1', text: 'Digitale Aufnahme', handlungsfeldId: handlungsfeld, handlungsfeld: 'Patientenpfade' }]);
    assert.equal((await call('kt', 'GET', `/v1/projekte/${projekt.p0}/vertrag/ziele`)).statusCode, 403);
    // Strategisches Ziel muss es geben, das Handlungsfeld folgt ihm
    const k2 = await speichern('pl', entwurf, 2, i => { i.strategischesZielId = '00000000-0000-4000-8000-000000000000'; });
    assert.equal(k2.statusCode, 422, k2.body);
    const k2ok = await speichern('pl', entwurf, 2, i => { i.strategischesZielId = ziel; });
    assert.equal(k2ok.statusCode, 200, k2ok.body);
    assert.equal(k2ok.json().inhalt.handlungsfeldId, handlungsfeld);
    assert.equal((await speichern('pl', entwurf, 2, i => { i.jahreszielId = ziel; })).statusCode, 422, 'kein Jahresziel');
    // Abhängigkeit nur zu sichtbaren Projekten
    assert.equal((await speichern('pl', entwurf, 6, i => { i.abhaengigkeiten = [{ registerId: null, zuProjektId: projekt.andere, text: 'Schnittstelle', ansprechperson: '' }]; })).statusCode, 200);
    assert.equal((await speichern('kt', entwurf, 6, () => {})).statusCode, 403);
    // Projektorganisation: nur Personen der Organisation, Sponsor höchstens einmal
    const k8 = await speichern('pl', entwurf, 8, i => { i.mitglieder = [{ personId: id.ctl, funktion: 'ctl', akv: '' }, { personId: id.kt, funktion: 'ctl', akv: '' }]; });
    assert.equal(k8.statusCode, 422, k8.body);

    // Kosten mit Beträgen: PL speichert, Kernteam sieht keine Beträge und bearbeitet Kapitel 9 nicht
    const k9 = await speichern('pl', entwurf, 9, i => {
      i.kosten = [{ registerId: null, phase: 'P1', art: 'capex', text: 'Lizenzen', lieferant: 'Acme AG', offerte: 'O-1', betrag: 120000.555 }];
      i.personal = [{ registerId: null, phase: 'P1', rolle: 'pl', groesse: 'M', fte: null, vonMonat: null, bisMonat: null, bemerkung: '' }];
    });
    assert.equal(k9.statusCode, 200, k9.body);
    assert.equal(k9.json().inhalt.kosten[0].betrag, 120000.56);
    const kt9 = await call('kt', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/9`);
    assert.equal(kt9.json().inhalt.kosten[0].betrag, null);
    assert.ok(!kt9.body.includes('120000'));
    assert.equal((await call('ctl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/9`)).json().inhalt.kosten[0].betrag, 120000.56);
    assert.equal((await speichern('kt', entwurf, 9, () => {})).statusCode, 403);
    // Grösse und FTE zugleich ist ungültig (A-20)
    assert.equal((await speichern('pl', entwurf, 9, i => { (i.personal as { fte: number }[])[0]!.fte = 0.5; })).statusCode, 422);
  });

  test('K2-4: fehlende Pflichtangaben mit Sprungziel; Einreichen gesperrt, dann möglich (UC-002 A3, Schritt 8)', async () => {
    // Ausgangslage leeren: drei Angaben fehlen (Ausgangslage, Risiken, Change Management), Ziel und Personal sind erfasst
    await speichern('pl', entwurf, 1, i => { i.ausgangslage = '  '; });
    const p = await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/pflichtangaben`);
    assert.equal(p.statusCode, 200, p.body);
    const fehlend = p.json().angaben.filter((a: { erfuellt: boolean }) => !a.erfuellt) as { kapitel: number; feld: string; quelle: { code: string } }[];
    assert.equal(p.json().vollstaendig, false);
    assert.deepEqual(fehlend.map(a => `${a.kapitel}.${a.feld}`), ['1.ausgangslage', '10.risiken', '11.gibtsnicht']);
    assert.ok(fehlend.every(a => a.quelle.code === 'P0_P1'));
    // Ein Klick: jedes Sprungziel ist ein Kapitel der Version mit diesem Feld (unbekanntes Feld: das Kapitel)
    const detail = (await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}`)).json();
    for (const a of fehlend) {
      const k = (await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/${a.kapitel}`)).json();
      assert.equal(k.kapitel, a.kapitel);
      assert.ok(a.feld in k.inhalt || a.feld === 'gibtsnicht', `${a.kapitel}.${a.feld}`);
      assert.ok(detail.kapitel.find((x: { kapitel: number }) => x.kapitel === a.kapitel).fehlend >= 1, 'Symbol «Angaben fehlen» am Kapitel');
    }
    // Einreichen gesperrt: je Angabe ein Fehler mit Pfad zur Stelle
    const e = await call('pl', 'POST', `/v1/vertragsversionen/${entwurf}/einreichen`, undefined, { 'if-match': `W/"${detail.version.version}"` });
    assert.equal(e.statusCode, 422, e.body);
    assert.deepEqual(e.json().errors.map((x: { path: string }) => x.path), ['/kapitel/1/ausgangslage', '/kapitel/10/risiken', '/kapitel/11/gibtsnicht']);

    await speichern('pl', entwurf, 1, i => { i.ausgangslage = 'Papierformulare'; });
    await speichern('pl', entwurf, 10, i => { i.risiken = [{ registerId: null, text: 'Lieferverzug', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Zweitlieferant', verantwortlich: 'PL' }]; });
    await speichern('pl', entwurf, 11, i => { i.stakeholder = [{ registerId: null, gruppe: 'Pflege', interesse: 'Entlastung', einfluss: 'hoch', massnahmen: 'Schulung' }]; });
    await speichern('pl', entwurf, 7, i => { (i.meilensteine as { termin: string | null }[])[0]!.termin = '2026-12-15'; });
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/pflichtangaben`)).json().vollstaendig, true);

    const v = (await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}`)).json().version;
    assert.equal((await call('kt', 'POST', `/v1/vertragsversionen/${entwurf}/einreichen`, undefined, { 'if-match': `W/"${v.version}"` })).statusCode, 403);
    const ok = await call('pl', 'POST', `/v1/vertragsversionen/${entwurf}/einreichen`, undefined, { 'if-match': `W/"${v.version}"` });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual([ok.json().version.stand, ok.json().version.can.write], ['in_pruefung', false]);
    assert.ok(ok.json().version.eingereichtAt);
    // Bis zum Ergebnis gesperrt
    assert.equal((await speichern('pl', entwurf, 4, () => {})).statusCode, 409);
    // Die UE erhält den Quality-Check (Sammelaufgabe über das Recht vertrag:review)
    const aufgaben = await full(api.t.runtime, T, async tx => (await tx.query<{ titel: string; empfaenger_recht: string; link: string }>(
      "SELECT titel, empfaenger_recht, link FROM ppm.aufgabe WHERE art = 'vertrag.quality_check' AND stand = 'offen' AND bezug_id = $1", [entwurf])).rows);
    assert.deepEqual(aufgaben, [{ titel: 'Quality-Check Projektvertrag 2026-001', empfaenger_recht: 'vertrag:review', link: '/projekte/2026-001/vertrag/pruefen' }]);
  });

  test('Gate P1–P2: nicht mit Grösse S/M/L, Kosten bis P4 (UC-003 A1, Vorgabe A-12)', async () => {
    // übernommenes Projekt in P2: der erste Vertrag gilt für die laufende Phase, Pflichtangaben des Gates P1–P2
    const c = await call('pl', 'POST', `/v1/projekte/${projekt.p2}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(c.statusCode, 201, c.body);
    const v = c.json().version.id;
    assert.equal(c.json().version.zielphase, 'P2');
    await speichern('pl', v, 9, i => {
      i.personal = [{ registerId: null, phase: 'P2', rolle: 'pl', groesse: 'L', fte: null, vonMonat: null, bisMonat: null, bemerkung: '' }];
      i.kosten = [{ registerId: null, phase: 'P2', art: 'capex', text: 'Umsetzung', lieferant: '', offerte: '', betrag: 2100000 }];
    });
    const fehlt = (await call('pl', 'GET', `/v1/vertragsversionen/${v}/pflichtangaben`)).json().angaben.filter((a: { erfuellt: boolean }) => !a.erfuellt);
    assert.deepEqual(fehlt.map((a: { feld: string; grund: string }) => [a.feld, a.grund]), [
      ['personal', '1 Zeile ist nur als Grösse S/M/L geplant; ab dem Gate P1–P2 braucht es FTE und Monate je Rolle und Phase.'],
      ['kosten', 'Kosten fehlen für P3, P4.'],
    ]);
    await speichern('pl', v, 9, i => {
      i.personal = [{ registerId: null, phase: 'P2', rolle: 'pl', groesse: null, fte: 0.8, vonMonat: '2027-01', bisMonat: '2027-12', bemerkung: '' }];
      i.kosten = (['P2', 'P3', 'P4'] as const).map(phase => ({ registerId: null, phase, art: 'opex', text: `Betrieb ${phase}`, lieferant: '', offerte: '', betrag: 1000 }));
    });
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${v}/pflichtangaben`)).json().vollstaendig, true);
  });

  test('Baseline: Version abgenommen und verbindlich, Listen im Register, IDs im Kapitel (Register-Übernahme)', async () => {
    // Auslöser ist der Gate-Entscheid (AP-E3-3); hier direkt in voller Sicht wie dort für die UE
    const r = await full(api.t.runtime, T, tx => vertrag.baselineSetzen(tx, systemActor('system'), entwurf));
    assert.deepEqual([r.stand, r.baseline], ['abgenommen', true]);
    const liste = (await call('pl', 'GET', `/v1/projekte/${projekt.p0}/vertrag`)).json();
    assert.deepEqual([liste.baseline, liste.entwurf], [entwurf, null]);

    const k9 = (await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/9`)).json().inhalt;
    const kosten = (await call('pl', 'GET', `/v1/projekte/${projekt.p0}/kosten`)).json().items;
    assert.deepEqual(kosten.map((k: Record<string, unknown>) => [k.id, k.text, k.budgetBaseline, k.prognose]), [[k9.kosten[0].registerId, 'Lizenzen', 120000.56, 120000.56]]);
    const bedarf = (await call('pl', 'GET', `/v1/projekte/${projekt.p0}/ressourcenbedarf`)).json().items;
    assert.deepEqual(bedarf.map((b: Record<string, unknown>) => [b.id, b.phase, b.groesse]), [[k9.personal[0].registerId, 'P1', 'M']]);
    const ms = (await call('pl', 'GET', `/v1/projekte/${projekt.p0}/meilensteine`)).json().items as { text: string; terminBaseline: string | null; art: string }[];
    assert.ok(ms.some(m => m.terminBaseline === '2026-12-15'));
    assert.equal(ms.filter(m => m.art !== 'kommunikation').length, (await call('pl', 'GET', `/v1/vertragsversionen/${entwurf}/kapitel/7`)).json().inhalt.meilensteine.length);
    assert.equal((await call('pl', 'GET', `/v1/projekte/${projekt.p0}/risiken`)).json().items[0].text, 'Lieferverzug');
    assert.equal((await call('pl', 'GET', `/v1/projekte/${projekt.p0}/stakeholder`)).json().items[0].gruppe, 'Pflege');
    // Abhängigkeit erscheint auch beim anderen Projekt (UC-002 Schritt 5)
    const ab = (await call('pl', 'GET', `/v1/projekte/${projekt.andere}/abhaengigkeiten`)).json().items;
    assert.deepEqual(ab.map((a: { richtung: string; text: string }) => [a.richtung, a.text]), [['eingehend', 'Schnittstelle']]);
    // Strategiebezug aus Kap. 2 im Arbeitsraum Ziele (PP.02.05)
    const zugeordnet = await full(api.t.runtime, T, async tx => (await tx.query<{ z: string }>('SELECT strategisches_ziel_id AS z FROM ppm.ziel_projekt WHERE projekt_id = $1', [projekt.p0])).rows);
    assert.deepEqual(zugeordnet, [{ z: ziel }]);
    // Ein zweites Mal geht nicht (nicht eingereicht)
    await assert.rejects(full(api.t.runtime, T, tx => vertrag.baselineSetzen(tx, systemActor('system'), entwurf)), /nicht zum Entscheid/);
  });
});
