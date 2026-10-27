/**
 * Statusbericht erstellen (UI-13, Kernablauf K1, UC-004) in hell, dunkel und 360 px: Projekt mit Anna als
 * Projektleitung (über die API angelegt), Bericht der laufenden Periode mit Vorbelegung, Einreichen nur mit der Tastatur
 * und Rückgängig, Interaktionen für K1-1 gezählt (≤ 15 ohne Änderung an den Registern), axe ohne Befund, kein Überlauf.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login, tabTo } from './support.ts';

const PERIODE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

/** Schreibende Aufrufe der API mit CSRF-Token und Organisation der Sitzung (wie die Oberfläche). */
async function apiAls(page: Page) {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string }; person: { email: string | null } };
  const headers = { 'x-csrf-token': me.csrfToken, 'x-tenant': me.tenant.alias, 'content-type': 'application/json' };
  return {
    me,
    async send<T>(method: 'POST' | 'PUT', url: string, data: unknown, extra: Record<string, string> = {}): Promise<T> {
      const r = await page.request.fetch(url, { method, headers: { ...headers, ...extra }, data: JSON.stringify(data) });
      expect(r.status(), `${method} ${url}: ${await r.text()}`).toBeLessThan(300);
      return r.json() as Promise<T>;
    },
    async get<T>(url: string): Promise<T> { return (await page.request.get(url, { headers: { 'x-tenant': me.tenant.alias } })).json() as Promise<T>; },
  };
}

/** Projekt in einem Portfolio mit Pflichten, Anna als Projektleitung; liefert die Nummer. */
async function projektMitAnna(page: Page, name: string): Promise<string> {
  const a = await apiAls(page);
  const schluessel = `e2e-${Date.now().toString(36)}`;
  const pf = await a.send<{ id: string }>('POST', '/v1/portfolios', { kategorie: 'A', schluessel, name: `E2E ${schluessel}` });
  const pj = await a.send<{ id: string; nummer: string }>('POST', '/v1/projekte', { name, portfolioId: pf.id, phase: 'P1' });
  const people = await a.get<{ items: { id: string; email: string | null }[] }>(`/v1/people?q=${encodeURIComponent('Anna')}`);
  const anna = people.items.find(p => p.email === a.me.person.email) ?? people.items[0]!;
  await a.send('PUT', `/v1/projekte/${pj.id}/organisation`, { mitglieder: [{ personId: anna.id, funktion: 'pl', akv: '' }] }, { 'if-match': 'W/"0"' });
  return pj.nummer;
}

test('Statusbericht nur mit der Tastatur einreichen und rückgängig machen (K1-1, Tastatur)', async ({ page }) => {
  await login(page, ANNA, '/eingang');
  const nr = await projektMitAnna(page, `Bericht E2E ${Date.now()}`);
  let interaktionen = 0;
  // Einstieg: Projektakte › Bericht (die Aufgabe im Eingang entsteht ab dem 18. mit Phasenmodell in Kraft)
  await page.goto(`/projekte/${nr}/bericht?periode=${PERIODE}`);
  interaktionen++;
  await expect(page.getByRole('heading', { name: /^Statusbericht / })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bericht' })).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);

  // Erster Bericht: Abweichung je Dimension wählen, Status und Trend bewusst setzen
  for (const d of ['Inhalt', 'Termin', 'Ressourcen', 'Budget']) {
    await page.getByLabel(d, { exact: true }).selectOption('keine');
    interaktionen++;
  }
  const imPlan = page.getByRole('radio', { name: 'Im Plan' });
  await tabTo(page, imPlan, 80);
  await page.keyboard.press('Space');
  interaktionen++;
  // Tab hält in einer Optionsgruppe nur an der ersten Option (ohne Wahl); weiter mit den Pfeiltasten, die zugleich wählen
  await tabTo(page, page.getByRole('radio', { name: 'aufwärts' }), 10);
  await page.keyboard.press('ArrowDown');
  interaktionen++;
  await expect(page.getByRole('radio', { name: 'gleichbleibend' })).toBeChecked();
  await expect(page.getByText('Alle Pflichtangaben sind erfasst.')).toBeVisible();
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible();

  const einreichen = page.getByRole('button', { name: 'Statusbericht einreichen' });
  await tabTo(page, einreichen, 40);
  await page.keyboard.press('Enter');
  interaktionen++;
  await expect(page.getByText(/^Statusbericht \S+ eingereicht\./)).toBeVisible();
  expect(interaktionen).toBeLessThanOrEqual(15);
  await expect(page.getByText(/In Prüfung bei der Unternehmensentwicklung seit/)).toBeVisible();
  await expect(imPlan).toBeDisabled();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText('Einreichen rückgängig gemacht. Der Bericht ist wieder ein Entwurf.')).toBeVisible();
  await expect(imPlan).toBeEnabled();
});

test('«Kritisch» sperrt das Einreichen ohne Begründung und Massnahme; dunkel und 360 px ohne Befund', async ({ page }) => {
  await login(page, ANNA, '/eingang');
  const nr = await projektMitAnna(page, `Kritisch E2E ${Date.now()}`);
  await page.goto(`/projekte/${nr}/bericht?periode=${PERIODE}`);
  await page.getByRole('radio', { name: 'Kritisch' }).check();
  await expect(page.getByRole('alert').filter({ hasText: 'Begründung und Massnahme fehlen' })).toBeVisible();
  await page.getByRole('button', { name: 'Statusbericht einreichen' }).click();
  // Sperre als Regelmeldung «Sperre: Angaben fehlen: …» (Hinweis mit Stufe vor dem Text, I-P1)
  await expect(page.getByText(/Angaben fehlen: /)).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});
