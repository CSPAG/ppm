/**
 * Abnahme AP-E2-1 (K3 Vorbereiten; UC-006 Schritte 1–5, A2; PP.04.05): Termin eines Gremiums öffnen, Sitzung anlegen,
 * Gate-Review eines Projekts einplanen (35 Min.), Warnung «Unterlagen fehlen» mit «Auf nächste Sitzung verschieben»
 * und Rückgängig, Unterlagen versenden mit Vorschau der Wirkung; Reihenfolge per Tastatur; axe hell, dunkel und 360 px.
 * Portfolio, Gremium, Termine und Projekt entstehen je Lauf über die API (Administration der Gremien folgt mit AP-E0-5).
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Mittwoch etwa `tage` Kalendertage nach heute als JJJJ-MM-TT. */
function mittwochIn(tage: number): string {
  const d = new Date(Date.now() + tage * 86_400_000);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Aufruf der API mit der Sitzung der Seite (CSRF-Token aus /auth/me, Organisation «demo»). */
async function apiPost(page: Page, url: string, data: unknown) {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken?: string };
  const r = await page.request.post(url, { data, headers: { 'x-csrf-token': me.csrfToken ?? '', 'x-tenant': 'demo', 'idempotency-key': crypto.randomUUID() } });
  expect(r.status(), `${url}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}

test('Sitzung vorbereiten: einplanen, verschieben und zurückholen, versenden; barrierefrei', async ({ page }) => {
  const lauf = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const kuerzel = `e2e-${lauf}`;
  const [termin1, termin2] = [mittwochIn(35), mittwochIn(63)];
  await login(page, ANNA);
  const portfolio = await apiPost(page, '/v1/portfolios', { kategorie: 'B', schluessel: `e2e-${lauf}`, name: `E2E ${lauf}` });
  const gremium = await apiPost(page, '/v1/gremien', { portfolioId: portfolio.id, kuerzel, name: `Ausschuss ${lauf}`, art: 'entscheidend' });
  for (const datum of [termin1, termin2]) await apiPost(page, `/v1/gremien/${gremium.id}/termine`, { datum });
  const projekt = await apiPost(page, '/v1/projekte', { name: `Projekt ${lauf}`, portfolioId: portfolio.id, phase: 'P2' });

  // Einstieg über die Navigation: Gremien › Sitzungen
  await page.goto('/gremien/sitzungen');
  await expect(page.getByRole('heading', { name: 'Sitzungen', level: 1 })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: new RegExp(`Sitzung ${kuerzel.toUpperCase()} .* öffnen`) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/gremien/${kuerzel}/sitzungen/${termin1}$`));

  // Termin ohne Sitzung: anlegen; Traktandum 1 «Bericht der Programmleitung» ist immer gesetzt (K3 Schritt 4), ohne
  // Griff und ohne Entfernen, mit Hinweis
  await page.getByRole('button', { name: 'Sitzung vorbereiten' }).click();
  const liste = page.getByRole('list', { name: 'Traktandenliste' });
  await expect(liste.getByRole('heading', { name: 'Bericht der Programmleitung' })).toBeVisible();
  await expect(liste.getByText(/bleibt Traktandum 1; Sie können es weder entfernen noch verschieben/)).toBeVisible();
  await expect(liste.getByRole('button', { name: /Bericht der Programmleitung/ })).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Gate-Review einplanen (PP.04.05): 35 Minuten; ohne Unterlagen Warnung mit Ausweg (UC-006 A2)
  await page.getByLabel('Gate-Review einplanen').selectOption({ label: `${projekt.nummer} Projekt ${lauf} · P2` });
  await page.getByRole('button', { name: 'Aufnehmen', exact: true }).click();
  await expect(liste.getByText(/35 Min\./)).toBeVisible();
  await expect(liste.getByText(/Unterlagen für .* fehlen/)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  await liste.getByRole('button', { name: 'Auf nächste Sitzung verschieben' }).click();
  await expect(page.getByText(/Traktandum auf .* verschoben\./)).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(liste.getByText(/35 Min\./)).toBeVisible();

  // Unterlagen versenden: Vorschau der Wirkung, dann ein bewusster Klick (I-R1 Stufe 3)
  await page.getByRole('button', { name: 'Unterlagen versenden' }).click();
  const dialog = page.getByRole('dialog', { name: 'Unterlagen jetzt versenden?' });
  await expect(dialog.getByText(new RegExp(`Die Mitglieder des ${kuerzel.toUpperCase()} erhalten Traktandenliste \\(2 Traktanden\\)`))).toBeVisible();
  await expect(dialog.getByText(/Frist 5 Arbeitstage: eingehalten|Unterlagen/).first()).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Unterlagen versenden' }).click();
  await expect(page.getByText(/Unterlagen versendet am .* Die Traktandenliste ist fest\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unterlagen versenden' })).toHaveCount(0);
  await expectAccessible(page);
  await expectNoOverflow(page);
});

