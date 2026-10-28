/**
 * Rollen der Organisation (UC-016 A2, AM.01.02; Seite «Rollen» des Baukastens ab iam 5.0): erreichbar für die
 * Administration in «Administration» nach «Benutzer und Rollen», axe ohne Befund, kein Überlauf (hell, dunkel,
 * 360 px); Leser:in hat keinen Zugang. Angelegt wird hier nicht: die Organisation der E2E-Tests teilen sich alle Läufe.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

const telefon = (page: Page) => page.viewportSize()!.width < 768;

test('Seite «Rollen» in der Administration, barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/verwalten/rollen');
  await expect(page.getByRole('heading', { name: 'Rollen', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  if (!telefon(page)) {
    // Reihenfolge der Bereiche: «Benutzer und Rollen» vor «Rollen» (IA «Verwalten des Baukastens»)
    const nav = page.getByRole('navigation', { name: 'Navigation' });
    const links = await nav.getByRole('link').allTextContents();
    const i = links.findIndex(t => t.trim() === 'Benutzer und Rollen');
    const j = links.findIndex(t => t.trim() === 'Rollen');
    expect(i, links.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(j).toBe(i + 1);
  }
});

test('Leser:in sieht die Seite «Rollen» nicht', async ({ page }) => {
  await login(page, BRUNO, '/verwalten/rollen');
  await expect(page.getByRole('heading', { name: 'Rollen', level: 1 })).toHaveCount(0);
});
