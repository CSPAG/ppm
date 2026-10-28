/**
 * Abnahme AP-E1-3 Oberfläche (UI-17; PC.04.01, UC-014 Schritt 1): Portfolio › Dashboard über die Navigation, Periode und
 * Ansicht in der Adresse (I-N5), Liste und Funnel mit der Tastatur; axe hell, dunkel und 360 px. Leser:in sieht den
 * Bereich nicht. Mit Projekten und Meldungen prüfen die Komponententests (`Dashboard.test.tsx`) und die API-Tests
 * (`test/app/dashboard.test.ts`).
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login, tabTo } from './support.ts';

test('Dashboard: Liste und Funnel; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByText(/\d+ Projekte? · \d+ im Plan · \d+ kritisch/)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  const funnel = page.getByRole('button', { name: 'Funnel nach Phase' });
  await tabTo(page, funnel);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/ansicht=funnel/);
  await expect(page.getByRole('table', { name: 'Funnel nach Phase' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht das Dashboard nicht', async ({ page }) => {
  await login(page, BRUNO, '/portfolio/dashboard');
  await expect(page.getByText(/Das Dashboard sehen Gremien/)).toBeVisible();
});
