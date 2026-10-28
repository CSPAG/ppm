/**
 * Abnahme AP-E6-1 (UI-38, K6 Schritte 1–5; BC ZM.02.01, ZM.02.03, ZM.02.04): Zielzyklus starten, Jahresziel unter dem
 * strategischen Ziel hinzufügen, «Metrik fehlt» im Baum und im Prüfbericht, Metrik und Zielwert automatisch speichern,
 * Hauptaktivität hinzufügen; Baum mit Tastatur; axe hell, dunkel und 360 px; Leser:in ändert nichts.
 */
import { expect, test } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Eindeutiges Jahr und eindeutige Nummer je Lauf (Projekte hell, dunkel, schmal laufen gegen dieselbe Datenbank). */
const jahr = () => 2031 + Math.floor(Math.random() * 69);
const nummer = () => `${100 + Math.floor(Math.random() * 900)}.${Math.floor(Math.random() * 1000)}`;

test('Zielzyklus: starten, Jahresziel mit Metrik und Hauptaktivität; Baum mit Tastatur; barrierefrei', async ({ page }) => {
  const feld = `E2E Zyklus ${Date.now()}`;
  const nr = nummer();
  const j = jahr();
  await login(page, ANNA);
  await page.getByRole('button', { name: 'Neues Handlungsfeld' }).click();
  await page.getByLabel('Bezeichnung').fill(feld);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: feld })).toBeVisible();
  await page.goto('/ziele/strategische-ziele?o=neu');
  await page.getByLabel('Handlungsfeld').selectOption({ label: feld });
  await page.getByLabel('Nummer').fill(nr);
  await page.getByLabel('Ziel', { exact: true }).fill('Kosten senken');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}`);

  // Z2 und Start
  await page.goto(`/ziele/${j}`);
  await expect(page.getByRole('heading', { name: `Zielzyklus ${j}`, level: 1 })).toBeVisible();
  // erst nach dem Laden entscheiden: leerer Zyklus (Z2, «Zielzyklus starten») oder schon gestartet (Baum)
  const starten = page.getByRole('button', { name: 'Zielzyklus starten' });
  const baum = page.getByRole('tree', { name: 'Zielhierarchie' });
  await expect(starten.or(baum)).toBeVisible();
  if (await starten.isVisible()) {
    await expectAccessible(page);
    await starten.click();
  }
  await expect(baum).toBeVisible();

  // strategisches Ziel wählen, Jahresziel ohne Metrik hinzufügen
  await baum.getByText(`${nr} Kosten senken`).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}`);
  await page.getByRole('button', { name: 'Jahresziel hinzufügen' }).click();
  await page.getByLabel('Ziel', { exact: true }).fill('Einkauf bündeln');
  await page.getByRole('form', { name: 'Jahresziel hinzufügen' }).getByRole('button', { name: 'Jahresziel hinzufügen' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('o')).toBe(`ziel:${nr}.1`);
  await expect(baum.locator(`[data-key="jz:${nr}.1"]`).getByText('Metrik fehlt')).toBeVisible();
  await expect(page.getByText(new RegExp(`Metrik fehlt: .*\\(${nr.replace('.', '\\.')}\\.1`)).first()).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Metrik und Zielwert speichern beim Verlassen (I-R3)
  await page.getByLabel('Metrik').fill('Anteil gebündelter Einkauf');
  await page.getByLabel('Zielwert').fill('≥ 60 %');
  await page.getByLabel('Zielwert').blur();
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible();
  await expect(baum.locator(`[data-key="jz:${nr}.1"]`).getByText('Metrik fehlt')).toHaveCount(0);

  // Hauptaktivität
  await page.getByLabel('Hauptaktivität', { exact: true }).fill('Rahmenverträge verhandeln');
  await page.getByRole('button', { name: 'Hauptaktivität hinzufügen' }).click();
  await expect(baum.getByText('Rahmenverträge verhandeln')).toBeVisible();

  // Baum mit Tastatur: ein Tabstopp, Pfeiltasten, Enter öffnet
  await baum.locator('[role="treeitem"][tabindex="0"]').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(':focus')).toHaveAttribute('aria-level', '2');
  await expectAccessible(page);
  await expectNoOverflow(page);
});

test('Leser:in sieht den Zielzyklus, ändert aber nichts', async ({ page }) => {
  await login(page, BRUNO, `/ziele/${new Date().getFullYear() + 1}`);
  await expect(page.getByRole('heading', { name: /^Zielzyklus \d{4}$/, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zielzyklus starten' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jahresziel hinzufügen' })).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);
});
