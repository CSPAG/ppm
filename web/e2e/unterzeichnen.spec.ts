/**
 * Projektvertrag unterzeichnen auf dem Telefon (UI-12, Kernablauf K2 Schritt 8; DM.02.06; UC-002 Schritt 10): Anna ist
 * Sponsor, Projektleitung und CTL eines über die API angelegten Projekts; Entwurf, Einreichen und Quality-Check laufen
 * über die API. Abnahme K2-1: ab dem Eingang bei 360 px höchstens 3 Interaktionen und ≤ 60 s bis zur bestätigten
 * Unterschrift; axe ohne Befund hell und dunkel, kein Überlauf.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Schreibende Aufrufe der API mit CSRF-Token und Organisation der Sitzung (wie die Oberfläche). */
async function apiAls(page: Page) {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string }; person: { email: string | null } };
  const headers = { 'x-csrf-token': me.csrfToken, 'x-tenant': me.tenant.alias };
  return {
    me,
    async send<T>(method: 'POST' | 'PUT', url: string, data: unknown, extra: Record<string, string> = {}): Promise<{ body: T; etag: string }> {
      // ohne Body auch kein Content-Type (sonst 400 «Body cannot be empty»), z. B. beim Einreichen
      const r = await page.request.fetch(url, data === undefined
        ? { method, headers: { ...headers, ...extra } }
        : { method, headers: { ...headers, 'content-type': 'application/json', ...extra }, data: JSON.stringify(data) });
      expect(r.status(), `${method} ${url}: ${await r.text()}`).toBeLessThan(300);
      return { body: await r.json() as T, etag: r.headers()['etag'] ?? '' };
    },
    async get<T>(url: string): Promise<T> { return (await page.request.get(url, { headers: { 'x-tenant': me.tenant.alias } })).json() as Promise<T>; },
  };
}

/** Projekt mit Anna als SP, PL und CTL, Entwurf eingereicht und Quality-Check bestätigt; liefert die Nummer. */
async function zurUnterzeichnung(page: Page): Promise<string> {
  const a = await apiAls(page);
  const schluessel = `e2e-${Date.now().toString(36)}`;
  const pf = await a.send<{ id: string }>('POST', '/v1/portfolios', { kategorie: 'A', schluessel, name: `E2E ${schluessel}` });
  const pj = await a.send<{ id: string; nummer: string }>('POST', '/v1/projekte', { name: `Vertrag E2E ${schluessel}`, portfolioId: pf.body.id, phase: 'P0' });
  const people = await a.get<{ items: { id: string; email: string | null }[] }>(`/v1/people?q=${encodeURIComponent('Anna')}`);
  const anna = people.items.find(p => p.email === a.me.person.email) ?? people.items[0]!;
  await a.send('PUT', `/v1/projekte/${pj.body.id}/organisation`, {
    mitglieder: (['sp', 'pl', 'ctl'] as const).map(funktion => ({ personId: anna.id, funktion, akv: '' })),
  }, { 'if-match': 'W/"0"' });
  const e = await a.send<{ version: { id: string } }>('POST', `/v1/projekte/${pj.body.id}/vertrag/entwuerfe`, { anlass: 'initial' });
  const v = e.body.version.id;
  // Die E2E-Datenbank entsteht je Lauf neu (scripts/e2e-db.ts) ohne Phasenmodell in Kraft: keine Pflichtangaben, das
  // Einreichen sperrt nicht (UC-002 Schritt 8). Setzt eine Spec künftig ein Phasenmodell in Kraft, meldet sich das hier.
  const pflicht = await a.get<{ vollstaendig: boolean; angaben: { text: string; erfuellt: boolean }[] }>(`/v1/vertragsversionen/${v}/pflichtangaben`);
  expect(pflicht.angaben.filter(x => !x.erfuellt).map(x => x.text), 'Pflichtangaben ohne Phasenmodell in Kraft').toEqual([]);
  const r = await a.send('POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': e.etag });
  await a.send('POST', `/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, { 'if-match': r.etag });
  return pj.body.nummer;
}

test('Unterzeichnen ab dem Eingang bei 360 px in höchstens 3 Interaktionen (K2-1)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page, ANNA, '/eingang');
  const nr = await zurUnterzeichnung(page);
  await page.goto('/eingang');

  const start = Date.now();
  let interaktionen = 0;
  // Je Funktion eine Aufgabe; eine Unterschrift deckt alle offenen Funktionen der Person
  const aufgabe = page.getByRole('listitem').filter({ hasText: nr }).filter({ hasText: /unterzeichnen/ }).first();
  // «Öffnen» trägt als Namen den Titel der Aufgabe («… unterzeichnen öffnen»)
  await aufgabe.getByRole('link', { name: /unterzeichnen öffnen$/ }).click();
  interaktionen++;
  await expect(page).toHaveURL(new RegExp(`/projekte/${nr}/vertrag/unterzeichnen`));
  await expect(page.getByRole('heading', { name: 'Projektvertrag unterzeichnen' })).toBeVisible();
  await expect(page.getByText('Mit deiner Unterschrift ist der Vertrag vollständig unterzeichnet und geht an das zuständige Gremium.')).toBeVisible();
  await expectNoOverflow(page);
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Unterzeichnen', exact: true }).click();
  interaktionen++;
  await expect(page.getByText('Unterzeichnet. Der Vertrag ist vollständig unterzeichnet.')).toBeVisible();
  expect(interaktionen).toBeLessThanOrEqual(3);
  expect(Date.now() - start).toBeLessThanOrEqual(60_000);
  // Hinweis mit Stufe vorangestellt («Hinweis: …», I-P1)
  await expect(page.locator('.hinweis').filter({ hasText: 'Der Vertrag ist vollständig unterzeichnet.' })).toBeVisible();
  await expect(page.getByText('3 von 3')).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
});
