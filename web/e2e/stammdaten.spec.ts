/**
 * Abnahme UI-44, UI-45 (UC-017 Schritte 1–2): Organisationseinheit anlegen und deaktivieren, Feiertag erfassen,
 * Vorgabe der Codetabellen laden und einen Wert deaktivieren; axe ohne Befund, kein Überlauf (hell, dunkel, 360 px);
 * Leser:in sieht die Administration nicht.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Organisationseinheit anlegen und deaktivieren, barrierefrei', async ({ page }, info) => {
  const kuerzel = `E${info.project.name.slice(0, 1)}${Date.now() % 1e9}`;
  await login(page, ANNA, '/administration/organisation');
  await expect(page.getByRole('heading', { name: 'Organisation', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('button', { name: 'Neue Einheit' }).first().click();
  await page.getByLabel('Kürzel', { exact: true }).fill(kuerzel);
  await page.getByLabel('Name', { exact: true }).fill(`Direktion ${kuerzel}`);
  await page.getByRole('button', { name: 'Speichern' }).click();
  const drawer = page.getByRole('dialog', { name: `${kuerzel} · Direktion ${kuerzel}` });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/[?&]o=[0-9a-f-]{36}/);
  await expectAccessible(page);

  await drawer.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Aktiv', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Änderungen gespeichert.')).toBeVisible();
  await page.keyboard.press('Escape');
  // Nur aktive (Vorgabe): die deaktivierte Einheit verschwindet aus der Liste
  await page.getByRole('searchbox').fill(kuerzel);
  await expect(page.getByText('Keine Einheit passt zur Suche.')).toBeVisible();
});

// Die Projekte (hell, dunkel, schmal) laufen parallel auf derselben Datenbank: jeder Lauf mit eigenen Daten
const lauf = (projekt: string) => `${projekt.slice(0, 1)}${Date.now() % 1e7}`;
const JAHR: Record<string, number> = { hell: 2091, dunkel: 2092, schmal: 2093 };

test('Feiertag erfassen', async ({ page }, info) => {
  const jahr = JAHR[info.project.name] ?? 2094;
  await login(page, ANNA, `/administration/organisation?ansicht=feiertage&jahr=${jahr}`);
  await page.getByRole('button', { name: 'Neuer Feiertag' }).first().click();
  // Tag aus der Zeit des Laufs, damit ein zweiter Lauf auf derselben Datenbank (Wiederholung in CI) nicht kollidiert
  const tag = `${jahr}-${String(1 + (Date.now() % 12)).padStart(2, '0')}-${String(1 + (Date.now() % 28)).padStart(2, '0')}`;
  await page.getByLabel('Datum').fill(tag);
  await page.getByLabel('Bezeichnung').fill(`Feiertag ${lauf(info.project.name)}`);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Feiertag erfasst.')).toBeVisible();
  await expectAccessible(page);
});

test('Codetabellen: Vorgabe laden, Wert hinzufügen, deaktivieren und rückgängig machen', async ({ page }, info) => {
  const schluessel = `e2e_${lauf(info.project.name)}`;
  await login(page, ANNA, '/administration/codetabellen');
  await expect(page.getByRole('heading', { name: 'Codetabellen', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Vorgabe laden' }).first().click();
  await expect(page.getByText(/Werte angelegt|bereits vollständig geladen/)).toBeVisible();
  await page.getByRole('button', { name: 'Trend', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Trend' }).getByText('gleichbleibend')).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('dialog', { name: 'Trend' }).getByRole('button', { name: 'Wert hinzufügen' }).click();
  await page.getByLabel('Text', { exact: true }).fill(`Wert ${schluessel}`);
  await page.getByLabel('Schlüssel').fill(schluessel);
  await page.getByLabel('Reihenfolge').fill('900');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Wert hinzugefügt.')).toBeVisible();
  const drawer = page.getByRole('dialog', { name: 'Trend' });
  await drawer.getByRole('button', { name: `Deaktivieren: Wert ${schluessel}` }).click();
  await expect(page.getByText(`«Wert ${schluessel}» deaktiviert.`)).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(drawer.getByRole('button', { name: `Deaktivieren: Wert ${schluessel}` })).toBeVisible();
});

test('Leser:in sieht Organisation und Codetabellen nicht in der Navigation', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
});
