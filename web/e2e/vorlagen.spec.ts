/**
 * Abnahme AP-E7-7 (AM.03.01; UC-018 Schritte 1–2; UI-48): Vorlagen öffnen, Word-Vorlage «Projektvertrag» hochladen,
 * Platzhalter zuordnen, Prüfbericht, aktiv setzen mit Wirkung vorher; axe hell, dunkel und 360 px. Leser:in sieht die
 * Administration › Vorlagen nicht.
 */
import { expect, test } from '@playwright/test';
import { wordVorlage } from '../../test/app/fixtures/word.ts';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Vorlage hochladen, zuordnen und aktiv setzen; barrierefrei', async ({ page }) => {
  await login(page, ANNA, '/administration/vorlagen');
  await expect(page.getByRole('heading', { name: 'Vorlagen', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vorstudie öffnen' })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.getByRole('button', { name: 'Projektvertrag öffnen' }).click();
  const drawer = page.getByRole('dialog', { name: 'Projektvertrag' });
  await expect(drawer.getByRole('button', { name: 'Neue Version hochladen' })).toBeVisible();
  // Platzhalter über zwei Läufe; «Freitext» ist kein bekanntes Feld
  const datei = wordVorlage([['Vertrag «Projekt', 'name»'], ['«Freitext»']], 'Intern · enthält Personendaten');
  await drawer.locator('input[type=file]').setInputFiles({ name: `Vertrag ${Date.now()}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: datei });

  const version = page.getByRole('dialog', { name: /^Projektvertrag · Version \d+$/ });
  await expect(version.getByText(/Zuordnung fehlt: 1 von 2/)).toBeVisible();
  await expect(version.getByRole('button', { name: 'Aktiv setzen' })).toBeDisabled();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await version.getByLabel('«Freitext»').selectOption({ label: 'Ausgangslage' });
  await version.getByRole('button', { name: 'Zuordnung speichern' }).click();
  await expect(page.getByText('Zuordnung gespeichert.')).toBeVisible();
  await version.getByRole('button', { name: 'Aktiv setzen' }).click();
  const frage = page.getByRole('dialog', { name: /aktiv setzen\?$/ });
  await expect(frage.getByText(/Ab sofort erzeugen alle Word-Ausgaben «Projektvertrag» diese Vorlage/)).toBeVisible();
  await frage.getByRole('button', { name: 'Aktiv setzen' }).click();
  await expect(page.getByText(/ist aktiv\.$/)).toBeVisible();
  await expect(version.getByText(/lassen sich nicht mehr ändern/)).toBeVisible();
});

test('Leser:in sieht die Vorlagen nicht in der Navigation (I-N2)', async ({ page }) => {
  await login(page, BRUNO, '/ziele/strategische-ziele');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vorlagen' })).toHaveCount(0);
});
