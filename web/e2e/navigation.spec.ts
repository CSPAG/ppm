/**
 * Navigation nach Arbeitsräumen (docs/ux/informationsarchitektur.md «Navigation», I-N2 bis I-N4) in hell, dunkel und
 * 360 px: Arbeitsräume nach Recht, nur mit Tastatur bedienbar, axe ohne Befund, kein Überlauf; auf dem Telefon Leiste
 * unten mit «Mehr»; Befehlspalette mit Aktion nach Recht.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login, tabTo } from './support.ts';

const telefon = (page: Page) => page.viewportSize()!.width < 768;
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Navigation' });

test('Arbeitsräume nach Recht, mit Tastatur, barrierefrei', async ({ page }) => {
  await login(page, ANNA);
  const nav = navigation(page);
  await expect(nav.getByRole('link', { name: 'Ziele', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Ziele', exact: true })).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Nur mit der Tastatur in die Administration (Verwalten des Baukastens)
  if (telefon(page)) {
    await expect(nav.getByRole('button', { name: 'Mehr' })).toBeVisible();
  } else {
    const admin = nav.getByRole('link', { name: 'Administration' });
    await tabTo(page, admin);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/verwalten\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
    await expectNoOverflow(page);
  }
});

test('Leser:in sieht nur die Arbeitsräume mit Recht', async ({ page }) => {
  await login(page, BRUNO);
  const nav = navigation(page);
  await expect(nav.getByRole('link', { name: 'Ziele', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  // Arbeitsräume ohne Inhalt erscheinen nicht (keine leeren Seiten)
  for (const name of ['Eingang', 'Projekte', 'Portfolio', 'Gremien']) await expect(nav.getByRole('link', { name })).toHaveCount(0);
});

test('Telefon: Leiste unten mit «Mehr» als Blatt mit Konto', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, 'nur auf dem Telefon');
  await login(page, ANNA);
  const mehr = navigation(page).getByRole('button', { name: 'Mehr' });
  const box = await mehr.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await tabTo(page, mehr);
  await page.keyboard.press('Enter');
  const blatt = page.getByRole('dialog', { name: 'Mehr' });
  await expect(blatt).toBeVisible();
  await expect(blatt.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(blatt).toHaveCount(0);
  await expect(mehr).toBeFocused();
});

test('Befehlspalette: Aktion nach Recht mit der Tastatur', async ({ page }) => {
  await login(page, ANNA);
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Befehle' });
  await expect(palette).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.type('Handlungsfeld anlegen');
  await expect(palette.getByRole('option', { name: 'Handlungsfeld anlegen' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/[?&]o=neu/);
});
