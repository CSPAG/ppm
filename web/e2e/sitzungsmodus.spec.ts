/**
 * Abnahme AP-E2-2 (K3 Durchführen; UC-006 Schritte 6–9, A3): Sitzung starten, Entscheid mit Auflage erfassen und die
 * Zeit messen (K3-3: ≤ 60 s je Traktandum), Antrag auf dem Tablet ohne Scrollen (K3-5: 768 px), Sitzung schliessen,
 * Protokoll bereinigen und versenden, Entscheide und Auflagen; axe hell, dunkel und 360 px.
 * Portfolio, Gremium, Termine, Projekt und versendete Sitzung entstehen je Lauf über die API.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

function mittwochIn(tage: number): string {
  const d = new Date(Date.now() + tage * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Aufruf der API mit der Sitzung der Seite (CSRF-Token aus /auth/me, Organisation «demo»). */
async function apiCall(page: Page, method: 'GET' | 'POST', url: string, data?: unknown, headers: Record<string, string> = {}) {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken?: string };
  const r = await page.request.fetch(url, {
    method, ...(data !== undefined ? { data } : {}),
    headers: { 'x-csrf-token': me.csrfToken ?? '', 'x-tenant': 'demo', ...(method === 'POST' ? { 'idempotency-key': crypto.randomUUID() } : {}), ...headers },
  });
  expect(r.status(), `${method} ${url}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}

test('Sitzung durchführen: Entscheid in ≤ 60 s, schliessen, Protokoll versenden; barrierefrei', async ({ page }) => {
  const lauf = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const kuerzel = `e2m-${lauf}`;
  const termin = mittwochIn(35);
  await login(page, ANNA);
  const portfolio = await apiCall(page, 'POST', '/v1/portfolios', { kategorie: 'B', schluessel: `e2m-${lauf}`, name: `E2E ${lauf}` });
  const gremium = await apiCall(page, 'POST', '/v1/gremien', { portfolioId: portfolio.id, kuerzel, name: `Ausschuss ${lauf}`, art: 'entscheidend' });
  for (const datum of [termin, mittwochIn(63)]) await apiCall(page, 'POST', `/v1/gremien/${gremium.id}/termine`, { datum });
  const projekt = await apiCall(page, 'POST', '/v1/projekte', { name: `Projekt ${lauf}`, portfolioId: portfolio.id, phase: 'P2' });
  let s = await apiCall(page, 'POST', `/v1/gremien/${kuerzel}/sitzungen`, { datum: termin });
  s = await apiCall(page, 'POST', `/v1/sitzungen/${s.id}/traktanden`, { art: 'gate', projektId: projekt.id, antrag: `Freigabe Phase P3 für ${projekt.nummer}` });
  await apiCall(page, 'POST', `/v1/sitzungen/${s.id}/versenden`, undefined, { 'if-match': `W/"${s.version}"` });

  // Einstieg aus der Sitzung: Sitzungsmodus
  await page.goto(`/gremien/${kuerzel}/sitzungen/${termin}`);
  await page.getByRole('button', { name: 'Sitzungsmodus' }).click();
  await expect(page).toHaveURL(new RegExp(`/gremien/${kuerzel}/sitzungen/${termin}/modus`));
  await page.getByRole('button', { name: 'Sitzung starten' }).click();
  await expect(page.getByText('Sitzung gestartet.')).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // K3-3: Entscheid ab Wortlaut erfassen, gemessen bis zur Bestätigung des Servers
  const start = Date.now();
  await page.keyboard.press('e');
  await page.getByRole('radio', { name: 'Mit Auflagen freigegeben' }).check();
  await page.getByLabel('Begründung').fill('Business Case überzeugt, Termin knapp');
  await page.getByRole('button', { name: 'Auflage hinzufügen' }).click();
  await page.getByLabel('Auflage 1').fill('Risikoplan nachreichen');
  await page.getByLabel('Termin').fill(mittwochIn(70));
  const wer = page.getByLabel('Verantwortlich');
  if (!(await wer.inputValue())) await wer.selectOption({ index: 1 });
  await expect(page.getByText(/Die Folge wird sofort nachgeführt\./)).toBeVisible();
  await page.getByRole('button', { name: 'Entscheid erfassen' }).click();
  await expect(page.getByText('Entscheid erfasst: Mit Auflagen freigegeben.').first()).toBeVisible();
  const dauer = Date.now() - start;
  test.info().annotations.push({ type: 'K3-3', description: `Entscheid erfasst in ${dauer} ms` });
  expect(dauer).toBeLessThan(60_000);
  await expectAccessible(page);

  // K3-5: Auf dem Tablet (768 px) steht der Antrag ohne Scrollen im Bild
  const vorher = page.viewportSize()!;
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  await expect(page.getByText(`Freigabe Phase P3 für ${projekt.nummer}`)).toBeInViewport();
  await expectNoOverflow(page);
  await page.setViewportSize(vorher);

  // Schliessen mit Hinweis, dann Protokoll
  await page.getByRole('button', { name: 'Sitzung schliessen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sitzung jetzt schliessen?' });
  await expect(dialog.getByText('Alle Traktanden sind entschieden.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Sitzung schliessen' }).click();
  await expect(page.getByText(/Sitzung geschlossen am .* Protokoll im Entwurf\./)).toBeVisible();
  await page.getByRole('button', { name: 'Protokoll', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sitzungen/${termin}/protokoll$`));
  await expect(page.getByText('Mit Auflagen freigegeben')).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByLabel('Anwesende').fill('Alle Mitglieder');
  const gespeichert = page.waitForResponse(r => r.url().endsWith('/protokoll') && r.request().method() === 'PUT');
  await page.getByLabel('Bemerkungen').focus();
  expect((await gespeichert).status()).toBe(200);
  await page.getByRole('button', { name: 'Protokoll versenden' }).click();
  const versand = page.getByRole('dialog', { name: 'Protokoll jetzt versenden?' });
  await expect(versand.getByText(/sehen das Protokoll ab dem Versand/)).toBeVisible();
  await versand.getByRole('button', { name: 'Protokoll versenden' }).click();
  await expect(page.getByText(/Protokoll versendet am .*/)).toBeVisible();
  await expectAccessible(page);

  // Entscheide und Auflagen
  await page.goto(`/gremien/entscheide?gremium=${kuerzel}`);
  await expect(page.getByRole('heading', { name: 'Entscheide', level: 1 })).toBeVisible();
  await expect(page.getByText(/Mit Auflagen freigegeben/).first()).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});
