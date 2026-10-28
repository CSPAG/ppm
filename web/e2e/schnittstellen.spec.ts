/**
 * Abnahme UI-49, UI-50 (AP-E7-3; UC-018 Schritte 3–5): Schnittstelle einrichten (inaktiv, ohne Testlauf ins Netz) und
 * den Rhythmus ändern; die Änderung steht mit altem und neuem Wert im Änderungsprotokoll; axe ohne Befund, kein Überlauf
 * (hell, dunkel, 360 px); Leser:in sieht beide Bereiche nicht.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

// Die Projekte laufen parallel auf derselben Datenbank: je Projekt ein eigener Eintrag des Katalogs (je Umsystem und
// Daten höchstens eine Schnittstelle). Adresse als öffentliche IP: keine Namensauflösung, kein Testlauf (inaktiv).
const UMSYSTEM: Record<string, RegExp> = { hell: /^ERP · Ist-Kosten/, dunkel: /^HR-System · Personal/, schmal: /^Budgetprozess · Jahresbedarf/ };

test('Schnittstelle einrichten und ändern; Änderung im Änderungsprotokoll; barrierefrei', async ({ page }, info) => {
  const name = UMSYSTEM[info.project.name] ?? UMSYSTEM.hell!;
  await login(page, ANNA, '/administration/schnittstellen');
  await expect(page.getByRole('heading', { name: 'Schnittstellen', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Schnittstellen' }).or(page.getByText(/Noch keine Schnittstelle eingerichtet/))).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  const zeile = page.getByRole('row', { name });
  if (!(await zeile.count())) {
    await page.getByRole('button', { name: 'Schnittstelle einrichten' }).first().click();
    const neu = page.getByRole('dialog', { name: 'Neue Schnittstelle' });
    const option = await neu.getByRole('option', { name }).getAttribute('value');
    await neu.getByLabel('Umsystem und Daten').selectOption(option!);
    await neu.getByLabel('Adresse', { exact: true }).fill('https://1.1.1.1/ppm-e2e');
    await neu.getByLabel('Aktiv', { exact: true }).uncheck();
    await expectAccessible(page);
    await neu.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Schnittstelle eingerichtet.')).toBeVisible();
  } else {
    await zeile.getByRole('button').first().click();
  }
  const drawer = page.getByRole('dialog', { name });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/[?&]o=[0-9a-f-]{36}/);
  await expect(drawer.getByText('Laufprotokoll')).toBeVisible();
  await expectAccessible(page);

  await drawer.getByRole('button', { name: 'Bearbeiten' }).click();
  const rhythmus = page.getByLabel('Rhythmus');
  const neuerWert = (await rhythmus.inputValue()) === 'woechentlich' ? 'taeglich' : 'woechentlich';
  await rhythmus.selectOption(neuerWert);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Änderungen gespeichert.')).toBeVisible();

  await page.goto('/administration/aenderungsprotokoll?objekt=schnittstelle');
  await expect(page.getByRole('heading', { name: 'Änderungsprotokoll', level: 1 })).toBeVisible();
  const anzeige = { taeglich: 'taeglich', woechentlich: 'woechentlich' }[neuerWert];
  await expect(page.getByRole('table', { name: 'Änderungen' }).getByText(new RegExp(`→ ${anzeige}`)).first()).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht Schnittstellen und Änderungsprotokoll nicht in der Navigation', async ({ page }) => {
  await login(page, BRUNO);
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Schnittstellen' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Änderungsprotokoll' })).toHaveCount(0);
});
