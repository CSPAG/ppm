/** Anmeldung über Keycloak, Prüfung mit axe (WCAG 2.2 AA) und Hilfen für Testdaten. */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD ?? 'Test1234!';
const APP = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:8090').origin;

/** Testpersonen (scripts/keycloak-setup.ts im Root). */
export const PEOPLE = {
  anna: 'anna@demo.example',     // org-admin in «demo»
  bruno: 'bruno@demo.example',   // viewer in «demo»
  max: 'max@muster.example',     // Organisation «muster»
  betrieb: 'betrieb@ppm.example', // platform-admin ohne Organisation
} as const;

/** Öffnet die App, meldet über das Formular von Keycloak an und wartet auf die Rückkehr in die App. */
export async function login(page: Page, email: string, path = '/projekte'): Promise<void> {
  await page.goto(path);
  // Keycloak 26 mit Organisationen: zuerst nur die E-Mail (identity-first), danach das Passwort auf einer zweiten Seite
  await page.locator('#username').fill(email);
  const password = page.locator('#password');
  if (!(await password.isVisible())) {
    await page.locator('#kc-login').click();
    await password.waitFor();
  }
  await password.fill(PASSWORD);
  await page.locator('#kc-login').click();
  await page.waitForURL(url => url.origin === APP && !url.pathname.startsWith('/auth/'));
}

/** Neuer Browser-Kontext (eigene Sitzung) mit angemeldeter Person. */
export async function loggedIn(browser: Browser, email: string, path = '/projekte'): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, path);
  return page;
}

/** axe mit den Regeln für WCAG 2.0–2.2 A/AA; erwartet keine Verstösse. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const found = result.violations.map(v => `${v.id}: ${v.help} (${v.nodes.map(n => n.target.join(' ')).join(', ')})`);
  expect(found, `axe: ${label}`).toEqual([]);
}

/** Hell oder dunkel wählen wie über den Knopf (localStorage `ppm.theme`) und neu laden. */
export async function useTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate(t => { window.localStorage.setItem('ppm.theme', t); }, theme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Eindeutige Bezeichnung für Testdaten. */
export const unique = (prefix: string): string => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Legt über die Oberfläche ein Projekt an und gibt seine ID zurück (aus `?o=`). */
export async function createProjekt(page: Page, label: string, o: { beginn?: string; ende?: string } = {}): Promise<string> {
  await page.goto('/projekte');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' });
  await dialog.getByRole('textbox', { name: /Bezeichnung/ }).fill(label);
  if (o.beginn) await dialog.getByLabel('Beginn', { exact: true }).fill(o.beginn);
  if (o.ende) await dialog.getByLabel('Ende', { exact: true }).fill(o.ende);
  await dialog.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('dialog', { name: label })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('o');
  expect(id).toBeTruthy();
  return id!;
}
