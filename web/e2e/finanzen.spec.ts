/**
 * Abnahme AP-E7-4 (UI-26–UI-28; BC PC.01.02, PC.01.04, PC.01.05; UC-010): Portfolio › Finanzen mit Übersicht,
 * Abweichungen und Budgetprozess (Assistent), Reiter in der Adresse (I-N5), axe hell, dunkel und 360 px ohne Überlauf;
 * Leser:in sieht den Bereich nicht (I-N2, A-33). Die Demo-Daten haben je nach Lauf keine Projekte mit Beträgen: dann
 * prüft der Test den leeren Zustand.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Finanzen: Übersicht, Abweichungen, Budgetprozess, barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/finanzen');
  await expect(page.getByRole('heading', { name: 'Finanzen', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Übersicht' })).toHaveAttribute('aria-current', 'page');
  const tabelle = page.getByRole('table', { name: 'Projekte mit Prognose, Budget und Ist' });
  await expect(tabelle.or(page.getByText('Keine Projekte mit Beträgen, die Sie sehen.'))).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('link', { name: 'Abweichungen' }).click();
  await expect(page).toHaveURL(/\/portfolio\/finanzen\/abweichungen/);
  await expect(page.getByRole('table', { name: 'Projekte mit Abweichung' }).or(page.getByText(/^Keine Abweichungen/))).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('link', { name: 'Budgetprozess' }).click();
  await expect(page).toHaveURL(/\/portfolio\/finanzen\/budgetprozess/);
  await expect(page.getByRole('heading', { name: 'Schritt 1 von 3: Jahr wählen' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Schritt 2 von 3: Jahresbedarf prüfen' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht den Bereich Finanzen nicht', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('link', { name: 'Finanzen' })).toHaveCount(0);
});
