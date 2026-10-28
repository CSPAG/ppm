/**
 * Statusbericht: Warnung «wesentliche Abweichung» mit «Änderung beantragen» (UI-13 → UI-09; Kernablauf K1 Schritt 2;
 * UC-004 A1 → UC-007 Schritt 1) in hell, dunkel und 360 px: Max ist in «muster» Projektleitung eines Projekts mit
 * Baseline und einem Meilenstein in 30 Tagen (daten.ts, Termin-Toleranz 14 Tage). Ein neuer Termin acht Wochen später
 * löst die Warnung aus; der Link öffnet den Vertrag mit dem Dialog des Änderungsantrags, der Bericht bleibt als Entwurf.
 */
import { expect, test } from '@playwright/test';
import { inTagen, projektMitBaseline } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

const PERIODE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

test('Wesentliche Terminabweichung: «Änderung beantragen» öffnet den Antrag (UC-004 A1)', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const p = await projektMitBaseline(page, `Abweichung E2E ${Date.now()}`, { meilenstein: 'Pilotbetrieb', meilensteinInTagen: 30 });

  await page.goto(`/projekte/${p.nummer}/bericht?periode=${PERIODE}`);
  await expect(page.getByRole('heading', { name: /^Statusbericht / })).toBeVisible();
  const termin = page.getByLabel('Neuer Termin für Pilotbetrieb');
  await termin.fill(inTagen(86));
  // Tab wechselt im Datumsfeld nur das Segment; gespeichert wird beim Verlassen des Felds
  await termin.blur();
  const warnung = page.locator('.sb-zeile-w').filter({ hasText: 'Wesentliche Abweichungen sind im Projektvertrag nachzuführen.' });
  await expect(warnung).toBeVisible();
  await expect(warnung).toContainText('Pilotbetrieb neu');
  const beantragen = warnung.getByRole('link', { name: 'Änderung beantragen' });
  await expect(beantragen).toHaveAttribute('href', `/projekte/${p.nummer}/vertrag?aenderung=1`);
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'light' });

  await beantragen.click();
  await expect(page).toHaveURL(new RegExp(`/projekte/${p.nummer}/vertrag`));
  const dialog = page.getByRole('dialog', { name: 'Änderung am Projektvertrag beantragen?' });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  // Abbrechen schliesst den Dialog und räumt die Adresse auf; der Bericht bleibt als Entwurf mit dem neuen Termin
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/aenderung=1/);
  await page.goto(`/projekte/${p.nummer}/bericht?periode=${PERIODE}`);
  await expect(page.getByLabel('Neuer Termin für Pilotbetrieb')).toHaveValue(inTagen(86));
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('.sb-zeile-w').getByRole('link', { name: 'Änderung beantragen' })).toBeVisible();
  await expectNoOverflow(page);
  await expectAccessible(page);
});
