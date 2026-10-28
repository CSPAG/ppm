/**
 * UX-Prüfung UI-12 «Quality-Check» (K2 Schritt 7; UC-002 Schritt 9, A5): eingereichter Entwurf über die API; Kommentar
 * je Kapitel bleibt beim Sprung ins Kapitel und zurück erhalten (Z7, I-R3); «Zurück an die Projektleitung» mit Wirkung
 * davor; axe hell, dunkel, 360 px und ohne Überlauf (dazu 768 und 1440 px über `expectNoOverflow`).
 */
import { expect, test } from '@playwright/test';
import { apiAls, gremium, inTagen, mittwochIn, phasenmodellMitToleranzen, projekt } from './daten.ts';
import { expectAccessible, expectNoOverflow, login, MAX } from './support.ts';

test('Quality-Check: Kommentar bleibt beim Sprung ins Kapitel, Rückmeldung an die PL; barrierefrei', async ({ page }) => {
  await login(page, MAX, '/eingang');
  const a = await apiAls(page);
  await phasenmodellMitToleranzen(a);
  const p = await projekt(a, `Prüfen E2E ${Date.now()}`, 'P0');
  await gremium(a, p.portfolioId, [mittwochIn(7)], ['P0_P1']);
  const e = await a.send<{ version: { id: string } }>('POST', `/v1/projekte/${p.id}/vertrag/entwuerfe`, { anlass: 'initial' });
  const v = e.body.version.id;
  const k7 = await a.get(`/v1/vertragsversionen/${v}/kapitel/7`);
  const inhalt = (await k7.json() as { inhalt: Record<string, unknown> }).inhalt;
  inhalt.meilensteine = [{ registerId: null, phase: 'P1', art: 'meilenstein', text: 'Pilot', termin: inTagen(60) }];
  await a.send('PUT', `/v1/vertragsversionen/${v}/kapitel/7`, { inhalt }, { 'if-match': k7.headers()['etag'] ?? '' });
  const d = await a.get(`/v1/vertragsversionen/${v}`);
  await a.send('POST', `/v1/vertragsversionen/${v}/einreichen`, undefined, { 'if-match': d.headers()['etag'] ?? '' });

  await page.goto(`/projekte/${p.nummer}/vertrag/pruefen`);
  await expect(page.getByRole('heading', { level: 2, name: /^Quality-Check · Version/ })).toBeVisible();
  await expectAccessible(page);
  await expectNoOverflow(page);

  const feld = page.getByLabel('Rückmeldung zu Kapitel 9 Ressourcen');
  await feld.fill('Personalbedarf in FTE fehlt');
  await page.getByRole('link', { name: 'Kapitel 9 ansehen' }).click();
  await expect(page).toHaveURL(new RegExp(`/projekte/${p.nummer}/vertrag\\?.*kapitel=9`));
  await page.goBack();
  await expect(feld).toHaveValue('Personalbedarf in FTE fehlt');
  await expect(page.getByText('1 Kapitel mit Rückmeldung')).toBeVisible();

  await page.getByRole('button', { name: 'Zurück an die Projektleitung' }).click();
  await expect(page.getByText('Zurück an die Projektleitung.', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zurück an die Projektleitung' })).toHaveCount(0);
  await expectAccessible(page);
});
