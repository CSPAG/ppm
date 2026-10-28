/**
 * UX-Prüfung UI-46 «Phasenmodell» (Administration; BC AM.02.03, UC-017 Schritt 3): Die Version in Kraft ist gesperrt
 * (Z9) mit Hinweis auf den Entwurf, Abschnitte in der Adresse (`?v=`, `?e=`, I-N5), Fristen und Toleranzen sichtbar;
 * axe hell, dunkel, 360 px und ohne Überlauf. Nur lesend: Ein Entwurf hier stünde den parallelen Specs im Weg, die ein
 * Phasenmodell in Kraft setzen (daten.ts).
 */
import { expect, test } from '@playwright/test';
import { apiAls, phasenmodellMitToleranzen } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

test('Phasenmodell in Kraft: gesperrt, Abschnitte in der Adresse, barrierefrei', async ({ page }) => {
  await login(page, MAX, '/administration/phasenmodell');
  const a = await apiAls(page);
  await phasenmodellMitToleranzen(a);
  const m = await (await a.get('/v1/phasenmodelle/aktuell')).json() as { id: string; nummer: number };

  await page.goto(`/administration/phasenmodell?v=${m.id}`);
  await expect(page.getByRole('heading', { level: 1, name: `Phasenmodell Version ${m.nummer}` })).toBeVisible();
  await expect(page.getByText(`Version ${m.nummer} ist in Kraft und unveränderlich.`, { exact: false })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.goto(`/administration/phasenmodell?v=${m.id}&e=fristen`);
  await expect(page.getByRole('heading', { level: 2, name: 'Fristen und Toleranzen' })).toBeVisible();
  await expect(page.getByText('Termin', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'In Kraft setzen' })).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Erste Phase über die Navigation (breit) bzw. die Auswahl (schmal); die Adresse folgt (I-N5)
  const auswahl = page.getByLabel('Abschnitt', { exact: true });
  if (await auswahl.isVisible()) await auswahl.selectOption('P0');
  else await page.getByRole('navigation').getByRole('button', { name: 'Initialisierung', exact: true }).click();
  await expect(page).toHaveURL(/[?&]e=P0/);
  await expectAccessible(page);
});
