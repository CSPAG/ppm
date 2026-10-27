/**
 * Abnahme AP-E5-1 (UI-19, UI-20; BC PP.01.02, PP.01.03, PP.02.01): Portfolio › Priorisierung mit Reitern Bewertung und
 * Modell; Entwurf anlegen bzw. öffnen, axe hell, dunkel und 360 px ohne Überlauf; Leser:in sieht den Bereich nicht (I-N2).
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Bewertung und Modell: Reiter, Entwurf, barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/priorisierung');
  await expect(page).toHaveURL(/\/portfolio\/priorisierung\/bewertung/);
  await expect(page.getByRole('heading', { name: 'Priorisierung', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('link', { name: 'Modell' }).click();
  await expect(page).toHaveURL(/\/portfolio\/priorisierung\/modell/);
  const anlegen = page.getByRole('button', { name: 'Entwurf anlegen' }).first();
  const version = page.getByRole('button', { name: /Modell \d+/ }).first();
  // Läufe hell, dunkel und schmal teilen die Datenbank: erst warten, bis die Liste geladen ist, dann neu anlegen oder
  // die vorhandene Version öffnen
  await expect(anlegen.or(version).first()).toBeVisible();
  if (await anlegen.isVisible()) await anlegen.click();
  else await version.click();
  await expect(page.getByRole('dialog', { name: /Modell \d+/ })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht den Bereich Priorisierung nicht', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('link', { name: 'Priorisierung' })).toHaveCount(0);
});
