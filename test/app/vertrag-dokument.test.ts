/**
 * Dokumentausgabe des Projektvertrags (AP-E3-5; DM.02.07, AM.03.01 Grundfunktion; UC-002 Schritt 12; K2 Schritt 11):
 * PDF und Word im Layout der Vorlage mit Versionsnummer, Stand und Freigabe; Kopfzeile «Intern · enthält
 * Personendaten» (Abnahme G12); Beträge nur mit `finanzen:read` (A-33); Rechte; Export im Audit; Vorlagen-Liste;
 * Toleranzen in Kap. 7.2 (A-10, K11) mit dem Standard des Phasenmodells, auch als Platzhalter eigener Word-Vorlagen.
 */
import assert from 'node:assert/strict';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { after, before, describe, test } from 'node:test';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';
import { wordVorlage } from './fixtures/word.ts';

const skip = await skipDb();

type H = Record<string, string>;

/** Text aller Seiten eines PDF (Inhaltsströme entpackt, WinAnsi-Oktale aufgelöst). */
function pdfText(b: Buffer): string {
  const s = b.toString('latin1');
  const out: string[] = [];
  for (const m of s.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const roh = inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1');
    for (const t of roh.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)) {
      out.push(t[1]!.replace(/\\([0-7]{3})/g, (_, o: string) => Buffer.from([parseInt(o, 8)]).toString('latin1')).replace(/\\(.)/g, '$1'));
    }
  }
  // WinAnsi 0x96 (–) und 0x80 (€) lesbar machen
  return out.join('\n').replace(/\x96/g, '–').replace(/\x80/g, '€');
}

/** Dateien eines ZIP (nur «deflate», wie `zip.ts` schreibt). */
function unzip(b: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  let p = 0;
  while (b.readUInt32LE(p) === 0x04034b50) {
    const groesse = b.readUInt32LE(p + 18), nameLen = b.readUInt16LE(p + 26), extra = b.readUInt16LE(p + 28);
    const name = b.subarray(p + 30, p + 30 + nameLen).toString('utf8');
    const start = p + 30 + nameLen + extra;
    out.set(name, inflateRawSync(b.subarray(start, start + groesse)).toString('utf8'));
    p = start + groesse;
  }
  return out;
}

