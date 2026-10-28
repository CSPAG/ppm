/**
 * Abnahme AP-E7-6 Oberfläche (UI-30; PC.04.03, UC-014 A2.1): Portfolio › Auswertungen mit eigenem Portfolio (über die
 * API angelegt), Filter und Gruppierung in der Adresse (I-N5), Einzelwerte einer Zahl in der Schublade, Export als CSV;
 * axe hell, dunkel und 360 px ohne Überlauf. Leser:in sieht den Bereich nicht.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Portfolio mit zwei Projekten in P1 und P2 (über die API wie die Oberfläche: CSRF-Token und Organisation). */
async function portfolioMitProjekten(page: Page): Promise<{ schluessel: string; name: string }> {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string } };
  const headers = { 'x-csrf-token': me.csrfToken, 'x-tenant': me.tenant.alias, 'content-type': 'application/json' };
  const post = async (url: string, data: unknown) => {
    const r = await page.request.post(url, { headers, data: JSON.stringify(data) });
    expect(r.status(), `${url}: ${await r.text()}`).toBeLessThan(300);
    return r.json() as Promise<{ id: string }>;
  };
  const schluessel = `aw-${Date.now().toString(36)}`;
  const name = `Auswertung ${schluessel}`;
  const pf = await post('/v1/portfolios', { kategorie: 'A', schluessel, name });
  for (const phase of ['P1', 'P2']) await post('/v1/projekte', { name: `Vorhaben ${phase} ${schluessel}`, portfolioId: pf.id, phase });
  return { schluessel, name };
}

test('Auswertung nach Phase mit Einzelwerten und Export; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/eingang');
  const pf = await portfolioMitProjekten(page);
  await page.goto(`/portfolio/auswertungen?portfolio=${pf.schluessel}`);
  await expect(page.getByRole('heading', { name: 'Auswertungen', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: /Ergebnis nach Portfolio, 2 Projekte/ })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel('Gruppierung').selectOption('phase');
  await expect(page).toHaveURL(/gruppierung=phase/);
  const tabelle = page.getByRole('table', { name: /Ergebnis nach Phase, 2 Projekte/ });
  await expect(tabelle.getByRole('row')).toHaveText([/Phase/, /^P11/, /^P21/, /^Summe2/]);

  await page.getByRole('button', { name: /^P2, Projekte: 1\. Einzelwerte öffnen/ }).click();
  const schublade = page.getByRole('dialog', { name: 'Einzelwerte: P2' });
  await expect(schublade.getByRole('link', { name: new RegExp(`Vorhaben P2 ${pf.schluessel}`) })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(schublade).toBeHidden();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportieren (CSV)', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^auswertung-\d{4}-\d{2}\.csv$/);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});

test('Leser:in sieht den Bereich «Auswertungen» nicht', async ({ page }) => {
  await login(page, BRUNO, '/eingang');
  await expect(page.getByRole('link', { name: 'Auswertungen', exact: true })).toHaveCount(0);
  await page.goto('/portfolio/auswertungen');
  await expect(page.getByText('Ad-hoc-Auswertungen erstellen die Unternehmensentwicklung und die Finanzen.')).toBeVisible();
});
