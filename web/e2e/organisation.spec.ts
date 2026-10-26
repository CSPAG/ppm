/** Mandantentrennung in der Oberfläche: Eine zweite Organisation sieht die Projekte von «demo» nicht. */
import { expect, test } from '@playwright/test';
import { createProjekt, loggedIn, login, PEOPLE, unique } from './helpers.ts';

test('zweite Organisation sieht nichts', async ({ page, browser }) => {
  const admin = await loggedIn(browser, PEOPLE.anna);
  const label = unique('E2E Geheim');
  const id = await createProjekt(admin, label);
  await admin.context().close();

  await login(page, PEOPLE.max);
  await page.getByRole('searchbox', { name: 'Projekte durchsuchen' }).fill(label);
  await expect(page.getByRole('heading', { name: 'Keine Treffer' })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(label) })).toHaveCount(0);

  // Auch über die Adresse nicht (404, nie Inhalt)
  await page.goto(`/projekte?o=${id}`);
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Projekt nicht gefunden' })).toBeVisible();
  await expect(page.getByText(label)).toHaveCount(0);
});
