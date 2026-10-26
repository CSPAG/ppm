/** Projekt anlegen, bearbeiten, Konflikt (412) aus zwei Sitzungen, löschen; Leser:in ohne Schreibknöpfe. */
import { expect, test } from '@playwright/test';
import { createProjekt, expectAccessible, loggedIn, login, PEOPLE, unique } from './helpers.ts';

test('anlegen, bearbeiten und löschen', async ({ page }) => {
  await login(page, PEOPLE.anna);
  const label = unique('E2E Projekt');
  await createProjekt(page, label, { beginn: '2026-01-01', ende: '2026-06-30' });
  const drawer = page.getByRole('dialog', { name: label });
  await expect(drawer.getByText('01.01.2026 – 30.06.2027')).toHaveCount(0);
  await expect(drawer.getByText('01.01.2026 – 30.06.2026')).toBeVisible();
  await expectAccessible(page, 'Schublade');

  // Formularfehler wie die API: Ende vor Beginn
  await drawer.getByRole('button', { name: 'Bearbeiten' }).click();
  await drawer.getByLabel('Ende', { exact: true }).fill('2025-12-31');
  await drawer.getByRole('button', { name: 'Speichern' }).click();
  await expect(drawer.getByText('Das Ende liegt vor dem Beginn.')).toBeVisible();
  await expect(drawer.getByLabel('Ende', { exact: true })).toBeFocused();

  await drawer.getByLabel('Ende', { exact: true }).fill('2026-12-31');
  await drawer.getByRole('textbox', { name: /Bezeichnung/ }).fill(`${label} geändert`);
  await drawer.getByRole('button', { name: 'Speichern' }).click();
  const changed = page.getByRole('dialog', { name: `${label} geändert` });
  await expect(changed.getByText('01.01.2026 – 31.12.2026')).toBeVisible();

  // Verlauf
  await changed.getByRole('button', { name: /Verlauf/ }).click();
  await expect(changed.getByText('Fassung 2')).toBeVisible();

  // Löschen mit Rückfrage
  await changed.getByRole('button', { name: 'Löschen' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Projekt löschen?' });
  await expect(confirm.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Projekte durchsuchen' }).fill(label);
  await expect(page.getByRole('heading', { name: 'Keine Treffer' })).toBeVisible();
});

test('Konflikt: jemand hat das Projekt inzwischen geändert (412)', async ({ page, browser }) => {
  await login(page, PEOPLE.anna);
  const label = unique('E2E Konflikt');
  const id = await createProjekt(page, label);
  const drawer = page.getByRole('dialog', { name: label });
  await drawer.getByRole('button', { name: 'Bearbeiten' }).click();
  await drawer.getByRole('textbox', { name: 'Beschreibung' }).fill('Meine Änderung');

  // Zweite Sitzung speichert zuerst
  const other = await loggedIn(browser, PEOPLE.anna, `/projekte?o=${id}`);
  const otherDrawer = other.getByRole('dialog', { name: label });
  await otherDrawer.getByRole('button', { name: 'Bearbeiten' }).click();
  await otherDrawer.getByRole('textbox', { name: 'Beschreibung' }).fill('Schneller');
  await otherDrawer.getByRole('button', { name: 'Speichern' }).click();
  await expect(otherDrawer.getByText('Schneller')).toBeVisible();
  await other.context().close();

  await drawer.getByRole('button', { name: 'Speichern' }).click();
  await expect(drawer.getByText('Jemand hat das Projekt inzwischen geändert.')).toBeVisible();
  await expectAccessible(page, 'Konflikt');
  await drawer.getByRole('button', { name: 'Neu laden' }).click();
  await expect(drawer.getByRole('textbox', { name: 'Beschreibung' })).toHaveValue('Schneller');
});

test('Leser:in sieht Projekte, aber keine Schreibknöpfe', async ({ page, browser }) => {
  const admin = await loggedIn(browser, PEOPLE.anna);
  const label = unique('E2E Lesen');
  const id = await createProjekt(admin, label);
  await admin.context().close();

  await login(page, PEOPLE.bruno, `/projekte?o=${id}`);
  const drawer = page.getByRole('dialog', { name: label });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Neues Projekt' })).toHaveCount(0);
});
