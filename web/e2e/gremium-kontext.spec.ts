/**
 * Gremium im Kopf des Arbeitsraums Gremien (IA «Kontext im Kopf», `/gremien/prat`; I-N5) in hell, dunkel und 360 px:
 * `/gremien/<kürzel>` führt auf dessen Sitzungen, die Wahl im Kopf wechselt das Gremium in der Adresse, die Entscheide
 * übernehmen es (`?gremium=`), die alte Adresse `/gremien/sitzungen` bleibt gültig. Zwei Gremien je Lauf über die API.
 */
import { expect, test, type Page } from '@playwright/test';
import { ANNA, expectAccessible, expectNoOverflow, login } from './support.ts';

/** Aufruf der API mit der Sitzung der Seite (CSRF-Token aus /auth/me, Organisation «demo»). */
async function apiPost(page: Page, url: string, data: unknown) {
  const me = await (await page.request.get('/auth/me')).json() as { csrfToken?: string };
  const r = await page.request.post(url, { data, headers: { 'x-csrf-token': me.csrfToken ?? '', 'x-tenant': 'demo', 'idempotency-key': crypto.randomUUID() } });
  expect(r.status(), `${url}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}

test('Gremium im Kopf: Einstieg je Gremium, Wahl in der Adresse, Entscheide übernehmen es; barrierefrei', async ({ page }) => {
  const lauf = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await login(page, ANNA);
  const [a, b] = [`ka${lauf}`, `kb${lauf}`];
  for (const k of [a, b]) {
    const portfolio = await apiPost(page, '/v1/portfolios', { kategorie: 'B', schluessel: `e2e-${k}`, name: `E2E ${k}` });
    await apiPost(page, '/v1/gremien', { portfolioId: portfolio.id, kuerzel: k, name: `Ausschuss ${k}`, art: 'entscheidend' });
  }

  // Einstieg je Gremium: /gremien/<kürzel> führt auf dessen Sitzungen, das Gremium steht im Kopf
  await page.goto(`/gremien/${a}`);
  await expect(page).toHaveURL(new RegExp(`/gremien/${a}/sitzungen$`));
  const wahl = page.getByLabel('Gremium', { exact: true });
  await expect(wahl).toHaveValue(a);
  await expect(page.getByRole('heading', { name: new RegExp(`^${a.toUpperCase()}`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${b.toUpperCase()}`) })).toHaveCount(0);
  // Bereich «Sitzungen» bleibt in der Leiste markiert (Leiste ab 1024 px)
  if ((page.viewportSize()?.width ?? 0) >= 1024) await expect(page.getByRole('link', { name: 'Sitzungen' }).first()).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);
  await expectNoOverflow(page);

  // Wahl im Kopf wechselt das Gremium in der Adresse
  await wahl.selectOption(b);
  await expect(page).toHaveURL(new RegExp(`/gremien/${b}/sitzungen$`));
  await expect(page.getByRole('heading', { name: new RegExp(`^${b.toUpperCase()}`) })).toBeVisible();

  // Entscheide übernehmen das gewählte Gremium
  await page.goto('/gremien/entscheide');
  await expect(page).toHaveURL(new RegExp(`/gremien/entscheide\\?gremium=${b}$`));
  await expect(page.getByLabel('Gremium', { exact: true })).toHaveValue(b);
  await expectAccessible(page);
  await expectNoOverflow(page);

  // «Alle Gremien»: die alte Adresse bleibt gültig und zeigt alle
  await page.getByLabel('Gremium', { exact: true }).selectOption({ label: 'Alle Gremien' });
  await expect(page).toHaveURL(/\/gremien\/entscheide$/);
  await page.goto('/gremien/sitzungen');
  await expect(page).toHaveURL(/\/gremien\/sitzungen$/);
  await expect(page.getByRole('heading', { name: new RegExp(`^${a.toUpperCase()}`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`^${b.toUpperCase()}`) })).toBeVisible();
});
