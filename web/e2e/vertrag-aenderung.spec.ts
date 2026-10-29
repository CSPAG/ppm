/**
 * Änderungsantrag am Projektvertrag (UI-09, UI-10, UI-11; Kernablauf K2 Schritte 1, 5, 6, 9; UC-007; AP-E3-4) in hell,
 * dunkel und 360 px: Max ist in «muster» Projektauftraggeber:in und Projektleitung eines Projekts mit Baseline (über die API,
 * daten.ts). Änderung beantragen mit Begründung, Kapitel anpassen, Änderung einreichen, als Projektauftraggeber:in freigeben; danach
 * ist die neue Version Baseline und der Vergleich zeigt die Änderung. axe ohne Befund, kein Überlauf.
 */
import { expect, test } from '@playwright/test';
import { projektMitBaseline } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

test('Änderung beantragen, einreichen und als Projektauftraggeber:in freigeben (UC-007 Schritte 1–4)', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const p = await projektMitBaseline(page, `Änderung E2E ${Date.now()}`, { meilenstein: 'Pilot', meilensteinInTagen: 60 });

  await page.goto(`/projekte/${p.nummer}/vertrag`);
  await page.getByRole('button', { name: 'Änderung beantragen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Änderung am Projektvertrag beantragen?' });
  await expect(dialog.getByText('Es entsteht ein Entwurf aus der Baseline.', { exact: false })).toBeVisible();
  await expectAccessible(page);
  await dialog.getByLabel('Begründung').fill('Annahmen zum Pilot haben sich geändert');
  await dialog.getByRole('button', { name: 'Entwurf anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Änderungsantrag' })).toBeVisible();
  await expect(page.getByText('Annahmen zum Pilot haben sich geändert')).toBeVisible();

  // Kapitel 4 anpassen (automatisch gespeichert)
  await page.goto(`/projekte/${p.nummer}/vertrag?kapitel=4&version=entwurf`);
  const annahmen = page.getByRole('textbox', { name: /^Annahmen/ });
  await annahmen.fill('Pilot erst nach dem Umbau der Station');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'Annahmen ergänzt' })).toBeVisible();
  await page.reload();
  await expect(annahmen).toHaveValue('Pilot erst nach dem Umbau der Station');
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Änderung einreichen' }).click();
  const einreichen = page.getByRole('dialog', { name: /^Änderung \(Version .+\) einreichen\?$/ });
  await expect(einreichen.getByText('Die Projektauftraggeber:in erhält die Änderung zum Entscheid.', { exact: false })).toBeVisible();
  await einreichen.getByRole('button', { name: 'Änderung einreichen' }).click();
  await expect(page.getByText('Eingereicht. Die Projektauftraggeber:in entscheidet die Änderung.')).toBeVisible();

  // Entscheid der Projektauftraggeber:in (Ziel der Aufgabe `aenderung.entscheiden`)
  await page.goto(`/projekte/${p.nummer}/vertrag/aenderung`);
  await expect(page.getByRole('heading', { name: 'Änderung am Projektvertrag entscheiden' })).toBeVisible();
  await expect(page.getByText('Annahmen zum Pilot haben sich geändert')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Änderung freigeben' }).click();
  await expect(page.getByText(/^Freigegeben\. Version \S+ ist Baseline\.$/)).toBeVisible();

  // Versionen: Vergleich der beiden Baselines zeigt die Annahmen als «neu» (UI-11)
  await page.goto(`/projekte/${p.nummer}/versionen`);
  await expect(page.getByRole('heading', { name: 'Versionen' })).toBeVisible();
  await expect(page.getByText('Pilot erst nach dem Umbau der Station')).toBeVisible();
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});
