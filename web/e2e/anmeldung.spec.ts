/** Anmeldung über Keycloak, Organisation im Kopf, Abmelden; Plattform-Administration ohne Organisation. */
import { expect, test } from '@playwright/test';
import { expectAccessible, login, PEOPLE } from './helpers.ts';

test('Anmeldung als Organisations-Admin zeigt Projekte und die Organisation', async ({ page }) => {
  await login(page, PEOPLE.anna);
  await expect(page).toHaveURL(/\/projekte/);
  await expect(page.getByRole('heading', { level: 1, name: 'Projekte' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Projekte' })).toHaveAttribute('aria-current', 'page');
  // Verwalten › Mitglieder für org-admin
  await page.getByRole('link', { name: 'Mitglieder' }).click();
  await expect(page).toHaveURL(/\/verwalten\/mitglieder/);
  await expectAccessible(page, 'Mitglieder');
});

test('Abmelden führt auf die öffentliche Seite', async ({ page }) => {
  await login(page, PEOPLE.anna);
  await page.getByRole('button', { name: /Anna/ }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/abgemeldet/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessible(page, 'Abgemeldet');
});

test('Betrieb ohne Organisation erreicht die Plattform-Administration', async ({ page }) => {
  await login(page, PEOPLE.betrieb, '/verwalten/organisationen');
  await expect(page.getByRole('heading', { name: 'Organisationen' }).first()).toBeVisible();
  await expect(page.getByText('demo').first()).toBeVisible();
  await expectAccessible(page, 'Organisationen');
});
