/**
 * Testdaten über die API für Specs, die einen Projektvertrag mit Baseline oder ein Projekt in P4 brauchen (AP-E3-4,
 * AP-E7-1, Statusbericht «Änderung beantragen»). Alles in der Organisation «muster» (Max, org-admin), damit Specs der
 * Organisation «demo» ohne Phasenmodell in Kraft bleiben (unterzeichnen.spec.ts); jedes Projekt mit eigenem Portfolio
 * und Gremium. Angelegt wird nur über die öffentlichen Routen, wie die Oberfläche (keine Daten an der RLS vorbei).
 */
import { expect, type APIResponse, type Page } from '@playwright/test';

export interface Api {
  me: { csrfToken: string; tenant: { alias: string }; person: { email: string | null } };
  fetch(method: 'POST' | 'PUT' | 'PATCH', url: string, data?: unknown, extra?: Record<string, string>): Promise<APIResponse>;
  send<T>(method: 'POST' | 'PUT' | 'PATCH', url: string, data?: unknown, extra?: Record<string, string>): Promise<{ body: T; etag: string }>;
  get(url: string): Promise<APIResponse>;
}

/** Schreibende Aufrufe der API mit CSRF-Token und Organisation der Sitzung (wie die Oberfläche). */
export async function apiAls(page: Page): Promise<Api> {
  const me = await (await page.request.get('/auth/me')).json() as Api['me'];
  const headers = { 'x-csrf-token': me.csrfToken, 'x-tenant': me.tenant.alias };
  const fetch: Api['fetch'] = (method, url, data, extra = {}) => page.request.fetch(url, data === undefined
    // ohne Body auch kein Content-Type (sonst 400 «Body cannot be empty»)
    ? { method, headers: { ...headers, ...extra } }
    : { method, headers: { ...headers, 'content-type': 'application/json', ...extra }, data: JSON.stringify(data) });
  return {
    me,
    fetch,
    async send<T>(method: 'POST' | 'PUT' | 'PATCH', url: string, data?: unknown, extra: Record<string, string> = {}) {
      const r = await fetch(method, url, data, extra);
      expect(r.status(), `${method} ${url}: ${await r.text()}`).toBeLessThan(300);
      return { body: await r.json() as T, etag: r.headers()['etag'] ?? '' };
    },
    get: url => page.request.get(url, { headers: { 'x-tenant': me.tenant.alias } }),
  };
}

const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
/** Datum n Kalendertage nach heute. */
export const inTagen = (n: number) => new Date(Date.parse(`${heute()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Datum n Kalendertage nach heute, auf den nächsten Mittwoch gelegt (Sitzungstag). */
export function mittwochIn(n: number): string {
  const d = new Date(Date.parse(`${inTagen(n)}T00:00:00Z`));
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const kennung = () => `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Toleranzen, ab denen der Statusbericht «wesentlich» warnt (A-10; die Vorgabe hat keine Werte). */
const TOLERANZEN = [
  { dimension: 'termin', wert: 14, einheit: 'kalendertage' },
  { dimension: 'kosten', wert: 10, einheit: 'prozent' },
  { dimension: 'umfang', wert: 10, einheit: 'prozent' },
];

/**
 * Phasenmodell nach der Vorgabe mit Toleranzen in Kraft, sofern das aktuelle keine Termin-Toleranz hat. Laufen Specs
 * parallel, kann ein anderer Lauf gerade einen Entwurf haben (409): dann erneut lesen.
 */
export async function phasenmodellMitToleranzen(a: Api): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const r = await a.get('/v1/phasenmodelle/aktuell');
    if (r.status() === 200) {
      const m = await r.json() as { toleranzen: { dimension: string; wert: number | null }[] };
      if (m.toleranzen.some(t => t.dimension === 'termin' && t.wert !== null)) return;
    }
    const c = await a.fetch('POST', '/v1/phasenmodelle', { quelle: 'vorgabe' });
    if (c.status() === 201) {
      const { id } = await c.json() as { id: string };
      const p = await a.send('PATCH', `/v1/phasenmodelle/${id}`, { toleranzen: TOLERANZEN }, { 'if-match': c.headers()['etag'] ?? '' });
      const k = await a.fetch('POST', `/v1/phasenmodelle/${id}/in-kraft-setzen`, undefined, { 'if-match': p.etag });
      if (k.status() < 300) return;
    }
    await new Promise(res => setTimeout(res, 500));
  }
  throw new Error('Phasenmodell mit Toleranzen nicht in Kraft gesetzt');
}

export interface Projekt { id: string; nummer: string; name: string; portfolioId: string }
export interface Gremium { id: string; kuerzel: string }

/** Projekt in eigenem Portfolio, die angemeldete Person in den angegebenen Funktionen. */
export async function projekt(a: Api, name: string, phase: string, funktionen: readonly string[] = ['sp', 'pl', 'ctl']): Promise<Projekt> {
  const schluessel = kennung();
  const pf = await a.send<{ id: string }>('POST', '/v1/portfolios', { kategorie: 'A', schluessel, name: `E2E ${schluessel}` });
  const pj = await a.send<{ id: string; nummer: string }>('POST', '/v1/projekte', { name, portfolioId: pf.body.id, phase });
  const vorname = a.me.person.email?.split('@')[0] ?? '';
  const people = await (await a.get(`/v1/people?q=${encodeURIComponent(vorname)}`)).json() as { items: { id: string; email: string | null }[] };
  const ich = people.items.find(p => p.email === a.me.person.email) ?? people.items[0]!;
  await a.send('PUT', `/v1/projekte/${pj.body.id}/organisation`, {
    mitglieder: funktionen.map(funktion => ({ personId: ich.id, funktion, akv: '' })),
  }, { 'if-match': 'W/"0"' });
  return { id: pj.body.id, nummer: pj.body.nummer, name, portfolioId: pf.body.id };
}

