/**
 * Abnahme AP-E0-9 (BC ZM.01.02, UC-011 Schritt 2): strategisches Ziel unter einem Handlungsfeld anlegen, ändern, Verlauf
 * mit früherem Stand, löschen; Adresse mit der Nummer (`?o=ziel:2.1`, I-N5); axe hell, dunkel und 360 px; Leser:in ändert nicht.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Eindeutige Nummer je Lauf (Projekte hell, dunkel, schmal laufen gegen dieselbe Datenbank). */
const nummer = () => `${100 + Math.floor(Math.random() * 900)}.${Math.floor(Math.random() * 1000)}`;

test('Ziel anlegen, ändern, Verlauf mit früherem Stand, löschen; barrierefrei', async ({ page }) => {
  const feld = `E2E Feld ${Date.now()}`;
  const nr = nummer();
  await login(page, ANNA);
  // Handlungsfeld als Bezug
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(feld);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: feld })).toBeVisible();

  await page.goto('/ziele/strategische-ziele');
  await expect(page.getByRole('heading', { name: 'Strategische Ziele', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('button', { name: 'Neues strategisches Ziel' }).click();
  await page.getByLabel('Handlungsfeld').selectOption({ label: feld });
  await page.getByLabel('Nummer').fill(nr);
  await page.getByLabel('Ziel', { exact: true }).fill('Zugang zur Versorgung verbessern');
  await expect(page.getByLabel('Horizont')).toHaveValue('2030');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Speichern' }).click();

  // Schublade über die Nummer, ohne Metrik ein Hinweis
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}`);
  const drawer = page.getByRole('dialog', { name: `${nr} Strategisches Ziel` });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/noch keine Metrik/)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await drawer.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Metrik').fill('Wartezeit in Tagen');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Änderungen gespeichert.')).toBeVisible();
  // Verlauf: Fassung 2 mit dem früheren Stand
  await expect(drawer.getByText('Fassung 2')).toBeVisible();
  await expect(drawer.getByText(/Metrik: Wartezeit in Tagen/)).toBeVisible();

  await drawer.getByRole('button', { name: 'Löschen' }).click();
  await page.getByRole('dialog', { name: 'Löschen' }).getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Strategisches Ziel gelöscht.')).toBeVisible();
});

test('Leser:in sieht die strategischen Ziele, ändert aber nichts', async ({ page }) => {
  await login(page, BRUNO, '/ziele/strategische-ziele');
  await expect(page.getByRole('heading', { name: 'Strategische Ziele', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Neues strategisches Ziel' })).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);
});
