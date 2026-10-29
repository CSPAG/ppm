/**
 * Eingang (UI-01, UX-E3) und Profil mit Stellvertretung (UI-43, UC-016 Schritt 4) in hell, dunkel und 360 px, der
 * Eingang zusätzlich bei 768 und 1440 px (Leiste links, Kopfkarten; IA «Navigation»):
 * Startseite nach der Anmeldung, «Zu tun» und Mitteilungen, Stellvertretung erfassen und beenden nur mit der Tastatur,
 * axe ohne Befund, kein Überlauf.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Startseite ist der Eingang mit «Zu tun» und Mitteilungen', async ({ page }) => {
  await login(page, ANNA, '/');
  await expect(page).toHaveURL(/\/eingang/);
  await expect(page.getByRole('heading', { level: 1, name: 'Eingang' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zu tun' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mitteilungen' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Nur mit Frist' }).click();
  await expect(page).toHaveURL(/filter=frist/);
});

test('Eingang bei 768 und 1440 px: Leiste links statt unten, Kopfkarten, axe ohne Befund, kein Überlauf', async ({ page }, info) => {
  test.skip(info.project.name !== 'hell', 'Breiten der UX-DoD im Projekt «hell»; 360 px misst «schmal»');
  await login(page, ANNA, '/eingang');
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { level: 1, name: 'Eingang' })).toBeVisible();
    // ab 768 px die Leiste links, die Leiste unten nur auf dem Telefon (I-N3)
    await expect(page.locator('nav.rail')).toBeVisible();
    await expect(page.locator('nav.bnav')).toBeHidden();
    await expect(page.getByRole('link', { name: /^Eingang/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Zu tun' })).toBeVisible();
    await expectAccessible(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `kein Überlauf bei ${width} px` }).toBeLessThanOrEqual(width);
  }
});

test('Stellvertretung erfassen und beenden; die Vertretung erhält eine Mitteilung', async ({ page, browser }) => {
  // Bruno meldet sich zuerst an: erst dann steht er im Personenverzeichnis
  const ctx = await browser.newContext();
  const bruno = await ctx.newPage();
  await login(bruno, BRUNO, '/eingang');
  await login(page, ANNA, '/konto/stellvertretung');
  await expect(page.getByRole('heading', { level: 1, name: 'Profil und Stellvertretung' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Stellvertretung erfassen' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Stellvertretung erfassen' });
  await dlg.getByRole('searchbox', { name: 'Vertretung' }).fill('Bruno');
  await dlg.getByRole('button', { name: /Bruno/ }).first().click();
  const bis = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await dlg.getByLabel('Bis', { exact: true }).fill(bis);
  await expect(dlg.getByText(/Wirkung:/)).toBeVisible();
  await expectAccessible(page);
  await dlg.getByRole('button', { name: 'Stellvertretung erfassen' }).click();
  await expect(page.getByText('Stellvertretung erfasst.')).toBeVisible();
  await expect(page.getByText(/vertritt dich/).first()).toBeVisible();

  // Bruno sieht die Mitteilung im Eingang
  await bruno.reload();
  await expect(bruno.getByText(/hat dich als Stellvertretung erfasst/).first()).toBeVisible();
  await ctx.close();

  await page.getByRole('button', { name: /^Stellvertretung durch .* beenden$/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Beenden' }).click();
  await expect(page.getByText('Stellvertretung beendet.')).toBeVisible();
});
