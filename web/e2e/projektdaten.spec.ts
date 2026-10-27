/**
 * Abnahme AP-E0-6 PR 2: Register lesend in der Projektübersicht (UI-06). Testdaten über die API der Sitzung (BFF mit
 * CSRF-Token und Organisation aus /auth/me): Portfolio, Projekt, Meilenstein mit Baseline-Abweichung, Risiko, Kosten,
 * Abhängigkeit zu einem zweiten Projekt. Geprüft: Abschnitte, Beträge, beide Richtungen der Abhängigkeit; axe hell,
 * dunkel und 360 px. Leser:in sieht keine Projekte (kein `projekt:read`).
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, BRUNO, expectAccessible, expectNoOverflow, login } from './support.ts';

/** POST an die API mit den Kopfzeilen der Sitzung; liefert den Körper der Antwort. */
async function post(page: Page, pfad: string, body: unknown): Promise<{ id: string; nummer?: string }> {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken: string; tenant: { alias: string } };
  const r = await page.request.post(pfad, { data: body, headers: { 'X-CSRF-Token': me.csrfToken, 'X-Tenant': me.tenant.alias } });
  expect(r.status(), `${pfad}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}

test('Projektübersicht zeigt Meilensteine, Risiken, Kosten und Abhängigkeiten; barrierefrei', async ({ page }) => {
  const lauf = Date.now();
  await login(page, ANNA, '/projekte');
  const pf = await post(page, '/v1/portfolios', { kategorie: 'A', schluessel: `e2e-${lauf}`, name: `E2E ${lauf}` });
  const a = await post(page, '/v1/projekte', { name: `E2E Register ${lauf}`, portfolioId: pf.id });
  const b = await post(page, '/v1/projekte', { name: `E2E Nachbar ${lauf}`, portfolioId: pf.id });
  await post(page, `/v1/projekte/${a.id}/meilensteine`, { phase: 'P0', art: 'meilenstein', text: 'Initialisierung abgeschlossen', terminAktuell: '2027-03-31' });
  await post(page, `/v1/projekte/${a.id}/risiken`, { text: 'Fachkräftemangel', wahrscheinlichkeit: 'hoch', auswirkung: 'mittel', massnahme: 'Pool aufbauen' });
  await post(page, `/v1/projekte/${a.id}/kosten`, { phase: 'P1', art: 'capex', text: 'Server', prognose: 250000 });
  await post(page, `/v1/projekte/${a.id}/abhaengigkeiten`, { zuProjektId: b.id, text: 'Gemeinsame Schnittstelle', ansprechperson: 'L. Brunner' });

  await page.goto(`/projekte/${a.nummer}`);
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(`E2E Register ${lauf}`) })).toBeVisible();
  const ms = page.getByRole('table', { name: 'Meilensteine, Lieferergebnisse und Kommunikationsmassnahmen' });
  await expect(ms.getByRole('row', { name: /Initialisierung abgeschlossen/ })).toBeVisible();
  await expect(page.getByRole('table', { name: /Risiken des Projekts/ }).getByText('Fachkräftemangel')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Kosten nach CAPEX und OPEX' }).getByRole('row', { name: /Total/ })).toContainText("250'000");
  await expect(page.getByText('Dieses Projekt hängt ab von')).toBeVisible();
  await expect(page.getByText(b.nummer!)).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Beim anderen Projekt erscheint dieselbe Abhängigkeit als eingehend (UC-002 Schritt 5)
  await page.goto(`/projekte/${b.nummer}`);
  await expect(page.getByText('Von diesem Projekt hängt ab')).toBeVisible();
  await expect(page.getByText(a.nummer!)).toBeVisible();
  await expectAccessible(page);
});

test('Leser:in ohne Projektrecht sieht keine Projektakte', async ({ page }) => {
  await login(page, BRUNO, '/ziele/handlungsfelder');
  await page.goto('/projekte/2026-001');
  await expect(page.getByRole('table', { name: 'Kosten nach CAPEX und OPEX' })).toHaveCount(0);
  await expectAccessible(page);
});
