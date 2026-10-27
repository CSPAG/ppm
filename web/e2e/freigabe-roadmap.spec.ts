/**
 * Abnahme AP-E6-2 (UI-39, UI-31; K6 Schritte 6–8; BC ZM.02.02, PP.04.03): Jahresziel mit Metrik, «Zur Freigabe vorlegen»
 * im Assistenten mit Wirkung, Sperre der Jahresziele, «Freigabe erfassen», Roadmap mit Vorschau publizieren und lesen;
 * axe hell, dunkel und 360 px; Leser:in sieht die Roadmap, publiziert aber nicht.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Eindeutiges Jahr und eindeutige Nummer je Lauf (Projekte hell, dunkel, schmal laufen gegen dieselbe Datenbank). */
const jahr = () => 2031 + Math.floor(Math.random() * 69);
const nummer = () => `${100 + Math.floor(Math.random() * 900)}.${Math.floor(Math.random() * 1000)}`;

test('Jahresziele vorlegen, Freigabe erfassen, Roadmap publizieren; barrierefrei', async ({ page }) => {
  const feld = `E2E Freigabe ${Date.now()}`;
  const nr = nummer();
  const j = jahr();
  await login(page, ANNA);
  await page.goto('/ziele/handlungsfelder?o=neu');
  await page.getByLabel('Bezeichnung').fill(feld);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: feld })).toBeVisible();
  await page.goto('/ziele/strategische-ziele?o=neu');
  await page.getByLabel('Handlungsfeld').selectOption({ label: feld });
  await page.getByLabel('Nummer').fill(nr);
  await page.getByLabel('Ziel', { exact: true }).fill('Kosten senken');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}`);

  // Zielzyklus mit einem Jahresziel mit Metrik und Zielwert
  await page.goto(`/ziele/${j}?o=ziel:${nr}`);
  const starten = page.getByRole('button', { name: 'Zielzyklus starten' });
  if (await starten.isVisible()) await starten.click();
  await page.getByRole('button', { name: 'Jahresziel hinzufügen' }).click();
  await page.getByLabel('Ziel', { exact: true }).fill('Einkauf bündeln');
  await page.getByLabel('Metrik').fill('Anteil gebündelter Einkauf');
  await page.getByLabel('Zielwert').fill('≥ 60 %');
  await page.getByRole('form', { name: 'Jahresziel hinzufügen' }).getByRole('button', { name: 'Jahresziel hinzufügen' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}.1`);

  // Assistent: Prüfung, Zusammenfassung, Wirkung, Vorlegen
  await page.getByRole('button', { name: 'Zur Freigabe vorlegen' }).click();
  await expect(page.getByRole('heading', { name: `Jahresziele ${j} zur Freigabe`, level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('cell', { name: feld })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText(/werden «zur Freigabe» gesetzt|wird «zur Freigabe» gesetzt/)).toBeVisible();
  await page.getByRole('button', { name: 'Zur Freigabe vorlegen' }).click();
  await expect(page.getByText(`Jahresziele ${j} liegen dem VR zur Freigabe vor`, { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jahresziel hinzufügen' })).toHaveCount(0);

  // Freigabe erfassen (UE-Recht über org-admin)
  await page.getByRole('button', { name: 'Freigabe erfassen' }).click();
  await expect(page.getByRole('radio', { name: 'Freigegeben' })).toBeChecked();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Freigabe erfassen' }).click();
  await expect(page.getByText(`Jahresziele ${j} in Kraft`, { exact: false }).first()).toBeVisible();

  // Roadmap: Vorschau mit Wirkung, publizieren, lesen
  await page.goto(`/portfolio/roadmap?jahr=${j}`);
  await page.getByRole('button', { name: 'Roadmap publizieren' }).click();
  await expect(page.getByText(`Alle angemeldeten Personen sehen die Roadmap ${j} lesend.`, { exact: false })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Roadmap publizieren' }).click();
  await expect(page.getByText(/^publiziert /)).toBeVisible();
  await expect(page.getByRole('heading', { name: feld, level: 2 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht die Roadmap, publiziert aber nicht', async ({ page }) => {
  await login(page, BRUNO, '/portfolio/roadmap');
  await expect(page.getByRole('heading', { name: /^Roadmap( \d{4})?$/, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roadmap publizieren' })).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);
});
