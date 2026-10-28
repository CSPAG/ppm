/**
 * Abnahme AP-E7-5 (BC ZM.03.03, UC-013 Schritte 1 und 4; UI-37): Gremien › Jahresrückblick öffnen (im Q4 das laufende
 * Jahr, sonst das Vorjahr), Jahresauswertung mit Kennzahlen, Erkenntnisse speichern, Dokument bereit; axe hell, dunkel
 * und 360 px. Eigenes Jahr, damit parallele Tests sich nicht stören.
 */
import { expect, test } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Jahresrückblick zusammenstellen und Erkenntnisse speichern; barrierefrei', async ({ page }) => {
  await login(page, ANNA);
  await page.goto('/gremien/jahresrueckblick');
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/gremien\/jahresrueckblick\/\d{4}$/);

  await page.goto('/gremien/jahresrueckblick/2091');
  await expect(page.getByRole('heading', { name: 'Jahresrückblick 2091', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Kennzahlen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 Zielerreichung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 Lessons Learned' })).toBeVisible();

  await page.getByLabel('Erkenntnisse', { exact: true }).fill(`Zu viele Vorhaben parallel ${Date.now()}`);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Als Dokument herunterladen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Im PRAT traktandieren' })).toBeEnabled();
  await expectAccessible(page);
  await expectNoOverflow(page);
});