/**
 * Entscheidendes Gremium des Portfolios (Traktandenvorschläge der Module gehen dorthin, A-45) mit Terminen; mit `gates`
 * zusätzlich der Gremienweg für diese Gates.
 */
export async function gremium(a: Api, portfolioId: string, termine: string[], gates: string[] = []): Promise<Gremium> {
  const kuerzel = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const g = await a.send<{ id: string }>('POST', '/v1/gremien', { portfolioId, kuerzel, name: `Gremium ${kuerzel}`, art: 'entscheidend' });
  if (gates.length) {
    const weg = await a.get(`/v1/portfolios/${portfolioId}/gremienweg`);
    await a.send('PUT', `/v1/portfolios/${portfolioId}/gremienweg`, { schritte: gates.map(gate => ({ gate, gremiumId: g.body.id })) }, { 'if-match': weg.headers()['etag'] ?? '' });
  }
  for (const datum of termine) await a.send('POST', `/v1/gremien/${g.body.id}/termine`, { datum });
  return { id: g.body.id, kuerzel };
}

/** Sitzung am Termin mit dem ersten Vorschlag der Art anlegen und versenden (K3 Schritte 1–5); liefert Sitzung und Traktandum. */
export async function sitzungVersendet(a: Api, g: Gremium, datum: string, art: string): Promise<{ sitzung: string; traktandum: string; version: number }> {
  const s = await a.send<{ id: string; version: number }>('POST', `/v1/gremien/${g.kuerzel}/sitzungen`, { datum });
  const vorschlaege = await (await a.get(`/v1/sitzungen/${s.body.id}/vorschlaege`)).json() as { gruppen: { art: string; traktanden: { id: string }[] }[] };
  const t = vorschlaege.gruppen.find(x => x.art === art)?.traktanden[0];
  expect(t, `Traktandum der Art ${art} vorgeschlagen`).toBeTruthy();
  const st = (await a.send<{ version: number }>('POST', `/v1/sitzungen/${s.body.id}/traktanden`, { vorschlagId: t!.id })).body;
  const v = (await a.send<{ version: number }>('POST', `/v1/sitzungen/${s.body.id}/versenden`, undefined, { 'if-match': `W/"${st.version}"` })).body;
  return { sitzung: s.body.id, traktandum: t!.id, version: v.version };
}

/**
 * Projekt mit Projektvertrag als Baseline (K2 Schritte 6–11): Phasenmodell mit Toleranzen in Kraft, entscheidendes
 * Gremium mit Termin in einer Woche und Gremienweg P0–P1, Entwurf mit einem Meilenstein (Termin in
 * `meilensteinInTagen`), Einreichen, Quality-Check, Unterschrift, Gate-Entscheid «freigegeben» in der laufenden Sitzung.
 * Danach ist das Projekt in P1, der Meilenstein steht mit Baseline-Termin im Register.
 */
export async function projektMitBaseline(page: Page, name: string, o: { meilenstein: string; meilensteinInTagen: number }): Promise<Projekt & { gremium: Gremium }> {
  const a = await apiAls(page);
  await phasenmodellMitToleranzen(a);
  const p = await projekt(a, name, 'P0');
  const datum = mittwochIn(7);
  const g = await gremium(a, p.portfolioId, [datum], ['P0_P1']);

  const e = await a.send<{ version: { id: string } }>('POST', `/v1/projekte/${p.id}/vertrag/entwuerfe`, { anlass: 'initial' });
  const v = e.body.version.id;
  const k7 = await a.get(`/v1/vertragsversionen/${v}/kapitel/7`);
  const inhalt = (await k7.json() as { inhalt: Record<string, unknown> }).inhalt;
  inhalt.meilensteine = [{ registerId: null, phase: 'P1', art: 'meilenstein', text: o.meilenstein, termin: inTagen(o.meilensteinInTagen) }];
  await a.send('PUT', `/v1/vertragsversionen/${v}/kapitel/7`, { inhalt }, { 'if-match': k7.headers()['etag'] ?? '' });
  const d = await a.get(`/v1/vertragsversionen/${v}`);
  const r = await a.send('POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': d.headers()['etag'] ?? '' });
  await a.send('POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': r.etag });
  // Eine Unterschrift deckt alle offenen Funktionen der Person (SP, PL, CTL)
  const pr = await a.get(`/v1/vertragsversionen/${v}/pruefung`);
  await a.send('POST', `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' }, { 'if-match': pr.headers()['etag'] ?? '' });

  // Gate-Traktandum in die Sitzung, versenden, starten, entscheiden (K3)
  const s = await sitzungVersendet(a, g, datum, 'gate');
  await a.send('POST', `/v1/sitzungen/${s.sitzung}/starten`, undefined, { 'if-match': `W/"${s.version}"` });
  await a.send('PUT', `/v1/traktanden/${s.traktandum}/entscheid`, { ergebnis: 'freigegeben', begruendung: 'Vertrag vollständig' });
  const vertrag = await (await a.get(`/v1/projekte/${p.id}/vertrag`)).json() as { baseline: string | null };
  expect(vertrag.baseline, 'Baseline nach dem Gate-Entscheid').toBeTruthy();
  return { ...p, gremium: g };
}
