/**
 * Gate-Modus (UI-08, Kernablauf K2 Schritte 1–4; UC-003 Schritte 1, 4) in hell, dunkel und 360 px: Max ist in der
 * Organisation «muster» Sponsor, Projektleitung und CTL eines über die API angelegten Projekts mit Entwurf für das Gate
 * P0–P1. Eigene Organisation, damit das Phasenmodell in Kraft (Vorgabe des PM-Handbuchs mit Leitfragen je Wertestrom)
 * keine Specs der Organisation «demo» berührt. Leitfrage beantworten, speichern beim Verlassen, Fortschritt; axe ohne
 * Befund, kein Überlauf.
 */
import { expect, test, type Page } from '@playwright/test';
import { apiAls as datenApi, phasenmodellMitToleranzen } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

/** Schreibende Aufrufe der API mit CSRF-Token und Organisation der Sitzung (wie die Oberfläche). */
async function apiAls(page: Page) {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string }; person: { email: string | null } };
  const headers = { 'x-csrf-token': me.csrfToken, 'x-tenant': me.tenant.alias };
  return {
    me,
    async send<T>(method: 'POST' | 'PUT' | 'PATCH', url: string, data: unknown, extra: Record<string, string> = {}): Promise<{ body: T; etag: string }> {
      // ohne Body auch kein Content-Type (sonst 400 «Body cannot be empty»)
      const r = await page.request.fetch(url, data === undefined
        ? { method, headers: { ...headers, ...extra } }
        : { method, headers: { ...headers, 'content-type': 'application/json', ...extra }, data: JSON.stringify(data) });
      expect(r.status(), `${method} ${url}: ${await r.text()}`).toBeLessThan(300);
      return { body: await r.json() as T, etag: r.headers()['etag'] ?? '' };
    },
    async get(url: string) { return page.request.get(url, { headers: { 'x-tenant': me.tenant.alias } }); },
  };
}

/** Phasenmodell nach der Vorgabe in Kraft (einmal je Organisation, daten.ts), Projekt in P0 mit Max und Entwurf 0.1; liefert die Nummer. */
async function projektMitEntwurf(page: Page): Promise<string> {
  const a = await apiAls(page);
  const daten = await datenApi(page);
  // gemeinsam mit den Specs aus daten.ts: parallel sicher (Entwurf eines anderen Laufs → erneut lesen)
  await phasenmodellMitToleranzen(daten);
  const schluessel = `e2e-${Date.now().toString(36)}`;
  const pf = await a.send<{ id: string }>('POST', '/v1/portfolios', { kategorie: 'A', schluessel, name: `E2E ${schluessel}` });
  const pj = await a.send<{ id: string; nummer: string }>('POST', '/v1/projekte', { name: `Gate E2E ${schluessel}`, portfolioId: pf.body.id, phase: 'P0' });
  const people = await (await a.get(`/v1/people?q=${encodeURIComponent('Max')}`)).json() as { items: { id: string; email: string | null }[] };
  const max = people.items.find(p => p.email === a.me.person.email) ?? people.items[0]!;
  await a.send('PUT', `/v1/projekte/${pj.body.id}/organisation`, {
    mitglieder: (['sp', 'pl', 'ctl'] as const).map(funktion => ({ personId: max.id, funktion, akv: '' })),
  }, { 'if-match': 'W/"0"' });
  await a.send('POST', `/v1/projekte/${pj.body.id}/vertrag/entwuerfe`, { anlass: 'initial' });
  return pj.body.nummer;
}

test('Gate-Modus: Leitfrage beantworten, beim Verlassen gespeichert, Fortschritt (UC-003 Schritt 4)', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const nr = await projektMitEntwurf(page);
  await page.goto(`/projekte/${nr}/vertrag/gate`);
  await expect(page.getByRole('heading', { name: 'Gate P0–P1 vorbereiten' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leitfragen 0 von 5 beantwortet' })).toBeVisible();
  await expectAccessible(page);

  const feld = page.getByLabel('Hat das Projekt ausreichenden Nutzen?');
  await feld.fill('Business Case mit Nutzen in Kap. 3 belegt');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leitfragen 1 von 5 beantwortet' })).toBeVisible();

  // nach dem Neuladen vom Server
  await page.reload();
  await expect(page.getByLabel('Hat das Projekt ausreichenden Nutzen?')).toHaveValue('Business Case mit Nutzen in Kap. 3 belegt');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});
