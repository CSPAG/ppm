/**
 * Abnahme AP-E1-2 Oberfläche (UI-15, UI-16; K1 «Prüfen», UC-005): Portfolio › Monatsabschluss über die Navigation,
 * Periode in der Adresse (I-N5), Kopf, leerer Posteingang vor den ersten Berichten (Z2), Ansicht «Termine» mit der
 * Tastatur, Wechsel der Periode; axe hell, dunkel und 360 px. Leser:in sieht den Bereich nicht. Mit Berichten
 * prüfen die Komponententests (`Monatsabschluss.test.tsx`) und die API-Tests (`test/app/monatsabschluss.test.ts`).
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login, tabTo } from './support.ts';

const periode = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

test('Monatsabschluss: Periode, Posteingang, Termine; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/monatsabschluss');
  await expect(page.getByRole('heading', { name: 'Monatsabschluss', level: 1 })).toBeVisible();
  // Ohne Periode in der Adresse: die Periode in Arbeit
  await expect(page).toHaveURL(/periode=\d{4}-\d{2}/);
  await expect(page.getByText(/von \d+ eingereicht/)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Termine (UI-16) mit der Tastatur
  const termine = page.getByRole('button', { name: 'Termine', exact: true });
  await tabTo(page, termine);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/ansicht=termine/);
  await expect(page.getByRole('heading', { name: 'Terminabweichungen' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Vorherige Periode über die Adresse und zurück über den Schalter
  await page.goto(`/portfolio/monatsabschluss?periode=${periode()}`);
  await page.getByRole('button', { name: 'Vorherige Periode' }).click();
  await expect(page).not.toHaveURL(new RegExp(`periode=${periode()}`));
  await page.getByRole('button', { name: 'Nächste Periode' }).click();
  await expect(page).toHaveURL(new RegExp(`periode=${periode()}`));
});

test('Leser:in sieht den Monatsabschluss nicht', async ({ page }) => {
  await login(page, BRUNO, '/portfolio/monatsabschluss');
  await expect(page.getByText('Den Monatsabschluss sieht die Unternehmensentwicklung.')).toBeVisible();
});
