/**
 * Abnahme UI-47 (AP-E0-5; BC AM.02.04; UC-017 Schritt 4): Portfolio anlegen, entscheidendes Gremium und SNS-VR
 * erfassen, Gremienweg mit «via SNS-VR» festlegen, Sitzungstermin planen; barrierefrei hell, dunkel und 360 px;
 * Leser:in sieht den Bereich nicht.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Portfolio mit Gremien und Gremienweg «via SNS-VR»', async ({ page }) => {
  const n = `${Date.now()}`;
  const name = `E2E Transformation ${n}`;
  await login(page, ANNA, '/administration/portfolios');
  await expect(page.getByRole('heading', { name: 'Portfolios und Gremien', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Portfolio der Kategorie A (Pflichten, A-07)
  await page.getByRole('button', { name: 'Neues Portfolio' }).first().click();
  await page.getByLabel('Bezeichnung').fill(name);
  await page.getByLabel('Schlüssel').fill(`e2e-${n}`);
  await page.getByRole('button', { name: 'Speichern' }).click();
  const portfolio = page.getByRole('dialog', { name });
  await expect(portfolio).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]o=e2e-${n}`));
  await expect(portfolio.getByText(/sind Pflicht/)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Entscheidendes Gremium (vorbelegt) und SNS-VR als externes Gremium (A-45, A-02)
  for (const [gname, kuerzel, art] of [[`PRAT ${n}`, `prat-${n}`, null], [`SNS-VR ${n}`, `sns-${n}`, 'extern, ohne Benutzer']] as const) {
    await page.getByRole('dialog').getByRole('button', { name: 'Neues Gremium' }).click();
    const form = page.getByRole('dialog', { name: 'Neues Gremium' });
    await form.getByLabel('Bezeichnung').fill(gname);
    await form.getByLabel('Kürzel').fill(kuerzel);
    if (art) await expect(form.getByLabel('Art')).toHaveValue('extern');
    else await expect(form.getByLabel('Art')).toHaveValue('entscheidend');
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog', { name: gname })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: `Zurück zu ${name}` }).click();
  }

  // Gremienweg: P0–P1 mit SNS-VR (Q8 Kap. 5.1)
  await page.getByRole('dialog').getByRole('button', { name: 'Gremienweg bearbeiten' }).click();
  await page.getByLabel('Gate P0–P1').selectOption({ label: `PRAT ${n}, via SNS-VR ${n}` });
  await page.getByLabel('Gate P2–P3').selectOption({ label: `PRAT ${n}` });
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gremienweg gespeichert.')).toBeVisible();
  await expect(page.getByRole('dialog', { name }).getByText(`PRAT ${n}, via SNS-VR ${n}`)).toBeVisible();

  // Sitzungstermin im entscheidenden Gremium
  await page.getByRole('dialog').getByRole('button', { name: `PRAT ${n}` }).click();
  const gremium = page.getByRole('dialog', { name: `PRAT ${n}` });
  await gremium.getByLabel('Datum').fill('2027-01-20');
  await gremium.getByRole('button', { name: 'Termin planen' }).click();
  await expect(page.getByText(/Termin .*20\.1\.2027 geplant\./)).toBeVisible();
  await expect(gremium.getByRole('button', { name: /Termin .*20\.1\.2027 entfernen/ })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht Portfolios und Gremien nicht in der Navigation', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('link', { name: 'Portfolios und Gremien' })).toHaveCount(0);
});
