/**
 * UX-Prüfung UI-05 «Meine Projekte» (Seitentyp Liste + Schublade, I-L1, I-N5): Projekt mit eigenen Rollen über die API,
 * Suche und Filter in der Adresse, leer durch Filter mit «Filter zurücksetzen» (Z3), Schublade `?o=<nr>` mit Escape und
 * Sprung in die Projektakte; axe hell, dunkel, 360 px und ohne Überlauf (dazu 768 und 1440 px über `expectNoOverflow`).
 */
import { expect, test } from '@playwright/test';
import { apiAls, projekt } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

test('Meine Projekte: Suche, Filter, Schublade und Projektakte, barrierefrei', async ({ page }) => {
  await login(page, MAX, '/projekte');
  const name = `E2E Meine Projekte ${Date.now()}`;
  const p = await projekt(await apiAls(page), name, 'P0', ['pl']);

  await page.goto(`/projekte?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole('heading', { name: 'Projekte', level: 1 })).toBeVisible();
  const zeile = page.getByRole('button', { name: `${p.nummer} ${name} öffnen` });
  await expect(zeile).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Filter in der Adresse (I-N5); ohne Treffer Z3 mit Ausweg
  await page.getByLabel('Meine Rolle').selectOption({ label: 'Sponsor' });
  await expect(page).toHaveURL(/[?&]rolle=sponsor/);
  await expect(page.getByText('Kein Projekt passt zu deiner Suche oder den Filtern.')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).first().click();
  await expect(page).not.toHaveURL(/[?&](rolle|q)=/);
  await page.getByRole('searchbox').fill(p.nummer);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${p.nummer}`));
  await page.getByLabel('Meine Rolle').selectOption({ label: 'Projektleitung' });
  await expect(zeile).toBeVisible();

  // Schublade mit Adresse, Escape schliesst sie
  await zeile.click();
  const schublade = page.getByRole('dialog', { name: `${p.nummer} · ${name}` });
  await expect(schublade).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]o=${p.nummer}`));
  await expect(schublade.getByText('Projektleitung', { exact: true }).first()).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(schublade).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]o=/);

  // Direkt über die Adresse und weiter in die Projektakte
  await page.goto(`/projekte?o=${p.nummer}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Projektakte öffnen' }).click();
  await expect(page).toHaveURL(new RegExp(`/projekte/${p.nummer}`));
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
});
