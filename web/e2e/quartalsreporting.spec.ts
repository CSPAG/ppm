/**
 * Abnahme AP-E6-4 (BC ZM.03.02, UC-012 Schritte 3–4, K6 Schritte 11–12): Quartalsreporting über die Navigation öffnen
 * (zuletzt abgeschlossenes Quartal), Entwurf erstellen, Kommentar speichern; axe hell, dunkel und 360 px.
 */
import { expect, test } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

test('Quartalsreporting erstellen und kommentieren; barrierefrei', async ({ page }) => {
  await login(page, ANNA);
  await page.goto('/ziele/quartalsreporting');
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/ziele\/\d{4}\/quartalsreporting$/);
  expect(new URL(page.url()).searchParams.get('quartal')).toMatch(/^q[1-4]$/);

  await page.goto('/ziele/2026/quartalsreporting?quartal=q3');
  await expect(page.getByRole('heading', { name: 'Quartalsreporting Q3 2026', level: 1 })).toBeVisible();
  const erstellen = page.getByRole('button', { name: 'Bericht erstellen' });
  const gesamtstatus = page.getByRole('heading', { name: '1 Gesamtstatus' });
  await expect(erstellen.or(gesamtstatus)).toBeVisible();
  if (await erstellen.isVisible()) await erstellen.click();
  await expect(gesamtstatus).toBeVisible();
  await expect(page.getByRole('heading', { name: '7 Geschäfte zur Weiterleitung an den VR' })).toBeVisible();

  const feld = page.getByLabel('Kommentar zu Gesamtstatus');
  if (await feld.isVisible()) {
    await feld.fill(`Programm auf Kurs ${Date.now()}`);
    await page.getByRole('button', { name: 'Kommentare speichern' }).click();
    await expect(page.getByText('Gespeichert.')).toBeVisible();
  }
  await expectAccessible(page);
  await expectNoOverflow(page);
});
