/**
 * Exit-Gate P4 in der Sitzung (UC-015 Schritte 5–6, K3 Durchführen; AP-E7-1) und Korrektur in der offenen Sitzung
 * (A-30, #147) in hell, dunkel und 360 px: Max ist in «muster» Sponsor, Projektleitung und CTL eines Projekts in P4 mit
 * entscheidendem Gremium (daten.ts). Abschlussbericht einreichen → Traktandum beim Gremium; Sitzung mit dem Traktandum
 * über die API versendet; im Sitzungsmodus «Abgeschlossen» → Projekt nur noch lesbar; Korrektur auf «Nacharbeiten
 * verlangt» → Projekt wieder aktiv, Bericht wieder bearbeitbar. axe ohne Befund, kein Überlauf.
 */
import { expect, test, type Page } from '@playwright/test';
import { apiAls, gremium, mittwochIn, projekt, sitzungVersendet } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

/** Im Sitzungsmodus zum Traktandum 2 (1 ist der Bericht der Programmleitung) und den Entscheid erfassen bzw. korrigieren. */
async function entscheiden(page: Page, ergebnis: string, begruendung: string) {
  // erst wenn die Seite steht, reagiert sie auf die Tastatur
  await expect(page.getByRole('heading', { level: 2, name: /^1\. Bericht der Programmleitung/ })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /^2\. / })).toBeVisible();
  await page.keyboard.press('e');
  await page.getByRole('radio', { name: ergebnis }).check();
  await page.getByLabel('Begründung').fill(begruendung);
}

test('Exit-Gate in der Sitzung: «Abgeschlossen» macht das Projekt lesend, Korrektur öffnet es wieder (UC-015, A-30)', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const a = await apiAls(page);
  const p = await projekt(a, `Exit-Gate E2E ${Date.now().toString(36)}`, 'P4');
  const datum = mittwochIn(14);
  const g = await gremium(a, p.portfolioId, [datum]);

  // Abschlussbericht erfassen und einreichen: das Exit-Gate geht als Traktandum an das Gremium
  await page.goto(`/projekte/${p.nummer}/abschluss`);
  await page.getByRole('textbox', { name: /^Zielerreichung/ }).fill('Alle Ziele erreicht');
  await page.getByRole('textbox', { name: /^Business Case Abschluss/ }).fill('Im Budget');
  await page.getByRole('textbox', { name: /^Übergabe an Betrieb und Linie/ }).fill('Betrieb ab 1. Januar');
  await expect(page.getByText('Alle Pflichtangaben sind erfasst.')).toBeVisible();
  await page.getByRole('button', { name: 'Bericht einreichen' }).click();
  await page.getByRole('dialog', { name: 'Bericht einreichen?' }).getByRole('button', { name: 'Bericht einreichen' }).click();
  await expect(page.getByText('Bericht eingereicht; das Exit-Gate ist dem Gremium vorgeschlagen.')).toBeVisible();
  await expect(page.getByText('Der Abschlussbericht liegt beim Gremium (Exit-Gate P4).', { exact: false })).toBeVisible();

  // Sitzung mit dem Traktandum versendet (K3 Vorbereiten, über die API), im Sitzungsmodus starten und entscheiden
  await sitzungVersendet(a, g, datum, 'abschluss');
  await page.goto(`/gremien/${g.kuerzel}/sitzungen/${datum}/modus`);
  await page.getByRole('button', { name: 'Sitzung starten' }).click();
  await expect(page.getByText('Sitzung gestartet.')).toBeVisible();
  await entscheiden(page, 'Abgeschlossen', 'Ziele erreicht, Übergabe geregelt');
  await page.getByRole('button', { name: 'Entscheid erfassen' }).click();
  await expect(page.getByText('Entscheid erfasst: Abgeschlossen.').first()).toBeVisible();
  await expectAccessible(page);

  // Endzustand: Projektakte nur noch lesbar, Lessons Learned weiter möglich
  await page.goto(`/projekte/${p.nummer}/abschluss`);
  await expect(page.getByText(/Das Projekt ist seit .* formell abgeschlossen\./)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Zielerreichung/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bericht einreichen' })).toHaveCount(0);
  await expect(page.getByText('Letzter Entscheid des Gremiums: Abgeschlossen', { exact: false })).toBeVisible();
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'light' });

  // Korrektur in der offenen Sitzung (A-30): «Nacharbeiten verlangt» nimmt den Endzustand zurück
  await page.goto(`/gremien/${g.kuerzel}/sitzungen/${datum}/modus`);
  await entscheiden(page, 'Nacharbeiten verlangt', 'Übergabe an die Linie fehlt noch');
  await page.getByRole('button', { name: 'Entscheid korrigieren' }).click();
  await expect(page.getByText('Entscheid korrigiert: Nacharbeiten verlangt.').first()).toBeVisible();

  await page.goto(`/projekte/${p.nummer}/abschluss`);
  await expect(page.getByText('Das Gremium verlangt Nacharbeiten.', { exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Zielerreichung/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Bericht einreichen' })).toBeVisible();
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});
