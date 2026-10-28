/**
 * Statusbericht: Warnung «wesentliche Abweichung» mit «Eskalieren» (UI-13; Kernablauf K1 Schritt 2 und Regeln; UC-004
 * A1.2; #136) in hell, dunkel und 360 px: Max ist in «muster» Projektleitung eines Projekts mit Baseline und einem
 * Meilenstein in 30 Tagen (daten.ts, Termin-Toleranz 14 Tage). Ein neuer Termin acht Wochen später löst die Warnung aus;
 * «Eskalieren» zeigt die Wirkung vor dem Auslösen, danach steht an der Warnung «Eskaliert am …», der Bericht bleibt
 * Entwurf, und die Eskalation erscheint als Traktandenvorschlag in der nächsten Sitzung des Gremiums (K3 Schritt 1).
 */
import { expect, test } from '@playwright/test';
import { apiAls, inTagen, mittwochIn, projektMitBaseline } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

const PERIODE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

test('Wesentliche Terminabweichung eskalieren: Vorschlag für die nächste Sitzung (UC-004 A1.2)', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const p = await projektMitBaseline(page, `Eskalation E2E ${Date.now()}`, { meilenstein: 'Rollout', meilensteinInTagen: 30 });
  const naechste = mittwochIn(35);
  await (await apiAls(page)).send('POST', `/v1/gremien/${p.gremium.id}/termine`, { datum: naechste });

  await page.goto(`/projekte/${p.nummer}/bericht?periode=${PERIODE}`);
  await expect(page.getByRole('heading', { name: /^Statusbericht / })).toBeVisible();
  const termin = page.getByLabel('Neuer Termin für Rollout');
  await termin.fill(inTagen(86));
  // Tab wechselt im Datumsfeld nur das Segment; gespeichert wird beim Verlassen des Felds
  await termin.blur();
  const warnung = page.locator('.sb-zeile-w').filter({ hasText: 'Wesentliche Abweichungen sind im Projektvertrag nachzuführen.' });
  await expect(warnung).toBeVisible();

  await warnung.getByRole('button', { name: 'Eskalieren' }).click();
  const dialog = page.getByRole('dialog', { name: 'Abweichung eskalieren?' });
  await expect(dialog.getByText('Die Eskalation erscheint als Traktandenvorschlag in der nächsten Sitzung des entscheidenden Gremiums', { exact: false })).toBeVisible();
  // Grund vorbelegt mit der Abweichung, Massnahme freiwillig
  await expect(dialog.getByLabel('Grund')).toHaveValue(/Rollout neu/);
  await dialog.getByLabel('Vorgeschlagene Massnahme (optional)').fill('Zusätzliche Ressourcen für den Rollout');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Eskalieren' }).click();
  await expect(page.getByText('Eskaliert. Die Eskalation steht als Vorschlag für die nächste Sitzung des Gremiums.')).toBeVisible();
  await expect(warnung.getByText(/^Eskaliert am .* · Vorschlag ans Gremium$/)).toBeVisible();
  await expect(warnung.getByRole('button', { name: 'Eskalieren' })).toHaveCount(0);
  // Der Bericht bleibt ein Entwurf
  await expect(page.getByRole('button', { name: 'Statusbericht einreichen' })).toBeEnabled();
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'light' });

  // Nächste Sitzung des Gremiums: die Eskalation steht in den Vorschlägen (K3 Schritt 1)
  await page.goto(`/gremien/${p.gremium.kuerzel}/sitzungen/${naechste}`);
  await page.getByRole('button', { name: 'Sitzung vorbereiten' }).click();
  const vorschlaege = page.getByRole('complementary', { name: 'Vorschläge' });
  await expect(vorschlaege.getByRole('button', { name: `Eskalation ${p.nummer} ${p.name} aufnehmen` })).toBeVisible();
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  await expectAccessible(page);
});
