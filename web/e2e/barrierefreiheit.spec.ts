/** axe (WCAG 2.2 AA) hell und dunkel, Tastatur in Dialogen, nutzbar bei 390 px Breite. */
import { expect, test } from '@playwright/test';
import { createProjekt, expectAccessible, login, PEOPLE, unique, useTheme } from './helpers.ts';

for (const theme of ['light', 'dark'] as const) {
  test(`axe ${theme === 'light' ? 'hell' : 'dunkel'}: Liste, Formular, Schublade, Befehlspalette`, async ({ page }) => {
    await login(page, PEOPLE.anna);
    await useTheme(page, theme);
    await expectAccessible(page, `Liste (${theme})`);

    await page.getByRole('button', { name: 'Neues Projekt' }).click();
    const form = page.getByRole('dialog', { name: 'Neues Projekt' });
    await expect(form.getByRole('textbox', { name: /Bezeichnung/ })).toBeFocused();
    await form.getByRole('button', { name: 'Anlegen' }).click();
    await expect(form.getByText('Gib eine Bezeichnung ein.')).toBeVisible();
    await expectAccessible(page, `Formular mit Fehlern (${theme})`);
    await page.keyboard.press('Escape');
    await expect(form).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Neues Projekt' })).toBeFocused();

    const label = unique('E2E Axe');
    await createProjekt(page, label);
    await expectAccessible(page, `Schublade (${theme})`);
    await page.getByRole('dialog', { name: label }).getByRole('button', { name: 'Zugriff' }).click();
    await expect(page.getByRole('dialog', { name: new RegExp(`Zugriff.*${label}`) })).toBeVisible();
    await expectAccessible(page, `Zugriff (${theme})`);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox', { name: 'Befehl suchen' })).toBeFocused();
    await expectAccessible(page, `Befehlspalette (${theme})`);
  });
}

test('Fokus bleibt im Dialog (Tab läuft im Kreis)', async ({ page }) => {
  await login(page, PEOPLE.anna, '/projekte?neu=true');
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
  }
});

test('390 px: ohne waagrechtes Scrollen, Navigation über den Menüknopf', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, PEOPLE.anna);
  await expect(page.getByRole('heading', { level: 1, name: 'Projekte' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAccessible(page, 'Liste 390 px');

  await page.getByRole('button', { name: 'Navigation öffnen' }).click();
  const nav = page.getByRole('dialog', { name: 'Navigation' });
  await expect(nav.getByRole('link', { name: 'Projekte' })).toBeVisible();
  await page.keyboard.press('Escape');

  const label = unique('E2E Schmal');
  await createProjekt(page, label);
  const drawer = page.getByRole('dialog', { name: label });
  const box = await drawer.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  await expectAccessible(page, 'Schublade 390 px');
});
