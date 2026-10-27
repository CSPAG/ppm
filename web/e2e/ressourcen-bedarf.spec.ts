/**
 * Abnahme AP-E7-2 PR 2: Seite «Bedarf» (UI-25). Testdaten über die API der Sitzung (BFF mit CSRF-Token und Organisation
 * aus /auth/me): Rolle des Ressourcenbedarfs, Portfolio, Projekt mit Bedarf in FTE. Geprüft: Bedarfsliste, Schublade,
 * Person zuteilen, Stand «gedeckt», Ansicht «Überbuchungen»; axe hell, dunkel und 360 px.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

async function post(page: Page, pfad: string, body: unknown): Promise<{ id: string; nummer?: string; principalId?: string }> {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string } };
  const r = await page.request.post(pfad, { data: body, headers: { 'X-CSRF-Token': me.csrfToken, 'X-Tenant': me.tenant.alias } });
  expect(r.status(), `${pfad}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}

test('Bedarf zuteilen: Liste, Schublade, gedeckt; Überbuchungen; barrierefrei', async ({ page }) => {
  const lauf = Date.now();
  const rolle = `e2e${lauf % 100000}`;
  await login(page, ANNA, '/portfolio/ressourcen/bedarf');
  await post(page, '/v1/codetabellen/ressourcenrolle/werte', { schluessel: rolle, label: `E2E Rolle ${lauf}` });
  const pf = await post(page, '/v1/portfolios', { kategorie: 'A', schluessel: `e2e-r-${lauf}`, name: `E2E Ressourcen ${lauf}` });
  const p = await post(page, '/v1/projekte', { name: `E2E Bedarf ${lauf}`, portfolioId: pf.id });
  await post(page, `/v1/projekte/${p.id}/ressourcenbedarf`, { phase: 'P1', rolle, fte: 0.5, vonMonat: '2030-01', bisMonat: '2030-02' });

  await page.goto('/portfolio/ressourcen/bedarf?von=2030-01&bis=2030-02');
  await expect(page.getByRole('heading', { level: 1, name: 'Ressourcen' })).toBeVisible();
  const zeile = page.getByRole('row', { name: new RegExp(`E2E Bedarf ${lauf}`) });
  await expect(zeile.getByText('offen')).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await zeile.getByRole('button').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('row', { name: /Januar 2030/ })).toBeVisible();
  await dialog.getByRole('radio').first().check();
  await dialog.getByLabel('Anteil (FTE)').fill('0,5');
  await dialog.getByRole('button', { name: 'Zuteilen' }).click();
  await expect(dialog.getByText('gedeckt').first()).toBeVisible();
  await expectAccessible(page);

  await page.goto('/portfolio/ressourcen/bedarf?von=2030-01&bis=2030-02&ansicht=konflikte');
  await expect(page.getByRole('radio', { name: 'Überbuchungen', checked: true })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});
