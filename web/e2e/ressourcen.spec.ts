/**
 * Abnahme AP-E5-4 (UI-23, UI-24; BC RK.01.01, RK.02.04): Portfolio › Ressourcen mit Auslastung und Kapazität, Reiter
 * und Zeitraum in der Adresse (I-N5), axe hell, dunkel und 360 px ohne Überlauf; Leser:in sieht den Bereich nicht (I-N2).
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Auslastung und Kapazität: Reiter, Zeitraum, barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/ressourcen');
  await expect(page).toHaveURL(/\/portfolio\/ressourcen\/auslastung/);
  await expect(page.getByRole('heading', { name: 'Ressourcen', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Auslastung' })).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByLabel('Von').fill('2027-01');
  await expect.poll(() => new URL(page.url()).searchParams.get('von')).toBe('2027-01');

  await page.getByRole('link', { name: 'Kapazität' }).click();
  await expect(page).toHaveURL(/\/portfolio\/ressourcen\/kapazitaet\?.*von=2027-01/);
  // mit Rollen in der Codetabelle das Raster, sonst der Weg dorthin
  await expect(page.getByRole('table', { name: 'Kapazitätsangebot je Rolle und Monat' }).or(page.getByText(/noch keine Rollen des Ressourcenbedarfs/))).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht den Bereich Ressourcen nicht', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('link', { name: 'Ressourcen' })).toHaveCount(0);
});
