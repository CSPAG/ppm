/**
 * Freigabe der Initialisierung (UC-001 Schritte 6–7, A4, A5; Kernablauf K4 Schritte 8–10; AP-E4-3). Abnahme: Das Projekt
 * entsteht mit den Angaben der Idee – im Gremium (Kategorie A: Traktandum der Art `idee`, Entscheid in der Sitzung) und
 * bei der Direktion (Kategorie C: Aufgabe `idee.freigeben`, Freigabe mit Sponsor und Projektleitung). Dazu: Sponsor und
 * Projektleitung Pflicht (A-05), Aufgabe «Projektvertrag erstellen» an die PL, Korrektur des Entscheids zieht das Projekt
 * zurück (A-30), Zurückweisen durch die Direktion.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { grant, login, person, testApi, type TestApi } from './api.ts';
import { full, skipDb } from './harness.ts';
import { heute } from '../../src/modules/sitzung/format.ts';

const skip = await skipDb();

type H = Record<string, string>;

function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('Freigabe der Initialisierung', { skip }, () => {
  let api: TestApi;
  let tenantId = '';
  let as1: H, ue: H, adm: H, direktion: H, fremdeDirektion: H;
  let as1Id = '', sp = '', pl = '';
  let feld = '', bereich = '', direktionPflege = '', portfolioA = '', portfolioC = '', portfolioC2 = '';
  const termin = mittwochIn(28);

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ok = async (method: string, url: string, headers: H, payload?: unknown, status = 200) => {
    const r = await call(method, url, headers, payload);
    assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
    return r;
  };
  const mit = (h: H, etag: string): H => ({ ...h, 'if-match': etag });
  const sys = <T>(fn: Parameters<typeof full<T>>[2]) => full(api.t.runtime, tenantId, fn);
  const aufgaben = (art: string, bezugId: string) => sys(async tx => (await tx.query<{ empfaenger_person: string | null; empfaenger_recht: string | null; stand: string; titel: string; link: string }>(
    'SELECT empfaenger_person, empfaenger_recht, stand, titel, link FROM ppm.aufgabe WHERE art = $1 AND bezug_id = $2 ORDER BY created_at', [art, bezugId])).rows);
  const mitteilungen = (an: string) => sys(async tx => (await tx.query<{ text: string }>('SELECT text FROM ppm.mitteilung WHERE empfaenger_person = $1 ORDER BY created_at', [an])).rows.map(r => r.text));

  /** Idee einreichen und der Kategorie zuordnen; liefert ID, Nummer und ETag. */
  async function zugeordnet(titel: string, kategorie: 'A' | 'C', portfolioId: string) {
    const c = await ok('POST', '/v1/ideen', as1, {
      titel, ausgangslage: `${titel}: heute auf Papier`, zielsetzung: `${titel}: digital`, handlungsfeldId: feld,
      bereiche: [bereich], nutzen: 'hoch', nutzenText: 'weniger Doppelerfassung', aufwand: 'mittel', relevanz: 'hoch',
    }, 201);
    const id = c.json().id as string;
    const e = await ok('POST', `/v1/ideen/${id}/einreichen`, mit(as1, 'W/"1"'));
    const k = await ok('POST', `/v1/ideen/${id}/kategorie`, mit(ue, e.headers.etag as string), { kategorie, portfolioId });
    return { id, nummer: c.json().nummer as number, etag: k.headers.etag as string };
  }

  before(async () => {
    api = await testApi();
    const a = await login(api, 'demo', 'u-as1', 'antragsteller');
    tenantId = a.tenantId; as1Id = a.principalId; as1 = { authorization: a.authorization };
    ue = { authorization: (await login(api, 'demo', 'u-ue', 'ue')).authorization };
    adm = { authorization: (await login(api, 'demo', 'u-adm', 'org-admin')).authorization };
    [sp, pl] = [await person(api, tenantId, 'u-sp'), await person(api, tenantId, 'u-pl')];
    feld = (await ok('POST', '/v1/handlungsfelder', adm, { label: 'Patientenorientierung' }, 201)).json().id;
    bereich = (await ok('POST', '/v1/org-einheiten', adm, { kuerzel: 'DMS', name: 'Medizinische Dienste', art: 'direktion' }, 201)).json().id;
    direktionPflege = (await ok('POST', '/v1/org-einheiten', adm, { kuerzel: 'DPF', name: 'Pflege', art: 'direktion' }, 201)).json().id;
    const pm = await ok('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' }, 201);
    await ok('POST', `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, mit(adm, pm.headers.etag as string));
    portfolioA = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'A', schluessel: 'transformation', name: 'Transformation' }, 201)).json().id;
    const prat = (await ok('POST', '/v1/gremien', ue, { portfolioId: portfolioA, kuerzel: 'prat', name: 'Programmausschuss', art: 'entscheidend' }, 201)).json().id;
    await ok('POST', `/v1/gremien/${prat}/termine`, ue, { datum: termin }, 201);
    portfolioC = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'C', schluessel: 'dpf', name: 'Direktion Pflege', orgEinheitId: direktionPflege }, 201)).json().id;
    portfolioC2 = (await ok('POST', '/v1/portfolios', ue, { kategorie: 'C', schluessel: 'dms', name: 'Direktion Medizin', orgEinheitId: bereich }, 201)).json().id;
    const d = await login(api, 'demo', 'u-direktion', null);
    await grant(api, tenantId, `user:${d.principalId}`, 'direktion', { type: 'portfolio', id: portfolioC });
    direktion = { authorization: d.authorization };
    const d2 = await login(api, 'demo', 'u-direktion2', null);
    await grant(api, tenantId, `user:${d2.principalId}`, 'direktion', { type: 'portfolio', id: portfolioC2 });
    fremdeDirektion = { authorization: d2.authorization };
  });
  after(async () => { await api?.close(); });

  test('Kategorie A: dem Gremium vorlegen, Entscheid in der Sitzung legt das Projekt in P0 mit den Angaben der Idee an', async () => {
    const i = await zugeordnet('Digitale Patientenaufnahme', 'A', portfolioA);
    let f = await ok('GET', `/v1/ideen/${i.id}/freigabe`, ue);
    assert.deepEqual([f.json().weg, f.json().zustaendig, f.json().can], ['gremium', 'PRAT Programmausschuss', { traktandieren: true, angaben: true, entscheiden: false }]);
    assert.equal((await call('POST', `/v1/ideen/${i.id}/traktandieren`, mit(as1, i.etag))).statusCode, 403);
    f = await ok('POST', `/v1/ideen/${i.id}/traktandieren`, mit(ue, i.etag));
    assert.equal((await ok('GET', `/v1/ideen/${i.id}`, as1)).json().stand, 'traktandiert');
    assert.ok((await mitteilungen(as1Id)).some(t => t.includes('dem PRAT zum Entscheid vorgelegt')));
    assert.equal((await aufgaben('idee.pruefen', i.id)).every(x => x.stand !== 'offen'), true, '«Projektidee prüfen» erledigt');
    assert.equal((await call('POST', `/v1/ideen/${i.id}/traktandieren`, mit(ue, f.headers.etag as string))).statusCode, 409, 'schon vorgelegt');

    // Sitzung: Vorschlag aufnehmen, versenden, starten
    const t = await sys(async tx => (await tx.query<{ id: string; titel: string; antrag: string }>("SELECT id, titel, antrag FROM ppm.traktandum WHERE art = 'idee' AND bezug_id = $1", [i.id])).rows);
    assert.deepEqual(t.map(x => [x.titel, x.antrag]), [['Initialisierung: Digitale Patientenaufnahme', 'Initialisierung freigeben (Kategorie A), Sponsor und Projektleitung benennen']]);
    const s = (await ok('POST', '/v1/gremien/prat/sitzungen', ue, { datum: termin }, 201)).json();
    let v = (await ok('POST', `/v1/sitzungen/${s.id}/traktanden`, ue, { vorschlagId: t[0]!.id })).json();
    v = (await ok('POST', `/v1/sitzungen/${s.id}/versenden`, mit(ue, `W/"${v.version}"`))).json();
    await ok('POST', `/v1/sitzungen/${s.id}/starten`, mit(ue, `W/"${v.version}"`));

    // Ohne Sponsor und Projektleitung scheitert die Freigabe (A-05)
    const ohne = await call('PUT', `/v1/traktanden/${t[0]!.id}/entscheid`, ue, { ergebnis: 'freigegeben', begruendung: 'Nutzen überzeugt' });
    assert.equal(ohne.statusCode, 422, ohne.body);
    f = await ok('GET', `/v1/ideen/${i.id}/freigabe`, ue);
    assert.equal((await call('PUT', `/v1/ideen/${i.id}/freigabe/angaben`, mit(ue, f.headers.etag as string), { sponsor: '00000000-0000-4000-8000-000000000009', projektleitung: pl })).statusCode, 422);
    f = await ok('PUT', `/v1/ideen/${i.id}/freigabe/angaben`, mit(ue, f.headers.etag as string), { sponsor: sp, projektleitung: pl });
    assert.deepEqual([f.json().sponsor, f.json().projektleitung], [sp, pl]);

    await ok('PUT', `/v1/traktanden/${t[0]!.id}/entscheid`, ue, { ergebnis: 'freigegeben', begruendung: 'Nutzen überzeugt' });
    f = await ok('GET', `/v1/ideen/${i.id}/freigabe`, ue);
    const projekt = f.json().projekt as { id: string; nummer: string; name: string };
    assert.ok(projekt, 'Projekt entstanden');
    assert.equal((await ok('GET', `/v1/ideen/${i.id}`, as1)).json().stand, 'freigegeben');

    // Abnahme: Projekt in P0 mit den Angaben der Idee
    const p = (await ok('GET', `/v1/projekte/${projekt.id}`, ue)).json();
    assert.deepEqual([p.name, p.phase, p.portfolioId, p.handlungsfeldId, p.lebenszyklus, p.sponsor, p.projektleitung],
      ['Digitale Patientenaufnahme', 'P0', portfolioA, feld, 'aktiv', sp, pl]);
    const herkunft = await sys(async tx => (await tx.query<{ h: Record<string, unknown> }>('SELECT herkunft AS h FROM ppm.projekt WHERE id = $1', [projekt.id])).rows[0]!.h);
    assert.deepEqual([herkunft.quelle, herkunft.ideeId, herkunft.ausgangslage, herkunft.zielsetzung, herkunft.handlungsfeldId, herkunft.nutzen, herkunft.kategorie],
      ['idee', i.id, 'Digitale Patientenaufnahme: heute auf Papier', 'Digitale Patientenaufnahme: digital', feld, 'weniger Doppelerfassung', 'A']);
    const vertrag = await aufgaben('vertrag.erstellen', projekt.id);
    assert.deepEqual(vertrag.map(x => [x.empfaenger_person, x.stand, x.link]), [[pl, 'offen', `/projekte/${projekt.nummer}/vertrag`]]);
    assert.ok((await mitteilungen(as1Id)).some(x => x.includes(`Das Projekt ${projekt.nummer} entsteht in Phase P0`)));
    assert.ok((await mitteilungen(sp)).some(x => x.includes('Du bist Sponsor')));

    // je Idee ein Projekt
    const anzahl = async () => sys(async tx => (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM ppm.projekt WHERE herkunft->>'ideeId' = $1", [i.id])).rows[0]!.n);
    assert.equal(await anzahl(), 1);

    // Korrektur auf «abgelehnt» (A-30): Projekt zurückgezogen, Aufgabe entfällt, Idee zurückgewiesen
    const ent = await sys(async tx => (await tx.query<{ version: number }>('SELECT version FROM ppm.entscheid WHERE traktandum_id = $1', [t[0]!.id])).rows[0]!);
    await ok('PUT', `/v1/traktanden/${t[0]!.id}/entscheid`, mit(ue, `W/"${ent.version}"`), { ergebnis: 'abgelehnt', begruendung: 'Budget fehlt' });
    assert.equal((await ok('GET', `/v1/projekte/${projekt.id}`, ue)).json().lebenszyklus, 'zurueckgezogen');
    assert.equal((await aufgaben('vertrag.erstellen', projekt.id))[0]!.stand, 'entfallen');
    f = await ok('GET', `/v1/ideen/${i.id}/freigabe`, ue);
    assert.equal(f.json().projekt, null);
    assert.equal((await ok('GET', `/v1/ideen/${i.id}`, as1)).json().stand, 'zurueckgewiesen');
    assert.equal(await anzahl(), 1);
  });

  test('Kategorie C: der Direktion übergeben, Freigabe im Eingang legt das Projekt im Portfolio der Direktion an', async () => {
    const i = await zugeordnet('Pflegedokumentation mobil', 'C', portfolioC);
    let f = await ok('GET', `/v1/ideen/${i.id}/freigabe`, ue);
    assert.deepEqual([f.json().weg, f.json().zustaendig, f.json().can.angaben], ['direktion', 'Direktion Pflege', false]);
    assert.equal((await call('PUT', `/v1/ideen/${i.id}/freigabe/angaben`, mit(ue, i.etag), { sponsor: sp, projektleitung: pl })).statusCode, 409);
    f = await ok('POST', `/v1/ideen/${i.id}/traktandieren`, mit(ue, i.etag));
    const auf = await aufgaben('idee.freigeben', i.id);
    assert.deepEqual(auf.map(x => [x.empfaenger_recht, x.stand, x.link]), [['idee:decide', 'offen', `/portfolio/ideen/${i.nummer}`]]);
    assert.ok((await mitteilungen(as1Id)).some(t => t.includes('der Direktion (Direktion Pflege) zum Entscheid vorgelegt')));

    // Direktion sieht die Idee und darf entscheiden; die UE und eine fremde Direktion nicht
    const d = await ok('GET', `/v1/ideen/${i.id}/freigabe`, direktion);
    assert.equal(d.json().can.entscheiden, true);
    const etag = d.headers.etag as string;
    assert.equal((await call('POST', `/v1/ideen/${i.id}/freigeben`, mit(ue, etag), { sponsor: sp, projektleitung: pl })).statusCode, 403);
    assert.equal((await call('POST', `/v1/ideen/${i.id}/freigeben`, mit(fremdeDirektion, etag), { sponsor: sp, projektleitung: pl })).statusCode, 404);
    assert.equal((await call('POST', `/v1/ideen/${i.id}/freigeben`, mit(direktion, 'W/"1"'), { sponsor: sp, projektleitung: pl })).statusCode, 412);
    assert.equal((await call('POST', `/v1/ideen/${i.id}/freigeben`, mit(direktion, etag), { sponsor: sp, projektleitung: '00000000-0000-4000-8000-000000000009' })).statusCode, 422);

    f = await ok('POST', `/v1/ideen/${i.id}/freigeben`, mit(direktion, etag), { sponsor: sp, projektleitung: pl, begruendung: 'Direktion trägt' });
    const projekt = f.json().projekt as { id: string; nummer: string };
    assert.ok(projekt);
    const p = (await ok('GET', `/v1/projekte/${projekt.id}`, direktion)).json();
    assert.deepEqual([p.name, p.phase, p.portfolioId, p.orgEinheitId, p.sponsor, p.projektleitung], ['Pflegedokumentation mobil', 'P0', portfolioC, direktionPflege, sp, pl]);
    assert.equal((await aufgaben('idee.freigeben', i.id))[0]!.stand, 'erledigt');
    assert.deepEqual((await aufgaben('vertrag.erstellen', projekt.id)).map(x => x.empfaenger_person), [pl]);
    assert.equal((await call('POST', `/v1/ideen/${i.id}/freigeben`, mit(direktion, f.headers.etag as string), { sponsor: sp, projektleitung: pl })).statusCode, 409);
  });

  test('Kategorie C: die Direktion weist mit Begründung zurück (UC-001 A4.2)', async () => {
    const i = await zugeordnet('Neue Pflegebetten', 'C', portfolioC);
    const f = await ok('POST', `/v1/ideen/${i.id}/traktandieren`, mit(ue, i.etag));
    const etag = f.headers.etag as string;
    assert.equal((await call('POST', `/v1/ideen/${i.id}/ablehnen`, mit(direktion, etag), { begruendung: '  ' })).statusCode, 422);
    await ok('POST', `/v1/ideen/${i.id}/ablehnen`, mit(direktion, etag), { begruendung: 'Kein Budget in diesem Jahr' });
    const r = (await ok('GET', `/v1/ideen/${i.id}`, as1)).json();
    assert.deepEqual([r.stand, r.begruendung], ['zurueckgewiesen', 'Kein Budget in diesem Jahr']);
    assert.equal((await aufgaben('idee.freigeben', i.id))[0]!.stand, 'erledigt');
    assert.ok((await mitteilungen(as1Id)).some(t => t.includes('«Neue Pflegebetten» wird nicht weiterverfolgt')));
  });

  test('Ohne Kategorie lässt sich nichts vorlegen; Antragstellende sehen den Stand, aber keine Handlungen', async () => {
    const c = await ok('POST', '/v1/ideen', as1, { titel: 'Ohne Kategorie', ausgangslage: 'a', zielsetzung: 'b', handlungsfeldId: feld, bereiche: [bereich], nutzen: 'hoch', aufwand: 'mittel', relevanz: 'hoch' }, 201);
    const e = await ok('POST', `/v1/ideen/${c.json().id}/einreichen`, mit(as1, 'W/"1"'));
    assert.equal((await call('POST', `/v1/ideen/${c.json().id}/traktandieren`, mit(ue, e.headers.etag as string))).statusCode, 409);
    const f = await ok('GET', `/v1/ideen/${c.json().id}/freigabe`, as1);
    assert.deepEqual([f.json().weg, f.json().can], [null, { traktandieren: false, angaben: false, entscheiden: false }]);
  });
});
