/**
 * Abnahme AP-E6-3 (BC ZM.03.01, UC-012 Schritte 1–2, K6 Schritt 10): Zielerreichung über die Navigation öffnen (zuletzt
 * abgeschlossenes Quartal), Stand eines Ziels erfassen, beim Verlassen der Zeile gespeichert, nach dem Neuladen da;
 * axe hell, dunkel und 360 px; Leser:in sieht die Tabelle ohne Eingabefelder.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

const nummer = () => `${100 + Math.floor(Math.random() * 900)}.${Math.floor(Math.random() * 1000)}`;

test('Stand erfassen, gespeichert beim Verlassen der Zeile; barrierefrei', async ({ page }) => {
  const feld = `E2E Feld ${Date.now()}`;
  const nr = nummer();
  await login(page, ANNA);
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(feld);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: feld })).toBeVisible();
  await page.goto('/ziele/strategische-ziele?o=neu');
  await page.getByLabel('Handlungsfeld').selectOption({ label: feld });
  await page.getByLabel('Nummer').fill(nr);
  await page.getByLabel('Ziel', { exact: true }).fill('Qualität sichern');
  await page.getByLabel('Metrik').fill('Zufriedenheit');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}`);

  // Navigation führt ins zuletzt abgeschlossene Quartal (/ziele/<jahr>/zielerreichung?quartal=qN)
  await page.goto('/ziele/zielerreichung');
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/ziele\/\d{4}\/zielerreichung$/);
  expect(new URL(page.url()).searchParams.get('quartal')).toMatch(/^q[1-4]$/);

  await page.goto('/ziele/2026/zielerreichung?quartal=q3');
  await expect(page.getByRole('heading', { name: 'Zielerreichung Q3 2026', level: 1 })).toBeVisible();
  const stand = page.getByLabel(`Neuer Stand ${nr}`);
  await stand.fill('74 %');
  await page.getByLabel(`Kommentar ${nr}`).fill('auf Kurs');
  await page.keyboard.press('Tab');
  await expect(page.getByText(`Stand ${nr} gespeichert.`)).toBeAttached();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await page.reload();
  await expect(page.getByLabel(`Neuer Stand ${nr}`)).toHaveValue('74 %');
  await expect(page.getByLabel(`Kommentar ${nr}`)).toHaveValue('auf Kurs');
});

test('Leser:in sieht die Zielerreichung, erfasst aber nichts', async ({ page }) => {
  await login(page, BRUNO, '/ziele/2026/zielerreichung?quartal=q3');
  await expect(page.getByRole('heading', { name: 'Zielerreichung Q3 2026', level: 1 })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);
});
