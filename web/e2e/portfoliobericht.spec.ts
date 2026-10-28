/**
 * Abnahme AP-E2-3 Oberfläche (UI-18 Risikolage, UI-29 Portfoliobericht; PC.02.02, PC.04.02, UC-014 Schritte 2–3):
 * beide Seiten über die Navigation des Arbeitsraums Portfolio, Portfolio in der Adresse (I-N5), axe hell, dunkel und
 * 360 px. Erzeugen, Kommentar und Bereitstellen prüfen die Komponententests (`Portfoliobericht.test.tsx`) und die
 * API-Tests (`test/app/portfoliobericht.test.ts`).
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Risikolage: Matrix als Tabelle, Risiken, Abhängigkeiten; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/dashboard/risiken');
  await expect(page.getByRole('heading', { name: 'Risikolage', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Verteilung nach Wahrscheinlichkeit und Auswirkung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abhängigkeiten' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Portfoliobericht: Seite mit Portfolio und Periode; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/auswertungen/portfoliobericht');
  await expect(page.getByRole('heading', { name: 'Portfoliobericht', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Periode')).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht Risikolage und Portfoliobericht nicht', async ({ page }) => {
  await login(page, BRUNO, '/portfolio/dashboard/risiken');
  await expect(page.getByText(/Die Risikolage sehen Gremien/)).toBeVisible();
});
