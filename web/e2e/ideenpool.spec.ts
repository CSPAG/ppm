/**
 * Abnahme AP-E4-2 (BC DM.01.02–04, PP.02.04; UC-001 Schritte 3–5, K4): Ideenpool als Liste und Funnel «Pre-P0» mit
 * Ansicht in der Adresse; eine eingereichte Idee öffnet die Prüfung mit Leitfragen, Kriterienraster und Kategorie;
 * axe hell, dunkel und 360 px.
 */
import { expect, test } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Ideenpool, Funnel und Prüfung einer eingereichten Idee; barrierefrei', async ({ page }) => {
  const feld = `E2E Poolfeld ${Date.now()}`;
  const titel = `E2E Poolidee ${Date.now()}`;
  await login(page, ANNA);
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(feld);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: feld })).toBeVisible();

  // Idee einreichen (Assistent, AP-E4-1)
  await page.goto('/portfolio/ideen/neu');
  const neu = page.getByRole('button', { name: 'Neue Idee beginnen' });
  const titelFeld = page.getByLabel('Titel');
  await expect(neu.or(titelFeld)).toBeVisible();
  if (await neu.isVisible()) await neu.click();
  await titelFeld.fill(titel);
  await page.getByLabel('Ausgangslage').fill('Papier.');
  await page.getByLabel('Zielsetzung').fill('Ohne Papier.');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('radio', { name: new RegExp(feld) }).check();
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const g of ['Nutzen', 'Aufwand', 'Relevanz']) await page.getByRole('radiogroup', { name: g }).getByLabel('hoch').check();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Projektidee einreichen' }).click();
  await expect(page.getByRole('heading', { name: 'Ihre Idee ist eingereicht.' })).toBeVisible();

  // Ideenpool und Funnel
  await page.goto('/portfolio/ideen');
  await expect(page.getByRole('heading', { name: 'Ideenpool', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Funnel «Pre-P0»' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('ansicht')).toBe('funnel');
  await expect(page.getByRole('heading', { name: 'Ideen je Stand' })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Liste' }).click();

  // Prüfung
  await page.getByRole('button', { name: new RegExp(`^Öffnen: ${titel}`) }).or(page.getByRole('button', { name: new RegExp(titel) })).first().click();
  await expect(page.getByRole('heading', { name: 'Kriterienraster' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leitfragen zum Eintritt P0' })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Strategische Relevanz' }).getByLabel('hoch').check();
  await expectAccessible(page);
  await expectNoOverflow(page);
});
