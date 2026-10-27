/** Abnahme: Anmeldung, Handlungsfeld anlegen, ändern mit 412, löschen; zweite Organisation sieht nichts; Leser:in ändert nicht. */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

test('Anmeldung und leere oder gefüllte Liste, barrierefrei', async ({ page }) => {
  await login(page, ANNA);
  await expect(page.getByRole('heading', { name: 'Handlungsfelder', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Handlungsfeld anlegen, ändern mit Konflikt (412), löschen', async ({ page, browser }) => {
  const label = `E2E ${Date.now()}`;
  await login(page, ANNA);
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(label);
  await page.getByLabel('Leitsatz').fill('Ein Leitsatz für den Test.');
  await page.getByLabel('Stossrichtungen').fill('Erste Stossrichtung\nZweite Stossrichtung');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const drawer = page.getByRole('dialog', { name: label });
  await expect(drawer).toBeVisible();
  await expectAccessible(page);

  // Zweiter Tab ändert dasselbe Handlungsfeld zuerst
  const other = await (await browser.newContext({ storageState: await page.context().storageState() })).newPage();
  await other.goto(page.url());
  await other.getByRole('button', { name: 'Bearbeiten' }).click();
  await other.getByLabel('Bezeichnung').fill(`${label} (B)`);
  await other.getByRole('button', { name: 'Speichern' }).click();
  await expect(other.getByText('Änderungen gespeichert.')).toBeVisible();

  await drawer.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Bezeichnung').fill(`${label} (A)`);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/inzwischen geändert/)).toBeVisible();
  await page.getByRole('button', { name: 'Neu laden' }).click();
  await expect(page.getByLabel('Bezeichnung')).toHaveValue(`${label} (B)`);
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await page.getByRole('dialog', { name: 'Löschen' }).getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Handlungsfeld gelöscht.')).toBeVisible();
});

test('zweite Organisation sieht das Handlungsfeld nicht', async ({ page, browser }) => {
  const label = `Nur Demo ${Date.now()}`;
  await login(page, ANNA);
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(label);
  await page.getByRole('button', { name: 'Speichern' }).click();
  const id = new URL(page.url()).searchParams.get('o');
  expect(id).toMatch(/^[0-9a-f-]{36}$/);

  const b = await (await browser.newContext()).newPage();
  await login(b, MAX);
  await b.getByRole('searchbox').fill(label);
  await expect(b.getByText(/Kein Handlungsfeld passt/)).toBeVisible();
  // Direkter Zugriff über die ID: nicht gefunden (404), nie «kein Recht» mit Inhalt
  await b.goto(`/ziele/handlungsfelder?o=${id}`);
  await expect(b.getByText(/gibt es nicht mehr, oder Sie sehen es nicht/)).toBeVisible();
  const res = await b.request.get(`/v1/handlungsfelder/${id}`);
  expect(res.status()).toBe(404);
});

test('Leser:in sieht die Handlungsfelder, ändert aber nichts', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('heading', { name: 'Handlungsfelder', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Neues Handlungsfeld' })).toHaveCount(0);
  await expectAccessible(page);
});
