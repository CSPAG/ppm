/**
 * Abnahme AP-E5-2 (UI-21; BC PP.03.04, PP.02.02, PC.02.01): Portfolio › Priorisierung › Matrix mit Ansicht, Tabelle,
 * «Wie wird das berechnet?» und Portfoliorisiken; axe hell, dunkel und 360 px ohne Überlauf. Die Demo-Daten haben je nach
 * Lauf (noch) kein Modell in Kraft: dann prüft der Test den leeren Zustand.
 */
import { expect, test } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Matrix: Reiter, Ansichten, Regel und Portfoliorisiken, barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/priorisierung/matrix');
  await expect(page.getByRole('heading', { name: 'Priorisierung', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Matrix' })).toHaveAttribute('aria-current', 'page');
  const matrix = page.getByRole('figure', { name: /Portfolio-Matrix/ });
  const leer = page.getByText(/kein Bewertungsmodell in Kraft|keine aktiven Projekte|noch kein Portfolio/);
  await expect(matrix.or(leer).first()).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  if (await matrix.isVisible()) {
    await page.getByRole('button', { name: 'Ressourcen × Nutzen' }).click();
    await page.getByRole('button', { name: 'Als Tabelle' }).click();
    await expect(page.getByRole('table', { name: 'Projekte der Matrix' })).toBeVisible();
    await expectAccessible(page);
    await expectNoOverflow(page);
  }

  await page.getByRole('button', { name: 'Wie wird das berechnet?' }).click();
  const regel = page.getByRole('dialog', { name: 'Wie wird das berechnet?' });
  await expect(regel.getByText(/hoch = 3, mittel = 2, tief = 1/)).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Portfoliorisiken' }).click();
  const risiken = page.getByRole('dialog', { name: 'Portfoliorisiken' });
  await expect(risiken).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});
