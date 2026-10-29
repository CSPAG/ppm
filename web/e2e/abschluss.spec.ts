/**
 * Projektabschluss (UI-14 Projektakte › Abschluss, UI-32 Portfolio › Auswertungen › Lessons Learned; UC-015 Schritte
 * 1–5; PS.04.01–03; AP-E7-1) in hell, dunkel und 360 px: Max ist in «muster» Projektauftraggeber:in und Projektleitung eines
 * Projekts in P4 (über die API, daten.ts). Pflichtangaben im Seitenpanel, automatisches Speichern, Nutzenbeurteilung der
 * Projektauftraggeber:in, Lesson Learned, Einreichen mit Wirkung; danach ist der Bericht gesperrt und die Lesson steht in der
 * Auswertung des Portfolios. axe ohne Befund, kein Überlauf.
 */
import { expect, test } from '@playwright/test';
import { apiAls, projekt } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

test('Abschlussbericht erfassen, Nutzen beurteilen, Lesson Learned, einreichen (UC-015)', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const kennung = Date.now().toString(36);
  const p = await projekt(await apiAls(page), `Abschluss E2E ${kennung}`, 'P4');

  await page.goto(`/projekte/${p.nummer}/abschluss`);
  await expect(page.getByRole('heading', { name: 'Abschlussbericht' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abschluss' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Noch keine Baseline des Projektvertrags')).toBeVisible();
  await expect(page.getByText('3 Angaben fehlen')).toBeVisible();
  await expectAccessible(page);

  // Sprung aus dem Seitenpanel zum fehlenden Feld (I-P4), danach automatisch gespeichert
  await page.getByRole('complementary').getByRole('button', { name: /Zielerreichung/ }).click();
  const ziel = page.getByRole('textbox', { name: /^Zielerreichung/ });
  await expect(ziel).toBeFocused();
  await ziel.fill('Alle Ziele erreicht, Nutzen ab dem zweiten Quartal messbar');
  await page.getByRole('textbox', { name: /^Business Case Abschluss/ }).fill('Kosten 4 % unter Budget');
  await page.getByRole('textbox', { name: /^Übergabe an Betrieb und Linie/ }).fill('Betrieb übernimmt ab 1. Januar');
  await expect(page.getByText('Alle Pflichtangaben sind erfasst.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Gespeichert$/ })).toBeVisible();

  // Nutzenrealisierung: Beurteilung der Projektauftraggeber:in (PC.03.02)
  await page.getByRole('textbox', { name: /^Beurteilung Projektauftraggeber:in/ }).fill('Nutzen stabil erreicht');
  await page.getByRole('button', { name: 'Beurteilung speichern' }).first().click();
  await expect(page.getByText('Beurteilung gespeichert.')).toBeVisible();

  // Lesson Learned (PS.04.03)
  const erkenntnis = `Früh mit dem Betrieb planen ${kennung}`;
  await page.getByRole('textbox', { name: /^Erkenntnis/ }).fill(erkenntnis);
  await page.getByRole('button', { name: 'Lesson Learned erfassen' }).click();
  await expect(page.getByText('Lesson Learned erfasst.')).toBeVisible();
  await expect(page.getByText(erkenntnis)).toBeVisible();
  await expectAccessible(page);

  // Einreichen mit Wirkung (I-R1 Stufe 3)
  await page.getByRole('button', { name: 'Bericht einreichen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bericht einreichen?' });
  await expect(dialog.getByText('Mit dem Einreichen wird das Exit-Gate P4 dem Gremium vorgeschlagen', { exact: false })).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Bericht einreichen' }).click();
  await expect(page.getByText(/^Bericht eingereicht/).first()).toBeVisible();
  await expect(ziel).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Zielerreichung/ })).toBeDisabled();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);

  // Portfolio › Auswertungen › Lessons Learned mit Suche in der Adresse (I-N5) und Schublade
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/portfolio/auswertungen/lessons-learned?q=${encodeURIComponent(kennung)}`);
  await expect(page.getByRole('heading', { name: 'Lessons Learned', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(erkenntnis) }).click();
  const schublade = page.getByRole('dialog', { name: 'Lesson Learned' });
  await expect(schublade.getByRole('button', { name: `${p.nummer} ${p.name}` })).toBeVisible();
  await expect(schublade.getByRole('button', { name: 'Bearbeiten' })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(schublade).toBeHidden();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});
