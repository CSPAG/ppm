/**
 * Zugänge (UC-016 A1, AP-E7-8): Seite und Entziehen bis zur Vorschau (was mit dem Zugang entfällt); axe ohne Befund,
 * kein Überlauf (hell, dunkel, 360 px). Entzogen wird hier nicht: die Personen der E2E-Tests teilen sich alle Läufe.
 * Leser:in hat keine Aktion.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Zugang entziehen: Person wählen, Vorschau, abbrechen; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/administration/zugaenge');
  await expect(page.getByRole('heading', { name: 'Zugänge', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('button', { name: 'Zugang entziehen' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Zugang entziehen' });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/[?&]o=entziehen/);
  await drawer.getByRole('searchbox').fill('Bruno');
  await drawer.getByRole('button', { name: /Bruno/ }).first().click();
  await expect(drawer.getByRole('heading', { name: 'Was mit dem Zugang entfällt' })).toBeVisible();
  await expect(drawer.getByText(/wird aus der Organisation entfernt/)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await drawer.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(drawer).toHaveCount(0);
});

test('Leser:in kann keinen Zugang entziehen', async ({ page }) => {
  await login(page, BRUNO, '/administration/zugaenge?o=entziehen');
  await expect(page.getByRole('heading', { name: 'Zugänge', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zugang entziehen' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
