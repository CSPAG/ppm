/**
 * Abnahme AP-E1-3 Oberfläche (UI-17; PC.04.01, UC-014 Schritt 1): Portfolio › Dashboard über die Navigation, Periode und
 * Ansicht in der Adresse (I-N5), Liste und Funnel mit der Tastatur; axe hell, dunkel und 360 px. Eigene Testdaten
 * (Portfolio mit einem Projekt) und die laufende Periode: Ohne `periode` zeigt das Dashboard die letzte abgeschlossene, und
 * die hängt davon ab, was andere Tests parallel abschliessen (Ursache des früheren Flackerns). Leser:in sieht den
 * Bereich nicht. Mit Projekten und Meldungen prüfen die Komponententests (`Dashboard.test.tsx`) und die API-Tests
 * (`test/app/dashboard.test.ts`).
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login, tabTo } from './support.ts';

/** POST an die API mit den Kopfzeilen der Sitzung; liefert den Körper der Antwort. */
async function post(page: Page, pfad: string, body: unknown): Promise<{ id: string; nummer?: string }> {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string } };
  const r = await page.request.post(pfad, { data: body, headers: { 'X-CSRF-Token': me.csrfToken, 'X-Tenant': me.tenant.alias } });
  expect(r.status(), `${pfad}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}

/** Laufende Periode in der Schweiz (offen, Dashboard live). */
const laufend = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date()).slice(0, 7);

test('Dashboard: Liste und Funnel; barrierefrei', async ({ page }) => {
  const lauf = Date.now();
  await login(page, ANNA, '/portfolio/dashboard');
  const schluessel = `e2e-db-${lauf}`;
  const pf = await post(page, '/v1/portfolios', { kategorie: 'A', schluessel, name: `E2E Dashboard ${lauf}` });
  await post(page, '/v1/projekte', { name: `E2E Dashboard ${lauf}`, portfolioId: pf.id, phase: 'P1' });

  await page.goto(`/portfolio/dashboard?portfolio=${schluessel}&periode=${laufend()}`);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`E2E Dashboard ${lauf}`) })).toBeVisible();
  // Kennzahlen als Liste; jede Zahl ist eine Schaltfläche zu ihren Projekten (Seitentyp Bericht)
  await expect(page.getByRole('listitem').filter({ hasText: /^1 Projekt$/ })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  const funnel = page.getByRole('button', { name: 'Funnel nach Phase' });
  await tabTo(page, funnel);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/ansicht=funnel/);
  const tab = page.getByRole('table', { name: 'Funnel nach Phase' });
  await expect(tab).toBeVisible();
  // Spalte «Projekte» der Phase P1: das eigene Projekt
  await expect(tab.getByRole('row', { name: /P1/ }).getByRole('cell').first()).toHaveText('1');
  await expectAccessible(page);
  await expectNoOverflow(page);
  // die Zahl führt zu ihren Einzelwerten: Liste der Phase in der Adresse
  await tab.getByRole('button', { name: /^Projekte in P1 .*anzeigen: 1 Projekte$/ }).click();
  await expect(page).toHaveURL(/phase=P1/);
  await expect(page.getByRole('link', { name: new RegExp(`E2E Dashboard ${lauf}`) })).toBeVisible();
});

test('Leser:in sieht das Dashboard nicht', async ({ page }) => {
  await login(page, BRUNO, '/portfolio/dashboard');
  await expect(page.getByText(/Das Dashboard sehen Gremien/)).toBeVisible();
});
