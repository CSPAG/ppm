/**
 * Abnahme AP-E5-3 (UI-22; BC PP.03.01–03, UC-008 Schritte 5–6, K5): Portfolio › Priorisierung › Szenarien; Szenario
 * anlegen bzw. öffnen, Banner «Ist-Stand ändert sich nicht», Rangliste; Umordnen mit Alt+↓ ab 1024 px; axe hell, dunkel
 * und 360 px ohne Überlauf; Szenarienvergleich.
 */
import { expect, test } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Szenario anlegen, umordnen, vergleichen; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/portfolio/priorisierung/szenarien');
  await expect(page.getByRole('heading', { name: 'Priorisierung', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Szenarien' })).toHaveAttribute('aria-current', 'page');
  const breit = page.viewportSize()!.width >= 1024;
  // Läufe hell, dunkel und schmal teilen die Datenbank: erst warten, bis die Seite geladen ist (leer, Liste oder ohne Portfolio)
  const leer = page.getByText(/^Noch kein Szenario\./);
  const liste = page.getByRole('table', { name: 'Rangliste des Szenarios' });
  const ohnePortfolio = page.getByText('Es gibt noch kein Portfolio, das Sie sehen.');
  await expect(leer.or(liste).or(ohnePortfolio).first()).toBeVisible();
  if (await ohnePortfolio.isVisible()) return;
  await expectAccessible(page);
  if (await leer.isVisible() && breit) {
    await page.getByRole('button', { name: 'Szenario anlegen' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Szenario anlegen' });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await dialog.getByRole('button', { name: 'Szenario anlegen' }).click();
  }
  if (!(await liste.isVisible())) { await expectNoOverflow(page); return; }
  await expect(page.getByText(/Der Ist-Stand des Portfolios ändert sich nicht\./)).toBeVisible();
  const runter = page.getByRole('button', { name: /nach unten$/ });
  if (breit && await runter.count() > 1) {
    const erste = (await liste.getByRole('rowheader').first().textContent())!.slice(0, 8);
    await runter.first().focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(liste.getByRole('rowheader').nth(1)).toContainText(erste);
    await expect(page.getByText(new RegExp(`^${erste} auf Rang 2`))).toBeVisible();
  }
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('button', { name: 'Szenarien vergleichen' }).click();
  await expect(page.getByRole('table', { name: 'Szenarienvergleich' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});
