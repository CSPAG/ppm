/** Anmeldung über Keycloak und Prüfungen der UX-Definition of Done (docs/ux/rahmen/pruefung.md) für alle Tests. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

export interface Person { user: string; password: string }

/** Testpersonen aus scripts/keycloak-setup.ts (Organisationen «demo» und «muster»). */
export const ANNA: Person = { user: process.env.E2E_USER ?? 'anna@demo.example', password: process.env.E2E_PASSWORD ?? 'ppm-demo' };
/** Rolle «leser» in «demo»: sieht, ändert aber nichts. */
export const BRUNO: Person = { user: process.env.E2E_USER_C ?? 'bruno@demo.example', password: process.env.E2E_PASSWORD_C ?? 'ppm-demo' };
export const MAX: Person = { user: process.env.E2E_USER_B ?? 'max@muster.example', password: process.env.E2E_PASSWORD_B ?? 'ppm-demo' };

export async function login(page: Page, p: Person, path = '/ziele/handlungsfelder') {
  await page.goto(path);
  // Anmeldeseite von Keycloak (andere Herkunft), danach zurück in die App
  const user = page.locator('#username');
  try {
    await user.waitFor({ timeout: 15_000 });
  } catch (e) {
    const text = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Anmeldeseite von Keycloak nicht erreicht: ${page.url()}\n${text.slice(0, 500)}`, { cause: e });
  }
  await user.fill(p.user);
  // Mit Organisationen meldet Keycloak zweistufig an (zuerst E-Mail, dann Passwort); ohne einstufig
  const password = page.locator('#password');
  if (!(await password.isVisible())) await page.locator('#kc-login').click();
  await password.fill(p.password);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** axe ohne Befund (WCAG 2.2 AA); hell und dunkel über die Projekte der Konfiguration oder `page.emulateMedia`. */
export async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Weitere Breiten der UX-DoD: Tablet und breiter Bildschirm (docs/ux/rahmen/pruefung.md, «schmalste Breite der Rolle»). */
const BREITEN = [768, 1440] as const;

/**
 * Nichts ragt über den Rand der aktuellen Breite (Q-B6, schmalste Breite 360 px). Im Projekt «hell» zusätzlich bei 768
 * und 1440 px; danach gilt wieder die Breite des Projekts. «dunkel» und «schmal» messen nur ihre eigene Breite.
 */
export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (test.info().project.name !== 'hell') return;
  const vorher = page.viewportSize()!;
  try {
    for (const width of BREITEN) {
      await page.setViewportSize({ width, height: vorher.height });
      // nach dem Umbruch neu messen, bis das Layout steht
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `kein Überlauf bei ${width} px` })
        .toBeLessThanOrEqual(width);
    }
  } finally {
    await page.setViewportSize(vorher);
  }
}

/**
 * Nur mit der Tastatur: Tab, bis `target` den Fokus hat (höchstens `max` Schritte), und der Fokus ist sichtbar
 * (Umriss oder Schatten). Danach z. B. `page.keyboard.press('Enter')`.
 */
export async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(el => el === document.activeElement)) {
      const sichtbar = await target.evaluate(el => {
        const s = getComputedStyle(el);
        return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      });
      expect(sichtbar, 'Fokus sichtbar').toBe(true);
      return;
    }
  }
  throw new Error(`Mit ${max}× Tab nicht erreicht: ${target.toString()}`);
}

/**
 * Jahre der Zielzyklen je Spec und Projekt der Konfiguration (hell, dunkel, schmal laufen gegen dieselbe Datenbank).
 * Getrennt, weil freigabe-roadmap.spec den Zyklus seines Jahres freigibt: danach nimmt er keine Jahresziele mehr an, und
 * zog zielzyklus.spec zufällig dasselbe Jahr, fehlte «Jahresziel hinzufügen» bis zum Zeitlimit (früheres Flackern).
 */
const ZIELJAHRE = { freigabe: 2031, zielzyklus: 2064 } as const;
const PROJEKTE = ['hell', 'dunkel', 'schmal'];
export function zieljahre(spec: keyof typeof ZIELJAHRE, projekt: string): number[] {
  const breite = 11;
  const von = ZIELJAHRE[spec] + Math.max(0, PROJEKTE.indexOf(projekt)) * breite;
  return Array.from({ length: breite }, (_, i) => von + i);
}

/** Ein Jahr aus `jahre` ohne gestarteten Zielzyklus (sonst wäre er von einem früheren Versuch schon vorgelegt). */
export async function freiesZieljahr(page: Page, jahre: number[]): Promise<number> {
  const me = await (await page.request.get('/auth/me')).json() as { tenant: { alias: string } };
  const start = Math.floor(Math.random() * jahre.length);
  for (let i = 0; i < jahre.length; i++) {
    const j = jahre[(start + i) % jahre.length]!;
    const r = await page.request.get(`/v1/ziele/${j}`, { headers: { 'x-tenant': me.tenant.alias } });
    expect(r.status(), `GET /v1/ziele/${j}`).toBe(200);
    if ((await r.json() as { zieljahr: unknown }).zieljahr === null) return j;
  }
  throw new Error(`Kein Jahr ohne Zielzyklus in ${jahre[0]}–${jahre.at(-1)}`);
}
