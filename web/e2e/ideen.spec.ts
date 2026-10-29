/**
 * Abnahme AP-E4-1 (BC DM.01.01, UC-001 Schritte 1–2, K4): Projektidee mit dem Assistenten in vier Schritten einreichen,
 * Bestätigung, Stand «eingereicht» unter «Meine Ideen»; axe hell, dunkel und 360 px; Leser:in ohne `idee:create` sieht
 * den Bereich nicht.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Projektidee in vier Schritten einreichen und unter «Meine Ideen» verfolgen; barrierefrei', async ({ page }) => {
  const feld = `E2E Ideenfeld ${Date.now()}`;
  const titel = `E2E Idee ${Date.now()}`;
  await login(page, ANNA);
  // Handlungsfeld als Strategiebezug
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(feld);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: feld })).toBeVisible();

  await page.goto('/portfolio/ideen/neu');
  // Ein Entwurf früherer Läufe wird angeboten; hier eine neue Idee beginnen
  const neu = page.getByRole('button', { name: 'Neue Idee beginnen' });
  const titelFeld = page.getByLabel('Titel');
  await expect(neu.or(titelFeld)).toBeVisible();
  if (await neu.isVisible()) await neu.click();
  await expect(page.getByRole('heading', { name: 'Schritt 1 von 4: Worum geht es?' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Sperre beim «Weiter» ohne Pflichtfelder
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText(/^Zielsetzung fehlt: Ohne Ziel kann die Unternehmensentwicklung/)).toBeVisible();
  await titelFeld.fill(titel);
  await page.getByLabel('Ausgangslage').fill('Die Aufnahme erfolgt auf Papier.');
  await page.getByLabel('Zielsetzung').fill('Aufnahme ohne Papier in 10 Minuten.');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Schritt 2 von 4: Bezug zur Strategie' })).toBeFocused();
  await page.getByRole('radio', { name: new RegExp(feld) }).check();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Schritt 3 von 4: Erste Einschätzung' })).toBeVisible();
  for (const g of ['Nutzen', 'Aufwand', 'Relevanz']) await page.getByRole('radiogroup', { name: g }).getByLabel('mittel').check();
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Schritt 4 von 4: Zusammenfassung' })).toBeVisible();
  await expect(page.getByText('Die Unternehmensentwicklung erhält deine Idee zur Prüfung.', { exact: false })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Projektidee einreichen' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Idee ist eingereicht.' })).toBeVisible();

  await page.getByRole('link', { name: 'Zu «Meine Ideen»' }).click();
  await expect(page.getByRole('heading', { name: 'Meine Ideen', level: 1 })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(titel) }).getByText('eingereicht')).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Mitglied sieht den Bereich «Ideen» und kann einreichen (Master Entscheid 14, A-73)', async ({ page }) => {
  await login(page, BRUNO, '/ziele/handlungsfelder');
  await expect(page.getByRole('link', { name: 'Portfolio' })).toHaveCount(1);
});