describe('Dokumentausgabe Projektvertrag', { skip }, () => {
  let api: TestApi;
  let T: string;
  let projekt = '', version = '';
  const h: Record<string, H> = {};
  const id: Record<string, string> = {};

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  async function speichern(nr: number, aendern: (i: Record<string, unknown>) => void) {
    const g = await call('pl', 'GET', `/v1/vertragsversionen/${version}/kapitel/${nr}`);
    const inhalt = g.json().inhalt;
    aendern(inhalt);
    const r = await call('pl', 'PUT', `/v1/vertragsversionen/${version}/kapitel/${nr}`, { inhalt }, { 'if-match': g.headers.etag as string });
    assert.equal(r.statusCode, 200, r.body);
  }

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'B', 'dok', 'Dok', true) RETURNING id", [T])).rows[0]!.id;
      projekt = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-014', 'Neues KIS (Zürich)', $2) RETURNING id", [T, pf])).rows[0]!.id;
    });
    for (const [sub, rolle, ort] of [['pl', 'pl', { type: 'projekt', id: projekt }], ['kt', 'kt', { type: 'projekt', id: projekt }], ['ue', 'ue', { type: 'org' }], ['fremd', 'antragsteller', { type: 'org' }]] as const) {
      const l = await login(api, 'acme', `dok-${sub}`, null);
      id[sub] = l.principalId;
      await grant(api, T, `user:${l.principalId}`, rolle, ort as { type: 'org' });
      h[sub] = { authorization: l.authorization };
    }
    const c = await call('pl', 'POST', `/v1/projekte/${projekt}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(c.statusCode, 201, c.body);
    version = c.json().version.id;
    await speichern(1, i => { i.ausgangslage = 'Papierformulare bei der Aufnahme – «heute» € 0,–\nzweite Zeile'; });
    await speichern(8, i => { i.mitglieder = [{ personId: id.pl, funktion: 'pl', akv: 'führt das Projekt' }]; });
    await speichern(9, i => { i.kosten = [{ registerId: null, phase: 'P1', art: 'capex', text: 'Lizenzen', lieferant: 'Muster AG', offerte: 'O-1', betrag: 12345.5 }]; });
    // Toleranz Termin im Vertrag; Kosten aus dem Phasenmodell in Kraft (10 %), Umfang ohne Standard (A-10)
    await speichern(7, i => { i.toleranzen = [{ dimension: 'termin', wert: 14, einheit: 'kalendertage' }]; });
    const adm = { authorization: (await login(api, 'acme', 'dok-adm', 'org-admin')).authorization };
    const pm = await call('ue', 'POST', '/v1/phasenmodelle', { quelle: 'vorgabe' });
    assert.equal(pm.statusCode, 201, pm.body);
    const t = await call('ue', 'PATCH', `/v1/phasenmodelle/${pm.json().id}`, { toleranzen: [{ dimension: 'kosten', wert: 10, einheit: 'prozent' }] }, { 'if-match': pm.headers.etag as string });
    assert.equal(t.statusCode, 200, t.body);
    const k = await api.app.inject({ method: 'POST', url: `/v1/phasenmodelle/${pm.json().id}/in-kraft-setzen`, headers: { ...adm, 'if-match': t.headers.etag as string } });
    assert.equal(k.statusCode, 200, k.body);
  });
  after(async () => { await api?.close(); });

  test('PDF: Kopfzeile G12, Deckblatt mit Version und Stand, Kapitel, Beträge mit Recht (DM.02.07)', async () => {
    const r = await call('pl', 'GET', `/v1/vertragsversionen/${version}/dokument`);
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.headers['content-type'], 'application/pdf');
    assert.equal(r.headers['content-disposition'], 'attachment; filename="Projektvertrag-2026-014-v0.1.pdf"');
    assert.equal(r.headers['cache-control'], 'private, no-store');
    assert.ok(r.rawPayload.subarray(0, 8).toString('latin1').startsWith('%PDF-1.4'));
    const text = pdfText(r.rawPayload);
    assert.match(text, /Intern · enthält Personendaten/, 'Abnahme G12');
    assert.match(text, /Neues KIS \(Zürich\)/);
    assert.match(text, /Version\n0\.1/);
    assert.match(text, /Status\nin Arbeit/);
    assert.match(text, /Freigabe\nnicht freigegeben/);
    assert.match(text, /B: Projekt der Geschäftsleitung/);
    assert.match(text, /Papierformulare bei der Aufnahme – «heute» € 0,–\nzweite Zeile/);
    assert.match(text, /13 Beilagen/);
    assert.match(text, /CHF 12.345\.50/);
    assert.match(text, /Seite 1 von \d+/);
    assert.match(text, /Vorlage Projektvertrag, Fassung 1/);
    // Kap. 7.2: Toleranz des Vertrags, sonst Standard des Phasenmodells (A-10, K11)
    assert.match(text, /Toleranz Termin\n14 Kalendertage/);
    assert.match(text, /Toleranz Kosten\nStandard des Phasenmodells: 10 %/);
    assert.match(text, /Toleranz Umfang\nStandard des Phasenmodells: keiner/);
  });

  test('Word: gültiges Paket mit Kopfzeile, Überschriften und Seitenzahl', async () => {
    const r = await call('pl', 'GET', `/v1/vertragsversionen/${version}/dokument?format=docx`);
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.headers['content-type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.match(r.headers['content-disposition'] as string, /Projektvertrag-2026-014-v0\.1\.docx/);
    const z = unzip(r.rawPayload);
    assert.deepEqual([...z.keys()].sort(), ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/footer1.xml', 'word/header1.xml', 'word/styles.xml']);
    assert.match(z.get('word/header1.xml')!, /Intern · enthält Personendaten/);
    assert.match(z.get('word/footer1.xml')!, /NUMPAGES/);
    const doc = z.get('word/document.xml')!;
    assert.match(doc, /<w:pStyle w:val="Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">9 Ressourcen<\/w:t>/);
    assert.match(doc, /«heute» € 0,–<\/w:t><\/w:r><w:r><w:br\/><w:t xml:space="preserve">zweite Zeile/);
    assert.match(doc, /Neues KIS \(Zürich\)/);
    assert.match(doc, /Toleranz Kosten<\/w:t>.*?Standard des Phasenmodells: 10 %/s);
  });

  test('ohne Recht auf Beträge «nicht verfügbar» (A-33, G12); ohne Leserecht 404/403; Format geprüft', async () => {
    const kt = pdfText((await call('kt', 'GET', `/v1/vertragsversionen/${version}/dokument`)).rawPayload);
    assert.match(kt, /nicht verfügbar/);
    assert.doesNotMatch(kt, /12.345/);
    assert.equal((await call('fremd', 'GET', `/v1/vertragsversionen/${version}/dokument`)).statusCode, 404, 'Projekt nicht sichtbar');
    assert.equal((await call('pl', 'GET', `/v1/vertragsversionen/${version}/dokument?format=odt`)).statusCode, 422);
  });

  test('Export im Audit (I-Z3)', async () => {
    const rows = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string; data: { format: string } }>(
      "SELECT action, data FROM ppm.audit_log WHERE resource_id = $1 AND action = 'vertrag.exported' ORDER BY id", [version])).rows);
    assert.ok(rows.length >= 3);
    assert.deepEqual(rows.map(r => r.data.format).slice(0, 2), ['pdf', 'docx']);
  });

  test('Vorlagen: Grundbestand Projektvertrag mit Fassung (AM.03.01)', async () => {
    const r = await call('ue', 'GET', '/v1/vorlagen');
    assert.equal(r.statusCode, 200, r.body);
    const v = r.json().items.find((x: { art: string }) => x.art === 'projektvertrag');
    assert.deepEqual([v.grundbestand.version, v.grundbestand.quelle, v.aktiv], ['1', 'PM-Handbuch, Vorlage Projektvertrag (Q7)', null]);
    assert.equal((await call('pl', 'GET', '/v1/vorlagen')).statusCode, 403);
  });
  test('eigene Word-Vorlage: Platzhalter der Toleranzen aus Kap. 7.2 (AM.03.01, UC-018 Schritt 2)', async () => {
    const katalog = (await call('ue', 'GET', '/v1/vorlagen/projektvertrag')).json().felder.map((f: { schluessel: string }) => f.schluessel);
    assert.ok(['kap7.toleranzTermin', 'kap7.toleranzKosten', 'kap7.toleranzUmfang'].every(k => katalog.includes(k)));
    const datei = wordVorlage([['Termin: «Toleranz Termin»'], ['Kosten: «Toleranz Kosten»'], ['Umfang: «Toleranz Umfang»']], 'Intern · enthält Personendaten');
    const v = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen', { dateiname: 'Toleranzen.docx', inhalt: datei.toString('base64') });
    assert.equal(v.statusCode, 201, v.body);
    assert.deepEqual([v.json().zuordnung, v.json().pruefung.aktivierbar], [{ 'Toleranz Termin': 'kap7.toleranzTermin', 'Toleranz Kosten': 'kap7.toleranzKosten', 'Toleranz Umfang': 'kap7.toleranzUmfang' }, true]);
    const a = await call('ue', 'POST', `/v1/vorlagen/projektvertrag/versionen/${v.json().version}/aktivieren`, undefined, { 'if-match': v.headers.etag as string });
    assert.equal(a.statusCode, 200, a.body);
    const doc = unzip((await call('pl', 'GET', `/v1/vertragsversionen/${version}/dokument?format=docx`)).rawPayload).get('word/document.xml')!;
    assert.match(doc, /Termin: 14 Kalendertage/);
    assert.match(doc, /Kosten: Standard des Phasenmodells: 10 %/);
    assert.match(doc, /Umfang: Standard des Phasenmodells: keiner/);
  });
});
